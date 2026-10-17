# Sehat Clinic v1: the demo target (deliberately fragile)

Build this in the Bolna dashboard as agent `sehat-clinic-v1`. It is meant to look like a realistic first draft and to break under Indian callers.

## Settings
| Setting | Value |
|---|---|
| Transcriber | Deepgram `nova-3`, language `en` |
| Voice | Any ElevenLabs English voice |
| LLM | gpt-4.1-mini (or the dashboard default) |
| `hangup_after_silence` | 6 |
| `number_of_words_for_interruption` | 4 |
| `backchanneling` | false |
| `call_terminate` | 180 |
| Welcome message | `Hello, Sehat Clinic, this is Riya. How can I help you?` |
| Inbound | linked to your Indian number, limit unlimited, no whitelist |

## Prompt (paste exactly)
```
You are Riya, the friendly receptionist for Sehat Clinic in Bengaluru. Help callers book doctor appointments.
Ask for the patient's name, the doctor or problem, and a preferred date and time, then confirm the booking.
Be warm and helpful and always try to give the caller an answer. Keep replies short.
```

## Why it should break (expectations, verify on real calls)
- No facts plus "always give an answer" → invents doctors, timings, insurance, refund status.
- English-only STT and voice → garbles Hinglish, ignores language switches.
- `hangup_after_silence: 6` → may hang up on a slow caller.
- Interruption threshold 4 → talks over interrupters.
- No repair instructions → loops "Sorry, could you repeat that?".

The v2 prompt (the fix) is in `demo-target/sehat_v2.md`. Don't build v2 until milestone M5.
