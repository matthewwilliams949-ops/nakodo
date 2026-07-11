# Nakodo design system — Direction B, made implementable

*2026-07-10 · Head of Design · Turns the decided visual identity (brand guide v0.3, Direction B "the blackbox", 2026-07-06) into tokens and component specs the CTO can fold into `globals.css` inside the M8 timebox. Trigger: the shipped CSS still wears pre-decision styling — light warm paper, a green accent that appears in no decided palette, no mono register, and no amber token for the reveal moment `design/reveal-handoff.md` calls for. Appendix A is ready-to-paste CSS.*

**Scope honesty:** Nakodo has three styled surfaces (one-page site, intro page states, 404-ish invalid page) and plain-text emails. This document specs exactly those and stops. No component library, no theming infrastructure, no light mode — a system sized to the product.

---

## 1. Principles (the identity, restated as constraints)

1. **Dark, always.** The identity is the blackbox: "a quiet dark system in which the only bright thing that ever happens is an introduction." Web surfaces are carbon-grounded with no light mode and no `prefers-color-scheme` switch — the dark page *is* the brand statement, and the audience lives in dark terminals. (Light variants exist only for READMEs/npm, per the brand guide.)
2. **Amber is earned, never decorative.** Amber appears only where an introduction is happening or the person it revealed: the anonymous card's accent and Accept button on the card page, the revealed `{Name}`, and their sender label in the thread. Never on links, hovers, focus rings, ordinary buttons, or the mark. If a surface has amber on it, an introduction is on it.
3. **Mono is the voice, Inter is the reading.** JetBrains Mono carries the wordmark, headings, buttons, labels, code, and the guarantees; Inter carries body prose (cards, messages, paragraphs). Mono is the primary register, not a garnish — but paragraphs people actually read get a reading face.
4. **Quiet by default.** No shadows, no gradients. Hierarchy comes from the two typefaces, bone-vs-ash, and hairline rules. The system should feel like a well-kept terminal, not a web app.
5. **Motion is rare, one-time, and settles** *(added 2026-07-10 at Matthew's direction — "a little flair, make it feel special"; supersedes this file's earlier "no motion" wording).* Three moves, all CSS, all honoring `prefers-reduced-motion`:
   - **Entrance rise:** page sections fade up 10px with a 40ms stagger (`rise`, 0.55s) — the page composes itself like terminal output arriving.
   - **The struck edge:** the anonymous card's amber accent draws in top-to-bottom on arrival (`edge`, 0.9s) — the card is lit like a match, once.
   - **The phosphor glow:** on the revealed page, the headline (and the revealed `{Name}`, once M8 lands it) flares with a soft amber `text-shadow` and settles to none over ~2s (`phosphor`) — the brand guide's "one warm phosphor glow in a dark system," literally. This is the reveal's flair and appears nowhere else.
   - One persistent element: a blinking terminal cursor (`.cursor::after`, `▍` in ash) after the site h1. Nothing else loops; nothing moves on scroll, and hover stays within 120ms color transitions.

   Canonical keyframes/selectors live in the shipped `apps/web/app/globals.css` (branch `design/nakodo-feel`), which supersedes Appendix A where they differ — Appendix A predates the motion layer.

## 2. Tokens

Palette (decided 2026-07-06; hexes match the rendered brand guide):

| Token | Value | Semantic CSS var | Role |
|---|---|---|---|
| Carbon | `#141311` | `--bg` | Page ground |
| Panel | `#1E1C19` | `--surface` | Cards, code blocks, composer |
| Bone | `#EDE8DE` | `--fg` | Text, the mark, buttons |
| Ash | `#8F8A80` | `--muted` | Secondary text, quiet borders |
| Line | `#33302B` | `--line` | Hairline borders, rules |
| Amber | `#E1A23C` | `--accent` | **The introduction only** (principle 2) |
| Amber ink | `#241A08` | `--accent-ink` | Text on amber fills |

Contrast (checked): bone/carbon ≈ 13:1, ash/carbon ≈ 5.2:1 (AA normal text), amber/carbon ≈ 7.7:1, amber-ink/amber well above AA. Ash is the floor — never set text darker than ash.

Type:

