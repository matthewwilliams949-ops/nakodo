# Legal documents — launch drafts

*Drafted 2026-07-11 (CEO) for the 0.2.0 launch. Three documents: [privacy-policy.md](privacy-policy.md), [terms-of-service.md](terms-of-service.md), [impressum.md](impressum.md).*

## ⚠️ Read before publishing

**These are founder drafts, not legal advice.** Claude is not a lawyer. They are written to be accurate to Nakodo's actual data model and reasonably complete for a German-operated, GDPR-scoped launch — but **get them reviewed** (a data-protection-literate lawyer, or at minimum a reputable German Impressum/Datenschutz generator cross-check) before they go live. The Privacy Policy and Impressum are effectively required (GDPR Art. 13 + §5 DDG); the ToS is strongly recommended for a service that connects strangers.

## Placeholders you must fill (search for `[[ ]]`)

- `[[LEGAL NAME]]` — your full legal name (Impressum requires it; a sole operator uses their own name until there's a company).
- `[[STREET ADDRESS]]`, `[[POSTCODE CITY]]` — physical address. **German Impressum law requires a real, reachable postal address** (a c/o or business address is fine; a PO box alone is not sufficient). If you don't want your home address public, a common solution is a `c/o` service address — flag this and we'll decide.
- `[[CONTACT EMAIL]]` — suggest `hello@nakodo.dev` (already live) or a dedicated `privacy@`/`legal@`.
- `[[VAT ID]]` — only if you have a USt-IdNr.; delete the line if not.
- `[[HOSTING REGION]]` / processor confirmations — I've filled these from the code (Vercel, Resend EU, Postgres EU) but **confirm each processor's actual data-processing region and that a DPA/AVV is in place** before relying on the "data stays in the EU" claim publicly.

## Wiring them into the site (after review)

Once you've signed off, these become three routes — `/privacy`, `/terms`, `/impressum` — linked from the site footer. Say the word and I'll build the Next.js pages from the approved markdown (≈30 min, one commit). I have deliberately **not** put them on the live site yet, because unreviewed legal text on a trust-first product is worse than none.
