# Issues

Confirmed against the code cited in [AS_IS.md](./AS_IS.md). Severity is about a paid multi-tenant suite, not about the hackathon demo.

## Patch loop

| Issue | Where | Impact | Severity |
|---|---|---|---|
| The score is against the facts sheet, not the prompt the model is running. That part is correct for a judge. The patch is a different path. | `judgeCall` passes `target.facts`. `buildCallerBlock` separately loads the live prompt. | A red call can be "the bot violated the sheet" even when the live prompt never contained the sheet. | Med |
| If the agent id is missing or `GET /v2/agent` throws, Claude writes the block from `task_goal`. Unknown names fall through to the hardcoded clinic sentence `TARGET_TASK`. | `buildCallerBlock`, `TARGET_TASK` in `pipeline.ts` and `runs.service.ts` | A lender or a customer's bot can receive a clinic patch. The error is only `console.error`. | High |
| Apply is a second step, default off. A finished run does not change the bot. | `PATCH_ENABLED`, `planPatch` | The loop the product describes does not close unless someone calls apply and the gate is on. | Med |
| After the first footer, later applies append. They do not replace. The read-back checks that the first 48 characters of the block appear somewhere in the prompt. | `composePrompt`, `executePatch` (`markers` slice 0–48) | The prompt grows. A short overlap can count as stuck without the new section being the one the model follows. | High |
| Sehat and RupeeSetu open on a short v1 draft. Swaad, Nila, and Nivas open on the role sentence stored as `seed_prompt`. | `demo-target/*.manifest.json` | Reset and the first patch for those three still start from a prompt that does not collect name, time, or a confirmation. | High |
| Transcriber language flips only when the live value is exactly `en`, and only during apply. `multi` on nova-3 is rewritten to `hi`. | `withTranscriberLanguage`, `bolnaLanguage` | The first call on a new desk is whatever language the agent was created with. A later patch is the first time the ear changes. | High |
| The desk's own transcript is never stored. `target_execution_raw` has no writer. | `schema.ts`, `ingestCall` | A misheard name and a bot that ignored a clear name look the same. The judge is told to treat some of this as hearing, from the caller-side text only. | High |

## Content coupling

Adding a persona today means a new `personas/<slug>/` tree (`profile.json`, `prompt.md`, `agent.json`, `welcome.txt`, `.agent_id`), `CALLER_NAME` in `runs.service.ts`, `PERSONA_IDS` in `caller-packs.ts`, and a Bolna agent created out of band. `prompt.md` and `profile.json` can disagree. The dial path sends `callerBrief()` output as `user_data`, not `prompt.md`.

Adding a category means a manifest (including `vertical`, `seed_prompt`, and the topic ask), `manifestSlugOf`, `knownDemoAgentId`, and an env agent id. The desk pairing and the per-topic ask are data on that file.

`domains/*.json` is a third facts shape and is not loaded by the API.

| Issue | Severity |
|---|---|
| Persona and category are code plus several files, not one record. | High |
| Two copies of the category map can drift. | Med |
| `createSchema` caps `persona_ids` at 8, so 30 personas cannot be attached to one run even after the files exist. | Med |
| Rubric questions are one global list. A lender and a clinic share the clinic-flavoured task question (callback, doctor name). | High |

## Provider coupling

Bolna is not behind an interface.

- Dial, poll, and execution parse are `queue/bolna.ts` plus `execution.ts`, called directly from `pipeline.ts`.
- The call table column is `bolna_execution_id`.
- Prompt read and write know `agent_prompts.task_1`, `composition_by_language.en`, and `tasks[].tools_config.transcriber` (`runPatch`, `live-agent.ts`).
- The shared number is Bolna `GET /phone-numbers/all` (`inbound.service.ts`).
- Transcript parse assumes Bolna's `assistant` / `user` labels (`transcript.ts`).
- `targets.platform` allows `vapi`, `retell`, `elevenlabs`, `other`. `RunsService.create` always writes `platform: "bolna"`.

`judgeSecurity` exists and is not on this path. Only `scripts/run-lender-round.ts` and `scripts/probe-security.ts` call it.

## Channel coupling

Turns are a phone transcript. Speaker is `persona` or `target`. There is no channel field on `runs` or `calls`. Metrics assume a spoken Hindi ratio. Nothing in the engine can accept a WhatsApp thread without pretending it is a Bolna execution.

## Concurrency and scale

| Issue | Where | Impact | Severity |
|---|---|---|---|
| One worker, two jobs, one Redis queue for the whole process. | `queue.service.ts` | Judge calls and dials share two slots. A slow Jev call blocks a place. | High |
| Cap is per run, not per provider or per number. | `placeQueuedCall` | Two tenants on two numbers are uncapped relative to each other, up to the worker. Two calls in one run can hit one phone when the env cap is above 1. | High |
| Demo desks share one number and a row lock. | `line-lock.ts`, `prepareDemoLine` | A second tenant waits, or hits "The test bots are in use", for up to 30 minutes. | High |
| Skip when in-flight does not requeue. | `placeQueuedCall` early return | A pending caller depends on a later `placeNext`. A lost completion leaves them pending. This is the stall shape. | High |
| `CALL_CAPS_ENABLED` is `false`. | `runs.service.ts` line 22 | `DAILY_CALL_CAP` and the 3-runs-per-target check do not run. | High |
| No matrix. The client sends the list. | `createSchema` | 30 personas × many bots is N full dials, chosen by the browser, max 8. No risk weights, no sampling. | High |
| Postgres pool max 5. | `db.module.ts` | A wider worker will queue on the pool before it queues on Bolna. | Med |

