# Migration

## What changed in this pass

- Order is now content, interfaces, sim, phone target, orchestrator, patch verify and rollback, hybrid judge on the target transcript, golden-set F1, auth as the charging gate, then the sampler.
- Sim lands in the step immediately after the channel interfaces.
- The patch step must rerun and revert, not only match the written prompt.
- The judge step fetches the target transcript and marks string dimensions unverifiable when it is missing.
- Auth sits before any step that charges a customer.
- The golden set is its own step: label the calls on disk, compute Jev F1, run it in CI.
- New risks cover sim drifting from a real call, and a verify rerun doubling telephony. Verify on sim first when the prompt is in hand.

Incremental steps from the code in [AS_IS.md](./AS_IS.md) to the seams in [TO_BE.md](./TO_BE.md). Each step ships on its own. No flag day. Behavior of a demo crash stays the same until the step that says it changes.

## Order

| Step | Extract | Depends on | Leaves running |
|---|---|---|---|
| 0 | Docs only. This folder. | — | Everything |
| 1 | Content catalog. Load personas and manifests through one `ContentStore`. Move the category maps into that data. | Nothing | Dial, judge, patch, queue |
| 2 | `Conversation` plus `Channel`, `CallerEngine`, and `TargetAdapter`. Bolna is the voice implementation. `pipeline.ts` calls the interfaces. | 1, so briefs come from the store | Same calls, same Bolna accounts |
| 3 | `SimChannel`. Caller prompt against target prompt, text only, same `Conversation`. | 2 | Live dial |
| 4 | `phone` target. A run with an E.164 and no agent id scores and returns a copy block. String dimensions are unverifiable. Apply refuses instead of writing `TARGET_TASK`. | 2 | Demo desks still use the Bolna adapter |
| 5 | Orchestrator. Split dial and score queues. Semaphore per number. Re-enqueue when the line is busy. A global hold, not per tenant yet. | 2 | Judge and patch code |
| 6 | Patch verify and rollback. Read-back equality, then a rerun of the failing persona. Commit only if critical scores improved. Otherwise revert and mark `proposed_not_verified`. Growth cap. In-place section edit. Cheaper model first. | 2, and 3 so the rerun can be sim when the prompt is in hand | Who is allowed to press apply |
| 7 | Hybrid judge on the target transcript. Deterministic checks read target turns. Missing transcript marks those dimensions unverifiable, never red. Quote comes back inside the one score call. | 1, 2 | Jev as the model judge |
| 8 | Golden set. Label the calls already on disk. Compute Jev F1. Run it in CI. | 7 | The request path |
| 9 | Auth and tenancy. This is the charging gate. No crash pack is sold before it. Recording and run reads require the tenant or a `share_token`. | 5, so the hold has somewhere to live | Bolna callers |
| 10 | Planner sample. Default remains the six hand personas on one bot. The cap of 8 moves to `maxAttempts`. Generated personas stay proposed until a person promotes them. | 1, 5, 9 | The hand set |
| 11 | Second target adapter, only after a paying user has a non-Bolna bot. | 4, 9 | Caller engine |
| 12 | WhatsApp or BSP chat. | 2, 7 | Voice and sim |

Do not start at step 11 or 12. Do not build a second voice stack in this sequence. Do not charge a customer before step 9.

## Step notes

**1. Content.** Add a loader that reads `personas/*/profile.json` and `demo-target/*.manifest.json` and returns the types in TO_BE. Delete the duplicate maps only after `category.ts` and `caller-packs.ts` both call the loader. Keep `prompt.md` as the Bolna caller prompt until `CallerEngine.ensure` owns that push. `domains/*.json` stays a script input until a category row replaces it.

**2. Seams, no behavior change.** Move `queue/bolna.ts` behind `CallerEngine`. Move `runPatch`'s GET and PUT behind `TargetAdapter`. Parse the transcript inside the Bolna engine and return `Conversation`, with `targetTranscript` null until step 7 fetches it. The column can stay `bolna_execution_id` for one release. A new `provider_ref` column is filled with the same value. `pipeline.ts` stops importing Bolna. `Channel.kind` includes `sim` even though only voice is wired here.

**3. Sim.** `SimChannel.start` runs the caller brief against the target prompt as text model calls and returns the same `Conversation` shape, with both transcripts set. No `POST /call`. Use it to replay a saved brief while editing a persona or a rubric. It is not a WhatsApp thread.

**4. Phone target.** `create` stops forcing `platform: "bolna"` when the body has a number and no agent. `buildCallerBlock` returns the block with `currentPrompt` empty and `mode: refuse` for apply. String dimensions on this target are unverifiable, and the report says so. This is the first user-visible change. It is not yet for sale.

**5. Queue.** New place path: if the number semaphore is taken, enqueue `attempt.place` again with a delay. Delete the success-return in `placeQueuedCall` that drops the caller. Keep the 8 minute watchdog. Raise the Postgres pool only when the worker concurrency goes above 2. Two queues means judge jobs no longer share the dial lock. Sim attempts do not take the number semaphore.

