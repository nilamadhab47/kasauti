# Kasauti: technical spec

> **Gate:** nothing in this file gets built until `docs/phase0-results.md` says `Verdict: GO`. See `docs/PHASE0_SMOKE_TEST.md`.

## 1. Architecture (lean on purpose)

The product we are building is `docs/PLAN.md`: a dashboard and an HTTP API so one B2B team can run a caller pack against their own bot. The judges still need a real call, a brief with quotes, and a company that is not us. So:

TypeScript everywhere. pnpm workspace.

- **Dashboard:** Next.js on Vercel, shadcn/ui, Tailwind. This is the product a company logs into.
- **API:** NestJS on Railway. REST, the Bolna webhook, and the BullMQ worker. Bolna calls this host, not the Vercel app.
- **Postgres** on Railway. Drizzle is the schema layer.
- **Redis** on Railway. Cache for run status and the voice list. BullMQ uses the same Redis as the broker for the call queue.
- **Cloudflare R2** for recordings. Vercel and Railway disks are the wrong place for audio.
- **Judge:** Jev (`jev-latest`) on TypeSafe. One Score question per dimension, in a single request. Claude only writes the brief.
- **No Python audio service until later.** Latency shows as "n/a" until then.

```
Browser ──▶ Next.js (Vercel) ──HTTPS──▶ NestJS (Railway) ──▶ Postgres
                                              │                Redis (cache + BullMQ)
                                              │
                             POST /v2/agent   │   POST /webhooks/bolna
                             POST /call       ▼
                                        Bolna API ──PSTN──▶ Target voice agent
                                              │
                                       recording ──▶ R2
                                              │
                                       Jev scores the call
                                       Claude writes the brief
```

### Repo layout (after the gate opens)
```
kasauti/
  .cursor/rules/kasauti.mdc
  docs/
  scripts/              # Phase 0 scripts stay; they're useful for debugging forever
  personas/<id>/        # agent.json, prompt.md, welcome.txt, defaults.json (one folder per persona)
  demo-target/
  fixtures/             # real execution JSONs from Phase 0 and later
  packages/
    bolna/              # typed Bolna client (grown from scripts/lib/bolna.ts)
    judge/              # Jev scores (TypeSafe SDK), Claude brief, quote check
    core/               # transcript parser, metrics, persona compiler (pure functions, unit-tested)
  apps/
    web/                # Next.js dashboard, shadcn/ui, deployed on Vercel
    api/                # NestJS: REST, Bolna webhook, BullMQ worker, deployed on Railway
  pnpm-workspace.yaml
```

## 2. Milestones (do them in order)

Each milestone has a **done-when** check. Don't start the next one until it passes.

These match `docs/PLAN.md` §8. Do them in order.

| ID | Build | Done when |
|---|---|---|
| **M0** | Phase 0 smoke test | `docs/phase0-results.md` says GO. Done. |
| **M1** | Parser, Jev scores, Claude brief, `scripts/score-call.ts` | A brief for the three real uncle calls. Scores come from Jev. Every quote is a real line. |
| **M2** | NestJS, Drizzle schema, `POST /webhooks/bolna`, Railway | A finished call lands in `webhook_events` on Railway |
| **M3** | Persona sync, BullMQ queue, ingest, auto-judge | A run of 2 callers scores both with no manual step |
| **M4** | Workspace invite, bot form, library, live run, brief page | We add Sehat in the browser and watch a pack run |
| **M5** | Custom caller, clinic pack, rerun, compare, call detail | Sehat v2 is a rerun of v1 and compare shows the cells that moved |
| **M6** | Share link, API key, `POST /v1/runs`, `GET /v1/runs/:id`, cost on the page | A script starts a run and the share link shows the same brief |
| **M7** | Delivery pack, remaining callers, one outside company, video, submit | That company added their own number and got a link. Submitted before noon 31 Oct 2026 |
| **M8** | Both transcripts, run history | One call shows both ears. The bot page lists past runs |
| **M9** | Outbound webhook, sample GitHub Action | Their URL receives the brief |
| **M10** | Latency from the stereo recording | The latency cell is a number |
| **M11** | Customer’s own Bolna key | A run bills their key |
| **M12** | Training mode | The uncle calls a person and the brief scores the person |

M8–M12 start after M7. If time gets short, delay M8–M12. Inside M1–M7, delay the delivery pack and the custom caller before delaying the brief, the queue, the share link, or the outside company.