- `--mono`: JetBrains Mono, fallback `ui-monospace, 'SF Mono', Menlo, monospace`
- `--sans`: Inter, fallback `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Load via `next/font`** (JetBrains Mono 400/500, Inter 400/500) — self-hosted at build. Do **not** use the Google Fonts CDN: the site promises "data lives in the EU," and a fonts CDN call on page load would quietly break that sentence.

Scale: 4px base. Spacing steps used: 4 / 8 / 12 / 16 / 24 / 40 / 64. Radius: `6px` (small: code, chips) and `10px` (cards, composer). Reading column: `40rem` (unchanged).

Type sizes: h1 `1.6rem` mono 500 (mono runs wide — down from the current 1.9rem sans), h2 `0.95rem` mono 500 uppercase-free (quiet section labels), body `1rem` Inter, muted/meta `0.9rem`, guarantees + labels `0.85rem` mono.

## 3. Components

Class names stay as they are in the JSX (`.muted`, `.card`, `.actions`, `button.accept`, `button.decline`) — this is a restyle, not a refactor. New classes come from the reveal brief only.

**Page shell.** `body`: carbon, bone, Inter, `line-height: 1.65`. `main`: 40rem column, `padding: 4rem 1.5rem 6rem`.

**Wordmark header** (add to `layout.tsx`, both surfaces): `人 nakodo` — mono, `0.95rem`, bone, the 人 and the word separated by a space; links to `/`. The mark is typeable, so the header is text, no image. Favicon: bone 人 on carbon rounded square (brand guide spec) — currently missing entirely.

**Headings.** h1/h2 in mono 500, bone, `letter-spacing: -0.01em`. The site h1 is two sentences — at 1.6rem mono it reads like a statement typed into a terminal, which is the point.

**The anonymous card** (`.card`) — the hero brand artifact. Panel surface, 1px `--line` border, radius 10px, `padding: 1.25rem 1.5rem`, body in Inter. **On the card page only**, it carries the amber accent: `border-left: 2px solid var(--accent)`. On the revealed page the recap card drops the accent (`.card.recap`) and its text drops to ash — amber has moved to the name; the card recedes into memory.

**The revealed name.** `.person` — the amber moment: amber, mono 500, same size as its surrounding h1. Used for `{Name}` in the reveal headline and (at `0.85rem`) for their sender label in the thread. This span is the only place `--accent` colors text.

**Buttons.** All buttons: mono `0.9rem`, `padding: 0.55rem 1.4rem`, radius 6px, transparent bg, 1px bone border, bone text; hover: panel bg (no color change). `button.accept` **on the card page**: amber fill, amber-ink text, no border — the one loud object in the product, and it's the yes. `button.decline`: ash border, ash text (quiet, shame-free — matches "Pass"). The send button on the revealed page is a default (bone-outline) button: messaging is ordinary life, not the introduction moment.

**Code / terminal block** (`pre`, `code`): panel bg, 1px `--line` border, mono, bone. The site's install command is the second-most-important brand surface after the card — full-width block, radius 6px, generous padding (`1rem 1.25rem`).

**The guarantees** (`ol.guarantees`): mono `0.85rem`, `line-height: 1.7`, bone; markers in ash. The brand guide's "spec register" voice artifact, applied as pure styling — the decided v2 wording is untouched.

**The thread** (reveal brief §4.2) — correspondence, not chat. No bubbles, no alignment-by-side. Each `.msg`: block, separated by a 1px `--line` top rule (`padding: 12px 0`), sender label + date on one mono `0.85rem` line (You → ash; their name → `.person` amber), body in Inter bone. `.thread-empty` (say-hello state): ash, italic Inter.

**Composer.** `textarea`: panel bg, 1px `--line` border, radius 10px, Inter, bone, `min-height: 6rem`, full width; focus: border-color bone (never amber — principle 2). Placeholder: ash.

**Chip** (`.chip`, the share-email one-tap): mono `0.8rem`, `padding: 0.3rem 0.8rem`, radius 6px, ash border + ash text; hover: bone border + bone text. Deliberately quieter than buttons — it's a convenience, not a call to action.

**Forms rule.** No single-line `<input>` on any user-facing surface. The only free-text entry in the product is the composer textarea (reveal brief §4.1 — an input field reads as a form to the platform; a textarea reads as a message to a person).

**Focus & interaction.** `:focus-visible`: 2px bone outline, 2px offset, everywhere. Transitions: `border-color/background 120ms ease` max. Nothing moves otherwise.

## 4. What stays out

Plain-text emails (styling is the absence of styling — decided), the admin/review surface (internal; readable defaults are fine), README/npm (light-context logo rules per brand guide), any dark/light toggle, any component not listed above. If M9+ adds a surface, it extends this file first.

---

## Appendix A — `globals.css`, ready to paste

Replaces the current file. Assumes `next/font` exposes `--font-mono` and `--font-inter` (wire-up in `layout.tsx`; keep the fallback stacks regardless).

```css
:root {
  --bg: #141311;        /* carbon */
  --surface: #1e1c19;   /* panel */
  --fg: #ede8de;        /* bone */
  --muted: #8f8a80;     /* ash */
  --line: #33302b;
  --accent: #e1a23c;    /* amber — the introduction only */
  --accent-ink: #241a08;
  --mono: var(--font-mono, ui-monospace, 'SF Mono', Menlo, monospace);
  --sans: var(--font-inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  color: var(--fg);
  background: var(--bg);
  font-family: var(--sans);
  line-height: 1.65;
}

main { max-width: 40rem; margin: 0 auto; padding: 4rem 1.5rem 6rem; }

.brand {
  font-family: var(--mono);
  font-size: 0.95rem;
  color: var(--fg);
  text-decoration: none;
  display: inline-block;
  margin: 1.5rem 1.5rem 0;
}

h1, h2 {
  font-family: var(--mono);
  font-weight: 500;
  letter-spacing: -0.01em;
}
h1 { font-size: 1.6rem; line-height: 1.35; }
h2 { font-size: 0.95rem; margin-top: 2.5rem; }

.muted { color: var(--muted); }
.muted em { font-style: italic; }

a { color: var(--fg); }

code, pre {
  font-family: var(--mono);
  font-size: 0.9em;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
}
code { padding: 0.1em 0.35em; }
pre { padding: 1rem 1.25rem; overflow-x: auto; }

ol.guarantees {
  padding-left: 1.2rem;
  font-family: var(--mono);
  font-size: 0.85rem;
  line-height: 1.7;
}
ol.guarantees li { margin: 0.75rem 0; }
ol.guarantees li::marker { color: var(--muted); }

/* the anonymous card — hero artifact; amber accent on the card page only */
.card {
  border: 1px solid var(--line);
  border-left: 2px solid var(--accent);
  background: var(--surface);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  margin: 1.5rem 0;
}
.card.recap { border-left-color: var(--line); color: var(--muted); }

/* the revealed person — the only text amber in the product */
.person { color: var(--accent); font-family: var(--mono); font-weight: 500; }

.actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }

