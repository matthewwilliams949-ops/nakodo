# Legal documents — launch drafts

*Drafted 2026-07-11 (CEO) for the 0.2.0 launch. Three documents: [privacy-policy.md](privacy-policy.md), [terms-of-service.md](terms-of-service.md), [impressum.md](impressum.md).*

## ⚠️ Read before publishing

**These are founder drafts, not legal advice.** Claude is not a lawyer. They are written to be accurate to Nakodo's actual data model and reasonably complete for a German-operated, GDPR-scoped launch — but **get them reviewed** (a data-protection-literate lawyer, or at minimum a reputable German Impressum/Datenschutz generator cross-check) before they go live. The Privacy Policy and Impressum are effectively required (GDPR Art. 13 + §5 DDG); the ToS is strongly recommended for a service that connects strangers.

## Status (2026-07-11)

All `[[ ]]` placeholders are **filled**: Matthew Williams / Esmarchstraße 15, 10407 Berlin / hello@nakodo.dev; no VAT ID (no legal entity yet — line removed); date 2026-07-11. Two items below still need Matthew's action before these go live.

## ⚠️ Open items before publishing

1. **`hello@nakodo.dev` must actually receive mail.** It's live as the *sending* address (Resend, `EMAIL_FROM`), but an Impressum/privacy contact address has to be **reachable**. Per `SETUP-ACCOUNTS.md` this needs Porkbun email forwarding to your Gmail (~2 min). Confirm it's on, or a legal contact address that bounces is itself a compliance gap.

2. **🚩 DB region vs. the site's public claim — a real trust-accuracy bug.** The homepage ([apps/web/app/page.tsx:65](../../apps/web/app/page.tsx)) states *"Data lives in the EU (Frankfurt)."* The actual Supabase database is on `aws-1-eu-west-2` = AWS **London (UK)** — not Frankfurt, not the EU. This is a false, load-bearing claim on a trust-first product's landing page; a technical reader who checks will catch it. **Decide one:**
   - **Move the DB to Frankfurt (`eu-central-1`)** so the claim becomes true. Best done *now* — there's ~1 row of real data, so migration cost is near-zero, and the launch sweep zeros even that. (CTO task: Supabase can't relocate a project in place — recreate in eu-central-1, swap `DATABASE_URL`, `pnpm db:apply`.) *Recommended.*
   - **Or** soften the site copy to match reality (UK is GDPR-adequate, but "Frankfurt/EU" is a stronger story than "London/UK").
   The privacy policy's processor line is written to the Frankfurt target and carries an inline ⚠ until this is resolved.

3. **Processor DPAs** — Vercel and Resend are US-incorporated; confirm you've accepted their DPAs with SCCs (both offer them). Supabase EU region + DPA likewise.

## Wiring them into the site (after review)

Once you've signed off, these become three routes — `/privacy`, `/terms`, `/impressum` — linked from the site footer. Say the word and I'll build the Next.js pages from the approved markdown (≈30 min, one commit). I have deliberately **not** put them on the live site yet, because unreviewed legal text on a trust-first product is worse than none.
