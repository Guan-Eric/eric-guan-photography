# Studiofront production secrets checklist

Run after Neon + R2 + Stripe + Resend are ready. Do **not** put these in `wrangler.jsonc`.

Generate:

```bash
openssl rand -hex 32   # AUTH_SESSION_SECRET
openssl rand -hex 32   # ADMIN_SESSION_SECRET
openssl rand -hex 32   # CRON_SECRET
```

Upload (each prompts for the value):

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
npx wrangler secret put GOOGLE_CALENDAR_CLIENT_ID
npx wrangler secret put GOOGLE_CALENDAR_CLIENT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put CLOUDFLARE_R2_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_R2_ACCESS_KEY_ID
npx wrangler secret put CLOUDFLARE_R2_SECRET_ACCESS_KEY
npx wrangler secret put CLOUDFLARE_R2_BUCKET
npx wrangler secret put CLOUDFLARE_ZONE_ID
npx wrangler secret put CF_SAAS_API_TOKEN
```

Public (non-secret) vars live in `wrangler.jsonc` → `vars` (already set for Studiofront), including `CUSTOM_DOMAIN_TARGET=sites.studiofront.ca`.

Optional for tenant custom domains (Growth/Studio): create an API token with **Zone → SSL and Certificates → Edit**, **Zone → DNS → Edit** (for the one-time setup script), and **Zone → Zone → Read**. Store it as **`CF_SAAS_API_TOKEN`** (not `CLOUDFLARE_API_TOKEN` — Wrangler uses that name for its own CLI auth). Set `CLOUDFLARE_ZONE_ID` to the `studiofront.ca` zone id.

Also set in the Cloudflare dashboard (or extend `vars`) if not already there:

| Key | Example |
|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` / `pk_live_…` |
| `PLATFORM_EMAIL_FROM` | `Studiofront <hello@studiofront.ca>` |
| `GOOGLE_CALENDAR_REDIRECT_URI` | Optional override. Default is `{PLATFORM_PUBLIC_URL}/api/admin/calendar/callback`. Add that exact URI in the Google Cloud OAuth client. |

Scopes: `calendar.events`, `calendar.calendarlist.readonly`, `userinfo.email`.

Local preview: copy [`.dev.vars.example`](../.dev.vars.example) → `.dev.vars`.

**Production flags (must stay unset or off in Wrangler):**

- `ALLOW_GALLERY_STUB_UNLOCK` — never set in production (gallery payments require Stripe).
- `CUSTOM_DOMAIN_ENABLED` — set to `1` in `wrangler.jsonc` vars only when Cloudflare SaaS (`CLOUDFLARE_ZONE_ID`, `CF_SAAS_API_TOKEN`) is configured. See [`docs/MIGRATIONS.md`](MIGRATIONS.md) for database migration order.

Verify local env before deploy:

```bash
npm run setup:check
```

Full runbook: [`DEPLOY.md`](../DEPLOY.md).
