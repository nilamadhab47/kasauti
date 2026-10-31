# Kasauti: product spec

*Owner: Nilamadhab Senapati (solo). Bolna Symphony Buildathon, submit by Sat 31 Oct 2026.*
*Working name. "Kasauti" (कसौटी) is the touchstone used to test gold.*

## 1. One line
Kasauti phones your voice agent as India's toughest callers, then gives you a red/green report card on what broke, before your customers find out. Change your prompt, rerun, and see what got fixed.

## 2. Problem
Indian businesses are putting voice agents on clinic, delivery, lending and support lines. Builders test them in polite English from a quiet room. Real callers:
- mix Hindi and English mid-sentence, or switch language fully
- talk over the bot
- call from a busy market
- speak a dialect
- go quiet while they find their glasses

The bot mishears, invents a doctor's timing, hangs up on a grandmother, or loops "Sorry, I didn't get that." Builders find out from angry customers. Manual testing doesn't scale: one builder, one phone, one accent, and every prompt change can break something that used to work.

## 3. Users
- **Primary:** a small B2B team that ships voice agents for Indian customers. An agency, or an in-house team. They usually build on Bolna. Bolna Slack is where we meet them. Bolna the company is not the first buyer.
- **Secondary:** the same team’s client, who receives a read-only report and never logs in.

**Job to be done:** "Before I ship this prompt change, tell me whether my bot still handles real Indian callers, in a report I can send to my client."

**Framing:** a regression suite. The first brief is the hook. Rerunning after every change is what they pay for.

The build plan is `docs/PLAN.md`. This file keeps the product rules. If they disagree, `docs/PLAN.md` wins on scope and order.

## 4. Positioning (honest)
Cekura, Coval and Hamming already offer simulated callers, accents, noise and some Hindi. Never say "nobody tests Hinglish." Kasauti's angle:
1. **India-first persona library**, not a language toggle: real Indian call situations written natively in Devanagari and Hinglish, played with Sarvam code-mixed voices.
2. **Bolna-native and +91-native:** real calls from Indian numbers over Indian carriers.
3. **A dashboard a B2B team can use the same day:** add a bot, pick a pack, read a brief, rerun, share the link. An API starts that same run. No SDK and no button inside Bolna.
4. **Evidence-backed judging:** [Jev](https://docs.typesafe.ai/introduction) sets the score. Claude writes the brief. Every quote has to be a line from the call.

## 5. What we ship so one company can onboard

Full sequence, pages, API, and the later list: `docs/PLAN.md`.

### In that product
- Workspace with a magic-link invite.
- A bot: name, phone number, platform, task, facts sheet, consent tick.
- Six caller templates, a clinic pack, a delivery pack, and a form to add a caller.
- A queue, at most 3 calls at once.
- A brief on top of the grid: pass or fail, worst quote, one prompt change. Audio and transcript underneath. Cost of the run on the page.
- Rerun, compare, and a public read-only link.
- An API key. `POST /v1/runs` and `GET /v1/runs/:id` create and read the same run as the button.

### Later
- The bot’s own transcript beside the caller’s. Latency from the recording. Run history.
- An outbound webhook and a sample GitHub Action.
- The customer’s own Bolna key.
- Training mode, where the caller phones a person and the brief scores the person.
- An embeddable test button. A price page. Nightly runs. Slack. Teams and SSO.

## 6. Personas

| ID | Who | Tests mainly | Priority |
|---|---|---|---|
| `angry_uncle` | Sharma ji, 58, Delhi, ₹500 UPI refund for a cancelled appointment | hallucination, task completion, tone | **Core** (Phase 0) |
| `lang_switcher` | Neha, 35, Gurgaon: English → full Hindi → English mid-call | language switch, dropped intents, hallucination | **Core** |
| `noisy_market` | Priya, 32, Lajpat Nagar market, real market noise track | repair, task completion | **Core** |
| `interrupter` | Vikram, 29, Bengaluru, jumps into pauses, stacks questions | interruption handling, dropped intents | **Core** |
| `elderly_slow` | Kamla Devi, 74, Lucknow, slow speech, long fumbles | dead air / patience, tone | Stretch |
| `dialect_bhojpuri` | Ramesh, 40, Bhojpuri-flavoured Hindi vocabulary (dialect, not accent) | task completion, repair | Stretch |

Full prompts, beats and pass criteria: `docs/ORIGINAL_SPEC.md` §4.

Every persona follows the same rules: Hindi in Devanagari, no profanity or threats, never reveals it's a bot or a test, short replies, fixed "beats" in order (so reruns face the same pressure), ends the call by about 2.5 minutes.

## 7. Scoring (what the report card means)

Eight dimensions, 0–5 each:

| Dimension | Question |
|---|---|
| Task | Did it achieve the caller's goal and confirm key details correctly? |
| Hallucination | Did it state anything not in the facts sheet? (5 = nothing invented) |
| Language | Did it follow the caller's language within one turn? |
| Intents | Did it answer or acknowledge every distinct thing the caller asked? |
| Interruptions | When cut off, did it stop and answer the newest question? |
| Latency | Response speed and silence handling (scored by code; "n/a" in MVP without audio analysis) |
| Repair | When it misheard, did it ask a specific clarifying question instead of looping? |
| Tone | Polite, calm, respectful to elders, de-escalates anger |

- Cell colour: **green ≥ 4**, **amber = 3**, **red ≤ 2**, grey = n/a or needs review.
- Persona verdict: **red** if any of that persona's critical dimensions ≤ 2, or hallucination ≤ 2, or the call made no progress. **Green** if all critical dimensions ≥ 4 and nothing is red. Otherwise amber.
- **Pass rate** = green personas / personas run. Amber is not a pass.
- Every score below 5 must quote the target's exact words. No evidence, no score.

## 8. User flow
The customer flow, the pages, and the API are in `docs/PLAN.md` §1, §2 and §7.

## 9. Demo target
"Sehat Clinic" on Bolna. v1 is a realistic but fragile first draft (`demo-target/sehat_v1.md`); v2 applies the fixes (`demo-target/sehat_v2.md`). Facts sheet: `demo-target/facts.json`.

The demo uses only real numbers from real runs. If v2 still fails a persona, that red stays on screen.

## 10. Success
Fill in real numbers only.
- One company added their own bot, ran a pack, and either reran after a prompt change or sent the report link to a teammate.
- Sehat v1 → v2 pass rate, from real runs.
- A script started a run through the API and got the same brief as the dashboard.

## 11. Rules for calling
- A target can only be added with the consent tick: "I own this agent or have permission to call it."
- Only owner-submitted numbers are dialled. Rate limit: 3 runs per target per day.
- Calls at reasonable hours.

## 12. Dates
The build order is `docs/PLAN.md` §8. Submit the hackathon before noon IST on Sat 31 Oct 2026 with whatever of steps 1–7 is real. Interviews 5–7 Nov. Finale 20 Nov, Bengaluru.
