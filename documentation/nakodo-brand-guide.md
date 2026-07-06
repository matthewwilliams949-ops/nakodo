# Nakodo — Brand Guide

*v0.3 · name decided 2026-07-05 · visual identity set 2026-07-06*
*Pronounced **nah-KOH-doh** · visual showpiece: [nakodo-brand-guide.html](nakodo-brand-guide.html) (this file is the working reference; the HTML is the rendered guide)*

---

## What Nakodo is

The one-liner the brand lives next to:

> **Your agent knows what you're building better than anyone. We make it your networker — a social network with no feed, no faces, and no performance, that only ever outputs one thing: the right person, today.**

An MCP server that quietly turns your coding agent into your networker. It captures approved snippets of what you're building, compares them privately across users, and outputs exactly one thing: an introduction to the right person. No feed, no likes, no faces, no performance. Silence is the resting state; the only visible event is the meeting.

---

## The name

### Nakodo — 仲人, "the person in between"

From the Japanese **仲人 (*nakōdo*)**: *naka* (中/仲, "middle, between") + *hito* (人, "person"), voiced to *-bito* and contracted over centuries into *nakōdo*. Literally **the one who stands between two parties** — the traditional go-between of an *omiai*, the Japanese arranged introduction.

The name was chosen because the nakōdo's real, centuries-old job description maps almost line-for-line onto the product's four hard rules. This isn't a metaphor stretched to fit — the role already *is* the product:

| The nakōdo's role | The product's guarantee |
|---|---|
| Studies both sides deeply, in private, before either has seen the other | The matcher sees everything; humans see nothing until double opt-in |
| Presents each party to the other in their best honest light | The agent as emissary — it pitches your work on your behalf |
| Carries interest **and refusal** indirectly, so no one loses face | Declines are never revealed, in either direction |
| Arranges the one meeting, then steps back | The only output is an intro — no feed, no browse surface |

The nakōdo's defining trait is **discretion**. This is the deliberate opposite of the Yiddish *yenta* — the gossipy, meddling matchmaker. Where the yenta performs, the nakōdo is a quiet, respected role built entirely on trust. That contrast *is* the anti-LinkedIn, anti-build-in-public stance in a single word.

### Why it holds up

