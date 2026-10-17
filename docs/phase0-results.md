# Phase 0 results

Date: 2026-10-17
Verdict: GO

## Calls
| # | Test | execution_id | final status | duration | turns (uncle/clinic) | ended by | cost | notes |
|---|---|---|---|---|---|---|---|---|
| 1 | B (before fix) | 29bf6ccf-836d-4d69-9504-af13572cebe3 | failed | 0 | 0/0 | Error, provider code 3080, "Carrier Internal Error" | 0 | Plivo `+918035735856` → Vobiz `+917965480975`. Rang 12s. No transcript, no recording. |
| 2 | B | 9581a1ff-77bf-4594-b787-12a194dc7258 | completed | 174s | 34/49 | Callee (Riya hung up) | 18 | Vobiz CLI `+918071580188`. Recording stereo 8 kHz. |
| 3 | B | 32ea6d7d-0f6a-4c33-a19d-5a0fbbc7f634 | completed | 68s | 12/19 | Callee (Riya hung up) | 9 | Same CLI. Recording stereo 8 kHz. |
| 4 | B | 3ee2277b-dae4-4a4f-b534-87ac6f047739 | completed | 180s | 35/53 | Caller, scheduled hangup (uncle `call_terminate` 180) | 18 | Same CLI. Recording stereo 8 kHz. |

Cost is Bolna `total_cost` on the uncle execution, in cents, with `billing_settled: false`. The clinic leg is a second agent and is not included. Test A (`932447c6-6487-4097-b198-1ef2106a1ec2`, uncle → mobile) was judged by ear as working and is not in this table.

## Observations
- Who spoke first? The uncle. His welcome (`हेलो? हाँ, हेलो? Clinic से बात हो रही है?`) played, then Riya's "How can I help you?". Greetings did not collide.
- Did they respond to each other's actual words, or talk past each other? They took turns. The longest run of one speaker was 4 lines. Riya reacted to "cancel", "appointment", and "name", then stayed on booking and never gave a refund time. That is the v1 failure the demo wants, not a broken pipe.
- Transcript quality on the uncle's side (Hinglish/Devanagari readable?): Yes. Riya's English is stored as Hindi phonetic spelling (`हाउ कैन आई हेल्प यू`) because the uncle's transcriber is Sarvam `saaras:v3` with language `hi`. A person can still score it.
- What the clinic heard (target-side transcript) vs what the uncle said: Not fetched. `CLINIC_AGENT_ID` is empty.
- Recording: stereo, 8000 Hz, downloaded with the Bearer header. Files are under `runs/phase0/<id>/recording.mp3`.
- Concurrency: not checked during a live call.
- Real cost per minute (both legs): Uncle leg only, unsettled: about 6¢/min on the 174s and 180s calls, about 8¢/min on the 68s call. Clinic leg unknown.
- Content filter issues: none. The uncle stayed on the refund complaint.

## Fixes tried
| Fix | Result |
|---|---|
| Uncle input/output provider `plivo` → `vobiz` | The Plivo call failed with carrier code 3080. After the switch, outbound used Vobiz `+918071580188` and the next three calls completed. |

## Decision
Why GO / RETRY / NO-GO: All three calls after the Vobiz switch connected, reached `completed`, alternated well past 6 turns, stayed readable, downloaded a recording, and ended on their own inside 4 minutes. The gate needs 2 of 3.
Next step: Commit `phase0: GO`. The three completed execution files are in `fixtures/`. Milestone M1 in `docs/TECH_SPEC.md` is unblocked. Fill `CLINIC_AGENT_ID` before scoring what Riya's own transcriber heard.
