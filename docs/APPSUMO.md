# AppSumo Licensing (v2)

Studiofront integrates with AppSumo’s **Licensing API** (not CSV codes). Buyers get a license key from AppSumo, connect via OAuth, and we map tiers onto existing plans.

## Partner Portal URLs

| Field | Value |
|---|---|
| Webhook | `https://studiofront.ca/api/appsumo/webhook` |
| OAuth redirect | `https://studiofront.ca/api/appsumo/oauth` |

Redirect URI must match **exactly** (trailing slash sensitive). Override with `APPSUMO_REDIRECT_URI` if needed.

## Tier map

| AppSumo tier | Studiofront plan |
|---|---|
| 1 | Starter |
| 2 | Growth |
| 3 | Studio |

Granted plans use `subscriptionStatus: active` with **no** Stripe subscription id. Deactivate / refund sets plan `trial` + `subscriptionStatus: canceled`.

## Env / secrets

```bash
APPSUMO_API_KEY=…
APPSUMO_CLIENT_ID=…
APPSUMO_CLIENT_SECRET=…
# optional override:
APPSUMO_REDIRECT_URI=https://studiofront.ca/api/appsumo/oauth
```

Production (Cloudflare Workers):

```bash
npx wrangler secret put APPSUMO_API_KEY
npx wrangler secret put APPSUMO_CLIENT_ID
npx wrangler secret put APPSUMO_CLIENT_SECRET
```

`npm run setup:check` warns if the listing is about to go live without these keys.

## Activation flow

1. Purchase → AppSumo POSTs `purchase` / `activate` to `/api/appsumo/webhook` (store `license_key`).
2. Buyer OAuth → GET `/api/appsumo/oauth?code=…` exchanges code → sets pending cookie → `/appsumo/complete`.
3. Buyer signs in / creates studio → `POST /api/appsumo/link` applies plan via `applyPlanToTenant`.

## Test checklist

1. Save webhook URL in Partner Portal → test POST with `"test": true` → expect `200` + `{ "event": "purchase", "success": true }` (no DB writes).
2. Save OAuth URL → GET with no query → `200 OK`.
3. Use developer credits for a dry-run purchase → webhook row in `appsumo_licenses` → OAuth → link → Admin → Settings shows masked license key.
4. Trigger deactivate → studio access canceled.

## Support

License keys are searchable in Neon/SQL (`appsumo_licenses.license_key`). Settings shows a masked key + copy for the linked studio. AppSumo does not send buyer email — account is always created on Studiofront.

## Out of scope (v1)

- Deal add-on seat packs / `migrate` product logic (webhooks are acknowledged only)
- CSV code redemption
- Mapping tiers to the Lifetime plan id
