# Kasauti rebuild — backlog

Tickets derived from MIGRATION.md. Epics = migration steps. Each ticket is Linear-ready: ID, size (S/M/L), depends-on, acceptance. Build epics in order. Do NOT start a later epic early. Keep `PATCH_ENABLED`, `NUMBER_SWITCH_ENABLED` gates and `MAX_CONCURRENT_CALLS=1` through all of this; do not charge anyone before Epic 9.

`MAX_CONCURRENT_CALLS=1` does not fix a caller left pending when `placeQueuedCall` returns without re-queueing. That fix is Epic 5. If a live demo stalls before then, re-queue that one job. Do not start the orchestrator early for it.

## Do now — no code, run in parallel (unblocks pricing + the label set)

- **P-1 — Confirm the Bolna `total_cost` unit (S).** Done 2026-11-07. The unit is US cents. One dashboard credit is one cent. Recorded in AS_IS. `centsToCost` was not edited. No new call was placed: a live re-read of calls already on the account matched 6¢/min (a 90-second call came back 9).
- **P-1b — Fix `centsToCost` only if P-1 disagrees with the code (S).** Skipped. The code already treats the field as cents and divides by 100. Depends: P-1.
- **P-2 — Label the golden set (M).** Done 2026-11-07. `packages/judge/src/golden/caller-side.csv`: 30 calls, one row per dimension. Every row is `caller-side` and `target_truth=no`. A name, amount, or code is `string_specific=yes`. Pass or fail only where the live-round note describes the behavior. The other cells are `unlabelled`. Jev scores were not copied. This is not an F1 number. F1 is Epic 8.

These two need no refactor. P-1 is the pricing input. P-2 is the label file Epic 8 will score. Do them this week regardless of code progress.

---

## Epic 1 — Content catalog (ContentStore)
*Goal: personas, categories, manifests, rubrics load through one versioned store. Adding a persona or category = adding data, not editing code. Migration step 1.*

- **K1-1 — ContentStore types + interface (S).** Done 2026-11-07. `Persona`, `Category`, `Rubric`, and `ContentStore` are in `packages/core/src/content.ts` and exported. `CallerBrief` stays the type `callerBrief()` already returns. No dial-path change.
- **K1-2 — File-backed loader (M).** Done 2026-11-07. `loadFileContentStore` reads the 6 profiles and 5 manifests through the existing Zod schema. A bad file throws with its path and the field name. `store.brief` returns the same object as `callerBrief()`. Depends: K1-1.
- **K1-3 — callerBrief snapshot test (S).** Done 2026-11-07. `packages/core/src/caller-brief.snapshot.test.ts` snapshots all 6 callers × 5 desks. Depends: K1-2.
- **K1-4 — Single category→desk map (M).** Done 2026-11-08. Each manifest has `vertical`. The API, the run route, and the callers page read the desk for that vertical from the catalog. The old maps in `category.ts` and `caller-packs.ts` are gone. `agent-briefs.ts` stays. Snapshot unchanged. Depends: K1-2.
- **K1-5 — Ask templates into category data (M).** Done 2026-11-08. Each chosen topic carries its dialect or records ask on the manifest. `caller-brief.ts` no longer switches on the topic name. A topic with no ask keeps the old generic line. Snapshot unchanged. Depends: K1-3, K1-4.
- **K1-6 — Rubric loadable per category (M).** Done 2026-11-08. `Category.rubricId` is `default`. `store.rubric` returns the seven questions from `packages/judge/src/rubric.ts` unchanged. Critical stays on the persona. Depends: K1-2.
- **K1-7 — Collapse the first-prompt drafts (S).** Done 2026-11-08. `seed_prompt` on the manifest is the first draft. Sehat and RupeeSetu keep the short v1 text. Swaad, Nila, and Nivas keep the role sentence. `initialPromptFor` only trims that field. Depends: K1-2.
- **K1-8 — Drop unused copies only (S).** Done 2026-11-09. Nothing still imported the RupeeSetu v1 note, and its prompt already lives on the manifest, so that file is gone. The unused persona-id helper in `category.ts` is gone. `agent-briefs.ts`, `prompt.md`, `sehat_v1.md`, `sehat_v2.md`, and `suites/lender/*/defaults.json` stay because something still reads them or they are the only copy. `personas/*/defaults.json` and `demo-target/*_facts.json` were already absent. Snapshot unchanged. Depends: K1-4.

---

## Epic 2 — Interfaces: Channel / CallerEngine / TargetAdapter
*Goal: Bolna behind interfaces, no behavior change. `pipeline.ts` stops importing Bolna. Migration step 2.*