- **Coined-adjacent, so ownable** — a real word, but outside English, so it carries meaning without being generic. (In the family of Matthew's prior names: Lehren, Viertel — short, real, meaningful, non-English.)
- **Sounds like what it is** — three crisp syllables with hard consonants, phonetically at home among dev-tool names (Deno, Turso, Kubo). `npx nakodo`, `nakodo-mcp` read naturally.
- **A story you reveal, not explain** — like Asana borrowing from yoga, or Auno from *aun*. You don't have to know the etymology to use it; when you learn it, the whole product clicks.
- **The blackbox, named** — the nakōdo works behind a curtain. You never see the deliberation, only the introduction. It gives the product's invisible-matcher nature a human face without a feed.

### The through-line

**Nakōdo → the go-between → private knowledge of both sides → the single, face-saving introduction.** The name, the mechanism, and the trust model trace to one idea: a trusted intermediary who knows more than either party and reveals only what serves the meeting.

### The invisible-spirit reading (secondary, kept quietly in the brand)

An angle worth keeping in the brand's back pocket: the nakōdo behaves like a **guardian spirit** — the Greek *daimon*, the unseen agent that acts on your behalf and is the very reason background processes are called *daemons*. A spirit that runs silently and surfaces only when it has something for you. Nakodo carries this without leaning on it: it's a real human role first, a spirit-of-the-machine second. (The literal spirit names were checked and blocked — `daimon` is already an MCP dev tool on npm; `musubi`, after the fate-tying deity *musubi-no-kami*, is taken.)

### Availability & checks (as of 2026-07-05)

- **npm** `nakodo` — free.
- **Domains** — nakodo.dev (primary target), nakodo.so, nakodo.app all unregistered at check. nakodo.com is taken (not required per brief).
- **Collision scan** — no existing Nakodo MCP server, dev tool, startup, or app found across web, npm, and MCP-registry searches.
- **One open flag for the trademark read:** "Nakoda" (with an *a*) is a common Indian brand name; clear Nakodo against it in the relevant classes before public launch. Also check the nakodo.com owner.

### One connotation to hold consciously

The nakōdo's home context is **marriage** matchmaking. For a collaborator/cofounder product this reads as charm rather than baggage — "cofounder dating" is already the working idiom in startup culture — but the brand voice should lean on the *go-between* and *discretion* qualities rather than the romantic ones.

---

## Visual identity (direction set 2026-07-06)

Two directions were explored — A ("the go-between's study": warm washi ground, editorial serif, shrine vermilion) and B ("the blackbox": dark-first, monospace-led, an `o · o` mark). **Decision: Direction B, with a pure 人 as the mark instead of `o · o`** (Matthew, 2026-07-06). The identity is the blackbox: a quiet dark system in which the only bright thing that ever happens is an introduction.

### The mark — 人 (*hito*, person), pure and monochrome

The logo is the character 人 itself, in bone white: no accent dot, no stylization, no ornament. Drawn **calligraphically** — two curved brush strokes with tapered ends, crossing just below the tip so the left stroke rises above the join. The crossing (rather than a single shared apex) is deliberate: strokes that only meet at their very points read as an arrow or an A-frame; strokes that cross read as the character. Balanced in visual weight but with brush character, not a rigid mirror. It stays authentic — this is 人 as a brush writes it — and holds down to favicon size (~28px).

- **Primary:** bone (#EDE8DE) on carbon (#141311) — the mark's home.
- **On light:** carbon on bone, for READMEs and light contexts.
- **App icon / favicon / npm avatar:** bone 人 on a carbon rounded square.
- The mark is **always monochrome**. Amber never touches the logo.
- **The logo is typeable.** 人 is U+4EBA — it renders natively in terminal output, READMEs, npm descriptions, commit messages. Terminal banner: `人 nakodo — your agent's networker`.

### Palette

| Name | Hex | Role |
|---|---|---|
| Carbon | `#141311` | Ground (dark-first — the audience lives in dark terminals) |
| Panel | `#1E1C19` | Cards, raised surfaces |
| Bone | `#EDE8DE` | Text, the mark, people |
| Ash | `#8F8A80` | Quiet/secondary text |
| Amber | `#E1A23C` | **The introduction only** |

**The amber rule:** amber appears exclusively when an introduction happens — the intro-card accent, the moment an intro lands in a session. One warm phosphor glow in a dark system; scarcity is what makes it mean something. It never decorates ordinary UI, and never touches the mark.

### Type

- **JetBrains Mono** — the voice: wordmark (`nakodo`, lowercase, medium), headings, brand lines, terminal, spec text. Mono is the primary register, not a garnish. Italic for the quiet aside.
- **Inter** — body, when there's a lot to read.

### Voice artifacts (canonical)

- **Tagline register:** `// no feed. no faces. the only output is a person.`
- **The guarantees set like a spec** — the four trust rules written in RFC 2119 register, in mono: *"Profiles MUST NOT be displayed — only compared. Declines MUST NOT be revealed. Ever."* The audience's native idiom for a promise you can hold someone to.
- **Design for the real surfaces first** — the anonymous intro card is the only artifact users ever see and is the hero brand surface; the terminal (`npx nakodo`) and the README/registry card come next. The identity is judged there, not on a poster.

### Explored and parked

Direction A in full (washi/sumi/shu palette, Newsreader/Hanken Grotesk, shrine vermilion); the vermilion-dot "crossing" mark; the hanko seal mark; the `o · o` circle-dot system and its quiet/introduced/connected state lifecycle (dropped — it retrofitted a single-apex mark that we're no longer using); the symmetric single-apex typeform (read too much like an arrow).

## Naming lineage note

Nakodo is the second Japanese-sourced name in Matthew's work, after **Auno** (from *aun*, the paired breath — a coordination product). The two are unrelated products; the shared thread is the *method*, not the language: name the promise precisely at its source, then wear it lightly. Auno named **synchrony**; Nakodo names **the fateful, discreet introduction**. Where Auno is about many parts moving as one breath, Nakodo is about two strangers being quietly brought together by a third who knows them both.

---

## Voice & tone (starting point)

Quiet, discreet, anti-performance. The brand should never sound like a social network or a growth-hack. It speaks the way a trusted go-between would: understated, confident, allergic to hype.

**Lean toward:** the right person · today · quietly · in private · your agent knows · an introduction · off the record · no feed, no faces

**Steer clear of:** network · grow your audience · build in public · engagement · viral · supercharge · AI-native · 10x

---

## What's next

- **Register nakodo.dev** and reserve the npm package name.
- **Trademark read** — Nakodo vs. "Nakoda" (India) and any nakodo.com holder, in dev-tools and social classes.
- **Visual identity** — direction set (the blackbox: pure 人 mark in bone on carbon, amber reserved for the intro; see above). Remaining: exact mark geometry (stroke weights, taper, clearspace), the intro-card design as the hero artifact, and the one-page site.
- **The MCP server name + tool descriptions** — matter more than the brand for agent discovery; `find_collaborator(need)` stays literal regardless of brand. See [SCOPE.md](../SCOPE.md).
