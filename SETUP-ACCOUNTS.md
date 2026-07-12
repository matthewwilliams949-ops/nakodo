# M0 account batch — step-by-step

*Do this in one sitting once the name is chosen. ~90 minutes. Order matters — later steps need outputs from earlier ones. Have a password manager open; you'll generate ~5 credentials. Where a step says **→ .env**, paste the value into `.env` at the repo root (copy `.env.example` to `.env` first).*

**Prerequisite from the naming session:** ✅ done — **Nakodo**, npm `nakodo` free, nakodo.dev free, no MCP/registry collisions (verified 2026-07-05; rename pass already applied to the codebase).

---

## 1. Domain (~10 min)

1. Go to [porkbun.com](https://porkbun.com) (or Cloudflare Registrar if you prefer — both are at-cost, no upsell). Create an account if needed.
2. Buy **nakodo.dev**. Enable auto-renew, keep WHOIS privacy on (default). (Optional cheap insurance: nakodo.app was also free at check.) Note: .dev domains require HTTPS everywhere — fine, Vercel handles it.
3. Leave the DNS tab open — you'll add records here in steps 5 (Vercel) and 6 (Resend).

## 2. npm — claim the package name (~10 min)

1. Create an account at [npmjs.com/signup](https://www.npmjs.com/signup) with matthew.williams949@gmail.com (or log in if you have one). **Enable 2FA** (Settings → Two-Factor Authentication) — npm requires it to publish.
2. In a terminal, in this repo: `npm login` (opens browser).
3. Publish the placeholder to reserve the name (the rename pass is already done — the package is `nakodo` at 0.0.1 with a "pre-release" README; the real publish happens at M7):
   ```
   cd packages/mcp-server && npm publish
   ```
4. If `nakodo` got sniped since the 2026-07-05 availability check, stop and flag it — we'll pick between a scoped variant and `nakodo-mcp` (also free at check).

## 3. GitHub repo (~5 min)

1. On github.com signed in as **matthewwilliams949-ops**: New repository → name `nakodo` → **Private** → no README/gitignore (the local repo already has history).
2. Push the existing local repo:
   ```
   git remote add origin git@github.com:matthewwilliams949-ops/nakodo.git
   git push -u origin main
   ```
   (If SSH isn't set up for this account, use the HTTPS URL and a fine-grained personal access token.)

## 4. Supabase (~15 min)

1. Log in / sign up at [supabase.com](https://supabase.com) (GitHub sign-in is fine).
2. New project → name `nakodo` → **Region: Europe (Frankfurt) — eu-central-1** (this is the EU-data promise from the privacy note; don't skip it). Generate a strong DB password and save it in your password manager.
3. Once provisioned: **Connect** (top bar) → copy the **Session pooler** connection string (starts `postgresql://...pooler.supabase.com:5432/...`), substitute the password **→ .env as `DATABASE_URL`**.
   - *Note: we use Supabase as plain Postgres via a connection string; no supabase-js, no API keys needed. Supabase Studio's Table Editor is your concierge admin view.*
4. Apply the schema — from the repo root:
   ```
   pnpm db:apply
   ```
   (Runs `db/schema.sql` against `DATABASE_URL`.) Verify in Studio → Table Editor that the six tables exist.

## 5. Vercel (~15 min)

1. Sign up / log in at [vercel.com](https://vercel.com) with the GitHub account, so it can see the repo. Hobby plan is fine for v1.
2. Add New → Project → import the `nakodo` repo.
   - **Root Directory: `apps/web`** (critical — it's a monorepo).
   - Framework preset: Next.js (auto-detected). Build defaults are fine.
3. Before deploying, add Environment Variables (Production + Preview): `DATABASE_URL` (from step 4), `RESEND_API_KEY` (placeholder for now — you'll overwrite in step 6), `APP_URL` = `https://nakodo.dev`.
4. Deploy. The stub site should come up at the `*.vercel.app` URL.
5. Project → Settings → Domains → add `nakodo.dev` → follow the DNS instructions (add the A/CNAME records at Porkbun). Wait for the checkmark.
6. Local CLI so agents can deploy and pull env without your credentials again:
   ```
   pnpm dlx vercel login
   pnpm dlx vercel link      # run at repo root, pick the project, set root dir apps/web
   pnpm dlx vercel env pull apps/web/.env.local
   ```

## 6. Resend (~20 min, includes DNS wait)

1. Sign up at [resend.com](https://resend.com). Free tier (3k emails/month) is plenty for v1.
2. Domains → Add Domain → `nakodo.dev`, region EU (Ireland). Resend shows 3–4 DNS records (SPF TXT, DKIM CNAMEs/TXT, optional DMARC).
3. Add each record at Porkbun DNS. Click **Verify** in Resend — usually verifies within minutes; if it stalls, wait 15 min and re-verify.
4. Add a DMARC record if Resend didn't include one: TXT at `_dmarc.nakodo.dev` with value `v=DMARC1; p=none;` (monitoring mode — fine for our volume).
5. API Keys → Create ("production", full access) **→ .env as `RESEND_API_KEY`**, and update the Vercel env var from step 5.3 (Settings → Environment Variables → edit → then redeploy).
6. Decide the sender address — recommendation: `hello@nakodo.dev` for intros, and set a real inbox (forward to matthew.williams949@gmail.com via Porkbun email forwarding, ~2 min in their Email Forwarding tab) so replies reach you. **→ .env as `EMAIL_FROM`**.

## 7. Handoff checks (~5 min)

Run from the repo root and confirm all pass:

```
pnpm install
pnpm check          # typecheck + tests, should already be green
pnpm db:apply       # idempotent; confirms DATABASE_URL works
pnpm smoke:email    # sends a test email via Resend to your gmail — check it lands in inbox, not spam
```

Then tell me **"accounts done"** (plus anything that deviated, e.g. a scoped npm name). I'll verify the production deploy end-to-end and we move to the M6 metrics script and the Checkpoint A demo.

---

### Credentials inventory after this batch

| What | Where it lives |
|---|---|
| Porkbun, npm (+2FA), Supabase, Vercel, Resend logins | your password manager |
| `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` | `.env` locally + Vercel env |
| Vercel CLI auth | `vercel login` done once (step 5.6) |
| npm publish auth | `npm login` done once (step 2.2) |

Agents never need the logins — only the repo, `.env`, and the linked CLIs.

## 8. Telegram bot (M9d tier 2 — ~10 min, Matthew-only)

The notification bot for "an introduction is waiting" on phone lock screens. All of this is account/credential work, so it's yours:

1. In Telegram, open **@BotFather** → `/newbot`. Name: `Nakodo` (display), username: something like `NakodoBot` / `nakodo_notify_bot` (must end in `bot`; take the best available). BotFather returns the **bot token**.
2. Optional polish while you're there: `/setdescription` → "Delivers Nakodo introduction notifications. Nothing else."; `/setuserpic` if we have a mark.
3. **→ .env** as `TELEGRAM_BOT_TOKEN` (from step 1), `TELEGRAM_BOT_USERNAME` (the username without @), and `TELEGRAM_WEBHOOK_SECRET` (any long random string, e.g. `openssl rand -hex 32`).
4. Add the same three to **Vercel env** (Settings → Environment Variables) and redeploy.
5. Register the webhook: `pnpm telegram:setup` (idempotent; verifies the token matches the username, points Telegram at `APP_URL/api/telegram/webhook` with the secret).
6. Smoke it: ask your agent to connect Telegram (`connect_telegram`), tap the link, press Start — you should get the "Connected" DM. Send `/stop` and reconnect to confirm both directions.

| What | Where it lives |
|---|---|
| BotFather chat (bot ownership) | your Telegram account |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | `.env` locally + Vercel env |

## 9. Browser push keys (M9d tier 1 — ~3 min, Matthew-only)

The desk notification channel — a one-click "notify me on this device" on the intro page, no app install. Just a self-generated keypair, no third-party account:

1. Generate the VAPID keypair: `npx web-push generate-vapid-keys` (prints a public + private key).
2. **→ .env** as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT=mailto:hello@nakodo.dev`.
3. Add the same three to **Vercel env** and redeploy.
4. Smoke it: open any intro page after saying yes → "Notify me on this device" → allow → accept from the other side and confirm the desktop notification fires.

Until these are set the channel is **off** by design: no button renders, subscribe returns 503, sends skip — nothing else is affected.

| What | Where it lives |
|---|---|
| VAPID keypair (self-generated, no account) | `.env` locally + Vercel env |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `.env` locally + Vercel env |
