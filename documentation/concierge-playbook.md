# Concierge playbook — how Matthew writes intros

*2026-07-09 · The weekly matching pass, operationalized. Sources: SCOPE.md trust rules + the KIEZ research (see kiezwerk-nuggets.md). Matching decisions are human; this is the standard the human holds.*

**ADDENDUM 2026-07-12 (Matthew's call):** the manual approve step on agent proposals is REMOVED — agent-proposed intros deliver directly; server lint, the 2-outbound cap, and inbound dampening are the guard rails. What this changes here: (1) the quality bar in this playbook now lives in the agent guidance (the two-reason rule, mutual benefit, suggested first step) and in Activation's audit of `intro_proposed` events — not in a pre-send review; (2) **Matthew's daily seed-window job flips direction: answer inbound intros fast** (new users' agents propose to his card as their first send — his response latency IS their first impression), rather than drafting outbound welcome cards; `pnpm intro:send` remains for concierge intros, which are unchanged. The review CLI (`pnpm intro:review`) is an emergency brake, off by default.

## The bar

**Rule #1 — over-invest in every user's FIRST introduction.** It's their activation moment: a mediocre first card kills them permanently, a brilliant one creates "who's next." While volume is low, hand-pick the single best available match for each new user even if it means they wait a few extra days. No intro beats a weak intro.

**Rule #2 — mutual benefit or nothing.** The test: *would both walk away feeling they gained?* Each side must hold a currency the other wants — any axis, not same-level ("distribution wisdom ↔ frontier-AI fluency" is a great trade). Never propose "access to someone better than you" in either direction; that's the extractive trap that killed the meet-an-expert products.

**Rule #3 — never rank, score, or compare people.** Not in cards, not in notes that could leak into cards. Warmth and specificity only.

## The card format

Each anonymous card = **relevant facts + the visible "why"**. The why is the trust mechanism — short, specific, evidenced from their records, and framed as the two-way trade:

> *Someone in Berlin, three weeks into an agent-memory tool, strong at backend (shipped auth + a test harness solo). Why you two: you both prototype past the "just a toy" point — they need exactly the design instinct you've shown three times this year, and they're ahead of you on the agent-persistence problem you hit last week.*

Wanted-framing wherever true (being wanted retains better than being offered): lead with *"someone building X could use exactly what you have"* when the match originates from the other side's ask.

**Every card ends with a suggested first step** — concrete and bounded, derived from the why: *"a 30-minute call this week"*, *"trade a look at each other's onboarding flows and one piece of honest feedback"*. The why is the agenda; the first step makes it walkable. (Answer to "what do people actually do with a match" — light-touch assist, then get out of the way; never scheduling software.)

## The weekly pass

1. Read new profiles/snippets/asks in the admin table.
2. **Log the needed-perspective category of every ask** (design / distribution / technical-AI / product-positioning / business-fundraising / sharp-outside-eye). This distribution = the recruiting list for the next seed wave — recruit the supply the demand is asking for.
3. Draft cards for the best available pairs (Rules 1–3). Claude drafts from the records; Matthew edits for warmth and sends via `pnpm intro:send`.
4. Track per-intro outcome (proposed → accepted → revealed → contact exchanged → real exchange confirmed). The launch gate counts **real exchanges**, not intros.
5. No good match for someone this week? Send nothing. Silence is on-brand; a filler intro is not.
