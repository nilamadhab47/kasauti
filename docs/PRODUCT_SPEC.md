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
- **Primary:** builders and small agencies shipping voice agents for Indian customers on Bolna (beachhead: the Bolna Slack community), and later Vapi, Retell and ElevenLabs.
- **Secondary:** Indian SMBs and ops teams that bought a voice agent and want a check after every change.

**Job to be done:** "Before I ship this prompt change, tell me in 5 minutes whether my bot still handles real Indian callers."

**Framing:** a **regression test for voice agents**. The first report card is the hook; rerunning after every change is the habit.

## 4. Positioning (honest)
Cekura, Coval and Hamming already offer simulated callers, accents, noise and some Hindi. Never say "nobody tests Hinglish." Kasauti's angle:
1. **India-first persona library**, not a language toggle: real Indian call situations written natively in Devanagari and Hinglish, played with Sarvam code-mixed voices.
2. **Bolna-native and +91-native:** real calls from Indian numbers over Indian carriers.
3. **Self-serve for indie builders:** one form, one click, a shareable report. No sales call.
4. **Evidence-backed judging (Jev):** every score below 5 quotes the exact line that failed.

## 5. MVP scope (buildathon)

### In
- Register a target: name, phone number, platform, task goal, facts sheet, consent tick.
- Built-in personas (4 core, 2 stretch). No custom personas.
- Run: places one call per selected persona, at most 3 at a time.
- Report card: personas × dimensions grid, red/amber/green, pass rate.
- Call detail: audio player, transcript as turns, evidence for each failing score.
- Fix suggestions: 3–6 prompt lines rolled up from the judge's hints.
- Rerun with the same personas and beats, plus a v1-vs-v2 compare view.
- Public read-only share link.

### Out (for now)
- Real auth (use one API key per invited builder, or none).
- Custom persona editor.
- Precise audio-level latency analysis (MVP shows latency as "n/a" unless the audio service gets built).
- Precise mid-sentence barge-in (needs our own media-stream caller).
- CI integration, billing, teams.

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
1. **New target** → form → saved.
2. **Run** → tick personas, give a label (`v1-baseline`) → start.
3. **Live run** page: each persona card moves queued → ringing → talking → scoring → done.
4. **Report card** fills in. Header: "2/4 personas passed".
5. Click a cell → **call detail**: audio, transcript, evidence ("Turn 7: bot said Dr. Mehta is available Sunday. Facts: clinic closed Sunday.").
6. **Fix suggestions** panel → copy into the bot's prompt.
7. **Rerun** (label `v2-fix`) → **compare** view with flipped cells highlighted and "Δ pass rate".
8. **Share** → public link.

## 9. Demo target
"Sehat Clinic" on Bolna. v1 is a realistic but fragile first draft (`demo-target/sehat_v1.md`); v2 applies the fixes (`demo-target/sehat_v2.md`). Facts sheet: `demo-target/facts.json`.

The demo uses only real numbers from real runs. If v2 still fails a persona, that red stays on screen.

## 10. Success metrics for the buildathon
Fill in real numbers only; never round up.
- Outside builders whose bots were tested: target **5+**
- Calls run: target **50+**
- Distinct bugs found in outside bots, and how many were fixed and confirmed by a rerun
- At least **one builder who reran** after changing their prompt (the repeat-use signal)
- Sehat v1 → v2 pass rate
- 1–3 real quotes from builders (with permission)

## 11. Rules for calling
- A target can only be added with the consent tick: "I own this agent or have permission to call it."
- Only owner-submitted numbers are dialled. Rate limit: 3 runs per target per day.
- Calls at reasonable hours.

## 12. Key dates
| Date | Milestone |
|---|---|
| Sat Oct 17 | Phase 0: one real bot-to-bot call (go/no-go) |
| Sun Oct 18 | First scored call; 60-second clip |
| Tue Oct 20 | 3 builders said "test my bot" (go/no-go) |
| Sun Oct 25 | Full pipeline, report card, outside bots tested |
| Thu Oct 29 | 3-minute demo video |
| **Sat Oct 31, before noon IST** | **Submit** |
| Nov 3 / Nov 5–7 / Nov 8 / Nov 20 | Shortlist / interviews / results / finale in Bengaluru |
