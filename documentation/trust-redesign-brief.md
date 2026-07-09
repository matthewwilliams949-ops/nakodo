# Trust redesign brief — v1.1 (pre-recruitment blocker)

*2026-07-09 · Decision from the CEO-session with Matthew. This supersedes SCOPE.md's v1 email-delivery design. Nothing user-facing launches until this ships.*

## The finding

Matthew, as first user, hit **trust discomfort** in onboarding — specifically the email-address ask. His read after reflection: *exchanging emails with a stranger via an agent will always be uncomfortable*, regardless of copy. The fix is structural, not textual: contact details must never pass through the agent/matching layer.

## Design changes

1. **No email at onboarding.** Registration = handle + agent-synthesized profile only. Email becomes optional, later, framed strictly as a notification channel ("we'll ping you when an intro is waiting"), never shared, never part of matching or reveal.
2. **Intros move to a web surface (Tinder-shaped, Matthew's suggestion).** An intro is a card at nakodo.dev/intros (magic-link or token auth from the MCP session): anonymous relevant-facts card → accept/decline in the app. Declines remain invisible in both directions (unchanged guarantee).
3. **Mutual accept opens an in-app connection, not an email handoff.** Minimal in-app message thread (or structured "share what you want" exchange) where the two people themselves decide what contact info to share, human-to-human. The platform never transmits contact details on anyone's behalf.
4. **In-session touchpoint stays:** the MCP server can tell the user "you have an intro waiting — nakodo.dev/intros" on next session. Agent announces; human decides on the web surface.

## Recruitment reframe (same session)

Cold DMs are dead — Matthew found them spammy and his platform accounts lack the history to carry them. Replacement motions:
- **Public builder posts by Matthew** (drafted by Claude, humanized/posted by him): Show HN, r/SideProject, r/mcp, Indie Hackers, Product Hunt — a handful across weeks 2–4, not an ongoing campaign.
- **Public replies in existing "looking for a collaborator" threads** ("I built a tool for exactly this") — authentic, targeted, not DMs.
- **Directory listings + agent-pull** (pure Claude work, unchanged).

## Gates (adjusted for the new motion)

- Seed proxy (2 weeks after first post wave): ≥25 installs, ≥40% activation.
- Launch gate (4 weeks post-launch, unchanged + one addition): ≥150 installs, ≥40% activation, ≥10 intros proposed with ≥50% accepted, **≥3 verified real exchanges** (the Boardy lesson: measure collaborations formed, not intros made).
- Failure → fallback is pre-decided: AI-native estate settlement (Dossier C in Notion, "Venture-scale search — opened 2026-07-09"), no relitigation.

## Build order

1. Strip email from registration path (API + MCP onboarding flow).
2. Intro web surface: /intros with token/magic-link auth, card UI, accept/decline.
3. Mutual-accept connection surface (minimal thread or contact-share exchange).
4. Notification plumbing: MCP next-session announcement; optional email alerts (opt-in, notification-only).
5. Then — and only then — draft the public posts and hand Matthew his first batch.
