import { eq } from "drizzle-orm";
import { runs, targets } from "../db/schema";
import type { Database } from "../db/db.module";

const CLAIM_GAP_MS = 2 * 60 * 1000;
const OCCUPY_MS = 30 * 60 * 1000;

export class LineBusyError extends Error {
  constructor() {
    super("The test bots are in use. Kindly wait.");
  }
}

/**
 * True while another browser still owns the shared line.
 * The lock covers the whole test, from the moment it starts until the run is done.
 * A lock with no run row only holds for the short claim gap. A lock older than 30 minutes is dropped.
 */
export function lineIsBusy(input: {
  lockRunId: string | null;
  lockAt: Date | null;
  runStatus: string | null;
  now: number;
  claimRunId: string;
}): boolean {
  if (!input.lockRunId || input.lockRunId === input.claimRunId) return false;
  const age = input.lockAt ? input.now - input.lockAt.getTime() : 0;
  if (age >= OCCUPY_MS) return false;
  if (!input.runStatus) return age < CLAIM_GAP_MS;
  return input.runStatus !== "done";
}

/** Claim the shared target row, or refuse when another session's test is still going. Pass null to check without claiming. */
export async function reserveSharedLine(db: Database, phone: string, runId: string | null, session: string | null = null): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(targets).where(eq(targets.phoneE164, phone)).limit(1).for("update");
    if (!row) return;
    const [run] = row.lineLockRunId
      ? await tx.select({ status: runs.status }).from(runs).where(eq(runs.id, row.lineLockRunId)).limit(1)
      : [];
    if (
      lineIsBusy({
        lockRunId: row.lineLockRunId,
        lockAt: row.lineLockAt,
        runStatus: run?.status ?? null,
        now: Date.now(),
        claimRunId: runId ?? "",
      })
    ) {
      throw new LineBusyError();
    }
    if (!runId) return;
    await tx
      .update(targets)
      .set({ lineLockRunId: runId, lineLockAt: new Date(), lineLockSession: session })
      .where(eq(targets.id, row.id));
  });
}

export async function clearSharedLine(db: Database, runId: string): Promise<void> {
  await db
    .update(targets)
    .set({ lineLockRunId: null, lineLockAt: null, lineLockSession: null })
    .where(eq(targets.lineLockRunId, runId));
}

/** Drop the lock only after the run itself is marked done. One call ending is not the end of the test. */
export async function releaseSharedLine(db: Database, runId: string, status: string | null): Promise<void> {
  if (!status) return;
  const [run] = await db.select({ status: runs.status }).from(runs).where(eq(runs.id, runId)).limit(1);
  if (run?.status !== "done") return;
  await clearSharedLine(db, runId);
}

/** What the workspace should show. `runId` is returned only to the browser that started the test. */
export async function readLineOccupancy(
  db: Database,
  phone: string,
  session: string | null,
): Promise<{ busy: boolean; yours: boolean; runId: string | null }> {
  const [row] = await db.select().from(targets).where(eq(targets.phoneE164, phone)).limit(1);
  if (!row?.lineLockRunId) return { busy: false, yours: false, runId: null };
  const [run] = await db.select({ status: runs.status }).from(runs).where(eq(runs.id, row.lineLockRunId)).limit(1);
  const busy = lineIsBusy({
    lockRunId: row.lineLockRunId,
    lockAt: row.lineLockAt,
    runStatus: run?.status ?? null,
    now: Date.now(),
    claimRunId: "",
  });
  const yours = busy && Boolean(session) && row.lineLockSession === session;
  return { busy, yours, runId: yours ? row.lineLockRunId : null };
}
