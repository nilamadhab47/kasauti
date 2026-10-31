# Kasauti: product plan

Phase 0 is done. Bot-to-bot calls work. This file is what we build next.

Kasauti is a regression suite for Indian voice agents. A company pastes the phone number of a bot they own, picks callers, and gets a short report they can send to their client. They change the prompt and run the same callers again.

The first buyer is a small B2B team: an agency, or an in-house team, that ships voice agents for Indian customers. They usually build those agents on Bolna. Bolna is where we meet them. Bolna is not the first customer, and we do not need a button inside Bolna’s studio to onboard them.

## Name

Keep **Kasauti** (कसौटी). It is the stone you rub gold on to see if the gold is real. That is the product: rub a voice agent against real Indian callers and see what is fake.

Say it kuh-SOW-tee. The tagline next to the wordmark is **Crash tests for voice agents.** In a room that does not know the word, one sentence is enough: "It's the touchstone. We use it to see if a voice agent is real."

Angry Uncle stays the name of a caller. It is a strong demo and a weak company name, because the product is the whole library, and a lender will not buy something that sounds like a sketch. CallCrash sounds like an outage tool. A plain English name like Probe or Suite will not be remembered.

Screens and the visual system are in `docs/UI.md`.

## 1. What the customer does

1. They open Kasauti and land in their workspace.
2. They add a bot: name, phone number, what it is supposed to do, a facts sheet, and a consent tick. The facts sheet is the only truth the judge may use.
3. They pick a situation pack, or they tick callers one by one. They can also add their own caller.
4. They press run. A queue calls a few at a time. The page shows queued, ringing, talking, scoring, done.
5. The finished run opens with a brief: passed or failed, the worst quote, and the one change to make. Under that is the grid, the audio, and the transcript.
6. They copy the suggested lines into their bot, press rerun, and see which cells moved.
7. They send a read-only link to their client.
8. If they keep prompts in code, the same run starts from an API call.

Employee training is the same callers pointed at a person, with a rubric that scores the human. It is a later product. This plan builds the bot test until one company can do steps 1–7 without us sitting next to them.

## 2. Two ways in, one run

| Surface | Who it is for | What it does |
|---|---|---|
| Dashboard | The person who owns the bot | Add a bot, pick callers, watch the queue, read the brief, rerun, share |
| HTTP API | Their developer | `POST /v1/runs` and `GET /v1/runs/:id` with an API key. Same run, same brief |
| Share link | Their client | Read-only report. No account |

An embeddable test button, a React SDK, and a plugin inside Bolna’s studio are later. They do not help the first company, because that company’s agent is a prompt and a phone number, not a page we can drop a button into.

A GitHub Action that calls the API is a thin extra once the API exists. It is a sample in the README, not a new backend.

## 3. The library

Six callers, already specified in `docs/ORIGINAL_SPEC.md` §4. Hindi stays in Devanagari. No threats, no insults. Each caller follows fixed beats so a rerun is the same pressure.

| Caller | Who | What a company learns |
|---|---|---|
| `angry_uncle` | Sharma ji, Delhi, ₹500 refund | Invented facts, missed task, cold tone |
| `lang_switcher` | Neha, Gurgaon, English then Hindi then English | Stuck in the wrong language |
| `noisy_market` | Priya, Lajpat Nagar, with a market track | Mishearing, empty “please repeat” |
| `interrupter` | Vikram, Bengaluru, talks into pauses | Ignores the newest question |
| `elderly_slow` | Kamla Devi, Lucknow, slow and quiet | Rushes, hangs up on silence |
| `dialect_bhojpuri` | Ramesh, Bhojpuri-flavoured Hindi | Cannot follow everyday wording |

Packs bind those callers to a job and a facts sheet.

| Pack | Job | Ships |
|---|---|---|
| Clinic | Book, cancel, refund policy | With the first dashboard. Sehat Clinic is the public sample |
| Delivery | “Where is my order”, address, reattempt | Before we onboard the first company |
| Collections | Due date, promise to pay, no fake waiver | After the first company, if they ask |

A custom caller is a form: name, who they are, goal, beats in order, language, voice from Bolna’s catalog. We compile that into a Bolna agent. The customer does not touch Bolna’s API. Voices stay inside Bolna, including ElevenLabs voices Bolna already offers. We do not run a second voice stack.

## 4. The report

The top of the run is a brief. Jev sets every score. Claude writes the sentence, the quote, and the prompt change from those scores:

- One line: passed or failed, and the pass rate.
- The worst quote, with the turn it came from.
- One concrete change to the bot’s prompt.

Under the brief:

- A grid, callers by dimension. Green at 4 or above, amber at 3, red at 2 or below. Latency stays blank until we score the recording.
- Each red or amber cell opens the call: audio, turns, and the evidence quote. The quote must appear in that turn. If it does not, the score is “needs review”, not a number.
- Three to six prompt lines, rolled up from the per-call hints.
- The cost of the run, in rupees or dollars as Bolna reported it, so a company can see what a pack costs.
- Rerun, and a compare view against the parent run: which cells flipped, and the pass-rate change.

Dimensions stay the ones in `docs/PRODUCT_SPEC.md` §7. Hallucination is judged only against the facts sheet. A bot that says something absent from the sheet is inventing. A bot that stays inside the sheet is not.

Persona verdict: red if a critical dimension is 2 or below, or hallucination is 2 or below, or the call never got going. Green if every critical dimension is 4 or above and nothing is red. Otherwise amber. Pass rate is green callers divided by callers in the run. Amber is not a pass.

