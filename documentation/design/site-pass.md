# Site pass — nakodo.dev pre-launch hierarchy and copy

*2026-07-11 · Head of Design · CEO task 2 (first assignment). Not a redesign — the Direction B visual system already shipped with M8. This pass changes section order and one paragraph. Implemented on branch `design/site-pass` alongside the launch-posts guarantee alignment; merge before Matthew posts #1.*

## The job, restated

A builder arriving from a launch post **already has the pitch** — they clicked through from a post that made the whole argument. The site's 60 seconds are for two things, in order: *can I try this right now* and *do I believe the trust story*. The old order (pitch → how it works → guarantees → install) served a cold visitor who never arrives; install was below three screens of text a launch-post arrival had effectively already read.

## Changes

1. **Section order → h1 · one-liner sub · Install · Five guarantees · How it works · privacy note.** Install is the second thing on the page; the guarantees sit directly under it as the trust close at the moment of decision. "How it works" becomes the depth layer for the skeptical minority who scroll, right above the privacy note. The M5 rule ("one-liner, five guarantees, install, privacy note — nothing else") is respected — same parts, launch-context order. No copy in h1/sub touched (positioning is the CEO's).

2. **Honesty fix — the "How it works" paragraph told the retired story.** It still said "*We* compare records privately," pre-M8 concierge language that contradicted both the shipped product and every launch post (which say: your agent searches, a human reviews). The rewrite matches product truth and reuses the guarantee-2 signature clause:
   > Your agent quietly keeps a record of what you're building — every snippet approved by you first. When you need someone (design, code, marketing, a co-founder), ask it: your agent searches a pool of profiles that carry no identity and proposes the introduction, and a human reviews every proposal before it reaches anyone. What arrives is an anonymous card describing a person worth meeting, on a private page. You both say yes, or nothing happens. After a yes, the card becomes a person — the name they chose to be called, and a private thread where you two take it from there. Nothing is ever sent on your behalf.

   This also retires "contact details are exchanged only by the two of you" (the pre-thread contact-field story) in favor of the thread language the reveal actually ships.

3. **Guarantees v2 canonical status confirmed:** site block = README block, verified identical 2026-07-11; launch posts now aligned to the same wording (see `launch-posts.md` header note). Any future edit to the five must change all three surfaces in one commit.

## Explicitly not changed

The one-liner and sub (CEO's positioning), the guarantees wording (decided in `agent-matching-v2.md`), the install command, the privacy note, all visual styling. The kiezwerk open item — "networker" vs "matchmaker" in the one-liner — remains Matthew's call and is not exercised here.
