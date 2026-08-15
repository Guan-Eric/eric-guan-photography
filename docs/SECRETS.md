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
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put CLOUDFLARE_R2_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_R2_ACCESS_KEY_ID
npx wrangler secret put CLOUDFLARE_R2_SECRET_ACCESS_KEY
npx wrangler secret put CLOUDFLARE_R2_BUCKET
```

Public (non-secret) vars live in `wrangler.jsonc` → `vars` (already set for Studiofront).

Also set in the Cloudflare dashboard (or extend `vars`) if not already there:

| Key | Example |
|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` / `pk_live_…` |
| `PLATFORM_EMAIL_FROM` | `Studiofront <hello@studiofront.ca>` |

Local preview: copy [`.dev.vars.example`](../.dev.vars.example) → `.dev.vars`.

Verify local env before deploy:

```bash
npm run setup:check
```

Full runbook: [`DEPLOY.md`](../DEPLOY.md).
