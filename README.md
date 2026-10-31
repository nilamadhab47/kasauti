# Kasauti

Kasauti crash-tests Indian voice agents. It dials a desk on a real +91 line with a small set of callers, scores the conversation, and writes a patch you can put back on the agent.

Built for the [Bolna Symphony Buildathon](https://www.bolna.ai/symphony/buildathon/).

## What you get

1. Pick a desk and the callers who should stress it.
2. Watch the orbit while one caller is on the line and the others wait.
3. Read a summary: an overall score out of 100, and each caller as held, amber, or broke.
4. Open a call for the transcript, the breaking turn, the recording, and the seven Jev scores.
5. Copy Claude’s patch block, or apply it onto the live agent.
6. Call that caller again, or the whole set. The summary keeps the other callers and shows before → after for the one that was redialed.

Amber means the critical dimensions held and something else was weak. Green means every critical dimension scored 3 or above. Red means a critical dimension collapsed.

## Callers

| Caller | Id | What they push |
|---|---|---|
| Sharma ji | `angry_uncle` | Agitation, Hinglish, interruptions |
| Neha | `lang_switcher` | Hindi and English in the same call |
| Ramesh | `dialect_bhojpuri` | Vernacular |
| Ankit | `staff_probe` | Staff and process probes |
| Meera | `records_raider` | Records that are not theirs |
| Rohit | `rohit` | Nosy follow-ups |

## Desks

| Desk | Category |
|---|---|
| Sehat Clinic | Clinic booking |
| Rupeesetu | Lender |
| Swaad | Restaurant |
| Nila | Clothing |
| Nivas | Property |

Demo desks are updated with `DEMO_BOLNA_API_KEY`. Caller agents are updated with `BOLNA_API_KEY`.

## Scores

Jev scores each call on seven dimensions, each out of 5. A missing score is filled from the rounded value when the judge has one, so a tile does not sit on a dash.

| Tile | Dimension |
|---|---|
| Task | `task_completion` |
| Facts | `hallucination` |
| Language | `language_switch` |
| Memory | `dropped_intents` |
| Interrupts | `interruption_handling` |
| Repair | `repair` |
| Tone | `tone_empathy` |

The overall number is the average of those scores, scaled to 0–100. On a rerun the call page shows two circles, the earlier score and the new one, with the change between them. The transcript and the recording switch with **Before** and **Now**.

A rerun of one caller does not drop the other callers from the summary. A full rerun is the only place the whole-run held rate is compared.

## Repo

```
apps/web     Next.js UI on port 3000
apps/api     NestJS API on port 3001
packages/judge   Jev scoring and the Claude patch
personas/    Caller profiles
demo-target/ Desk manifests
apps/api/drizzle  Postgres migrations
```

The web app talks to the API through its own route handlers (`KASAUTI_API_URL`). The browser does not hold a Bolna key. Recordings are streamed by the API.

The pipeline places one call at a time, waits for the Bolna webhook, stores the transcript, asks Jev to score it, and asks Claude for a patch block when the call is not green. Apply writes that same block onto the agent. The first write replaces the live prompt. A later write appends under a Kasauti footer.

## Run it locally

```bash
pnpm install
cp .env.example .env
pnpm --filter @kasauti/api db:push
pnpm api
pnpm web
```

The site is [http://localhost:3000](http://localhost:3000). The API is [http://127.0.0.1:3001](http://127.0.0.1:3001). Postgres and Redis have to be running before the API starts. `WEBHOOK_SECRET`, `DATABASE_URL`, and a reachable Bolna webhook are required for a live call. `PATCH_ENABLED` and `NUMBER_SWITCH_ENABLED` stay off until each is set to the exact string `true`.

`pnpm test` runs the Vitest suite.

## Environment

Names only. Values stay in `.env`, which is not committed. See `.env.example`.

| Name | Where | What |
|---|---|---|
| `BOLNA_API_KEY` | API | Caller agents |
| `DEMO_BOLNA_API_KEY` | API | Demo desks |
| `ALLOWED_NUMBERS` | API | Numbers the dialer may call |
| `SEHAT_AGENT_ID`, `DEMO_AGENT_ID`, `SWAAD_AGENT_ID`, `NILA_AGENT_ID`, `NIVAS_AGENT_ID` | API | Desk agents. Rupeesetu uses `DEMO_AGENT_ID` |
| `PERSONA_AGENT_ID` | API | Caller agent |
| `TYPESAFE_API_KEY` | API | Jev |
| `ANTHROPIC_API_KEY` | API | Patch blocks |
| `DATABASE_URL` | API | Postgres |
| `REDIS_URL` | API | BullMQ |
| `WEBHOOK_SECRET` | API | Bolna webhook |
| `PATCH_ENABLED` | API | Allow Apply to write the live prompt |
| `NUMBER_SWITCH_ENABLED` | API | Allow the shared line to move |
| `KASAUTI_API_URL` | Web | API origin. Server-side only |
| `WEB_ORIGINS` | API | Extra browser origins, comma-separated. Localhost is always allowed |
| `NEXT_PUBLIC_SITE_URL` | Web | Public origin for report links |

## Deploy

The frontend is a Vercel project. The API, Postgres, and Redis are one Railway project. Voice traffic still goes through Bolna. Deploying does not place a call.

### Vercel — `apps/web`

- Connect this repo and set the root directory to `apps/web`.
- Turn on including source files outside that directory. The UI imports caller profiles from `personas/` at the repo root.
- Framework: Next.js. Install and build with pnpm.
- Set these two variables. Nothing else belongs on Vercel.

```
KASAUTI_API_URL=https://kasauti-api-production.up.railway.app
NEXT_PUBLIC_SITE_URL=https://www.kasauti.space
```

Add both `www.kasauti.space` and `kasauti.space` as domains on the Vercel project, with `www` as the primary. On the Railway API, set `WEB_ORIGINS` to `https://www.kasauti.space,https://kasauti.space`.
- Do not put Bolna, Anthropic, or database secrets on Vercel. The route handlers proxy to the API.

### Railway — API, Postgres, Redis

One project, three services:

1. Postgres. Copy its `DATABASE_URL` onto the API.
2. Redis. Copy its `REDIS_URL` onto the API. The queue is BullMQ.
3. The API, deployed from the repository root so `packages/judge` stays on the import path.

API start command:

```bash
pnpm --filter @kasauti/api start
```

Before the first boot, apply the schema once:

```bash
pnpm --filter @kasauti/api db:push
```

Set the variables in the table above on the API service. Railway injects `PORT`. Set `WEB_ORIGINS` to the Vercel origin. Point the Bolna webhook at `https://<api-domain>/webhooks/bolna`.

`PATCH_ENABLED` and `NUMBER_SWITCH_ENABLED` should stay unset until you mean to write prompts and move the shared number.

## Safety

Only call agents you own or have permission to call. The dialer refuses any number that is not in `ALLOWED_NUMBERS`.
