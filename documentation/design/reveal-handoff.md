# Reveal handoff — the choreography after a mutual yes

*2026-07-10 · Head of Design · Covers BUILD-PLAN M8 items (a)–(f) plus three small copy fixes found in the flow review the same day. Decided behavior comes from BUILD-PLAN M8 and `agent-matching-v2.md`; voice from the brand guide and `kiezwerk-nuggets.md`. Nothing here changes what the product does beyond what M8 already ratified — it specifies how those behaviors feel and exactly what they say.*

---

## 1. The design principle (read this before the copy)

**The yes buys personhood.** Everything before the mutual yes is deliberately anonymous — a card, no face, no name. The reveal is the one moment the product has been saving up for, and it must *visibly spend* what the yes purchased, within one second of the page loading: a name where there was a card, a channel where there was silence. Matthew's walkthrough failure ("it never connected us" / "the platform is asking for my email again") happened because the old reveal delivered a form instead of a person. Every choice below follows from one test:

> **Does the page make it obvious that a person, not the platform, is now on the other side?**

Three sub-rules:

1. **The reveal is the amber moment.** Brand guide: amber appears exclusively when an introduction happens. The revealed name is the single amber element on the page. Nothing else on any Nakodo surface is amber. This is the identity system finally doing the thing it was designed for.
2. **The agent knocks only when the ball is in your court.** In-session notices and emails fire for exactly three states — card unanswered, introduction open and you haven't said hello, their message awaiting your reply. Never for states where there is nothing for you to do. Silence stays the resting state, even after a reveal.
3. **Every sentence must be mechanically true.** No copy promises a behavior the system doesn't perform (this brief also fixes two existing violations — §7).

---

## 2. State map

Page states for `app/intro/[token]` (extends the existing `viewFor` set):

```
invalid ─ expired ─ closed          (unchanged mechanics; expired gets new copy, §7)
card ──→ waiting ──→ revealed
                       ├─ say-hello        (0 messages in thread)
                       ├─ your-turn        (latest message is theirs)
                       ├─ their-turn       (latest message is yours)
                       └─ connected        (both sides ≥1 message — gate metric 4;
                                            a quiet modifier, not a separate layout)
```

**Ball-in-your-court, defined** (for side X): intro is revealed AND (thread is empty, OR the latest message is from the other side). This single predicate drives the in-session notice, the message email, and nothing else. No read-receipts, no unread flags — "whose turn is it" is all the state we track, and it's derivable from the last message's side.

**The revealed page never lapses.** Token expiry applies only to the unanswered card (already true in `viewFor` — expiry is checked only when own response is null). State it in copy (§4, reassurance block) and pin it with a test: a revealed intro remains reachable past `token_expires_at`.

---

## 3. Onboarding addition — the display name (M8 item a)

One optional question, asked during onboarding *after* profile approval, before the email question. Exact agent-facing instruction (add as a numbered step in the `find_collaborator` onboarding response):

> Ask, optionally: "If an introduction becomes mutual — you both say yes — what should the other person call you? A first name is plenty." Be clear about the boundary: the name is never on the card, never visible to anyone before a mutual yes, and skippable — the introduction works without it.

`create_profile` input description for the new field:

> `display_name` — Optional. Shown to the other person only after a mutual yes; the anonymous card never carries it. A first name is plenty. Only include if the user offered one.

Storage: PII store (`users`), never in the pool, never in cards — same class as email. Fallback chain for `{Name}` everywhere below: `display_name` → `handle` → none (copy variants for the none case are given inline).

---

## 4. The revealed page, state by state (M8 items a + b)

Layout order (mobile-first, one column): headline → the card you accepted → the thread → composer → reassurance → first-step line. The thread is the primary surface; the card shrinks to a recap.

### 4.1 Say-hello (0 messages)

**Headline:**
> **You both said yes — this is {Name}.**
> *(no name on file:)* **You both said yes.**

`{Name}` is rendered in amber (`#E1A23C`). It is the only amber on the page.

**Card recap** (existing `.card` block, visually quieter than on the card page — smaller type or reduced emphasis):
> *The card you said yes to:*
> {card}

**Empty thread state** (muted, where messages will appear):
> No messages yet. Someone goes first.

**Composer** — a textarea, not a single-line input (a single-line field reads as a form field; a textarea reads as a message):
- Placeholder: `Say hello — they already said yes to meeting you.`
- Send button label: **`Send to {Name}`** / no name: **`Send hello`**. The addressee in the button is the anti-flinch move: it is visibly a message to a person, not a field submitted to a platform.

**The one-tap share chip** (only rendered when the user has an email on file) — a small button above or beside the composer:
- Label: `Share the email I gave you`
- Behavior: prefills the composer with `You can reach me at {email}.` — the user still presses send. Nothing is ever sent by tapping the chip alone. If they edit the text, fine; it's their message.
- No email on file → no chip, no substitute. People type whatever contact they want, or none.