button {
  font-family: var(--mono);
  font-size: 0.9rem;
  padding: 0.55rem 1.4rem;
  border-radius: 6px;
  border: 1px solid var(--fg);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
button:hover { background: var(--surface); }
button.accept { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
button.accept:hover { background: var(--accent); filter: brightness(1.06); }
button.decline { border-color: var(--muted); color: var(--muted); }

/* the thread — correspondence, not chat */
.thread { margin: 1.5rem 0; }
.msg { border-top: 1px solid var(--line); padding: 0.75rem 0; }
.msg-meta { font-family: var(--mono); font-size: 0.85rem; color: var(--muted); margin-bottom: 0.25rem; }
.msg-meta .person { font-size: 0.85rem; }
.thread-empty { color: var(--muted); font-style: italic; }

textarea {
  width: 100%;
  min-height: 6rem;
  font-family: var(--sans);
  font-size: 1rem;
  color: var(--fg);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  resize: vertical;
}
textarea:focus { border-color: var(--fg); outline: none; }
textarea::placeholder { color: var(--muted); }

.chip {
  font-family: var(--mono);
  font-size: 0.8rem;
  padding: 0.3rem 0.8rem;
  border-radius: 6px;
  border: 1px solid var(--muted);
  background: transparent;
  color: var(--muted);
}
.chip:hover { border-color: var(--fg); color: var(--fg); background: transparent; }

:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
```

**Wire-up notes (CTO):** (1) `layout.tsx`: `next/font/google` for JetBrains Mono (400, 500) + Inter (400, 500) with `variable: '--font-mono' / '--font-inter'` on `<html>` — self-hosted, no CDN call. (2) Add the `.brand` header (`人 nakodo`) and a 人 favicon to `layout.tsx`. (3) Intro page: reveal states use `.card.recap`, `.person`, `.thread`/`.msg`/`.msg-meta`, `.thread-empty`, `.chip` per `reveal-handoff.md`; the accept/decline card page needs no markup changes. (4) The current accept button's green (`#2f4f3e`) disappears from the codebase entirely — if it survives anywhere, it's off-system.
