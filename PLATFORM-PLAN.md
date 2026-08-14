# Real Estate Media Platform Plan

> Build a portal-independent, white-label platform that replaces Aryeo for solo photographers first, then scales to multi-photographer SaaS — starting with Eric Guan Photography as tenant #1.

**Status:** Phase 0 complete (marketing site + tenant schema). Phases 1–5 not started.  
**Stack decision:** Next.js App Router, Postgres (Neon or Supabase), Cloudflare (Workers via OpenNext + R2), Stripe Connect, Resend.  
**Pricing model to beat Aryeo:** per-listing or low fixed + usage, not $99–$179/month subscription.

---

## Why this can beat Aryeo

Aryeo is strong at order → gallery → Zillow Showcase. It is weak for independents who care about:

| Gap | Aryeo | This product |
|---|---|---|
| Cost | ~$49–$179/mo whether you shoot or not | Near-$0 fixed; Stripe fees + optional per-listing |
| Agent friction | Agent login / portal | Signed gallery links, no login |
| Ownership | Zillow Group (ShowingTime+) | Photographer-owned data |
| Payment unlock | Invoice round-trip | One-tap pay-in-gallery unlock |
| Trust | Binary gate | Per-agent trust tiers (pay-first vs net-7) |
| Scheduling | Generic slots | Sunset-aware twilight + drive-time buffers (later) |
| White-label | Platform-branded experience | Full white-label from day one |

**Do not try to win on Zillow Showcase exclusivity or national team payroll.** Win on cost, friction, independence, and agent experience.

**Market signal:** Alternatives (Spiro ~$5/listing, HDPhotoHub ~$1.20–$2/listing) price per listing. Portal-independent + white-label + modern UX is an open lane.

---

## Product principles

1. **Tenant #1 is Eric Guan.** Every public page is rendered from tenant config, not hardcoded HTML.
2. **Ship volume before features.** A perfect platform with zero clients is worthless. Gate heavy build work on paid listings delivered manually.
3. **Gate downloads server-side.** Watermarked proofs until payment (or trust-tier unlock). Never rely on “please don’t download yet.”
4. **No agent accounts unless necessary.** Signed, expiring, revocable URLs beat logins for delivery.
5. **Per-listing economics for SaaS.** Photographers hate paying rent in slow months.
6. **Commercial-safe hosting.** Do not use Vercel Hobby for a business product. Prefer Cloudflare free tier (commercial OK) via OpenNext.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Marketing / portfolio (static SSG)                         │
│  Tenant-themed site: home, pricing, prep, city landings     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  App (Next.js App Router)                                   │
│  Booking · Admin board · Galleries · Property sites · API   │
└───┬─────────────┬─────────────┬─────────────┬───────────────┘
    │             │             │             │
 Postgres      R2 media      Stripe       Resend
 (tenants,     (originals,   Connect      (confirmations,
  orders,       proofs,       (per-tenant  delivery, pay,
  galleries,    MLS sizes)     payouts)    review ask)
  agents)
```

### Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Chosen; React ecosystem; App Router for marketing + app |
| Hosting | Cloudflare Workers (OpenNext) | Free tier, commercial-safe, edge |
| Media | Cloudflare R2 | 10 GB free, **zero egress** (critical for photo delivery) |
| Database | Neon or Supabase Postgres | Multi-tenant RLS; real SQL; not D1 for SaaS |
| Auth | Photographer login only (Clerk / Auth.js / Supabase Auth) | Agents stay link-based |
| Payments | **Stripe Connect** | Each photographer collects; platform can take a fee later |
| Email | Resend | Free tier enough early |
| Images | `sharp` on upload | Derivatives once; cache forever |

**Fixed cost target:** domain only (~$12/year) until volume forces paid tiers.

### Multi-tenancy

- Every row keyed by `tenant_id`.
- Host resolution: custom domain → subdomain → default tenant (dev).
- Theme = CSS custom properties injected on `<html>` (already implemented).
- Content shape lives in `lib/tenant-schema.ts` — becomes the DB row when Postgres lands.

### Critical data model (sketch)

```
tenants
  └─ brokerages
       └─ agents (trust_tier: pay_first | net7 | open)
            └─ orders (address, geocode, sqft, package, price, status, access)
                 ├─ appointments
                 ├─ media_assets → derivatives (proof, web, mls, full)
                 ├─ invoices / payments
                 ├─ galleries (state: proofing | unlocked | archived, token)
                 ├─ tour_pages
                 └─ events (views, downloads)