Schema additions on top of §5, because a company account is now in the product: `workspaces`, `api_keys`, `packs`, and custom callers stored per workspace. Built-in callers still live in `personas/`. A run belongs to a workspace. An API key can only dial a bot that workspace has saved with consent.

## 3. Bolna client (`packages/bolna`)

Docs index: https://www.bolna.ai/docs/llms.txt. Verify each endpoint before writing it.

```ts
export interface BolnaClient {
  me(): Promise<Account>;                                   // GET /user/me
  listVoices(): Promise<Voice[]>;                           // ⚠️ path: see api-reference/voice/get_all
  createAgent(body: AgentBody): Promise<{ agent_id: string; state: string }>; // POST /v2/agent → 201
  updateAgent(agentId: string, body: AgentBody): Promise<void>;               // ⚠️ PUT /v2/agent/{id}
  placeCall(req: PlaceCallReq): Promise<{ execution_id: string }>;            // POST /call
  getExecution(id: string): Promise<Execution>;             // GET /executions/{id}
  listAgentExecutions(agentId: string): Promise<Execution[]>; // ⚠️ GET /v2/agent/{id}/executions
  uploadAmbientSound(file: Buffer, name: string): Promise<{ id: string }>;   // ⚠️ POST /ambient-sounds/custom (body format unverified)
  downloadRecording(url: string): Promise<Buffer>;          // try Bearer header, fall back to none
}

export interface PlaceCallReq {
  agent_id: string;
  recipient_phone_number: string;            // E.164
  user_data?: Record<string, string>;        // fills {{variables}} in the prompt
  bypass_call_guardrails?: boolean;
}

export const TERMINAL = ['completed','no-answer','busy','failed','canceled','stopped','error','balance-low'] as const;
// Never treat 'call-disconnected' as final: recording/duration are empty until 'completed'.
```

`Execution` zod schema (`.passthrough()`): `id`, `status`, `transcript` (flat string), `telephony_data.recording_url`, `duration`, `hangup_by`, `hangup_reason`, `cost_breakdown`, `latency_data.time_to_first_audio`, plus timestamps. Use field names exactly as seen in `fixtures/` from Phase 0.

Retries: 3 attempts with backoff on 429/5xx. No retry on 4xx.

## 4. Personas

### 4.1 Files
One folder per persona under `personas/<id>/` (the Phase 0 `angry_uncle` folder is the template):
- `agent.json` — Bolna v2 body with `"@file:prompt.md"` and `"@file:welcome.txt"` placeholders
- `prompt.md` — persona prompt + shared CALL RULES footer, with `{{target_name}}`, `{{goal}}`, `{{seed_script}}`
- `welcome.txt`
- `defaults.json` — `id`, `name`, `user_data` defaults (goal, seed_script), `success_criteria[]`, `critical_dimensions[]`, optional `language_plan`, optional `noise_track_file`

Copy prompts, beats and criteria for the other personas from `docs/ORIGINAL_SPEC.md` §4. Keep the Devanagari exactly.

### 4.2 Compiler (`packages/core/persona.ts`)
`compilePersona(folder, opts: { webhookUrl, ambientTrackId? }) → { body, hash }`
- Inline the files, set `agent_config.webhook_url`, and for noisy personas set `task_config.ambient_noise = true` and `ambient_noise_track = <id>`.
- `hash = sha256(JSON.stringify(body))`.

### 4.3 Sync (`POST /personas/sync`, admin)
For each persona folder: compile → if there's no row in `persona_agents`, `createAgent`; if the hash changed, `updateAgent`; store `bolna_agent_id` and hash. Agents are free to hold; Bolna bills per minute.

**One agent per persona serves every target.** Per-call details go in `user_data` (`target_name`, `goal`, `seed_script`).

### 4.4 Noise (`noisy_market`)
- Track: CC0 market/traffic audio from freesound.org or your own phone recording, ≤ 10 MB, pre-boosted: `ffmpeg -i in.mp3 -filter:a "volume=2.5" market_loud.mp3`.
- Upload once via `uploadAmbientSound`, store the id in `personas/noisy_market/.ambient_id`.
- Requires Plivo or Vobiz telephony on the persona agent.

## 5. Database (Postgres, Drizzle ORM)

Personas live in files, not the DB. Tables:

