# Kasauti

A crash tester for voice agents. Synthetic Indian callers (an angry Hinglish uncle, a noisy-market caller, an interrupter, a Hindi↔English switcher and more) phone your voice agent, and you get a red/green report card on what broke.

Built for the [Bolna Symphony Buildathon](https://www.bolna.ai/symphony/buildathon/).

## Status: Phase 0 (prove one bot-to-bot call works)

Nothing else gets built until `docs/phase0-results.md` says `Verdict: GO`. The Cursor rule in `.cursor/rules/kasauti.mdc` enforces this.

## Start here
1. `cp .env.example .env` and fill in `BOLNA_API_KEY`, `ALLOWED_NUMBERS`, `MY_PHONE_NUMBER`.
2. Open the repo in Cursor and paste this into the agent:

   > Read `.cursor/rules/kasauti.mdc` and `docs/PHASE0_SMOKE_TEST.md`. Do Step 0 (repo setup) and write the scripts for Steps 1, 2, 4, 5 and 6. Don't build anything outside Phase 0. Check each Bolna endpoint against https://www.bolna.ai/docs/llms.txt before using it. When done, tell me which commands to run first.

3. Run the scripts and do the manual steps in `docs/PHASE0_SMOKE_TEST.md`.
4. Write `docs/phase0-results.md`. On GO, continue with `docs/TECH_SPEC.md` milestone M1.

## Docs
| File | What |
|---|---|
| `docs/PHASE0_SMOKE_TEST.md` | **Do first.** The Saturday bot-to-bot call test |
| `docs/PRODUCT_SPEC.md` | What we're building and why |
| `docs/TECH_SPEC.md` | How: architecture, schema, jobs, judge, milestones |
| `docs/ORIGINAL_SPEC.md` | Full research, all 6 persona prompts, judge prompt, demo script |
| `personas/angry_uncle/` | First caller persona (used in Phase 0) |
| `demo-target/` | Sehat Clinic v1 (fragile) and v2 (fixed) prompts + facts |

## Safety
Only call bots you own or have permission to call. Scripts refuse numbers not in `ALLOWED_NUMBERS`.
