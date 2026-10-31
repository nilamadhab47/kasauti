# Kasauti: UI plan

The interface has one job: a person who has never seen Kasauti can test a bot and forward the result. The report is the product. Everything else is how they get there.

Built as a Next.js app with shadcn/ui. It calls the NestJS API. The look below is the spec for those components.

## 1. Feel

Calm, sharp, and a little editorial. It should look like a lab report a founder would send to a client, not a call-centre console and not a hackathon landing page.

- Paper background, near-black text, hairline borders.
- One accent: ochre, used as a thin rule and for the wordmark. It is the touchstone mark. It is not a gold theme.
- Pass is green. Fail is red. Amber is the same ochre, used only on a score. Nothing else is coloured.
- The verdict is a serif, large. Everything else is a plain sans.
- Type ramp: verdict around 40px, section titles 18px, body 15px, labels 12px. Plenty of space. No dense admin tables on the first screen.
- Motion is status only. A row moves from "queued" to "talking". The brief appears when scoring finishes. No decorative animation.
- The shared report must read well on a phone. The workspace can be desktop-first.

Fonts, from a CDN: **Newsreader** for the verdict and the caller names, **Figtree** for the UI. Both are free and readable.

## 2. The front door

A stranger does not land on a signup form. They land on the Sehat sample, which is a real run.

Top: `Kasauti` and `Crash tests for voice agents.`

Then the real brief from Sehat v1: failed, the quote where Riya invents appointment 241, and the prompt line that would have stopped it. Under that, a short grid and one audio clip.

One button: **Test your bot**. Secondary text link: **See the rerun**, which is Sehat v2 beside v1.

That is the whole marketing page. No feature grid, no logos, no "how it works" in three cartoons.

## 3. Onboarding

Three fields, then a run. We do not ask for company size, role, or a card.

**Test your bot**

| Field | Why it is there |
|---|---|
| Bot name | So the report has a title. Placeholder: `Sehat Clinic`. |
| Phone number | The number the callers will dial. Helper: `A staging number you own.` |
| What it should do | One sentence. Placeholder: `Book doctor appointments and explain the refund policy.` |
| Facts | A textarea. Helper: `The only things the bot is allowed to say. We mark anything else as invented.` A clinic example can be inserted with one click. |
| Consent | `I own this bot or I have permission to call it.` The run button stays off until this is ticked. |

Under the form, pack chips. **Clinic** is selected. The chip shows the callers inside it: Sharma ji, Neha, Priya, Vikram. They can open a pack and untick one. **Add a caller** is a text link, not a step in this form.

The button says **Run clinic pack**. It does not say Submit.

If they are new, the magic link happens here. They type an email, we send the link, they come back to this same form with the fields still filled. We do not make them rebuild it.

After the first bot exists, the home screen is the list of bots. Each row is the name, the number, the last verdict, and **Run again**. Empty state is the same form, not an illustration.

## 4. Callers

Callers are people, shown as a short list, not as avatars and not as cards in a marketplace grid.

```
Sharma ji          Delhi · refund he was not owed          in this pack
Neha               Gurgaon · switches to Hindi mid-call    in this pack
Priya              Lajpat Nagar · calls from a market      in this pack
Vikram             Bengaluru · talks over the bot          in this pack
```

A selected row has the ochre rule on its left edge. Opening a row shows three beats and a sample line, so they know who is about to call. **Add a caller** asks for a name, a goal, and the beats in order. Voice is a short list from Bolna, with the language. We do not show a voice studio.

## 5. While it runs

The run page is the same page as the finished report. Before scores exist, the brief area says who is on the phone.

```
Sharma ji is talking
Neha is queued
Priya is queued
Vikram is queued
```

Each row has a live line of transcript when Bolna sends one, so they can see it is a real conversation. When a call finishes, that row collapses to a verdict pill. When all of them finish, the brief replaces the status block. They do not navigate to a different "results" screen.

If a call fails before anyone speaks, the row says `Call failed. The carrier rejected it. No charge.` and the run still completes the others.

## 6. The report

This is the screen that has to look good.

```
Sehat Clinic                                          v1 baseline
Failed · 0 of 4 callers passed                        Run again    Share

Riya invented appointment 241 and cancelled it.
The facts say she cannot process a refund.

"I have cancelled appointment ID 241 for you."
Sharma ji · turn 17

Change this line in the prompt
You cannot process refunds. Take the transaction id, apologise,
and promise a callback within 24 hours.

────────────────────────────────────────────────
Caller          Task   Facts   Language   Tone
Sharma ji       Fail   Fail    —          Fail
Neha            Fail   Fail    Fail       —
...

Suggested lines
1. ...
2. ...

This run cost $0.42
```

Rules for this screen:

- The verdict is the biggest text. Failed is red. Passed is green. The pass rate sits on the same line, smaller.
- The quote is set as a quotation, in the serif, with the caller and the turn under it.
- The prompt change is a block they can copy. One click copies it.
- The grid uses the words Pass, Mixed, and Fail in the cell. The number 0–5 is in the call detail, for the person who wants it. A client reading the share link should not have to learn a scale.
- Latency cells say `—` until we can score them.
- Audio lives on the call page, one click from a row. The report itself plays the single worst clip, under the quote, so they can hear it without leaving.

**Call page.** Caller name, verdict, the audio bar, then the transcript as a conversation. Sharma ji on one side, the bot on the other. A failing turn has the ochre rule and the judge's one-line reason under it. Metrics sit at the bottom in small type: duration, who hung up, cost.

**Compare.** Two columns, v1 and v2, same callers. A cell that flipped is marked. The header is a sentence: `Pass rate 0/4 → 3/4.` If nothing flipped, the sentence says so. We do not draw a celebration.

**Share link.** The same report, with Run again and the workspace nav removed. Footer: `Tested with Kasauti`. The client can play audio and read the quote. They cannot start a call.

## 7. The rest of the workspace

A thin top bar: wordmark, the bot's name, and a menu with **API key** and **Sign out**. API keys are a settings page with one key, a copy button, and a six-line example of `POST /v1/runs`. No documentation site.

Bot page, once they have history: last run's verdict, **Run again**, and a list of past runs with the label and the pass rate. That list is the history. We do not add charts until there are enough runs to need one.

## 8. Words

Short, specific, and in the customer's language. The UI chrome is English. Caller speech stays in Devanagari where the caller speaks Hindi.

| Say | Avoid |
|---|---|
| Test your bot | Get started |
| Run clinic pack | Submit |
| Facts the bot may say | Knowledge base |
| Invented | Hallucination, on the report. The score key can keep the word for us. |
| Call failed | Something went wrong |
| This run cost $0.42 | Usage |

Errors tell them what to do next. A bad phone number: `Use the full number, with +91.` A refused consent: the tick, not a modal essay.

## 9. What we will not put on screen

- A sidebar of twelve destinations. There are four: bots, the open run, callers, API key.
- Avatars, illustrations of uncles, confetti, gradients, glass, and a dark theme for the first version. Paper reads better in a client email.
- Score jargon on the brief. The grid can be opened by anyone who wants the dimensions.
- A wizard with progress dots. The form is one screen.