```sql
create table targets (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  name text not null,
  phone_e164 text not null,
  platform text not null check (platform in ('bolna','vapi','retell','elevenlabs','other')),
  bolna_agent_id text,                         -- set if the target is on our Bolna account
  task_goal text not null,
  facts jsonb not null default '{}',
  consent_confirmed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table persona_agents (
  persona_id text primary key,
  bolna_agent_id text not null,
  config_hash text not null,
  synced_at timestamptz not null default now()
);

create table runs (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references targets(id),
  label text not null,
  parent_run_id uuid references runs(id),      -- set on reruns, used by compare
  status text not null default 'queued',       -- queued|running|scoring|done|failed
  pass_rate numeric,
  share_token text unique,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  persona_id text not null,
  user_data jsonb not null,                    -- exactly what was sent, so reruns reuse it
  bolna_execution_id text unique,
  status text not null default 'pending',      -- pending|placing|<bolna statuses>|scored|failed
  attempt int not null default 1,
  execution_raw jsonb,                         -- last full GET /executions response
  target_execution_raw jsonb,                  -- target's own execution, if it's our Bolna agent
  recording_key text,
  duration_s int, cost numeric,
  hangup_by text, hangup_reason text,
  ttfa_ms numeric,
  verdict text,                                -- green|amber|red|null
  started_at timestamptz, ended_at timestamptz
);

create table turns (
  call_id uuid references calls(id) on delete cascade,
  idx int,
  speaker text not null check (speaker in ('persona','target')),
  text text not null,
  lang text,                                   -- hi|en|mixed
  primary key (call_id, idx)
);

create table call_metrics (
  call_id uuid primary key references calls(id) on delete cascade,
  persona_turns int, target_turns int,
  max_same_speaker_run int,
  persona_repeat_count int,
  target_hindi_ratio numeric,
  latency_p50_ms int, latency_p95_ms int, max_dead_air_ms int,   -- null until audio service exists
  raw jsonb
);

create table scores (
  call_id uuid references calls(id) on delete cascade,
  dimension text,
  score int check (score between 0 and 5),     -- null = needs review
  verdict text,                                -- green|amber|red|grey
  evidence jsonb not null default '[]',        -- [{turn_idx, quote, why}]
  fix_hint text,
  judge_version text not null,
  primary key (call_id, dimension, judge_version)
);

create table fix_suggestions (
  run_id uuid references runs(id) on delete cascade,
  idx int, dimension text, suggestion text, evidence_call_ids uuid[],
  primary key (run_id, idx)
);

create table webhook_events (
  id bigserial primary key,
  execution_id text, status text, payload jsonb,
  received_at timestamptz not null default now()
);
```

## 6. Run pipeline (BullMQ jobs)

```
POST /runs ─▶ run.start ─▶ (for each persona) call.place ─▶ Bolna dials
                                                      │
Bolna webhook ─▶ POST /webhooks/bolna ─▶ call.ingest (on terminal status)
                                                      │
                                   call.judge ─▶ run.finalize (when all calls done)
                                                      │
                                              run.fixes (roll-up)
```

| Job | Does | Notes |
|---|---|---|
| `run.start` | Create one `calls` row per persona with `user_data` (target name, persona goal, beats). For reruns, copy `user_data` from the parent run. Set run `running`. Enqueue `call.place` for the first 3. | |
| `call.place` | Check allowlist/consent/rate limits → `placeCall` → store `execution_id`, status `queued`. Enqueue `call.watchdog` with delay `call_terminate + 120 s`. | Max 3 in flight (`MAX_CONCURRENT_CALLS`), 20 s apart. When a call reaches a terminal state, place the next pending one. |
| `POST /webhooks/bolna` | Check `?s=WEBHOOK_SECRET`. Insert into `webhook_events`. Update `calls.status` for display. Return 200 fast. On a terminal status, enqueue `call.ingest` (singleton key = execution id). | Don't trust the payload for data; refetch in ingest. No HMAC is documented. |
| `call.watchdog` | If the call isn't terminal yet, `getExecution` and handle it like a webhook. | Covers lost webhooks. |
| `call.ingest` | `getExecution` → store raw + fields. On `no-answer`/`busy`: retry once after 60 s (`attempt = 2`), else mark failed. On `completed`: download recording → R2; parse turns (§7); compute metrics; if target is our Bolna agent, fetch and store its execution. Enqueue `call.judge`. | Idempotent: safe to run twice. |
| `call.judge` | Build `JevRequest` → judge → validate (§8) → store scores → compute persona verdict. | |
| `run.finalize` | When no calls are pending/in-flight: compute pass rate, set `done`. Enqueue `run.fixes`. | |
| `run.fixes` | Collect `fix_hint`s grouped by dimension → one LLM call to dedupe into 3–6 prompt lines → `fix_suggestions`. | |