```

Order statuses: `requested → confirmed → shot → editing → delivered → paid`.

---

## Phase 0 — Marketing site + tenant seam ✅

**Goal:** A site that wins inquiries, with a schema that becomes the SaaS `tenants` table.

**Done:**

- [x] Next.js App Router + TypeScript over the old static HTML
- [x] Tenant schema + Eric Guan tenant record (`content/tenants/eric-guan.ts`)
- [x] Theme tokens as CSS variables; site data-driven from tenant
- [x] Home, pricing, seller-prep (`/prep`), city landing (`/real-estate-photography/[city]`)
- [x] SEO: metadata, LocalBusiness JSON-LD, FAQ schema, sitemap, robots, OG image, favicon
- [x] Lightbox: `<dialog>`, focus restore, arrows, swipe, captions
- [x] Responsive images via `next/image` (AVIF/WebP)
- [x] Prefill `mailto:` booking stopgap (address, sqft, access, timing)
- [x] Twilight removed from public packages until kit supports it

**Still required before calling Phase 0 “live for agents”:**

- [ ] Replace Unsplash placeholders with real listing photos; set `portfolioComplete: true`
- [ ] Confirm city / `siteUrl` / email / phone / Instagram in tenant config
- [ ] Deploy (Cloudflare Pages/Workers) + custom domain
- [ ] Optional: analytics (Plausible / Cloudflare Web Analytics)

**Non-negotiable business step (not code):** shoot 3 homes free, deliver 15–30 images each, put them on the site.

---

## Phase 1 — Booking + quoting

**Goal:** Replace `mailto:` with a flow Calendly + Google Forms cannot match.

**Build:**

- [ ] Instant quote from package + square footage (firm price, not “I’ll get back to you”)
- [ ] Duration derived from sqft / package (`durationMinutes` already on packages)
- [ ] Service-area / postal-code gating
- [ ] Drive-time buffer between appointments (refuse slots that collide with travel)
- [ ] Access capture: lockbox/code, pets, parking, occupied vs vacant, who meets you
- [ ] Photographer admin board: one screen for all order statuses
- [ ] Google Calendar free/busy sync (personal calendar stays source of truth)
- [ ] Confirmation email + link to `/prep`

**Defer until kit supports it:** sunset-aware twilight slot offering.

**Gate to start Phase 1:** Phase 0 live with real portfolio photos. Prefer at least a few warm agent conversations so the form fields match real questions.

---

## Phase 2 — Gated delivery (the Aryeo-killer)

**Goal:** Proofs first; full-res only after payment (or trust tier).

**Build:**

- [ ] Upload pipeline → R2: original, web, watermarked proof, MLS-sized variants
- [ ] Gallery states: `proofing` → `unlocked` → `archived`
- [ ] Server-side download block in `proofing` (not UI-only)
- [ ] Signed, expiring, revocable gallery URLs — **no agent login**
- [ ] Stripe Checkout / Payment Element **inside the gallery** (Apple Pay / Google Pay)
- [ ] Webhook flips gallery to `unlocked`; same URL, full files appear
- [ ] Per-agent trust tiers: new agents pay-first; retainers get net-7 auto-unlock
- [ ] “Download for MLS” presets (long-edge, file size, sRGB, naming, zip)
- [ ] Branded + unbranded share links (MLS compliance)

**Gate to start Phase 2:** Prefer **5 paid listings delivered manually** (Drive + Wave/Stripe invoice) so the workflow is real before you automate it.

---

## Phase 3 — Property websites + share kit

**Goal:** Every listing gets a shareable property page agents actually send to sellers.

**Build:**

- [ ] Auto page from order data: hero, address, map, gallery, optional video/reel, agent bio
- [ ] Branded / unbranded toggle; custom slug; OG image per listing
- [ ] Share kit: Instagram feed + Story crops, Facebook crop, flyer PDF, short listing copy
- [ ] Optional floor plan / reel embed slots

---

## Phase 4 — Automation + retention

**Goal:** Reduce manual email; make agents look good to their sellers.

**Build:**

- [ ] Transactional email on every state change
- [ ] Day-before reminder + seller-prep link
- [ ] Delivery notice + pay CTA
- [ ] Timed review / referral request after payment
- [ ] Listing media report: views, downloads, tour traffic → branded email agents can forward to sellers
- [ ] In-gallery upsells after delivery (extra rooms, reel, floor plan — twilight later)

---

## Phase 5 — Scale (only at volume)

**Gate:** consistently **2–3 shoots/week**.

**Build:**

- [ ] Agent accounts with listing history
- [ ] Brokerage-level pricing
- [ ] Referral links
- [ ] Editor / second-shooter handoff queue
- [ ] Floor plans, virtual staging via third-party APIs
- [ ] Photographer onboarding for SaaS (tenant signup, Connect onboarding, branding)

---

## SaaS-specific work (because this is a product)

These are **extra** relative to “tool for myself only”:

1. **Stripe Connect** — Express or Standard accounts per photographer; platform fee optional later.
2. **Row-level security** — tenants cannot read each other’s data.
3. **Host routing** — `slug.platform.com` + custom domains + SSL.
4. **Onboarding** — studio name, brand colors, packages, service area, Connect link.
5. **Billing for the platform** — prefer per-active-listing or usage over high monthly SaaS rent.
6. **Legal** — ToS, privacy, media license defaults, DPA if needed.
7. **Abuse** — storage quotas, rate limits, malware scan on upload.

Keep the data model multi-tenant from Phase 1 onward even if only one tenant exists.

---

## Free “starter stack” (manual ops until Phase 2)

Use while building — do not skip learning the business:

| Need | Free tool |
|---|---|
| Inquiries | Site contact / Forms |
| Scheduling | Calendar + manual confirm |
| Invoicing | Wave or Stripe Payment Links |
| Delivery | Google Drive / WeTransfer |
| Payment protection | Watermarked proofs → unlock full-res after pay |

**Upgrade signal:** 2–3 shoots every week, or manual back-and-forth eating evenings.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Building instead of booking agents | Cap Phase 2 until 5 paid manual deliveries |
| Storage / bandwidth cost | R2 + archive full-res after ~90 days |
| MLS rules vary | Confirm local unbranded / branding rules before presets |
| Signed URL leaks | Long tokens, expiry, revoke on request |
| Stripe Connect complexity | Budget real time; start with one Connect account (yours) |
| Twilight marketed too early | Kept off public packages until flash + blue-hour practice |

---

## Scorecard vs Aryeo (target)

| Dimension | Target outcome |
|---|---|
| Monthly software cost | ~$0 + payment fees vs $49–$179 |
| Agent login | None for delivery |
| Unlock speed | Seconds (wallet pay) vs invoice email loop |
| Data / portal independence | Full |
| Zillow Showcase / 3D Home | Accept loss; don’t chase |
| Team payroll / multi-market | Accept loss until Phase 5 |

---

## Immediate next actions

1. **Shoot three homes** and replace portfolio images; flip `portfolioComplete`.
2. Correct tenant fields if needed: city, `siteUrl`, phone, Instagram (`content/tenants/eric-guan.ts`).
3. **Deploy** Phase 0 to Cloudflare + domain.
4. Run outreach from the year-plan slides (warm agents first).
5. Start **Phase 1** only after the site shows real work and you are taking bookings.

---

## Repo map (Phase 0)

```
app/                 # Routes: home, pricing, prep, city, SEO endpoints
components/          # Header, footer, gallery, JSON-LD, reveal
content/tenants/     # Tenant records (Eric Guan = tenant #1)
lib/tenant-schema.ts # Public site + future tenants table shape
lib/tenants.ts       # Loader (file today → DB tomorrow)
PLATFORM-PLAN.md     # This document
year-plan-slides.html# 12-month business launch plan (ops, not product)
```

---

## Decisions log

| Date | Decision |
|---|---|
| 2026-08-14 | Product is multi-photographer SaaS, not solo-only tool |
| 2026-08-14 | Stack: Next.js (not Astro / not static-only) |
| 2026-08-14 | Start with Phase 0; Phase 0 implemented |
| 2026-08-14 | Host commercially on Cloudflare, not Vercel Hobby |
| 2026-08-14 | Payments: Stripe Connect for SaaS |
| 2026-08-14 | Twilight option removed from public packages until kit supports it |
