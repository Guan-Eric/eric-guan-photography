# Real Estate Media Platform — SaaS Plan

> A multi-tenant SaaS for real estate photographers: white-label sites, booking, gated delivery, and shareable listing pages — priced to beat Aryeo on cost and agent friction.
>
> **Eric Guan Photography is tenant #1** (dogfood customer), not the product. Every feature must work for the next photographer who signs up.

**Product name (working):** TBD — treat the repo as the platform, not a personal site.  
**Status:** Wave 1–4 SaaS shell shipped (platform apex, Stripe Billing stubs, property pages, automation, invites). Postgres RLS SQL + signed R2 still required before an external paying studio.  
**Stack target:** Next.js App Router + TypeScript · Postgres (SQLite locally) · Cloudflare (OpenNext + R2) · Stripe Connect + Stripe Billing · Resend.  
**Local now:** SQLite + filesystem media; apex = platform marketing; studios at `{slug}.localhost` (`ericguan`, `demo`).

---

## Vision

Photographers run their business on **their brand**, not a Zillow-adjacent portal.

| Who | What they get |
|---|---|
| **Photographer (tenant)** | White-label marketing site, booking/quoting, shoot board, upload → proofs → pay-to-unlock galleries, MLS zips, later property pages + automation |
| **Agent (buyer of shoots)** | No account required for delivery; signed gallery link; pay in-gallery; branded or unbranded shares |
| **Platform (you)** | Per-tenant isolation, Connect payouts, usage/per-listing billing, onboarding, quotas, legal |

**Do not compete on** Zillow Showcase exclusivity or national staffing.  
**Compete on** price, white-label, no agent login, instant unlock, photographer-owned data.

---

## Why this can win vs Aryeo

| Gap | Aryeo | This SaaS |
|---|---|---|
| Cost | ~$49–$179/mo whether you shoot or not | Per-listing / usage-first; low fixed |
| Agent friction | Agent login / portal | Token gallery links, no login |
| Ownership | Zillow Group (ShowingTime+) | Photographer-owned data + media |
| Payment unlock | Invoice round-trip | Pay-in-gallery unlock (wallet-ready later) |
| Trust | One-size gate | Per-agent trust tiers (`pay_first` / `net7`) |
| White-label | Platform-branded feel | Full white-label (theme, domain, packages) |
| Market lane | All-in portal | Portal-independent + modern UX (open vs Spiro / HDPhotoHub pricing models) |

---

## Product principles

1. **SaaS-first data model.** Every business row has `tenant_id`. No “Eric-only” tables or routes.
2. **Dogfood, don’t derail.** Tenant #1 validates workflows; features that only help one studio wait.
3. **Server-side gates.** Watermarked proofs until payment or trust unlock — never UI-only.
4. **Agents stay link-based.** Photographer auth only, until brokerage history truly needs accounts.
5. **Per-listing economics.** Photographers hate rent in slow months; platform billing mirrors that.
6. **Commercial-safe hosting.** Cloudflare (commercial OK) via OpenNext — not Vercel Hobby for a business product.
7. **Swap storage/DB behind interfaces.** Local SQLite/files today; Postgres + R2 when second tenant or real traffic arrives.

---

## Architecture

```
                    ┌──────────────────────────────────────┐
                    │  Platform control plane (future)     │
                    │  Signup · billing · Connect · domains│
                    └──────────────────┬───────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│  Tenant edge (host → tenant_id)                                             │
│  custom-domain.com  ·  slug.platform.com  ·  localhost → default tenant     │
└──────────────────┬───────────────────────────────┬──────────────────────────┘
                   │                               │
┌──────────────────▼──────────────┐  ┌─────────────▼──────────────────────────┐
│  Public tenant surface          │  │  Photographer app                      │
│  Site · pricing · prep · book   │  │  Admin board · upload · publish · CRM  │
│  /g/[token] galleries           │  │  Settings · packages · service area    │
│  Property pages (later)         │  │                                        │
└──────────────────┬──────────────┘  └─────────────┬──────────────────────────┘
                   │                               │
         Postgres + R2 + Stripe Connect + Resend (+ Calendar later)
```

### Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js App Router + TypeScript | Marketing + app in one codebase |
| Host | Cloudflare Workers (OpenNext) | Commercial-safe free tier, edge |
| Media | Cloudflare R2 | Zero egress — critical for photo delivery |
| DB | Postgres (Neon / Supabase) | Multi-tenant + RLS; SQLite is local-only |
| Auth | Photographer-only (Auth.js / Clerk / Supabase Auth) | Agents remain token-based |
| Money | **Stripe Connect** (Express/Standard) | Each studio gets paid; platform fee later |
| Email | Resend | Cheap transactional |
| Images | `sharp` on upload | Proof / web / MLS / original derivatives once |

**Cost target early:** domain + free tiers until usage forces paid Cloudflare / DB.

### Multi-tenancy rules

- Resolve tenant from **Host** (custom domain → subdomain → env default).
- Theme = CSS variables on `<html>` from tenant record.
- Content shape: `lib/tenant-schema.ts` → becomes DB row when onboarding ships.
- **RLS or equivalent** before any second live tenant.
- Media paths always namespaced: `{tenantId}/{galleryId}/…`.

### Data model (SaaS)

```
platform_accounts          # who pays the SaaS (studio owner)
  └─ tenants               # brand / site / packages / service area
       ├─ memberships      # users ↔ tenant (owner, editor)
       ├─ brokerages
       │    └─ agents (trust_tier: pay_first | net7 | open)
       ├─ orders
       │    ├─ appointments
       │    ├─ galleries (proofing | unlocked | archived, public_token, revoked_at)
       │    ├─ media_assets → derivatives
       │    ├─ payments (Connect / Checkout)
       │    ├─ tour_pages (Phase 3+)
       │    └─ events (views, downloads)
       └─ billing_usage    # active listings, storage GB (platform metering)
```

Order flow: `requested → confirmed → shot → editing → delivered → paid` (+ `cancelled`).

---

## Roadmap

Phases below are **product milestones for the SaaS**. Dogfooding on tenant #1 is how we prove each slice, not the end state.

### Phase 0 — Tenant-themed marketing surface ✅

**Goal:** Prove white-label sites can win inquiries from config, not hardcoded HTML.

**Done**

- [x] Next.js App Router + TypeScript
- [x] Tenant schema + Eric Guan as sample tenant (`content/tenants/eric-guan.ts`)
- [x] Theme tokens; home, pricing, prep, city SEO landings
- [x] SEO (metadata, JSON-LD, sitemap, robots, OG, favicon)
- [x] Portfolio lightbox UX

**Tenant #1 go-live checklist (ops, not platform)**

- [ ] Real portfolio photos; `portfolioComplete: true`
- [ ] Correct `siteUrl` / contact / Instagram
- [ ] Deploy + custom domain
- [ ] Optional analytics

---

### Phase 1 — Booking + photographer ops ✅ (single-tenant runtime)

**Goal:** Quote + book + shoot board good enough to run a real studio.

**Done**

- [x] Instant quote (package + sqft)
- [x] Service-area gating + drive-time buffers
- [x] Access capture (lockbox, pets, parking, occupancy)
- [x] Preferred-time UX; confirm → calendar hold (Google free/busy stubbed)
- [x] Admin board + password gate
- [x] Email confirmations (Resend or console stub)

**SaaS gap remaining:** shared admin password → real photographer auth + memberships.

---

### Phase 2 — Gated delivery ✅ (local media / single Stripe account shape)

**Goal:** Aryeo-killer delivery: proofs → pay → unlock on the same link.

**Done**

- [x] Upload → original / web / watermarked proof / MLS derivatives (`data/media`, R2-ready helpers)
- [x] Gallery states + server-side download block
- [x] `/g/[token]` — no agent login; revoke flag
- [x] Stripe Checkout + webhook (local stub unlock without keys)
- [x] Trust tiers (`pay_first` / `net7` from prior paid orders)
- [x] MLS + full-res zips; branded / unbranded (`?brand=off`)