## 7. Transcript parsing and metrics (`packages/core`)

### Parser
- Input: Bolna's flat transcript string from the **persona's** execution.
- Split on lines beginning `assistant:` or `user:` (case-insensitive, trim). Lines without a prefix join the previous turn.
- `assistant` → `persona`, `user` → `target`. Drop empty turns.
- Unit tests use the real Phase 0 fixtures. Include edge cases: empty transcript, transcript starting mid-turn, Devanagari and emoji.

### Per-turn language
Share of letters in the Devanagari block (U+0900–U+097F): > 0.5 → `hi`, < 0.1 → `en`, else `mixed`.

### Metrics (no audio needed)
- `persona_turns`, `target_turns`, `max_same_speaker_run`
- `persona_repeat_count`: persona turns matching `/दोबारा|फिर से|repeat|क्या\?|सुनाई नहीं|ज़ोर से/i`
- `target_hindi_ratio`: Devanagari letters / all letters across target turns
- Bolna fields: `duration_s`, `hangup_by`, `hangup_reason`, `ttfa_ms`
- `latency_dead_air`: **grey "n/a"** in the MVP (needs the audio service, §11)

## 8. Judge and brief (`packages/judge`)

Two models, two jobs. [Jev](https://docs.typesafe.ai/introduction) returns a score. Claude writes the sentences. Code checks that any quoted line is actually in the transcript.

### Jev scores the call

One request to `POST https://api.typesafe.ai/v1/systemone` with `model: "jev-latest"`. Use `@typesafe-ai/sdk` (`TypeSafeClient.systemOne`). Auth is `TYPESAFE_API_KEY`.

The state is the facts sheet, the bot's task, the caller's goal, and the numbered turns. The questions are one [Score](https://docs.typesafe.ai/primitives/score) per dimension, all in that same request. A Score takes an ordered list of levels. Ours is six levels, index 0 through 5, using the anchors in `docs/ORIGINAL_SPEC.md` §5.1. Jev answers with a probability-weighted `score` (it can fall between levels), a probability per level, and a `confidence`.

Dimensions in that request: `task_completion`, `hallucination`, `language_switch`, `dropped_intents`, `interruption_handling`, `repair`, `tone_empathy`. Latency stays grey until the audio service exists.

Code, not the model, turns the answer into a cell:

- Round the weighted score to the nearest integer, 0–5.
- Green ≥ 4, amber = 3, red ≤ 2.
- Confidence under 0.6: the cell is grey, "needs review", and the number is still stored. The first three clinic calls sat mostly between 0.45 and 0.82, so the 0.8 bar from TypeSafe's citation check hid failures that were scored 0 or 1.
- Persona call: **red** if any critical dimension ≤ 2, or `hallucination` ≤ 2, or the call made no progress (`target_turns < 2` or status not `completed`). **Green** if every critical dimension ≥ 4 and nothing is red. Else amber.
- Run pass rate = green / total.

### Claude writes the brief

Claude receives the turns and the Jev scores. It returns three things: one sentence on what broke, one verbatim quote from a **target** turn, and one prompt line to add. It does not choose the score.

The quote must appear in that turn after normalising whitespace and case. If it does not, retry Claude once. If it still does not, the brief has no quote and the cell says needs review.

Then one Jev [Choice](https://docs.typesafe.ai/primitives/choice): does this quote support the failure, contradict it, or say nothing about it? A quote that does not support the failure is dropped. This is the same shape as TypeSafe's citation check.

## 9. Server routes and pages (NestJS)

### JSON / form endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/targets` | Create target (requires consent) |
| PATCH | `/targets/:id` | Edit goal or facts |
| POST | `/personas/sync` | Admin: compile + upsert persona agents |
| POST | `/runs` | `{target_id, persona_ids[], label}` |
| POST | `/runs/:id/rerun` | `{label}` → new run with `parent_run_id` |
| POST | `/runs/:id/share` | Create `share_token` |
| GET | `/api/runs/:id` | Run + calls + verdicts (live page polls every 3 s) |
| GET | `/calls/:id/audio` | Signed R2 URL redirect |
| POST | `/webhooks/bolna` | Bolna status webhook |
| GET | `/healthz` | Health |

### Pages (Next.js + shadcn/ui)

The browser talks only to the Next app. The Next app calls the Nest API. Shadcn components, styled to `docs/UI.md` (paper, black text, one ochre mark, serif verdict).
| Path | Page |
|---|---|
| `/` | Targets list + "New target" |
| `/targets/new` | Form: name, number, platform, task goal, facts (JSON textarea), consent tick |
| `/targets/:id` | Target + its runs + "New run" (persona checkboxes, label) |
| `/runs/:id` | **Live + report card in one page**: persona × dimension grid, coloured cells with scores, pass-rate header, fix suggestions, Rerun button. Polls while running. |
| `/calls/:id` | Audio player, transcript turns (failing turns highlighted), evidence cards, metrics |
| `/runs/:id/compare/:other` | Two grids, flipped cells highlighted, Δ pass rate |
| `/r/:token` | Public read-only report |

Auth: none for pages in the MVP except an `ADMIN_TOKEN` cookie for creating targets and runs. Public share pages need no auth.

## 10. Guardrails
- **Allowlist:** in development, only numbers in `ALLOWED_NUMBERS`. In production, only target numbers with `consent_confirmed_at`.
- **Caps:** `MAX_CONCURRENT_CALLS=3`, max 8 calls per run, `DAILY_CALL_CAP=40`, 3 runs per target per day.
- **Cost:** log `cost_breakdown` per call; show total cost per run on the report page (helps budgeting).
- **Content:** persona prompts never contain profanity or threats.
- **Secrets:** env only; never logged.

## 11. Optional: audio service (only if ahead of schedule)
Small Python FastAPI service: download recording → ffmpeg 16 kHz → split channels if stereo, else diarized STT with word timestamps → turns with `start_ms/end_ms` → `latency_p50/p95`, `max_dead_air_ms`, overlaps. Latency score by code:
- p95 < 1.5 s and max dead air < 4 s → 5; p95 1.5–2.5 s → 4; p95 2.5–3.5 s or one gap > 6 s → 3; p95 > 3.5 s or repeated gaps > 6 s → 2; target hung up on a silent caller or gap > 10 s → 1; dropped before any progress → 0. Calibrate on real calls.

## 12. Developer tools
- `scripts/score-call.ts <execution_id> [--persona <id>] [--target demo-target/facts.json]` — fetch → parse → judge → print a coloured terminal card. (M1)
- `scripts/dry-run.ts --persona <id> --target-prompt demo-target/sehat_v1.md --turns 12` — text-only conversation between the persona prompt and a target prompt using an LLM, no phone, no cost. For tuning persona prompts quickly. (M1)
- Keep all Phase 0 scripts.

## 13. Testing
`vitest` unit tests for: transcript parser, language tagging, metrics, persona compiler (snapshot), judge validator (fake quotes rejected, non-target turn rejected), verdict logic, allowlist check. Use real fixtures. No tests that dial phones.

## 14. Deployment
- **Vercel:** `apps/web`. `API_URL` points at the Railway API.
- **Railway:** `apps/api` (HTTP and the BullMQ worker), Postgres, Redis. Env vars from `.env.example`.
- `PUBLIC_BASE_URL` is the Railway API origin. Persona agents get `webhook_url = ${PUBLIC_BASE_URL}/webhooks/bolna?s=${WEBHOOK_SECRET}`. Re-run `/personas/sync` after changing the URL.

## 15. Open questions (verify, don't guess)
| # | Question | Where to check |
|---|---|---|
| 1 | Do bot-to-bot calls work and hold a conversation? | Phase 0 |
| 2 | Recording mono or stereo; does the URL need auth? | Phase 0 Step 6 |
| 3 | Does the inbound leg count toward concurrency? | Phase 0 |
| 4 | Exact paths: list voices, update agent, agent executions, ambient upload body | Bolna docs |
| 5 | Can a welcome message be empty? | Bolna docs / test |
| 6 | Does Sarvam STT support `endpointing`? Which code-switching STT + language pairs are accepted? | Bolna docs / 400 errors |
| 7 | Custom webhook headers via API, or only dashboard? | Bolna docs |
| 8 | Buildathon credits? | Bolna Slack |
| 9 | Jev's API | Resolved. `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`, SDK `@typesafe-ai/sdk`. See §8. |
