# M0 account batch — step-by-step

*Do this in one sitting once the name is chosen. ~90 minutes. Order matters — later steps need outputs from earlier ones. Have a password manager open; you'll generate ~5 credentials. Where a step says **→ .env**, paste the value into `.env` at the repo root (copy `.env.example` to `.env` first).*

**Prerequisite from the naming session:** the name, checked for npm package availability, domain availability, and MCP directory collisions (per NAME-BRIEF.md).

---

## 1. Domain (~10 min)

1. Go to [porkbun.com](https://porkbun.com) (or Cloudflare Registrar if you prefer — both are at-cost, no upsell). Create an account if needed.
2. Buy `<name>.dev` / `<name>.so` / `<name>.app` — whichever the naming session settled on. Enable auto-renew, keep WHOIS privacy on (default).
3. Leave the DNS tab open — you'll add records here in steps 5 (Vercel) and 6 (Resend).

## 2. npm — claim the package name (~10 min)

1. Create an account at [npmjs.com/signup](https://www.npmjs.com/signup) with matthew.williams949@gmail.com (or log in if you have one). **Enable 2FA** (Settings → Two-Factor Authentication) — npm requires it to publish.
2. In a terminal, in this repo: `npm login` (opens browser).
3. Tell me the final name first so I can run the rename pass — then publish the placeholder to reserve the name:
   ```
   cd packages/mcp-server && npm publish --access public
   ```
   (The package will be at version 0.0.1 with a "coming soon" README; real publish happens at M7.)
4. If the bare name is taken but was cleared as a scoped variant, we publish as `@<npm-username>/<name>` instead — flag it and I'll adjust.

## 3. GitHub repo (~5 min)

1. On github.com signed in as **matthewwilliams949-ops**: New repository → name `<name>` → **Private** → no README/gitignore (the local repo already has history).
2. Push the existing local repo:
   ```
   git remote add origin git@github.com:matthewwilliams949-ops/<name>.git
   git push -u origin main
   ```
   (If SSH isn't set up for this account, use the HTTPS URL and a fine-grained personal access token.)

## 4. Supabase (~15 min)

1. Log in / sign up at [supabase.com](https://supabase.com) (GitHub sign-in is fine).
2. New project → name `<name>` → **Region: Europe (Frankfurt) — eu-central-1** (this is the EU-data promise from the privacy note; don't skip it). Generate a strong DB password and save it in your password manager.
3. Once provisioned: **Connect** (top bar) → copy the **Session pooler** connection string (starts `postgresql://...pooler.supabase.com:5432/...`), substitute the password **→ .env as `DATABASE_URL`**.
   - *Note: we use Supabase as plain Postgres via a connection string; no supabase-js, no API keys needed. Supabase Studio's Table Editor is your concierge admin view.*
4. Apply the schema — from the repo root:
   ```
   pnpm db:apply
   ```
   (Runs `db/schema.sql` against `DATABASE_URL`.) Verify in Studio → Table Editor that the six tables exist.

## 5. Vercel (~15 min)

1. Sign up / log in at [vercel.com](https://vercel.com) with the GitHub account, so it can see the repo. Hobby plan is fine for v1.
2. Add New → Project → import the `<name>` repo.
   - **Root Directory: `apps/web`** (critical — it's a monorepo).
   - Framework preset: Next.js (auto-detected). Build defaults are fine.
3. Before deploying, add Environment Variables (Production + Preview): `DATABASE_URL` (from step 4), `RESEND_API_KEY` (placeholder for now — you'll overwrite in step 6), `APP_URL` = `https://<name>.<tld>`.
4. Deploy. The stub site should come up at the `*.vercel.app` URL.
5. Project → Settings → Domains → add `<name>.<tld>` → follow the DNS instructions (add the A/CNAME records at Porkbun). Wait for the checkmark.
6. Local CLI so agents can deploy and pull env without your credentials again:
   ```
   pnpm dlx vercel login
   pnpm dlx vercel link      # run at repo root, pick the project, set root dir apps/web
   pnpm dlx vercel env pull apps/web/.env.local
   ```

## 6. Resend (~20 min, includes DNS wait)

1. Sign up at [resend.com](https://resend.com). Free tier (3k emails/month) is plenty for v1.
2. Domains → Add Domain → `<name>.<tld>`, region EU (Ireland). Resend shows 3–4 DNS records (SPF TXT, DKIM CNAMEs/TXT, optional DMARC).
3. Add each record at Porkbun DNS. Click **Verify** in Resend — usually verifies within minutes; if it stalls, wait 15 min and re-verify.
4. Add a DMARC record if Resend didn't include one: TXT at `_dmarc.<name>.<tld>` with value `v=DMARC1; p=none;` (monitoring mode — fine for our volume).
5. API Keys → Create ("production", full access) **→ .env as `RESEND_API_KEY`**, and update the Vercel env var from step 5.3 (Settings → Environment Variables → edit → then redeploy).
6. Decide the sender address — recommendation: `hello@<name>.<tld>` for intros, and set a real inbox (forward to matthew.williams949@gmail.com via Porkbun email forwarding, ~2 min in their Email Forwarding tab) so replies reach you. **→ .env as `EMAIL_FROM`**.

## 7. Handoff checks (~5 min)

Run from the repo root and confirm all pass:

```
pnpm install
pnpm check          # typecheck + tests, should already be green
pnpm db:apply       # idempotent; confirms DATABASE_URL works
pnpm smoke:email    # sends a test email via Resend to your gmail — check it lands in inbox, not spam
```

Then tell me: **the name, the domain, the npm package name (bare or scoped), and "accounts done."** I'll run the rename pass (package/bin/config-dir/site/README), point everything at the real domain, push, and confirm the production deploy.

---

### Credentials inventory after this batch

| What | Where it lives |
|---|---|
| Porkbun, npm (+2FA), Supabase, Vercel, Resend logins | your password manager |
| `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` | `.env` locally + Vercel env |
| Vercel CLI auth | `vercel login` done once (step 5.6) |
| npm publish auth | `npm login` done once (step 2.2) |

Agents never need the logins — only the repo, `.env`, and the linked CLIs.