- **K2-1 — Interface + Conversation types (S).** Done 2026-11-10. `Conversation`, `Channel`, `CallerEngine`, `TargetAdapter`, `TargetRef`, and `LivePrompt` are in `packages/core/src/seam.ts` and exported. Depends: Epic 1.
- **K2-2 — BolnaCallerEngine (M).** Done 2026-11-10. Place and execution go through `bolnaCallerEngine`. The place body is unchanged. A stored `provider_ref` skips the next dial. Depends: K2-1, K2-5.
- **K2-3 — BolnaTargetAdapter (M).** Done 2026-11-10. `runPatch` reads and writes through `bolnaTargetAdapter`. The desk transcript method returns null. Depends: K2-1.
- **K2-4 — Parse transcript in the engine, return Conversation (M).** Done 2026-11-10. `pipeline.ts` consumes `Conversation` and does not import `queue/bolna.ts`. `targetTranscript` stays null. The stored turns still say `persona`. Snapshot unchanged. Depends: K2-2.
- **K2-5 — Schema: provider_ref + channel (S).** Done 2026-11-10. `calls.provider_ref` mirrors `bolna_execution_id`. `calls.channel` and `runs.channel` default to `voice`. Applied on the local database. Depends: K2-1.
- **K2-6 — Seam de-risk check (S).** Done 2026-11-10. A stored fixture execution matches `executionFields`, including duration, cost, and turns. No new live dial. Depends: K2-2, K2-4.

---

## Epic 3 — SimChannel (text simulation)
*Goal: caller prompt vs target prompt over text, same `Conversation`, no telephony. Dev harness + free preview tier. Migration step 3.*

- **K3-1 — SimChannel.start (M).** Run the caller brief against the target prompt as text LLM calls; return `Conversation` with both transcripts set, `channel: "sim"`, no `POST /call`, no recording. *Done: a saved brief produces a scored sim conversation with zero telephony spend.* Depends: Epic 2.
- **K3-2 — Sim replay dev command (S).** A script to replay a saved brief on sim while editing a persona or rubric. This replaces burning real calls to tune prompts. *Done: `pnpm sim <persona> <target>` prints a scored transcript.* Depends: K3-1.
- **K3-3 — Sim-vs-voice honesty guard (S).** Pair the same brief on sim with one saved voice transcript (the text, not only the mp3). A sim-only green is labelled "preview, not voice-verified" in any output. *Done: sim results carry the label; a paired diff is recorded.* Depends: K3-1.

---

## Epics 4–10 — headline tickets (break down when you reach them)

- **Epic 4 — Phone target (step 4).** `create` stops forcing `platform:"bolna"` when the body has an E.164 and no agent. Score runs; string dimensions come back `unverifiable` and the report says so (not a dash that looks like a fail). Apply returns `refuse` (no clinic fallback). First user-visible change, not yet for sale. *This is decision #1: any +91 number, copy-out patch.*
- **Epic 5 — Orchestrator (step 5).** Split `dial` and `score` queues. Per-number / per-provider / per-tenant Redis semaphores. Re-enqueue when busy (kill the stall: delete the success-return drop in `placeQueuedCall`). Raise the PG pool only when worker concurrency goes above 2. Sim attempts take no number semaphore.
- **Epic 6 — Patch write is mechanical (step 6).** Read-back must equal `afterText` (not a 48-char inclusion). If the write did not stick, put the previous prompt back. Growth cap. In-place section edit over append. Cheaper model first. A sim rerun here is a preview, not a reason to keep the prompt. *Do not commit because today's critical scores improved. That gate is Epic 7.*
- **Epic 7 — Hybrid judge, then the score gate (step 7).** Bolna adapter fetches the target transcript. Deterministic checks (PII, `never_say`, amount-not-in-facts, prompt-leak fragment) run on target turns. Null transcript → `unverifiable`, never red. Fold the quote into the single `scoreCall`; drop `quoteSupportsFailure`. Only after that: rerun the failing persona (prefer sim when the prompt is in hand) and commit the patch only if the critical scores improved. Otherwise revert and mark `proposed_not_verified`.
- **Epic 8 — Golden set F1 (step 8).** Score the P-2 labelled calls with the Epic 7 judge. Record F1. CI fails when F1 drops. Unverifiable cells, and caller-side labels that Epic 7 will not treat as target-truth, are excluded. *This is the credibility number. P-2 does not produce it.*
- **Epic 9 — Auth + tenancy = the charging gate (step 9).** Tenant/member model; `listTargets` filters by tenant; recordings behind member or `share_token`. No customer audio behind an id-only URL before the first pack is sold. **Nothing is charged before this ships.**
- **Epic 10 — Planner sample (step 10).** Default = six hand personas on one bot. Sampling turns on when the catalog exceeds `maxAttempts`; move the `createSchema` cap of 8 to `maxAttempts`; security + last-failure cells pinned; generated personas stay proposed until promoted.

*Later, not scheduled: Epic 11 (second target adapter — only when a paying user has a non-Bolna bot), Epic 12 (WhatsApp/BSP chat). Do not start these.*

---

## Working constraints during the whole rebuild
- Gates stay: `PATCH_ENABLED`, `NUMBER_SWITCH_ENABLED` exact-string `true`; `MAX_CONCURRENT_CALLS=1`.
- No live dial inside a refactor ticket. Ship queue/place changes between runs, never while a call is in flight.
- No charging, no multi-tenant exposure, no customer audio on a public URL before Epic 9.
- Every ticket: snapshot/fixtures green before merge. Epics 1–3 must not change any voice call's behavior. Sim is a new path, not a change to voice.
- A patch is not kept because the current judge liked the rerun. That decision waits for Epic 7.

## Suggested first week
1. P-1 and P-2 (parallel, no code). P-1 records the unit. P-2 records caller-side labels. Neither is an F1 number.
2. K1-1 → K1-2 → K1-3 (types, loader, snapshot). Stop there for the week.
3. Epic 1 and Epic 2 are done. Epic 3 is the text simulation. Do not start it until asked.
