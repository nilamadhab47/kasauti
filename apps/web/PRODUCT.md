# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing monorepo. The landing page is a route in the existing Next.js 16 app (`apps/web`, React 19, Tailwind v4, TypeScript, pnpm). Chosen so the marketing page shares the product's repo, fonts, brand assets, and the real prototype data, and so the one CTA can later hand straight into the product. Server-rendered for SEO/OG/favicon and a light JS payload.

## Users

Primary: solo builders and small product teams who ship a customer-facing voice agent on an Indian phone line (built on Bolna), and who need to know whether it holds up with real Indian callers before customers find the cracks. They own the system prompt and can change one line and redeploy. They evaluate the tool by pasting their bot's +91 number and reading a report.

## Product Purpose

Kasauti is a crash tester / regression tester for Indian voice agents. Synthetic Indian callers phone the bot over a real +91 line, each probing a specific failure mode, and the product returns a red/amber/green report card per call that quotes the exact line where the bot broke. The user changes one line of the prompt, reruns the same caller, and sees which cells flipped. Success = the user finds and fixes a real failure (an invented refund, a dropped question, a language it couldn't follow) before a customer hits it.

## Positioning

The wedge is Indian callers on a real Indian phone line, self-serve, with the exact line quoted as evidence. English-first voice-agent test tools (e.g. Hamming, Coval) prove the category but do not cover Hinglish / Hindi / Bhojpuri callers dialing a +91 number. Kasauti is not claimed to be the first or the only voice-agent tester — the honest edge is the Indian-caller coverage, the real line, and the self-serve loop. Built on Bolna.

## Operating Context

- The caller places a real phone call to the bot's +91 number; the bot answers as it would for a customer.
- Six caller archetypes, each a real Indian situation written in the language it happens in: the angry uncle demanding his ₹500 refund (Hinglish), the English→Hindi mid-sentence switcher, the loud market caller, the fast interrupter, the slow elderly caller, and a Bhojpuri caller.
- The judge scores each call across task completion, facts/hallucination, language switching, dropped intents, interruption handling, repair, and tone. A card is green at four-plus passing dimensions, amber at three, red at two or below.
- The core loop: paste number + allowed facts → callers ring it → read the card → fix one prompt line → rerun → compare which cells changed.

## Capabilities and Constraints

- Real +91 phone calls (not a simulator); languages: Hindi, Hinglish, English, Bhojpuri. Hindi is shown in Devanagari, Hinglish and English stay in Latin script; English is never spelled in Devanagari on screen.
- Terminology to preserve: "report card", "the line that broke", "cracked", "callers", red/amber/green cells, the touchstone (कसौटी) metaphor.
- The product grades only against the facts the user declares their bot is allowed to say; that declared truth is the single source for pass/fail.
- One CTA across the marketing surface: "Test my bot" → an early-access / waitlist form. The form is currently wired to a stub endpoint (`/api/waitlist`) that validates and logs; it does not yet store or email.

## Brand Commitments

- Name: Kasauti (कसौटी) — the black touchstone Indian jewellers rub gold on to tell real gold from fake; the product does that for AI voice agents.
- Symbol: a dark charcoal touchstone with a gold streak shaped like a voice waveform. Colours: charcoal near-black and gold. Logo files live in `public/brand/` (touchstone, lockup, and black-background variants).
- The touchstone + gold-streak-as-voice is the emotional centre; the gold streak breaking into red is "where the bot cracked."
- "Subtly Indian" means truthful details — Hinglish, Devanagari, ₹, +91, real call situations — never clichés (no mandalas, paisley, lotus, tricolour, Bollywood fonts).
- Honest positioning is binding: no invented testimonials, logos, user counts, star ratings, or "trusted by"; no "first"/"only" claims; placeholders are marked clearly.

## Evidence on Hand

- Real call data in `apps/web/lib/prototype.ts`: the Sharma ji (angry uncle) call against Sehat Clinic — a genuine failure. The broken line "I have cancelled appointment ID 241 for you." (she invented appointment 241), the diagnosis, the one-line prompt fix, and the per-dimension cells are real outputs of the system.
- Six caller archetypes with real example lines in-language.
- Brand imagery: `public/brand/` touchstone + lockup logos (provided) and four generated on-brand stone/streak pictures (streak, crack, streak-tall, six-streaks).
- NOT on hand, must not be fabricated: customer testimonials, logos of users, user/call counts, pass-rate statistics, press, product video. Real numbers (price, volumes), a production form endpoint, and the live domain are placeholders to be plugged in later.

## Product Principles

1. Show the product itself as proof — the report card, the transcript line, the waveform, the uncle's quote — never borrowed social proof.
2. Quote the exact line. Every verdict names the line that caused it; a score with no evidence is not shipped.
3. Truthfully Indian, never costume: real language, currency, and call situations carry the Indianness; no decorative clichés.
4. One honest action: paste a number, get a verdict, fix one line, rerun. Keep the path to value self-serve and short.
5. Say only what is true: no "first/only", no invented metrics; the edge is the Indian-caller coverage and the quoted evidence.

## Accessibility & Inclusion

Production-grade accessibility is required: semantic HTML, full keyboard navigation with visible focus, WCAG AA contrast, responsive from 360px to wide, no layout shift, and `prefers-reduced-motion` honored. Bilingual content (Devanagari + Latin) must each render in its own script with a font that supports it.
