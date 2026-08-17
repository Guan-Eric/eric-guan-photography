# Deploy Studiofront — Cloudflare Workers + Neon + R2

Product: **Studiofront**  
Worker: `studiofront` · R2 bucket: `studiofront-media`  
Domain (set yours): **`studiofront.ca`** (or whatever domain you point at this Worker)

Companions:

- Tech stack & hosting: [`docs/TECH-STACK.md`](docs/TECH-STACK.md)
- Stripe: [`docs/STRIPE-SETUP.md`](docs/STRIPE-SETUP.md)
- Secrets: [`docs/SECRETS.md`](docs/SECRETS.md)
- Env check: `npm run setup:check`

**Note:** Host routing uses Edge `middleware.ts` (not Next 16 `proxy.ts`) so OpenNext Cloudflare can build. Do not rename it back until OpenNext supports Node proxy.

---

## Architecture

| Piece | Service |
|---|---|
| App | Cloudflare Workers via OpenNext (`npm run deploy`) |
| Database | Neon Postgres (`DATABASE_URL`) |
| Media | Cloudflare R2 (`studiofront-media`) |
| Email | Resend |
| Money | Stripe Billing + Connect |

Local `next dev` uses **SQLite** when `DATABASE_URL` is unset.

---

## Checklist (do in order)

### 1. Domain

Own (or buy) a domain for Studiofront. Examples below use `studiofront.ca`.  
If your domain differs, replace it everywhere and keep Worker name `studiofront`.

### 2. Neon Postgres

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string → `DATABASE_URL`.
3. Apply schema:

```bash
psql "$DATABASE_URL" -f scripts/postgres-schema.sql
psql "$DATABASE_URL" -f scripts/postgres-rls.sql
```

Production does **not** auto-seed Eric/Demo. First studio comes from `/signup` after deploy.

### 3. Cloudflare login + R2

```bash
npx wrangler login
npx wrangler r2 bucket create studiofront-media
```

Create an **R2 S3 API token** in the Cloudflare dashboard (R2 → Manage R2 API Tokens) with Object Read & Write on `studiofront-media`.

Note your Account ID (dashboard sidebar).

### 4. Stripe (Test mode first)

Follow [`docs/STRIPE-SETUP.md`](docs/STRIPE-SETUP.md):

- Products: Starter $49 · Growth $99 · Studio $179 → Price IDs  
- API keys  
- Webhook: `https://studiofront.ca/api/stripe/webhook` (after DNS)  
- Customer Portal + Connect Express  

### 5. Resend

Verify `studiofront.ca` (or `mail.studiofront.ca`) in Resend.  
Set `RESEND_API_KEY` and:

```bash
PLATFORM_EMAIL_FROM="Studiofront <hello@studiofront.ca>"
```

### 6. Production secrets

See [`docs/SECRETS.md`](docs/SECRETS.md) for the full list.

Generate:

```bash
openssl rand -hex 32   # AUTH_SESSION_SECRET
openssl rand -hex 32   # ADMIN_SESSION_SECRET
openssl rand -hex 32   # CRON_SECRET
```

Upload secrets (abbreviated — full list in SECRETS.md):

```bash
npx wrangler secret put AUTH_SESSION_SECRET
npx wrangler secret put ADMIN_SESSION_SECRET
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put DATABASE_URL
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put STRIPE_PRICE_STARTER
npx wrangler secret put STRIPE_PRICE_GROWTH
npx wrangler secret put STRIPE_PRICE_STUDIO
npx wrangler secret put STRIPE_PRICE_PAYG_BASE
npx wrangler secret put STRIPE_PRICE_PAYG_LISTING
npx wrangler secret put STRIPE_PRICE_OVERAGE_LISTING
npx wrangler secret put STRIPE_PRICE_DOMAIN_ADDON
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put CLOUDFLARE_R2_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_R2_ACCESS_KEY_ID
npx wrangler secret put CLOUDFLARE_R2_SECRET_ACCESS_KEY
npx wrangler secret put CLOUDFLARE_R2_BUCKET
```

Set **non-secret** vars in Workers → Settings → Variables (or `wrangler.jsonc` `[vars]`):

```bash
PLATFORM_NAME=Studiofront
NEXT_PUBLIC_PLATFORM_NAME=Studiofront
PLATFORM_ROOT_DOMAIN=studiofront.ca
PLATFORM_PUBLIC_URL=https://studiofront.ca
NEXT_PUBLIC_SITE_URL=https://studiofront.ca
PLATFORM_EMAIL_FROM=Studiofront <hello@studiofront.ca>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
R2_FORCE_REMOTE=1
CLOUDFLARE_R2_BUCKET=studiofront-media
```

