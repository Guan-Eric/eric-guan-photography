# Studiofront — tech stack & hosting

**Studiofront** is a multi-tenant SaaS for real-estate photographers: book → shoot board → gated gallery → listing pages. Photographers get a studio subdomain (or custom domain); the apex host is the marketing / signup site.

This document describes **what runs where** and **how production deploys**. Step-by-step ops live in [`DEPLOY.md`](DEPLOY.md).

---

## Product shape

| Host | What it serves |
|---|---|
| `studiofront.ca` (apex) | Platform marketing, pricing, signup/login |
| `{slug}.studiofront.ca` | One photographer’s public site, booking, admin, galleries |
| Custom domains (optional) | Same studio app via Cloudflare for SaaS; customer CNAME → `sites.studiofront.ca` |

Eric Guan Photography is dogfood tenant #1 (`ericguan.…`). Production does **not** auto-seed tenants when Postgres is used — first studio comes from `/signup`.

Core loop (vs Aryeo-style extras): solo photographer workflow only — not Zillow, AI, or national ops tooling.

---

## Stack at a glance

```text
                    ┌─────────────────────────────────────┐
                    │         Cloudflare edge             │
 Browser ──────────►│  Workers (OpenNext Next.js app)     │
                    │  + R2 media  + Images (optional)    │
                    └───────────┬─────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
         Neon Postgres      Stripe API         Resend
         (tenants, users,   (Billing +         (email)
          orders, RLS)       Connect)
```

| Layer | Choice | Role |
|---|---|---|
| App framework | **Next.js 16** (App Router) | UI, API routes, SSR |
| Runtime (prod) | **Cloudflare Workers** via **OpenNext** | Hosts the Next.js app |
| Runtime (local) | Node (`next dev` / `next start`) | Local development |
| Database (prod) | **Neon Postgres 18** | Multi-tenant data |
| Database (local) | **SQLite** (`better-sqlite3`) when `DATABASE_URL` unset | Fast local stub |
| ORM | **Drizzle** | Typed queries; dual schemas (`schema.ts` / `schema.pg.ts`) |
| Object storage | **Cloudflare R2** bucket `studiofront-media` | Gallery & portfolio media |
| Payments | **Stripe** Billing + Connect (Express) | Studio subscriptions + gallery unlocks / payouts |
| Email | **Resend** | Reminders, auth mail, notifications |
| Auth | Custom (cookies + password hashes in DB) | Platform users & studio memberships — **not** Neon Auth |
| Cron | HTTP `/api/cron/reminders` + GitHub Actions | Day-before shoot emails |
| Package manager | npm | `package.json` |

---

## Application architecture

### Multi-tenancy

- Host routing in Edge **`middleware.ts`**: apex → SaaS marketing rewrites (`/` → `/saas`); `{slug}.{PLATFORM_ROOT_DOMAIN}` → sets `x-tenant-slug` / related headers.
- Tenant config and business data are scoped by `tenant_id` in Postgres.
- Postgres **RLS** policies exist (`scripts/postgres-rls.sql`) for defense in depth; the app connection uses the DB owner role today (owner bypasses RLS until a restricted role + `app.tenant_id` session var is wired).

### Major surfaces

| Area | Paths / notes |
|---|---|
| Marketing | `/saas`, `/saas/pricing`, apex rewrite |
| Auth | `/signup`, `/login`, forgot/reset password |
| Studio public | `/`, `/book`, `/prep`, `/g/[token]`, `/p/[slug]` |
| Studio admin | `/admin/*` (orders, schedule, work, pricing, settings) |
| Platform APIs | `/api/auth/*`, `/api/book`, `/api/stripe/webhook`, `/api/cron/reminders`, … |

### Money flows

1. **Photographer subscriptions** — Stripe Checkout against Price IDs (`STRIPE_PRICE_STARTER` / `GROWTH` / `STUDIO`); Customer Portal for manage/cancel.
2. **Gallery unlock** — one-off Checkout; when Connect is complete, **destination charges** on the platform account with `transfer_data.destination` to the photographer + optional `application_fee_amount`.
3. **Connect** — Express accounts; Stripe-hosted onboarding (Account Links); Express Dashboard for seller account management.

### Media

- Local: filesystem under `data/media` (or `MEDIA_ROOT`).
- Prod: R2 via S3-compatible credentials (`CLOUDFLARE_R2_*`) and/or Worker binding `MEDIA_BUCKET`.
- `R2_FORCE_REMOTE=1` in production vars → remote-only (no local mirror).