**SaaS gap remaining:** R2, expiring tokens, Connect destination charges, in-gallery wallets.

---

### Phase 3 — Multi-tenant platform shell

**Goal:** A second photographer can sign up and run without touching code.

**Done (MVP)**

- [x] Multi-tenant tables in SQLite (`users`, `tenants`, `memberships`, quotas) — Postgres-shaped; swap driver when `DATABASE_URL` lands
- [x] Photographer auth (signup / login / session) + memberships (`owner` / `editor`)
- [x] Onboarding wizard (`/signup` → `/onboarding`) for studio name, slug, theme accent, timezone
- [x] Host routing via `proxy.ts` (`{slug}.{PLATFORM_ROOT_DOMAIN}` + custom domain field)
- [x] Stripe Connect Express onboarding stubs + Checkout destination charges + `PLATFORM_FEE_BPS` (default 0)
- [x] Tenant-scoped admin mutations (order/upload/delivery require membership)
- [x] Seeded second tenant `demo-studio` + isolation script (`scripts/isolation-check.ts`)
- [x] R2 adapter stub (env-gated; local mirror until signed PutObject SDK)
- [x] Storage quota + upload rate limits

**Still later / production harden**

- [ ] Real Postgres + RLS policies
- [ ] Signed R2 client (`@aws-sdk/client-s3`) without local mirror
- [ ] Live Connect test payouts on two tenants
- [ ] Custom domain SSL automation

**Exit criteria progress:** two tenants exist locally (Eric + Demo); Connect works when Stripe keys are set.

---

### Phase 4 — Property websites + share kit ✅

**Done**

- [x] Auto listing page `/p/[slug]` (hero, address, OSM map, gallery, agent card)
- [x] Branded / unbranded; OG image
- [x] Share kit (Studio): IG/Story/FB crops, flyer PDF, caption copy
- [x] Growth+ entitlement for property pages

### Phase 5 — Automation + retention ✅

**Done**

- [x] Transactional email on status changes (confirmed / delivered / paid / cancelled)
- [x] Day-before reminder cron (`/api/cron/reminders` + `CRON_SECRET`)
- [x] Delivery + pay CTA; post-pay thank-you
- [x] Listing media report (views, downloads) at `/g/[token]/report`
- [x] In-gallery upsells on Studio plan

### Phase 6 — Growth & teams (partial)

**Done**

- [x] Platform billing: $49 / $99 / $149 + PAYG + trial + listing/seat quotas
- [x] Editor invites with seat limits
- [x] Legal pack: `/terms`, `/privacy`
- [x] Isolation tests include billing + listing pages
- [x] Postgres RLS SQL draft (`scripts/postgres-rls.sql`)

**Still later / production harden**

- [ ] Live Stripe Price IDs + Customer Portal
- [ ] Postgres + apply RLS before inviting an external studio
- [ ] Signed R2 client (`@aws-sdk/client-s3`) without local mirror
- [ ] Custom domain SSL automation
- [ ] Agent history / brokerage-level pricing
- [ ] Malware scan on upload

---

## Platform vs dogfood (keep these separate)

