# Phase 0: the bot-to-bot smoke test

**Do this before anything else.** No app, no database, no dashboard. Only scripts and two Bolna agents.

## The question this answers

> Can a Bolna agent (the fake caller) phone another voice agent (the fake clinic) over a real phone line, and can the two hold a conversation good enough to judge?

If **yes**, Kasauti is buildable. If **no**, you find out on Saturday, not on Oct 29.

## Who does what

| Step | Who | Where |
|---|---|---|
| 0. Repo setup | Cursor | repo root |
| 1. Account check | Cursor writes script, you run it | `scripts/check-account.ts` |
| 2. Find voices | Cursor writes script, you run it | `scripts/list-voices.ts` |
| 3. Clinic bot (target) | **You, in the Bolna dashboard** | dashboard |
| 4. Angry-uncle bot (caller) | Cursor writes script, you run it | `scripts/create-agent.ts` |
| 5. Place a call | Cursor writes script, you run it | `scripts/call.ts` |
| 6. Inspect the call | Cursor writes script, you run it | `scripts/inspect-call.ts` |
| 7. Run the test matrix | You | terminal + your phone |
| 8. Write the verdict | You (Cursor can draft) | `docs/phase0-results.md` |

Before Saturday (Friday's jobs): Bolna account created, API key made, wallet topped up with about $15, Indian inbound number purchase started, question posted in Bolna Slack about buildathon credits and whether bot-to-bot calls are fine.

---

## Step 0: Repo setup (Cursor)

Create only these:

```
kasauti/
  package.json          # type: module; deps: zod, dotenv; devDeps: tsx, typescript, @types/node, vitest
  tsconfig.json         # strict, ESNext modules, moduleResolution bundler
  .gitignore            # node_modules, .env, runs/
  .env.example          # already provided
  scripts/
    lib/bolna.ts        # tiny shared client (below)
    lib/env.ts          # loads + validates .env with zod
    check-account.ts
    list-voices.ts
    create-agent.ts
    call.ts
    inspect-call.ts
  runs/                 # raw outputs (gitignored)
  fixtures/             # hand-picked call JSONs to keep (committed)
```

`package.json` scripts:
```json
{
  "check": "tsx scripts/check-account.ts",
  "voices": "tsx scripts/list-voices.ts",
  "agent:create": "tsx scripts/create-agent.ts",
  "call": "tsx scripts/call.ts",
  "inspect": "tsx scripts/inspect-call.ts"
}
```

### `scripts/lib/env.ts`
Load `.env` with dotenv, validate with zod: `BOLNA_API_KEY` (required, starts with `bn-` ⚠️ prefix unverified, so only warn), `BOLNA_BASE_URL` (default `https://api.bolna.ai`), `ALLOWED_NUMBERS` (comma list of E.164, at least one), optional `PERSONA_AGENT_ID`, `CLINIC_AGENT_ID`, `CLINIC_NUMBER`, `MY_PHONE_NUMBER`.

### `scripts/lib/bolna.ts`
One function `bolna(method, path, body?)`:
- Adds `Authorization: Bearer <key>` and `Content-Type: application/json`.
- On non-2xx: print status and the response body (Bolna returns useful error text, e.g. `400 Provided language … is not available for the model`), then exit 1.
- Returns parsed JSON.
- Never prints the key.

---

## Step 1: `scripts/check-account.ts`

`GET /user/me` → print wallet balance and concurrency limit (⚠️ field names unverified: print the whole JSON pretty if unsure). Save to `runs/phase0/account.json`.

**Pass:** you see your balance. If you get 401, the key is wrong.

## Step 2: `scripts/list-voices.ts`

Call Bolna's List voices endpoint (⚠️ check the exact path at https://www.bolna.ai/docs/api-reference/voice/get_all). Filter to provider `sarvam`. Print a table: `voice_id`, display name, language, gender if present. **Highlight voices whose id contains `_enhi_`** (Hindi-English code-mixed). Save full output to `runs/phase0/voices.json`.

**You then pick:** one male `_enhi_` voice for the angry uncle. Write its `voice_id` and display name into `personas/angry_uncle/agent.json`.

## Step 3: Build the clinic bot (you, in the dashboard)

The dashboard is faster than the API for this one.

1. New agent → name `sehat-clinic-v1`.
2. Prompt: copy from `demo-target/sehat_v1.md` (the **v1** prompt; it's meant to be fragile).
3. Settings exactly as listed in `demo-target/sehat_v1.md` (English only, `hangup_after_silence: 6`, etc.).
4. Welcome message: `Hello, Sehat Clinic, this is Riya. How can I help you?`
5. Link the Indian inbound number to this agent (Inbound tab, or `POST /inbound/setup` ⚠️). Set the inbound limit to unlimited and leave the whitelist open for testing.
6. Put the agent id in `.env` as `CLINIC_AGENT_ID` and the number as `CLINIC_NUMBER`. Add the number to `ALLOWED_NUMBERS`.
7. **Sanity check:** call the clinic number from your own mobile and talk to Riya for 30 seconds. If that doesn't work, nothing else will.

**Number not approved yet?** Skip linking and go to Step 7, Test A (the uncle calls your phone). Test B waits until the number works.

## Step 4: `scripts/create-agent.ts <folder>`

Usage: `pnpm agent:create personas/angry_uncle`

- Reads `<folder>/agent.json` (a Bolna `POST /v2/agent` body).
- Replaces the string `"@file:prompt.md"` with the contents of `<folder>/prompt.md`, and `"@file:welcome.txt"` with `<folder>/welcome.txt` (trimmed).
- Sends `POST /v2/agent`. Expect **201** with `{ agent_id, state }`.
- Prints `agent_id`. Saves request and response to `runs/phase0/create-<name>.json`.
- If `<folder>/.agent_id` exists, ask before creating a duplicate (later this becomes an update; for Phase 0, one agent is enough). Writes `.agent_id` after success.

You then put the id in `.env` as `PERSONA_AGENT_ID`.

**If Bolna rejects the body:** read the error, check the field against https://www.bolna.ai/docs/api-reference/agent/v2/create, fix `agent.json`. Common traps: `pipelines` must be an array of arrays; Sarvam language is `hi`, not `hi-IN`; some transcriber + language pairs aren't allowed.

**If the content filter restricts the agent:** soften words in `prompt.md` (anger through tone only). Never add insults.

## Step 5: `scripts/call.ts --to <E.164> [--agent <id>] [--label <text>]`

- `--agent` defaults to `PERSONA_AGENT_ID`.
- **Refuses** if `--to` is not in `ALLOWED_NUMBERS`.
- Sends `POST /call`:
  ```json
  {
    "agent_id": "<persona agent>",
    "recipient_phone_number": "<--to>",
    "user_data": {
      "target_name": "Sehat Clinic",
      "goal": "Get a refund, or at least a callback, for a ₹500 consultation fee charged for an appointment the clinic cancelled.",
      "seed_script": "1) Complaint with transaction ID T2410UPI88231. 2) Reject a generic apology. 3) Ask for a manager. 4) Accept a callback if given a time window. 5) Confirm your callback number."
    },
    "bypass_call_guardrails": true
  }
  ```
  (Values come from `personas/angry_uncle/defaults.json` so you don't hard-code them.)
- Prints `execution_id`.
- Then polls `GET /executions/{execution_id}` every 5 s and prints each **status change** with a timestamp (`queued → initiated → ringing → in-progress → call-disconnected → completed`).
- Stops on a terminal state: `completed, no-answer, busy, failed, canceled, stopped, error, balance-low`. **Do not stop on `call-disconnected`**; the recording and duration are empty until `completed`.
- Hard timeout 8 minutes, then print the last status and exit.
- Appends one line to `runs/phase0/calls.jsonl`: `{ts, label, to, agent_id, execution_id, final_status}`.

## Step 6: `scripts/inspect-call.ts <execution_id>`

1. `GET /executions/{id}` → save to `runs/phase0/<id>/execution.json`.
2. Print a summary block:
   ```
   status / duration / hangup_by / hangup_reason
   cost (cost_breakdown, whole object)
   time_to_first_audio (latency_data)
   ```
3. Print the transcript **as turns**: split the flat string on lines starting with `assistant:` or `user:` (continuation lines join the previous turn). On the persona's execution, `assistant` = the uncle, `user` = the clinic. Print as:
   ```
   [00] UNCLE : हेलो? हाँ, हेलो? Clinic से बात हो रही है?
   [01] CLINIC: Hello, Sehat Clinic, this is Riya...
   ```
   Also print: number of turns per side and the longest run of consecutive turns by one side (a long run means they're talking past each other).
4. Download `telephony_data.recording_url` to `runs/phase0/<id>/recording.<ext>`. Try with the Bearer header first; if that fails, try without. Print which worked.
5. If `ffprobe` is installed, print channels (1 = mono, 2 = stereo), sample rate and duration. If not, say so.
6. If `CLINIC_AGENT_ID` is set: fetch the clinic agent's recent executions (⚠️ `GET /v2/agent/{agent_id}/executions`, check the docs), pick the one whose start time is within 2 minutes of this call, save it to `runs/phase0/<id>/target-execution.json` and print its transcript the same way. This is what the clinic **heard**, which shows speech-recognition errors.

---

## Step 7: Run the test matrix (you)

Listen to every recording. Don't trust the transcript alone.

| Test | Call | How many | What it proves |
|---|---|---|---|
| **A** | Uncle → **your mobile** (`MY_PHONE_NUMBER`). You play Riya the receptionist. | 1–2 | The caller bot sounds like a real Hinglish caller and follows its beats. Works even without the clinic number. |
| **B** | Uncle → **clinic number** | 3 | **The real test.** Two bots, one call. |
| **C** | Only if B had turn-taking problems: apply one fix from the list below, then repeat B | up to 3 rounds | Whether the problem is fixable with settings |

**Fixes to try for B, one at a time (change one thing, re-run, write down the result):**
1. **Both greet at once:** set the uncle's `welcome_message_delay` to 1000 and make its welcome just `हेलो?`. If Bolna allows an empty welcome message ⚠️, try empty so the clinic always speaks first.
2. **Uncle keeps getting cut off by the clinic:** raise the uncle's `number_of_words_for_interruption` to 4.
3. **Long silences / both waiting:** lower the clinic's welcome delay to 0; raise `hangup_after_silence` on both to 20 for the test.
4. **Uncle misunderstands the clinic badly:** switch the uncle's transcriber to a code-switching model (⚠️ check which provider/language pairs Bolna accepts) and compare.
5. **Call never ends:** confirm `hangup_after_LLMCall: true` and `call_terminate: 180` on the uncle.

Update the agent after a fix (dashboard edit is fine for Phase 0). Note every change in the results file.

## Step 8: Write `docs/phase0-results.md`

Use this template. Fill in real observations only.

```markdown
# Phase 0 results

Date:
Verdict: GO | RETRY | NO-GO

## Calls
| # | Test | execution_id | final status | duration | turns (uncle/clinic) | ended by | cost | notes |
|---|---|---|---|---|---|---|---|---|

## Observations
- Who spoke first? Did greetings collide?
- Did they respond to each other's actual words, or talk past each other?
- Transcript quality on the uncle's side (Hinglish/Devanagari readable?):
- What the clinic heard (target-side transcript) vs what the uncle said:
- Recording: mono or stereo? Needed auth to download?
- Concurrency: did the inbound leg count? (check /user/me or the dashboard during a call)
- Real cost per minute (both legs):
- Content filter issues:

## Fixes tried
| Fix | Result |

## Decision
Why GO / RETRY / NO-GO:
Next step:
```

### Verdict rules

**GO** if at least **2 of 3** Test B calls meet all of these:
- connected and reached `completed`
- **6 or more turns** alternating between the two bots
- each bot responds to what the other said (not two monologues)
- the transcript is readable enough that a human could score it
- the recording downloads
- the call ended on its own within 4 minutes

**RETRY** if calls connect but turn-taking is broken. Work through the fix list (max 3 rounds), then decide.

**NO-GO** if calls never connect, or no fix makes them usable. Then:
1. Ask in Bolna Slack whether outbound-to-bot is supported.
2. Try Fallback A from `docs/ORIGINAL_SPEC.md` (your own caller on a Plivo audio stream) on Sunday.
3. If neither works by **Monday Oct 19 night**, switch projects.

### After GO
1. Copy 2–3 representative `execution.json` files into `fixtures/` (they become test data).
2. Commit with message `phase0: GO`.
3. The Cursor rule now lets work move to `docs/TECH_SPEC.md` milestone M1.