---

## Environments

### Local development

```bash
npm run dev
# SaaS:     http://localhost:3000
# Studio:   http://ericguan.localhost:3000  (Chrome treats *.localhost as loopback)
```

| Concern | Local default |
|---|---|
| DB | SQLite (`./data/platform.sqlite`) unless `DATABASE_URL` is set |
| Media | Disk; R2 if credentials + optional force remote |
| Secrets | `.env.local` (gitignored) |
| Preview Worker | `npm run preview` (OpenNext + Wrangler) |

Copy [`.env.example`](.env.example) → `.env.local`. For Wrangler preview, also [`.dev.vars.example`](.dev.vars.example) → `.dev.vars`.

### Production

| Concern | Production |
|---|---|
| App | Worker name **`studiofront`** (`wrangler.jsonc`) |
| Build | `opennextjs-cloudflare build` → `.open-next/` |
| Deploy | `npm run deploy` (= OpenNext build + `opennextjs-cloudflare deploy`) |
| DB | Neon (`DATABASE_URL` as Wrangler secret) |
| Media | R2 `studiofront-media` |
| Public config | `wrangler.jsonc` → `vars` (platform name, root domain, URLs) |
| Secrets | `wrangler secret put …` — see [`docs/SECRETS.md`](docs/SECRETS.md) |
| Domains | Worker custom domains: apex + `*.studiofront.ca`; vanity hosts via Cloudflare for SaaS (`*/*` route + Custom Hostnames API) |

**Important OpenNext constraint:** use Edge **`middleware.ts`**, not Next 16 Node **`proxy.ts`**. OpenNext on Cloudflare still requires Edge middleware for host routing.

---

## Deploy pipeline (conceptual)

```text
1. Neon project + schema SQL
2. Cloudflare account + R2 bucket + R2 API token
3. Stripe Test (then Live): products, keys, Connect, Portal, webhook
4. Resend domain + API key
5. wrangler secrets + public vars
6. npm run deploy
7. Attach custom domains (+ Cloudflare for SaaS for tenant vanity hosts)
8. Point Stripe webhook → https://studiofront.ca/api/stripe/webhook
9. Schedule cron (GitHub Actions → /api/cron/reminders)
```

Custom domain ops: enable SaaS on the zone, run `scripts/postgres-migrate-custom-domain.sql`, `node scripts/setup-custom-domain-saas.mjs`, set `CLOUDFLARE_ZONE_ID` / `CF_SAAS_API_TOKEN` Worker secrets. See [`DEPLOY.md`](../DEPLOY.md) §8.

Full checklist: [`DEPLOY.md`](DEPLOY.md).  
Booking lifecycle (every click, status, email): [`BOOKING-FLOW.md`](BOOKING-FLOW.md).  
Stripe details: [`docs/STRIPE-SETUP.md`](STRIPE-SETUP.md).  
Env smoke test: `npm run setup:check`.

### Useful commands

| Command | Purpose |
|---|---|
| `npm run build` | Next.js production build (Node) |
| `npm run deploy` | OpenNext → Cloudflare Worker |
| `npm run preview` | Local Worker preview |
| `npx wrangler tail` | Live Worker logs |
| `npx wrangler secret put NAME` | Set a production secret |

---

## Infrastructure inventory (names)

| Resource | Identifier |
|---|---|
| Product | Studiofront |
| Worker | `studiofront` |
| R2 bucket | `studiofront-media` |
| R2 binding | `MEDIA_BUCKET` |
| Neon DB | project **StudioFront** (Postgres 18, AWS US East 2) |
| Planned apex | `studiofront.ca` (change everywhere if different) |
| Cron workflow | [`.github/workflows/reminders.yml`](.github/workflows/reminders.yml) |

---

## What is *not* in the stack

- Neon Auth / Supabase Auth (custom sessions instead)
- Firebase / Firestore
- Vercel hosting (prod target is Cloudflare Workers)
- Native Worker `scheduled` handler for reminders (use HTTP cron instead)

---

## Related docs

| Doc | Contents |
|---|---|
| [`DEPLOY.md`](DEPLOY.md) | Ordered production checklist |
| [`docs/SECRETS.md`](docs/SECRETS.md) | Wrangler secrets list |
| [`docs/STRIPE-SETUP.md`](docs/STRIPE-SETUP.md) | Billing + Connect |
| [`PLATFORM-PLAN.md`](PLATFORM-PLAN.md) | Product / roadmap notes |
| [`.env.example`](.env.example) | All env knobs documented |