## 5. The queue

A run creates one call per selected caller. At most three calls are in flight, started about 20 seconds apart. The rest wait. When one finishes, the next starts.

Bolna tells our server when a call changes state. We still poll if that message never arrives. We do not treat “call disconnected” as finished. The recording and the duration show up at “completed”.

Each finished call is parsed into turns, scored, and stored. When every call in the run is scored, we write the brief and the rolled-up prompt lines.

Dev and the first customer only dial numbers we have allowed, or numbers that workspace marked with consent. Caps: 3 calls at once, 8 callers in one run, 3 runs per bot per day, a daily cap so a bug cannot empty the wallet. The run page shows cost as it lands.

## 6. Accounts and the API

One workspace per company. We invite the first customer with a magic link. They can invite a teammate later. Until then, one login is enough.

Each workspace has an API key. The key can create a run and read runs and calls. It cannot change the key, and it cannot dial a number that workspace has not already saved with consent.

```
POST /v1/runs
{ "target_id": "...", "caller_ids": ["angry_uncle", "lang_switcher"], "label": "v3-refund-fix" }

GET /v1/runs/:id
→ status, brief, pass rate, calls[], cost
```

The dashboard uses the same handlers. A run started in the browser and a run started by the API are the same row.

When a run finishes we can POST the brief to a URL the company saved. That outbound webhook comes right after the API, because a B2B team will want the result in their own channel. It is not required for the first onboard.

## 7. Pages

| Page | What it is |
|---|---|
| `/` | Their bots, and a button to add one |
| `/bots/new` | Name, number, platform, task, facts, consent |
| `/bots/:id` | Packs, callers, past runs, new run |
| `/callers/new` | Custom caller form |
| `/runs/:id` | Live status, then the brief, the grid, the cost, rerun, share |
| `/runs/:id/compare/:other` | Cells that flipped |
| `/calls/:id` | Audio, transcript, evidence |
| `/settings/api` | The API key |
| `/r/:token` | Public read-only report |
| `/sample/sehat` | Our own clinic, so a stranger can see a real card before they add a bot |

Sehat Clinic v1 stays the sample that fails in public. v2 is the rerun. Numbers on that page come from real calls. A red that survives v2 stays red.

## 8. How we build it

One TypeScript repo. The dashboard is Next.js with shadcn, deployed on Vercel. The API is NestJS on Railway: it accepts requests, receives Bolna’s webhook, and runs the BullMQ queue. Postgres holds the data. Redis is the cache and the BullMQ broker. Recordings go to object storage. Jev scores each call. Claude writes the brief. The Phase 0 scripts stay, for debugging.

Do these in order. Each one is done only when its check passes.

| Step | Build | Done when |
|---|---|---|
| 1 | Parser, judge, and the brief, run on the three uncle calls we already have | The terminal prints a brief whose quotes are real lines from those calls |
| 2 | Server, database, Bolna webhook, running locally | A finished call lands in the local database without us pasting JSON. Deploy to Railway and Vercel is the last step |
| 3 | Queue | Starting a run of two callers scores both with no manual step |
| 4 | Dashboard: invite, add a bot, library, live run, brief | We can add Sehat and watch a pack run in the browser |
| 5 | Custom caller, clinic pack, rerun, compare | Sehat v2 is a rerun of v1, and the compare page shows the cells that moved |
| 6 | Share link, API key, `POST /v1/runs`, cost on the page | A script starts a run and the share link shows the same brief |
| 7 | Delivery pack, the rest of the library, one outside company | That company adds their own number, runs a pack, and receives the link. We submit the hackathon with this, plus the Sehat clip |

After that, in this order, only once step 7 is real:

| Step | Build | Done when |
|---|---|---|
| 8 | The bot’s own transcript beside the caller’s, and run history | One call shows both ears, and the bot page lists every past run |
| 9 | Outbound webhook, and a sample GitHub Action | Their URL receives the brief when a run finishes |
| 10 | Latency from the stereo recording | The latency cell is a number |
| 11 | Their own Bolna key, so minutes hit their wallet | A run on their key does not touch ours |
| 12 | Training mode | The uncle calls a person’s phone and the brief scores the person against the facts sheet |

An embeddable button waits until a customer asks for it.

If time gets short, delay steps 8–12. Keep steps 1–7. Inside those, delay the delivery pack and the custom caller form before delaying the brief, the queue, the share link, or the outside company.

## 9. Onboarding the first company

We find them in Bolna Slack, or from people Nilamadhab already knows who ship voice agents. The ask is specific: a staging number they own, the job the bot does, and the facts it is allowed to say.

On the call we send the magic link, they add the bot, we run the clinic or delivery pack, and we stay quiet while they read the brief. The onboard counts only if they change the prompt and rerun, or if they send the link to someone on their team. A single call we placed for them does not count.

We do not call their customers. We call the bot’s number. We do not take their call recordings.

## 10. What “good” looks like

- One company completed steps 1–7 on their own bot.
- Sehat v1 and v2 are real runs, and the compare page is honest.
- Every score below 5 quotes a line that is in the transcript.
- The brief is short enough to forward.
- The API starts the same run the button starts.
- The hackathon video is the uncle clip, then the dashboard, then that company’s rerun.

## 11. Explicitly later

- A test button inside someone else’s app, or inside Bolna.
- Scoring human trainees.
- Nightly schedules, Slack bots, a price page, teams and roles, SSO.
- Scraped call-centre audio.
- Our own telephony. Bolna places the calls.
