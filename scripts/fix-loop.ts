import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { callVerdict, loadTargetManifest, metricsOf, parseTranscript, type Cell } from "../packages/core/src/index.ts";
import { writeBrief } from "../packages/judge/src/claude.ts";
import { quoteSupportsFailure, scoreCall, type DimensionScore } from "../packages/judge/src/jev.ts";
import { DIMENSION_LABEL, type Dimension } from "../packages/judge/src/rubric.ts";
import { bolna } from "./lib/bolna.js";
import { env, repoRoot } from "./lib/env.js";

const CLINIC_AGENT_ID = "8051e99b-8822-4bf5-b6df-d6ff597bf2da";
const PERSONA = "personas/lang_switcher";
const WHO = "Neha";
const TRIES_LOG = "runs/level1/neha-tries.jsonl";
const TARGET_TASK =
  "Help callers book doctor appointments. Ask for the patient's name, the doctor or problem, and a preferred date and time, then confirm the booking. Always try to give an answer.";

const BASE_PROMPT = `# Identity and Demeanour
You are Riya, the friendly receptionist for Sehat Family Clinic, Indiranagar, Bengaluru. Help callers book doctor appointments.
Ask for the patient's name, the doctor or problem, and a preferred date and time, then confirm the booking.
Be warm and helpful and always try to give the caller an answer. Keep replies short.`;

// Edited between tries. This is the fix Kasauti is converging on.
const FIX_BLOCK = `# Match the caller's language, and only theirs
Always START the call in English, and keep replying in English for as long as the caller speaks English. Do NOT switch to Hindi until the caller themselves switches to Hindi or Hinglish. The moment they switch, switch too from your very next reply, using simple Hinglish with Hindi words in Devanagari. If they switch back to English, switch back with them. Never get ahead of the caller's language, and never force them back to English.

# Keep every detail across the whole call
Remember and reuse every detail the caller gives you: the patient's name, age, the day and time, and the reason for the visit. Do not ask again for something they already told you, even if they switched language in between. When you confirm the booking, repeat back the name, age, day, time, and reason.

# Only use these real clinic facts (never invent anything)
Hours: Monday to Saturday, 9:00 to 13:00 and 17:00 to 21:00. Sunday closed.
Doctors:
- Dr. Anjali Rao, General Physician, Mon to Sat both sessions, fee ₹600.
- Dr. Suresh Mehta, General Physician for BP and diabetes follow-ups, Mon/Wed/Fri mornings only, fee ₹700.
- Dr. Farah Khan, Paediatrician (children), Tue/Thu/Sat evenings, fee ₹800.
- Dr. Kiran Shetty, Dermatologist, Fri evening and Sat morning, fee ₹1000.
Insurance accepted: ONLY ICICI Lombard and HDFC Ergo. No other insurer is accepted.

Rules:
- For a child, book Dr. Farah Khan (paediatrician). She sits Tue/Thu/Sat evenings, so a Tuesday evening works.
- When you book, propose and confirm ONE single clock time, for example "Tuesday at 6 PM". Never read back the whole 5 PM to 9 PM window as the appointment time, and never say two different times for the same appointment. Pick one time, say it once, and ask the caller to confirm that exact time.
- If asked about an insurer that is not ICICI Lombard or HDFC Ergo (for example Star Health), say honestly that the clinic does NOT accept it and only accepts ICICI Lombard and HDFC Ergo. NEVER invent a policy, a doctor, a fee, or a timing you are unsure about. If you do not know something, say you will check.

# Name or detail corrections
If the caller corrects a name or any detail, acknowledge it and use only the corrected version from then on.

# Let the caller finish
Wait until the caller has clearly finished their sentence before you reply. One clear reply per turn is better than several rushed ones.

# Never end the call
Do not end or disconnect the call yourself. Stay on the line and let the caller hang up when they are done.`;

