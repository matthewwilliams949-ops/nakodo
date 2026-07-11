# /inbox — the product's first persistent human surface

*2026-07-11 · Head of Design · The M9c design brief (decided behavior: `roadmap-post-m8.md` §M9c — agent-minted magic-link primary, email magic-link fallback, per-intro tokens redirect into a session). Product consumes this directly, reveal-handoff pattern. Built on the design system and the reveal brief; nothing here changes decided auth mechanics — it choreographs them.*

## 1. The design problem

Every other product wants its persistent surface visited often; we are the anti-feed company, and our honest resting state is *nothing happening*. So the governing metaphor:

> **/inbox is a desk, not a feed.** You come to act on something your agent told you about, or to check your standing. It never manufactures a reason to return, and it is completely at peace with being empty.

The failure modes to design against are inherited dread (inbox-zero anxiety, badges, counts) and its opposite, abandonment (an empty page that reads like a dead product). The answer to both is the same: the page always *states its truth calmly* — what stands, what's quiet, who's searching on your behalf.

## 2. Anatomy (top to bottom)

Four zones, hairline-separated, same 40rem column. Zones render only their truth — an empty zone is one calm sentence, never an empty-box scaffold.

1. **Needs you** — the only zone that can be urgent, and the only zone with amber. Its items are exactly the ball-in-your-court set from the pending-v2 predicate: anonymous cards awaiting your answer (amber-edged, as everywhere) and threads where the latest word is theirs (name in person-amber, day, first line of their message in ash). Items link to the intro page, which remains the acting surface — /inbox lists, it doesn't duplicate.
   - Empty (the usual state): *"Nothing needs you."* — then the standing line from zone 2 carries the reassurance. No box, no illustration; one sentence in ash.
2. **Your asks** — each open ask: the need (Inter), `standing since {date}` (mono, ash, day precision). Empty: *"No open asks. When something's missing — a designer's eye, a second pair of hands — tell your agent."*
3. **Your introductions** — revealed intros as a quiet list: name (person-amber, mono, 0.85rem), day of last message, whose turn in plain ash words (*"their turn" / "your turn"* — never a badge, never a count). Row links to the thread.
4. **Your record** — profile first line + `{n} snippets on record` in running prose (a sentence, not a stat tile), and the standing exit: *"Your agent edits this — and 'delete me' removes everything, any time."* Links nowhere except the agent.

**Header:** the `人 nakodo` brand mark, plus `your inbox` in ash mono. **Nothing in the tab title, favicon, or header ever encodes state or counts.** The page for a user with three waiting cards and the page for a user with none have identical chrome.

## 3. The resting states (exact copy)

**Brand-new user (profile only, no asks, nothing waiting):**
> **You're early.**
> Your profile stands in the pool — it carries no identity, and your agent is the one searching. This page only ever fills with introductions, and silence is what most days here look like. That's the design, not a problem.

**Standing ask, nothing waiting** (zones 1+2 merge into the honest sentence):
> Nothing needs you. Your ask stands — *"{need}"*, since {date}. Your agent will knock when there's a person worth your yes.

Voice check: both state facts, neither apologizes, neither promises speed. "Worth your yes" is the quality bar said plainly — we don't fill silence with filler intros (concierge playbook rule 5, now surface copy).

## 4. Sign-in choreography (the brand moment)

**The agent is the key.** The line the agent says when it mints a login link (exact text for the tool's response, AIE consumes):
> Here's your key to nakodo — one click signs you in: {url}
> It works once, within the next ten minutes. Whenever you want back in, just ask me for another.

No account language ("log in to your account"), no security theater. A key you ask your go-between for — that's the mental model, and it's literally true.

**Landing:** the link sets the session and lands on /inbox directly. No interstitial, no "welcome back" banner — arriving at your own quiet desk *is* the confirmation. Entrance rise plays (first load only).

**Signed-out /inbox (exact copy):**
> **This page opens with a key from your agent.**
> Ask it — *"sign me in to nakodo"* — and it hands you a one-click link. If you left an email, the sign-in links in our emails work too. There's no password, because there's nothing to remember.

**No input fields on this page — none.** The email fallback must not become an email-entry form (that's the v1.1 flinch, rebuilt on a login screen). **Recommended mechanic** (within decided behavior, PE/TPE's call): the email magic-link fallback rides the notification emails we already send — every notice gains one line, `Your inbox: {short-lived signed link}` — so the fallback path exists without the page ever asking for anything. The only free-text input in the entire product remains the thread composer.

**Per-intro token links:** ratifying the PE's security read from the design side too — an intro token must never mint a session; a forwarded intro link opening someone's whole inbox would be the worst possible trust story. No session → the token renders the standalone intro page exactly as today. Session present and the token is yours → redirect to /inbox, landed at that introduction.

## 5. Visual notes

Design system applies wholesale; /inbox introduces one component: the **list row** — mono meta line over Inter content line, hairline top rule, the same grammar as `.msg`. Reuse those styles; do not invent a card grid. Amber budget on this page: card-item edges and revealed names, exactly as everywhere else. Motion: entrance rise on load; no per-item animation, no live updates, no polling spinners — the page is a snapshot, refreshed by refresh.

## 6. What this page never does (pinnable, the anti-feed contract)

No unread counts or badges anywhere. No state in tab title or favicon. No activity of other humans. No discovery, suggestions, or "people you may know." No timestamps finer than the day. No infinite anything — the page shows everything it has, which the proposal caps keep small. If a future feature needs one of these, it isn't this page — escalate to the CEO before building.

## 7. Build notes (PE, aligning with your TPE co-spec)

Your three page-side needs and my brief agree: session-resolver RSC pattern, `SameSite=Lax` cookie (the email-link redirect depends on it), and the signed-out page pointing agent-ward with no self-serve auth. Events worth logging: `inbox_signin_minted` (tool), `inbox_signed_in` (landing), `inbox_viewed`. The needs-you zone is your existing pending-v2 states keyed by session user — no new read model. Copy above is exact; layout is zones-in-order in the existing column; nothing needs a new page template.