You can also put public vars in `wrangler.jsonc` (already seeded for Studiofront):

```jsonc
"vars": {
  "PLATFORM_NAME": "Studiofront",
  "NEXT_PUBLIC_PLATFORM_NAME": "Studiofront",
  "PLATFORM_ROOT_DOMAIN": "studiofront.ca",
  "PLATFORM_PUBLIC_URL": "https://studiofront.ca",
  "NEXT_PUBLIC_SITE_URL": "https://studiofront.ca",
  "R2_FORCE_REMOTE": "1",
  "CLOUDFLARE_R2_BUCKET": "studiofront-media"
}
```

### 7. Deploy the Worker

```bash
npm run setup:check   # local .env — optional
npm run typecheck
npm run deploy
```

First deploy gets a `*.workers.dev` URL. Confirm it boots, then attach custom domains.

### 8. DNS + custom domains

#### Platform hosts

In Cloudflare DNS for `studiofront.ca`:

| Type | Name | Target |
|---|---|---|
| Worker custom domain | `@` | attach Worker `studiofront` |
| Worker custom domain | `*` | same Worker (wildcard studios) |
| Optional | `www` | apex |

Workers → **studiofront** → Custom Domains: add `studiofront.ca` and `*.studiofront.ca`.

Studios will be `ericguan.studiofront.ca`, etc.

#### Tenant vanity domains (Cloudflare for SaaS)

Photographers on Growth/Studio (and trial) can map `photos.theirbrand.com` → Studiofront.

1. Enable **Cloudflare for SaaS** on the `studiofront.ca` zone (SSL/TLS → Custom Hostnames).
2. Apply DB columns (Neon):

```bash
node scripts/apply-custom-domain-migration.mjs
# or: psql "$DATABASE_URL" -f scripts/postgres-migrate-custom-domain.sql
```

3. One-time DNS + fallback origin (uses API token in `.env.local` or the environment):

```bash
# CF_SAAS_API_TOKEN + CLOUDFLARE_ZONE_ID required
node scripts/setup-custom-domain-saas.mjs
```

That creates:

| Type | Name | Target |
|---|---|---|
| A (proxied) | `fallback` | `192.0.2.1` (dummy; Worker is origin) |
| CNAME (proxied) | `sites` | `fallback.studiofront.ca` |

Customers CNAME their hostname to **`sites.studiofront.ca`** (`CUSTOM_DOMAIN_TARGET` in wrangler vars).

4. Worker route `*/*` on zone `studiofront.ca` (listed in `wrangler.jsonc`) so vanity hosts hit Worker `studiofront`.
5. Secrets: `CLOUDFLARE_ZONE_ID`, `CF_SAAS_API_TOKEN` (SSL and Certificates Edit). Do **not** name the token `CLOUDFLARE_API_TOKEN` — Wrangler reserves that for CLI auth.

Saving a domain in Studio Settings creates a Cloudflare Custom Hostname and verifies DNS.

### 9. Stripe webhook (after domain works)

Point webhook at:

```text
https://studiofront.ca/api/stripe/webhook
```

### 10. Cron (reminders)

OpenNext’s Worker has no `scheduled` handler yet — hit the HTTP route daily (GitHub Actions, cron-job.org, etc.):

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://studiofront.ca/api/cron/reminders"
```

Example GitHub Actions (daily 14:00 UTC):

```yaml
# .github/workflows/reminders.yml
on:
  schedule:
    - cron: "0 14 * * *"
  workflow_dispatch:
jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "https://studiofront.ca/api/cron/reminders"
```

Store `CRON_SECRET` in GitHub Actions secrets (same value as the Worker secret).

### 11. Smoke

1. `https://studiofront.ca` — marketing  
2. `/signup` — create a studio  
3. `https://{slug}.studiofront.ca` — site + book  
4. Admin → upload → publish → pay  
5. Settings → Connect payouts  

---

## Local vs production

| | Local | Production |
|---|---|---|
| DB | SQLite | Neon |
| Media | `data/media` | R2 `studiofront-media` |
| Host | `localhost` / `*.localhost` | `studiofront.ca` / `*.studiofront.ca` |
| Runtime | `next dev` | OpenNext Worker |

## Useful commands

```bash
npm run preview    # OpenNext + Wrangler locally
npm run deploy     # build + deploy to Cloudflare
npx wrangler tail  # live logs
```