const SETTINGS = { hangup_after_silence: 20, number_of_words_for_interruption: 5 };
// The transcriber swap: English-only Deepgram could not hear Hindi digits.
const TRANSCRIBER = { provider: "sarvam", model: "saaras:v3", language: "unknown" };
const TERMINAL = new Set(["completed", "no-answer", "busy", "failed", "canceled", "cancelled", "stopped", "error", "balance-low"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function cellOf(score: DimensionScore): Cell {
  if (score.score === null) return "grey";
  if (score.score >= 4) return "green";
  if (score.score === 3) return "amber";
  return "red";
}
const WORD: Record<Cell, string> = { green: "Pass", amber: "Mixed", red: "Fail", grey: "Review" };

async function patchClinic(): Promise<void> {
  const agent = asRecord(await bolna("GET", `/v2/agent/${CLINIC_AGENT_ID}`));
  const tasks = agent.tasks as Record<string, unknown>[];
  const task = asRecord(tasks[0]);
  task.task_config = { ...asRecord(task.task_config), ...SETTINGS };
  const tools = asRecord(task.tools_config);
  tools.transcriber = { ...asRecord(tools.transcriber), ...TRANSCRIBER };
  task.tools_config = tools;
  const prompt = `${BASE_PROMPT}\n\n${FIX_BLOCK}\n`;
  await bolna("PUT", `/v2/agent/${CLINIC_AGENT_ID}`, {
    agent_config: {
      agent_name: agent.agent_name,
      agent_type: agent.agent_type,
      agent_welcome_message: agent.agent_welcome_message,
      webhook_url: agent.webhook_url,
      tasks,
      ingest_source_config: agent.ingest_source_config,
      calling_guardrails: agent.calling_guardrails,
      call_summary_enabled: agent.call_summary_enabled,
    },
    agent_prompts: { task_1: { system_prompt: prompt } },
    composition_by_language: { en: [{ type: "text", text: prompt }] },
  });
  const check = asRecord(await bolna("GET", `/v2/agent/${CLINIC_AGENT_ID}`));
  const checkTask = asRecord((check.tasks as unknown[])[0]);
  const silence = asRecord(checkTask.task_config).hangup_after_silence;
  const stt = asRecord(asRecord(checkTask.tools_config).transcriber).provider;
  if (silence !== SETTINGS.hangup_after_silence) throw new Error(`settings did not stick: hangup_after_silence ${String(silence)}`);
  if (stt !== TRANSCRIBER.provider) throw new Error(`transcriber did not stick: provider ${String(stt)}`);
  console.log(`clinic patched: hangup_after_silence ${silence}, transcriber ${stt}, prompt ${prompt.length} chars`);
}

async function placeCall(): Promise<string> {
  if (!env.CLINIC_NUMBER) throw new Error("CLINIC_NUMBER missing");
  const defaults = JSON.parse(await readFile(join(repoRoot, PERSONA, "defaults.json"), "utf8")) as {
    user_data: Record<string, string>;
    critical_dimensions: string[];
    success_criteria: string[];
  };
  const agentId = (await readFile(join(repoRoot, PERSONA, ".agent_id"), "utf8")).trim();
  const placed = asRecord(await bolna("POST", "/call", {
    agent_id: agentId,
    recipient_phone_number: env.CLINIC_NUMBER,
    user_data: defaults.user_data,
    bypass_call_guardrails: true,
  }));
  const executionId = typeof placed.execution_id === "string" ? placed.execution_id : "";
  if (!executionId) throw new Error(`no execution_id: ${JSON.stringify(placed)}`);
  console.log(`execution ${executionId}`);
  const started = Date.now();
  let status = typeof placed.status === "string" ? placed.status : "queued";
  while (Date.now() - started < 8 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    const execution = asRecord(await bolna("GET", `/executions/${executionId}`));
    const next = typeof execution.status === "string" ? execution.status : "unknown";
    if (next !== status) {
      status = next;
      console.log(`  ${status}`);
    }
    if (TERMINAL.has(status)) break;
  }
  return executionId;
}

async function score(executionId: string) {
  const defaults = JSON.parse(await readFile(join(repoRoot, PERSONA, "defaults.json"), "utf8")) as {
    user_data: { goal: string };
    success_criteria: string[];
    critical_dimensions: string[];
  };
  const facts = (await loadTargetManifest(repoRoot, "sehat")).facts;
  const execution = asRecord(await bolna("GET", `/executions/${executionId}`));
  const transcript = typeof execution.transcript === "string" ? execution.transcript : "";
  const turns = parseTranscript(transcript);
  const metrics = metricsOf(turns);
  const status = typeof execution.status === "string" ? execution.status : "unknown";
  const card = await scoreCall({
    facts,
    targetTask: TARGET_TASK,
    callerGoal: defaults.user_data.goal,
    successCriteria: defaults.success_criteria,
    inScope: [],
    outOfScope: [],
    turns,
  });
  const verdict = callVerdict({
    scores: card.scores.map((s) => ({ dimension: s.dimension, score: s.score })),
    critical: defaults.critical_dimensions,
    targetTurns: metrics.target_turns,
    status,
  });
  let draft = await writeBrief({ turns, scores: card.scores });
  if (draft.quote && draft.turn_idx !== null) {
    const turn = turns.find((t) => t.idx === draft.turn_idx);
    const relation = await quoteSupportsFailure({ sentence: draft.sentence, quote: draft.quote, turnText: turn?.text ?? "" });
    if (relation !== "supports") draft = { ...draft, quote: "", turn_idx: null };
  }
  console.log("\n--- transcript ---");
  for (const t of turns) console.log(`[${t.idx}] ${t.speaker === "persona" ? "CALLER" : "CLINIC"}: ${t.text}`);
  console.log(`\n${WHO}: ${verdict.toUpperCase()}  (status ${status}, target turns ${metrics.target_turns})`);
  for (const s of card.scores) {
    console.log(`${DIMENSION_LABEL[s.dimension as Dimension].padEnd(14)}${WORD[cellOf(s)].padEnd(8)}${s.rounded}  ${(s.confidence * 100).toFixed(0)}%`);
  }
  console.log(`\nwhy: ${draft.sentence}`);
  await appendFile(
    join(repoRoot, TRIES_LOG),
    `${JSON.stringify({ ts: new Date().toISOString(), executionId, verdict, sentence: draft.sentence, scores: card.scores.map((s) => ({ d: s.dimension, score: s.score, c: Number(s.confidence.toFixed(2)) })) })}\n`,
  );
  return verdict;
}

await patchClinic();
const executionId = await placeCall();
const verdict = await score(executionId);
console.log(`\n=> ${verdict === "green" ? "GREEN. Sharma passed." : verdict.toUpperCase() + ". Iterate the fix."}`);