| Track | Purpose | Examples |
|---|---|---|
| **Platform** | Sell to many photographers | Auth, Connect, domains, RLS, quotas, metering, onboarding |
| **Dogfood (tenant #1)** | Learn real RE photo ops | Portfolio shoots, Montréal outreach, package pricing, twilight later |

Never block platform isolation on “one more marketing page for Eric.”  
Never ship multi-tenant money movement without Connect + isolation tests.

---

## Pricing thesis (platform)

Match Aryeo Pro ladders in USD via Stripe Billing, undercutting only the top public rung:

1. **14-day trial** of Starter (full booking + galleries).
2. **Starter $49/mo** — 125 listings/year, 1 seat, subdomain.
3. **Growth $99/mo** — 250 listings/year, 3 seats, custom domain, property pages.
4. **Studio $149/mo** — 500 listings/year, 5 seats, share kit, reports, in-gallery upsells.
5. **Pay as you go $5/listing** — no monthly fee; switch to a flat plan once volume makes rent cheaper (Starter from 118 listings/year).
6. **Payment fees** — Stripe + optional platform % on Connect (`PLATFORM_FEE_BPS`).

No perpetual free Lite in v1. Env: `STRIPE_PRICE_STARTER` / `GROWTH` / `STUDIO`.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Building a personal CRM forever | Phase 3 shell is the next engineering priority |
| Second tenant leaks data | Postgres + RLS / strict `tenant_id` filters + automated tests before invite |
| Storage / bandwidth blowups | R2, archive full-res ~90 days, quotas |
| Connect complexity | Budget real time; dogfood Connect on tenant #1 first |
| MLS branding rules differ | Branded + unbranded links; confirm per market |
| Token gallery leaks | Long tokens, expiry, revoke |
| Building instead of selling | Cap net-new dogfood features until 1–2 external tenants or clear waitlist |

---

## Scorecard (SaaS targets)

| Dimension | Target |
|---|---|
| Photographer software cost | Usage-first vs $49–$179/mo |
| Time for new studio to go live | < 1 hour (onboarding + Connect + domain) |
| Agent login for delivery | None |
| Unlock speed | Seconds |
| Data / portal independence | Full |
| White-label | Theme + domain + packages |
| Zillow Showcase / 3D Home | Explicit non-goal |

---

## Immediate next actions

**Platform**

1. Create Stripe products/prices ($49 / $99 / $149 + PAYG meter) and set `STRIPE_PRICE_*`.
2. Point a real `DATABASE_URL` (Postgres) and apply `scripts/postgres-rls.sql` before inviting an external studio.
3. Complete Stripe Connect on dogfood tenant; verify destination Checkout.
4. Wire signed R2 uploads; drop local mirror for production media.
5. Pick a public `PLATFORM_NAME` + `PLATFORM_ROOT_DOMAIN`.

**Dogfood (tenant #1, parallel)**

1. Open `http://ericguan.localhost:3000` for the studio site; apex `localhost:3000` is now the SaaS.
2. Shoot / replace portfolio; deploy domain.
3. Run real bookings through gated galleries.

---

## Repo map

```
app/                  # Public + admin + gallery + APIs (must stay tenant-scoped)
components/           # UI
content/tenants/      # File-based tenants until onboarding/DB
lib/                  # quoting, orders, galleries, media, stripe, db, email
data/                 # Local SQLite + media (gitignored) — not production SaaS
PLATFORM-PLAN.md      # This document
.env.example          # Secrets stubs (admin, Resend, Stripe, media, later Connect)
year-plan-slides.html # Eric’s business ops plan (not the SaaS product roadmap)
```

---

## Decisions log

| Date | Decision |
|---|---|
| 2026-08-14 | Product is **multi-photographer SaaS**; Eric Guan = tenant #1 dogfood only |
| 2026-08-14 | Stack: Next.js (not Astro / static-only) |
| 2026-08-14 | Host commercially on Cloudflare, not Vercel Hobby |
| 2026-08-14 | Payments end-state: Stripe Connect; local single-account Checkout OK for dogfood |
| 2026-08-14 | Agents: no login for delivery (token galleries) |
| 2026-08-14 | Platform pricing: prefer per-listing / usage over high monthly rent |
| 2026-08-14 | Twilight off public packages until kit supports it |
| 2026-08-14 | Phase 0–2 dogfood MVP shipped (SQLite + local media) |
| 2026-08-14 | **Next engineering priority = Phase 3 multi-tenant shell**, not more solo-only polish |
| 2026-08-14 | Remade this plan to lead with SaaS, not “tool for myself first” |
| 2026-08-14 | Phase 3 MVP: photographer auth, DB tenants, proxy host routing, Connect stubs, isolation |
| 2026-08-14 | Apex host is the **SaaS marketing site**; Eric Guan lives at `ericguan.{platform}` |
| 2026-08-14 | Photographer billing: Aryeo-matched **$49 / $99 / $179** Stripe subscriptions + 14-day trial |
| 2026-08-18 | Public ladder **$49 / $99 / $149** + PAYG math on `/pricing#compare`; Starter includes 125 listings |
