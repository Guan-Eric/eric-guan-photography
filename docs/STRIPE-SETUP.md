# Stripe setup (platform billing + Connect)

## Quick start — live production

1. **Activate your Stripe account** (live mode) — see [Live activation](#live-activation) below.
2. Copy [`docs/env-stripe-live.example`](env-stripe-live.example) → `.env.stripe.live` (gitignored).
3. Paste `sk_live_...` and `pk_live_...` from [Dashboard → API keys](https://dashboard.stripe.com/apikeys) (Live toggle ON).
4. Provision products, prices, meter, and webhook:

```bash
npm run setup:stripe:production
# or with Cloudflare sync:
npm run setup:stripe:production:sync
```

5. Verify readiness:

```bash
npm run stripe:activation-check   # must exit 0 before taking live charges
npm run setup:check
npm run deploy
```

**Test mode (local dev):** use `sk_test_...` in `.env.local` and `node scripts/setup-stripe-parity.mjs` (alias for `setup-stripe-production.mjs --allow-test`).

---

## Live activation

Before live charges work, complete in the [Stripe Dashboard](https://dashboard.stripe.com) with **Test mode OFF**:

| Step | Where | Notes |
|---|---|---|
| Account activation | Settings → Business | Business details, representative, bank account |
| Terms of service | Activation checklist | Accept ToS (`tos_acceptance`) |
| Business profile | Settings → Business | **Product description**, **support phone**, **website URL** (`https://studiofront.ca`) |
| Customer Portal | Settings → Billing → Customer portal | Enable; allow payment method updates / cancel |
| Connect Express | Connect → Settings | Enable **Express** accounts for photographer payouts |
| Connect platform profile | Connect → Get started | Complete platform profile before live transfers |

Check status anytime:

```bash
npm run stripe:activation-check
```

---

## Products & prices (photographer subscriptions)

Created automatically by `npm run setup:stripe:production`, or manually in Dashboard:

| Product name | Price | Env var |
|---|---|---|
| Starter | $49 / month | `STRIPE_PRICE_STARTER=price_...` |
| Growth | $99 / month | `STRIPE_PRICE_GROWTH=price_...` |
| Studio | $149 / month | `STRIPE_PRICE_STUDIO=price_...` |

## Usage-based billing (pay-as-you-go + overage)

Billing → Meters → **Create meter** (or let the setup script create it):

- Event name: `listing_completed` (or set `STRIPE_METER_EVENT_LISTINGS`)
- Aggregation: **Sum** of `value`

| Product name | Price | Env var |
|---|---|---|
| Pay as you go (base) | $0 / month recurring | `STRIPE_PRICE_PAYG_BASE=price_...` |
| Pay as you go (listing) | $5 per unit, metered | `STRIPE_PRICE_PAYG_LISTING=price_...` |
| Listing overage | $3 per unit, metered | `STRIPE_PRICE_OVERAGE_LISTING=price_...` |
| Custom domain add-on | $5 / month, quantity-based | `STRIPE_PRICE_DOMAIN_ADDON=price_...` |

The $0 base keeps a monthly invoice cycle so metered listings have somewhere to
land. The overage price is attached to every flat tier and only accrues once a
studio passes its included listings; without it, tiers hard-block at the cap.
The domain add-on is a plain licensed price — the app keeps its quantity equal
to the number of live custom hostnames.

## API keys

Developers → API keys (live mode):

- Secret key → `STRIPE_SECRET_KEY` (Wrangler secret; prefer a [restricted key](https://docs.stripe.com/keys/restricted-api-keys))
- Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`wrangler.jsonc` vars after setup script)

## Webhook

Developers → Webhooks → Add endpoint (or use setup script):

```text
https://studiofront.ca/api/stripe/webhook
```

Events (minimum):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid` (optional but useful)

Copy Signing secret → `STRIPE_WEBHOOK_SECRET` (Wrangler secret).

## Customer Portal

Settings → Billing → Customer portal:

- Enable portal
- Allow customers to update payment method / cancel (as you prefer)

No extra secret — the app opens portal via `/api/billing/portal`.

## Connect (studio payouts)

Connect → Get started → **Express** accounts.

Photographers finish onboarding from **Admin → Settings → Connect payouts**.

Optional platform fee: `PLATFORM_FEE_BPS=250` means 2.5% (add to `wrangler.jsonc` vars).

## Cloudflare secrets

After `.env.stripe.live` is populated:

```bash
npm run stripe:sync-secrets
```

See [`SECRETS.md`](SECRETS.md) for the full list.

## Smoke test (live)

1. Sign up a studio → Settings → pick Starter → Checkout should open (live).
2. Complete checkout with a real card (refund from Dashboard if needed).
3. Open **Manage billing** → Customer Portal opens.
4. Settings → **Connect payouts** → complete Express onboarding.
5. Publish a gallery → Pay & unlock → Checkout; gallery unlocks after payment.
6. Stripe Dashboard → Webhooks → deliveries are 2xx from `studiofront.ca`.

**Never** set `ALLOW_GALLERY_STUB_UNLOCK=1` in production.
