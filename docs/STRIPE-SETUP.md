# Stripe setup (platform billing + Connect)

Do this in the [Stripe Dashboard](https://dashboard.stripe.com) (use **Test mode** first).

Stripe MCP is not required — all of this is Dashboard clicks + env vars.

## 1. Products & prices (photographer subscriptions)

Create three **recurring monthly** Products (USD):

| Product name | Price | Env var |
|---|---|---|
| Starter | $49 / month | `STRIPE_PRICE_STARTER=price_...` |
| Growth | $99 / month | `STRIPE_PRICE_GROWTH=price_...` |
| Studio | $179 / month | `STRIPE_PRICE_STUDIO=price_...` |

Copy each Price ID (starts with `price_`) into production secrets / `.env.local`.

## 2. API keys

Developers → API keys:

- Secret key → `STRIPE_SECRET_KEY`
- Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## 3. Webhook

Developers → Webhooks → Add endpoint:

Webhook URL after DNS:

```text
https://studiofront.ca/api/stripe/webhook
```

Select events (minimum):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid` (optional but useful)

Copy Signing secret → `STRIPE_WEBHOOK_SECRET`

## 4. Customer Portal

Settings → Billing → Customer portal:

- Enable portal
- Allow customers to update payment method / cancel (as you prefer)

No extra secret — the app opens portal via `/api/billing/portal`.

## 5. Connect (studio payouts)

Connect → Get started → **Express** accounts.

Photographers finish onboarding from **Admin → Settings → Connect payouts**.

Optional platform fee: `PLATFORM_FEE_BPS=250` means 2.5%.

## 6. Smoke test

1. Sign up a studio → Settings → pick Starter → Checkout should open.
2. Publish a gallery → Pay & unlock should open Checkout (or Connect destination when connected).
3. Confirm webhook deliveries are green in the Dashboard.