## Judge

| Issue | Where | Impact | Severity |
|---|---|---|---|
| One `systemOne` call returns all seven scores. No second sample. | `jev.ts` `scoreCall` | The same transcript can move a cell. Nothing records a repeat. | High |
| No deterministic check on the live path. Phone numbers, leaked prompt lines, and prices are prompt instructions to Jev, not code. | `rubric.ts`, `judgeCall` | Meera and Ankit pass or fail with the model's mood. `judgeSecurity` is off to the side. | High |
| Confidence floor is 0.35, with an exception that promotes a pass when rounded ≥ 3 and pass-mass ≥ 0.7. | `cells.ts` | A low-confidence failure becomes `grey`. `callVerdict` treats a null critical score as neither ≤ 1 nor ≥ 3, so the call becomes amber. | Med |
| No golden set on the request path. Package tests cover parsers and fixtures, not agreement with a labelled set. | `packages/judge/src/*.test.ts` | A rubric edit can shift every desk with no alarm. | High |
| Quote check is another Jev call. On anything but `supports`, the quote is cleared. The prompt line remains. | `judgeCall` | The report can show a fix for a line it refused to quote. | Med |
| Dimensions are not data. | `rubric.ts` | A new vertical cannot change what "task" means without editing the judge package. | High |

## Multi-tenancy and isolation

There is no tenant table, no user table, and no auth guard on `RunsController`. `owner_email` is a string on `targets`. `listTargets` returns every target. `GET /calls/:id/recording` streams audio to anyone with the id. The line lock session is an optional client string, not an identity.

Two customers who dial the same demo phone share one `targets` row (`create` updates that row's name, facts, and `bolna_agent_id`). The second run overwrites the first customer's sheet.

## Cost

| Issue | Severity |
|---|---|
| Nothing reserves credit before `POST /call`. A retry (job attempts 3, plus one busy redial) can dial again after a place that succeeded if the response was lost before `bolna_execution_id` was saved. The skip on a stored execution id does not cover that window. | High |
| Cost is one numeric column copied from Bolna. No STT, TTS, LLM, or Jev line. Claude and Jev spend is invisible. | Med |
| `bypass_call_guardrails: true` on every place. | Med |
| Caps that would have limited spend are compiled off. | High |

## Idempotency, retries, failure handling

| What works | What does not |
|---|---|
| Job ids `place-${callId}`, `ingest-${callId}`, `judge-${callId}`. A finished job is removed and re-added (`replay.ts`). | Place that throws retries the whole place. A Bolna accept followed by a lost response can dial twice. |
| Judge returns immediately if any score row exists. | A crash after the score insert and before `verdict` is set still finalizes, because any score row counts as done. |
| Watchdog gives up at 8 minutes and marks `failed`. | `console.error` / `console.log` in `finalizeRun` and the patch path are block-buffered when stdout is not a tty. `logLine` covers only some lines. |
| Webhook and watchdog both enqueue ingest with the same job id. | Webhook body is stored in full in `webhook_events`, including whatever Bolna sends. |

## Observability

Boot logs caller-file presence (`main.ts`). Place, skip, and score use `logLine`. Patch unread, patch skip, and run-done use `console.error` / `console.log`. There is no trace id on the log line. There is no metric for queue wait, judge latency, or spend per tenant. `ttfa_ms` is stored from the execution when present. The latency columns on `call_metrics` stay null.

## Known claims, verdict

| Claim | Verdict |
|---|---|
| Patches may be written against a facts sheet, not the live prompt. | Partly true. Scoring uses `targets.facts`. The patch tries the live prompt, and falls back to `task_goal` or the clinic `TARGET_TASK` when the read fails or the id is missing. |
| Patches are appended rather than replacing, so they may not take effect. | True after the first successful apply. The first apply replaces when no Kasauti footer is present. Later applies append. The stick check is a 48-character inclusion. |
| Caller content is scattered. | True. See the content table in AS_IS. |
| Bolna is wired through the core. | True for dial, transcript, recording, prompt write, and the phone number. The judge itself talks to Jev and Anthropic, not Bolna. |
| Voice is assumed. | True. No channel field. |
| Concurrency is capped and a shared number is the bottleneck. | True for demo desks. The daily cap is present and switched off. The worker cap is 2 jobs, not 2 calls. |
| The judge is one LLM pass, no deterministic checks, no calibration. | True on the API path. A security judge exists only in scripts. |
| The matrix is enumerated directly. | True in the weaker sense: the client sends an explicit list, max 8, one bot. There is no grid engine and no sampling. |