**6. Patch.** Change `executePatch` so `ok` requires the fetched system prompt to equal the string we wrote. Store before and after. Refuse when the live read throws. Keep the footer rule for the first replace. Then rerun the failing persona. Prefer that rerun on `SimChannel` when we hold the target prompt. Use a voice rerun only when we do not. If the critical scores did not improve, write the previous prompt back and store `proposed_not_verified`. If they did, commit. A matching section is edited in place. Append only under the growth cap. The first model call is the cheaper one. Opus is the retry, or a failure flagged hard.

**7. Judge.** Fetch the target transcript in the Bolna adapter when the provider can return one. Implement checks as pure functions over target turns: other-patient name from `facts`, a rupee amount not in `facts`, a line that matches `never_say`, a system-prompt fragment. A null target transcript marks those dimensions `unverifiable (no target transcript)` and does not set them red. Wire the checks in `judgeCall` before `scoreCall`. Fold the quote into that same `scoreCall`. Drop the separate `quoteSupportsFailure` request. A failed check writes the dimension with `source: "deterministic"`. Do not change the seven Jev questions in the same step.

**8. Golden set.** Label the calls already stored (the Ankit, Meera, and Rohit failures, plus the desks that held). Score them with the judge from step 7. Record F1. CI fails when F1 drops. Unverifiable cells are left out of F1. This step does not dial.

**9. Tenant, the charging gate.** Session cookie or a signed token. `owner_email` becomes a member of a tenant. `listTargets` filters by tenant. Demo phones belong to our tenant. `share_token` is set when the owner asks for a link. No customer audio behind an id-only URL, and no cross-tenant read, before the first crash pack is sold. Steps 1–8 can ship on our own desks. Step 9 is what makes a stranger's run safe to charge for.

**10. Sample.** The planner's first version returns the six hand personas when the caller asks for a crash. Sampling turns on when the catalog has more personas than `maxAttempts`. A generated row does not dial a paying customer until a person promotes it. Security personas are marked in the catalog, not hardcoded in the planner.

## Leave as-is

- The six hand personas and their Bolna caller agents.
- Jev as the model judge, including the 0.35 confidence floor, until the golden set says it should move.
- `PATCH_ENABLED` and `NUMBER_SWITCH_ENABLED` as exact-string gates.
- The orbit, summary, and call pages, until the API shapes they read actually change.
- `scripts/` one-offs. They can keep calling Bolna directly until step 2 is boring.
- Building our own caller (`CallerEngine` id `kasauti`). The interface reserves it. The migration does not schedule it.
- WhatsApp and web chat. Sim does not stand in for them.
- SOC 2, load tests, a second phone carrier.
- A published pack price. Bolna `total_cost` is confirmed as US cents. The price itself is still a decision.

## Risks

| Step | Risk | De-risk |
|---|---|---|
| 1 | A loader bug changes a caller's lines. | Snapshot `callerBrief` output for the six personas and five manifests. The step fails if the snapshot changes. |
| 2 | A wrapped Bolna call drops `bypass_call_guardrails` or `user_data`. | One fixture replay and one inspected execution shape compared to today's `executionFields`. No new live dial in the same change. |
| 3 | Sim drifts from a real call. The judge looks good in text and fails on the phone. | Keep a paired set: the same brief on sim and on one saved voice transcript. A sim-only green does not count as a voice green. Say so on the preview. |
| 4 | An own-number run writes a clinic prompt. | Apply on `provider: phone` returns refuse in a unit test before the route is exposed. |
| 5 | A re-enqueue storms Bolna. | Delay at least 15s. Cap delayed jobs per attempt. Watchdog still kills at 8 minutes. |
| 6 | A verify rerun doubles call cost. A strict equality check fails because Bolna rewrites whitespace. | Verify on `SimChannel` first whenever the target prompt is in hand. Spend a voice rerun only when sim cannot see the desk. Compare a normalized prompt. If inequality remains, applied is false and the previous prompt is what we read back. Revert writes that previous text, not a clinic draft. |
| 7 | A deterministic check false-fails a hearing slip, or a missing transcript becomes a red. | Checks run on the target transcript only, and only on exact strings. Near-misses stay with Jev. Null target turns mark the dimension unverifiable. |
| 8 | Labels disagree with a later rubric edit. | Store the rubric version on each golden row. F1 is computed against that version. |
| 9 | Existing runs become unreadable. | Backfill one tenant for current rows. Local session keeps working against that tenant until login exists. Do not sell a pack in this step's first deploy until a cross-tenant read test fails closed. |
| 10 | A sample skips the caller who would have failed. | The default crash is still the six hand personas. Security and last-failure cells are pinned when sampling turns on. Log the cells that were left out. |

Do not edit `runs.service.ts` or the place path while a call is in flight. Ship queue changes between runs.

## What we are not migrating

The hackathon UI copy, the landing page, and the Railway deploy wiring are outside this architecture. They do not block steps 1–4.