**Reassurance block** (muted, one block, always present on revealed pages):
> This thread is between you two — it never touches matching, and no one else ever sees it. Contact details are shared only if and when you write them yourself. This page doesn't expire.

**First-step line** (muted, keep the existing thought, sharpened):
> The card's "why" is your agenda — most introductions start with a 30-minute call, or trading a look at what you're each building and one piece of honest feedback.

### 4.2 Thread with messages (your-turn / their-turn / connected)

- Messages render plainly: sender label (**{Name}** / **You** — their label may reuse the amber, small), date (day precision is enough), body. Newest last. No avatars, no bubbles fighting for attention — this is a correspondence, not a chat app. Async by page refresh is fine (decided).
- **their-turn** (you just sent): one muted line under the thread:
  > Sent. {Name} will be told a message is waiting — by their agent, or by email if they left one. *(no name: "They'll be told a message is waiting — by their agent, or by email if they left one.")*

  This sets the async pace honestly without leaking which channel the counterpart actually has.
- **your-turn** (their message is the latest): no extra chrome — their message *is* the prompt. Composer placeholder becomes: `Reply to {Name}` / no name: `Write back`.
- **connected** (both ≥1 message): no banner, no confetti, nothing announced. The done state is quiet by design — celebrating it would be performance. The `connected` transition exists for the metrics script and the events table, not for the humans, who are busy talking to each other.
- Contact-fields migration (M8 item f, CTO's call to migrate or drop): if migrated, an existing `a_contact`/`b_contact` value renders as that side's first message, body `You can reach me at {contact}.` — indistinguishable from a typed message. No special styling, no "legacy" marker.

---

### 4.3 The no-email choreography (CTO constraint #1 — decision: the page never re-asks)

The revealed page never asks for an email — for anyone, in any state. Re-asking there would rebuild the exact flinch this redesign exists to remove ("the platform asking for my email again"), on its flagship surface, at its most person-to-person moment. So:

- **On the page**, a user with no email on file gets one extra muted line in the their-turn state (the page already knows own-side email — the share chip needs the same join):
  > No email on file — your agent will tell you when they write back.
- **The re-offer lives in the agent channel** (§5), delivered at the moment the user actually feels the latency, in the agent's voice, as an option rather than a form. This is sanctioned design, not new behavior: the v1.1 trust brief already says "email becomes optional, *later*, framed strictly as a notification channel." The mechanics of the add-email path (extend an existing tool vs. a small dedicated one) are the CTO's call; the framing constraint is fixed — notification channel only, never shared, skippable forever.

## 5. The driven completion loop — in-session notices (M8 item c)

`pendingNotice()` becomes a lifecycle notice. The pending endpoint returns actionable states only — `card`, `say_hello`, `message_waiting` — per the ball-in-your-court predicate (§2). Identity stays off this channel: names live on the page, exactly as cards do today ("cards and counterpart data stay on the web page" — keep that rule for names).

Exact notice texts (same register as the existing one — instructions to the agent, riding on any tool response):

**card** (existing, unchanged):
> 🔔 An introduction is waiting for the user. Tell them — an anonymous card describing someone worth meeting is ready to accept or decline (the other person learns nothing unless both say yes):
>   {url}

**say_hello:**
> 🔔 A mutual yes: the user and the person from one of their introductions both accepted. Tell them the introduction is open — the other person's name is on the page, and nobody has said hello yet:
>   {url}

**message_waiting:**
> 🔔 A message is waiting on one of the user's introductions — someone they said yes to has written to them. Tell them to pick it up:
>   {url}

Multiple states at once: list each on its own line under one 🔔 block, `card` items first (a new person outranks an ongoing thread). No notice for `their-turn` or `connected` — nothing to do, so the agent stays quiet.

**The email re-offer (no-email users only, §4.3):** when a `say_hello` or `message_waiting` notice is delivered to a user with no email on file, append:

> (No email is on file, so news like this reaches the user only when they open a session. If they'd like Nakodo to knock by email instead, they can add one any time — it's used only for that, never shared, and skipping it stays completely fine. Mention it lightly, once; never push.)

Notices are stateless, so "once" can't be enforced mechanically — but the notice only fires while the ball is in the user's court, which bounds repetition, and the instruction tells the agent to keep it light.

---

## 6. Emails (M8 items c + d)

All plain text, identity-free (the v1.1 rule stands: names and content live on the page; email is an unauthenticated, forwardable surface).

### 6.1 `revealNotice` — rewrite (item d: the subject carries the action)

- **Subject:** `You both said yes — go say hello`
- **Body:**
  > You both accepted the introduction. It's open now — their name is on the page, and the first hello is waiting to be written:
  >
  >   {url}
  >
  > That page is a private thread between the two of you. Whatever contact details you share there, you share yourself — nothing is ever sent on your behalf.
  >
  > — Nakodo

### 6.2 `messageWaiting` — new

- **Subject:** `A message is waiting on your introduction`
- **Body:**
  > Someone you said yes to has written to you. Pick it up here:
  >
  >   {url}
  >
  > — Nakodo

**Send rule (the anti-nag rule):** the message email fires only when the ball *crosses* into your court — i.e., their message arrives and the previous latest message was yours (or the thread was empty and this isn't the reveal moment, which `revealNotice` already covers). Several messages from them in a row produce one email. Never re-nudge a silent recipient; one knock per turn of the ball, then silence. (In-session notices are free of this concern — they recompute per tool call and are idempotent by nature.)

---

## 7. Small fixes outside the reveal (copy only — ship with M8)

1. **Expired page** ([intro/[token]/page.tsx:31](../../apps/web/app/intro/%5Btoken%5D/page.tsx)) currently promises "If the match is still right, it will come around again" — nothing re-proposes lapsed intros; the sentence is mechanically false. Replace body with:
   > Intro pages stay open for two weeks, and this one has closed quietly — the other person was never told anything. New introductions arrive the same way this one did.
2. **Intro card email** (`introCard` in [templates.ts:19](../../apps/web/emails/templates.ts)): replace the `Accept:` / `Decline:` link pair with a single link — the labels imply one-click actions the links don't (and shouldn't) perform, and they invite deciding before seeing the card properly. Replace the last block with:
   > See the card and decide:  {url}
   >
   > They see nothing unless you both say yes — and if you pass, they'll never know this card existed.

   (Drop the `?respond=` query params; they're inert.)
3. **Waiting page** ([intro/[token]/page.tsx:45](../../apps/web/app/intro/%5Btoken%5D/page.tsx)): "your agent will let you know" becomes true only once §5 ships — hold this copy change to the same deploy. New body:
   > If they say yes too, this page opens into your introduction — your agent will tell you, and if you left an email, so will we. If not, you'll never hear about this again — silence is normal here.

---

## 8. Build notes (for the CTO — mechanics this brief assumes)

- **Pending endpoint v2:** returns `{ url, state: 'card' | 'say_hello' | 'message_waiting', created_at }`. The current implementation covers only `card` (`status = 'proposed'` + own response null) — the gap is confirmed in prod code: `sendRevealNotices` has a comment claiming "the agent surfaces the reveal in-session," but no code path does, so an email-less user who accepts never learns of the reveal. §5 closes it. Add the revealed states to the query via the ball-in-your-court predicate over `intro_messages`.
- **Events:** `message_sent` (intro_id, side) on every message; `thread_connected` (intro_id) once, on the message that makes both sides ≥1 — this event *is* gate metric 4 (M8 item e); `pnpm metrics` counts `thread_connected`. Keep `contact_shared` firing when the share chip's prefilled text is sent unmodified, if cheap — nice signal, not required.
- **Tests to pin:** revealed page reachable past token expiry; pending endpoint returns `say_hello`/`message_waiting` only for the side whose court the ball is in; message email fires once per ball-crossing; thread visible only on revealed intros (the hard rule: no cold-messaging surface can ever exist); `{Name}` never appears in any email or pending-endpoint payload.
- **Sequencing per the CEO's handoff:** backend/pool/lint first is fine — nothing here blocks that. The surfaces in §3–§7 are one coherent chunk; take them together when you get there.

## 9. Explicitly not changed

No new product behavior beyond ratified M8 (a)–(f) and the v1.1-sanctioned add-email-later path (§4.3): no read receipts, no push/real-time, no re-proposal of expired intros (copy fixed instead), no celebration state, no identity in emails or the agent channel. The attribution-question reordering in onboarding (asked after the need is served, not mid-trust-formation) is noted in the CTO inbox as a nice-to-have within the M8 onboarding rewrite — it is not part of this brief's must-ship set.

## 10. Addendum (same day) — the CTO's two build constraints

1. **No-email dead end:** answered in §4.3 (page never re-asks; agent channel carries the re-offer) and §5 (exact append text). The pending-endpoint lifecycle in §8 is what removes the dead end itself.
2. **Empty-pool front door** — copy block, **contingent on the CEO confirming the CTO's proposed N<10 behavior** (honest "you're early" answer instead of implying an imminent match). If confirmed, the `find_collaborator` ask-confirmation at N<10 becomes:

   > Registered as a standing ask: {need}. An honest note to pass on: the network is young and the pool is still small — the right person may simply not have arrived yet. The ask stays open, nothing about it is visible to anyone, and this tool will announce the introduction here when it exists. Until then, silence is normal — it means no one has been settled for.

   Register matches the existing tool responses (text the agent relays). The last clause is the brand promise doing real work: at low density, "no intro yet" must read as standards, not neglect (concierge playbook rule: "no good match this week? Send nothing — a filler intro is not on-brand").
