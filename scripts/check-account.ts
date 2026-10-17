import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bolna } from "./lib/bolna.js";
import { repoRoot } from "./lib/env.js";

const account = await bolna("GET", "/user/me");
const dir = join(repoRoot, "runs/phase0");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "account.json"), JSON.stringify(account, null, 2));

const record = account && typeof account === "object" ? (account as Record<string, unknown>) : {};
const wallet = record.wallet ?? record.balance ?? record.credits;
const concurrency = record.concurrency ?? record.concurrency_limit;
console.log("wallet:", wallet ?? "(field not found, see runs/phase0/account.json)");
console.log("concurrency:", concurrency ?? "(field not found)");
console.log(JSON.stringify(account, null, 2));
