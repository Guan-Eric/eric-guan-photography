# StudioFront SaaS Success Playbook

> A detailed, StudioFront-specific adaptation of Mike’s 10-step Starter Story framework (bootstrapped SaaS that “can’t fail”).
>
> **Product:** Multi-tenant real estate media platform for photographers (white-label sites, booking, gated delivery, property pages).
> **Positioning:** Beat Aryeo on cost, agent friction, and photographer-owned brand — not on Zillow Showcase exclusivity.
> **Source frame:** [Starter Story — Mike’s $200k MRR playbook](https://youtu.be/67zh8_yiPh4)

Use this document as the go-to-market operating system. Engineering detail lives in `PLATFORM-PLAN.md`, `DEPLOY.md`, and `docs/TECH-STACK.md`.

---

## Principles (carry into every step)

1. **Minimize risk.** Prefer proven demand over novel categories.
2. **Always charge.** Paying users use the product and tell you what is broken.
3. **Design sells.** UX quality is a primary acquisition channel, not a polish pass.
4. **Stay lean.** Aim for founder salaries and profit, not vanity headcount or paid ads early.
5. **Dogfood ≠ product.** Eric Guan Photography is tenant #1 for learning; every feature must work for the next studio.
6. **Ship production-safe before external tenants.** Postgres RLS, signed R2, and live Stripe Connect before inviting paying studios.

---

## Scoreboard (what “working” looks like)

| Milestone | Target |
|---|---|
| Production-ready for second studio | RLS + R2 + Connect + billing live |
| Private LTD | ~$20–30k (stretch: more) |
| Marketplace / AppSumo-style LTD | Leave LTD era with ~$100k runway |
| Content compounding | Competitor + alternative pages indexed early |
| Social proof | Honest G2 / Capterra / Trustpilot reviews from real users |
| Sustainability | ~$10k MRR covering costs before profit splits / lifestyle spend |
| Long game | MRR replaces LTD cash before runway ends |

---

## Step 1 — Pick an idea that’s been done before

### Why this step exists

New ideas need expensive validation. Existing categories already prove people pay. Your job is to **execute better** on a known job-to-be-done.

### StudioFront application

You are already in a proven category:

| Competitor / adjacent | What customers already buy |
|---|---|
| Aryeo | Booking, delivery, portals, subscriptions |
| Spiro / HDPhotoHub | Studio ops + media delivery |
| Local agency + Dropbox/Google Drive | Manual delivery (painful baseline) |

**Do not** pivot into pure AI wrappers, marketplace liquidity bets, or Zillow-dependent exclusives. Platform risk and category novelty kill bootstrap odds.

### Decision checklist

- [ ] Job-to-be-done is clear: photographer runs brand + bookings + paid delivery without agent logins
- [ ] Competitors have customers despite mediocre UX or high pricing (proof of demand)
- [ ] Your wedge is specific and durable:
  - Per-listing / usage-first pricing vs high monthly rent
  - Token galleries (no agent account)
  - Pay-in-gallery unlock
  - Full white-label (theme, domain, packages)
  - Photographer-owned data
- [ ] Explicit non-goals written down (e.g. Zillow Showcase / national staffing)

### Exit criteria

You can explain in one sentence why a photographer switches **today**, and point to at least two competitors who already get paid for the same job.

---

## Step 2 — Decide what is a “good enough” MVP

### Why this step exists

Competitors reveal what customers actually need. Build the paid core fast, get usage, and iterate from feedback — not from feature envy.

### StudioFront “good enough” MVP (must ship)

| Capability | Why it’s core |
|---|---|
| Multi-tenant signup / host routing | Without this you are not a SaaS |
| White-label studio site + packages | Brand ownership is the pitch |
| Booking / quoting → shoot board | Daily ops loop |
| Upload → watermarked proofs | Trust + conversion |
| Token gallery + pay-to-unlock | Removes agent login friction |
| Stripe Connect payouts | Studios get paid; platform can take fee later |
| Platform billing ($49 / $99 / $149 + PAYG) | You get paid |
| Isolation (Postgres RLS + namespaced R2) | Second tenant safety |

### Explicitly defer

- Heavy brokerage CRM / agent history
- Full property-tour suite as table stakes
- Malware scanning polish before first revenue (schedule it, don’t block forever)
- Vanity marketing pages that only help tenant #1

### How to decide scope cuts

For every proposed feature, ask:

1. Would a photographer refuse to pay without it?
2. Does it help **any** studio, or only Eric?
3. Does it increase isolation / billing / delivery risk if delayed?

If (1) is no and (2) is Eric-only → park it.

### Exit criteria

A second studio can sign up, brand a subdomain, take a booking, deliver a gated gallery, get paid via Connect, and be billed on a platform plan — without you SSH-ing exceptions.

**Engineering gate before external invite:** see Immediate next actions in `PLATFORM-PLAN.md` (Stripe Price IDs, Postgres + RLS, Connect on dogfood, signed R2, public platform name/domain).

---

## Step 3 — Offer a lifetime deal (LTD)

### Why this step exists

LTDs create early capital and a cohort of users who are invested enough to complain productively. That cash funds content and runway while MRR is still young.

### StudioFront LTD design rules

| Rule | Recommendation |
|---|---|
| Price band | Roughly **$99–$299** one-time for a constrained Lifetime Starter (test willingness; don’t race to $49) |
| Caps | Hard limits on listings/year, seats, storage — LTDs must not become infinite liability |
| Mapping | Map LTD entitlements to Starter-like rights, not Studio tier forever |
| Scarcity | Limited seats / timebox (e.g. first 100) |
| Support expectation | Same product path as subscribers; no custom one-off builds |
| Legal | Clear “lifetime = while product operates” language; no unlimited SLA promises |

### Suggested LTD SKU (v1)

- **Price:** $199 one-time (`STRIPE_PRICE_LIFETIME`)
- Lifetime Starter rights: booking + galleries + subdomain
- Cap: **125 listings/year** (hard block — no overage meter)
- **1 seat**, 20 GB storage
- No custom domain / property pages (upsell to Growth/Studio)
- Scarcity: first **100** seats (`LTD_SEAT_CAP`), kill switch `LTD_ENABLED=0`
- Public page: `/lifetime` (alias `/ltd`)
- Checkout: signup → welcome → one-time Stripe payment → `plan=lifetime`

### Exit criteria

- [x] Public LTD offer page + FAQ (`/lifetime`)
- [x] Checkout path ready (`POST /api/billing/checkout` with `plan=lifetime`)
- [x] Caps enforced in billing/quotas (empty metered price → hard block)
- [x] Written FAQ on the offer page for sales DMs
- [ ] Provision live Stripe one-time price + sync Worker secret (`npm run setup:stripe:production`)
- [ ] Deploy and smoke-test a test-mode purchase before private sales (Step 5)

---

## Step 4 — Never give away an account for free

### Why this step exists

Free users rarely give useful feedback. Paid users use the product, hit real edges, and tell you why it is “crap” — which is gold at this stage.

### StudioFront policy

| Allowed | Not allowed (early) |
|---|---|
| Paid LTD | Open perpetual free tier |
| 14-day trial **after** paid core works | Unlimited sandbox forever |
| Discounted founder coupons with expiry | “Friends & family free forever” without caps |
| PAYG $5/listing for low-volume studios | Free Lite that competes with Starter |

Aligns with platform pricing thesis: no perpetual free Lite in v1.

### How to run trials without undermining paid

1. Trial requires card (or clear conversion path).
2. Trial = Starter capabilities only.
3. When trial ends → hard paywall on admin + new deliveries (read-only grace optional, short).
4. Track trial → paid conversion weekly.

### Exit criteria

Every active studio is either on trial-with-clock, LTD, subscription, or PAYG. Zero zombie free tenants.

---

## Step 5 — Sell a private LTD as hard as you can

### Why this step exists

Before marketplace fees and broad exposure, sell directly where photographers already gather. Private LTDs prove messaging and fund the next steps.

### Where to sell (priority order for StudioFront)

1. **Direct network** — photographers you’ve shot with / local associations / Montréal + regional RE photo circles
2. **Facebook groups** — real estate photography / realtor vendor groups (value-first posts; follow group rules)
3. **Reddit** — answer workflow pain honestly; soft mention only when asked for tools
4. **LinkedIn / X** — short demos of no-login gallery unlock + pricing contrast vs Aryeo
5. **Private LTD communities** — PitchGround-style / deal communities (research norms and fees)
6. **Warm outbound** — 20 personalized DMs/day to studio owners using Aryeo or Drive delivery

### Private LTD sales kit (create once, reuse)

- 60-second Loom: book → deliver → agent pays in gallery
- One-pager PDF: wedge vs Aryeo (price, friction, ownership)
- FAQ: caps, lifetime definition, migration, Connect onboarding
- Checkout link + calendar for onboarding calls
- Objection scripts: “I already pay Aryeo” / “agents won’t change” / “I need X feature”

### Revenue target

Aim for roughly **$20–30k** from the private LTD (Mike’s Thrill example). Stretch if demand is strong, but do not delay learning for perfect revenue.

### Exit criteria

Private LTD closed or timeboxed with enough cash + users to fund Step 6 content, plus a mailing list of buyers and waitlist non-buyers.

---

## Step 6 — Start writing content immediately

### Why this step exists

It is never too early. Content compounds via Google and LLM citation. LTD cash should buy writing time, not more speculative features.

### Content system for StudioFront

**Full editorial plan:** [`docs/CONTENT-PLAN.md`](./CONTENT-PLAN.md) — pillars, Phase 1–2 titles, 8-week calendar, briefs, distribution, and measurement.

**Pillar pages (ship first)**

- Aryeo alternative
- Aryeo vs StudioFront
- Best real estate photography software (year)
- How to deliver listing photos without agent logins
- Real estate photographer pricing software / booking software

**Supporting pages**

- City / service-area SEO (reuse tenant landing patterns carefully for platform marketing)
- “Switching from Dropbox / Google Drive”
- “Per-listing pricing vs monthly rent”
- Comparison pages vs Spiro / HDPhotoHub (honest, specific)

**Cadence**

- Week 1–2: 5 competitor/alternative pages live
- Ongoing: 1–2 high-intent pages per week until topical coverage is dense
- Every page: one clear CTA (trial / LTD / demo)

### Quality bar

- Specific screenshots of the real product
- Pricing math photographers can verify
- No fake “#1” claims — win on clarity and proof
- Index early; refresh quarterly

### Exit criteria

Competitor + alternative cluster published, analytics installed, and first organic impressions appearing (even if conversions lag).

---

## Step 7 — Launch on AppSumo (or similar marketplace)

### Why this step exists

Marketplaces mail large buyer lists. You trade fee/discount for speed: users + capital. Two common paths: standard marketplace listing vs higher-touch “select” style deals — research fees, review process, and deal structure before committing.

### Preparation checklist

- [ ] Private LTD learnings folded into onboarding
- [ ] Support inbox / help docs for common gallery + Connect issues
- [ ] Deal stack designed with **hard caps** (codes, listings, seats)
- [ ] Abuse controls (one studio per buyer rules as enforceable as practical)
- [ ] Migration plan from deal codes → normal billing after redemption window
- [ ] Status page / incident path for media delivery outages

### Capital goal

Close the broader LTD era with roughly **~$100k** in the bank to fund 1–2 years of content + product while MRR grows.

### Risk controls

- Do not sell uncapped lifetime Studio tier
- Reserve headroom for storage/R2 costs
- Staff support lightly but responsively during launch week
- Keep roadmap public enough that deal buyers feel heard without derailing isolation work

### Exit criteria

Marketplace deal completed (or consciously skipped if private LTD already hit capital goals), list of activated studios, and documented support themes feeding the roadmap.

---

## Step 8 — One last private LTD, then close forever

### Why this step exists

FOMO closes the lifetime chapter. Many buyers wait for “last chance.” Raise price slightly, email the list, then **end LTDs permanently** and push monthly/PAYG.

### Playbook

1. Announce end date (e.g. 7–14 days).
2. Price slightly above earlier private LTD.
3. Email: buyers, waitlist, content subscribers, partial trial users.
4. Social proof from existing LTD users (with permission).
5. Close checkout for LTD SKUs forever.
6. Redirect all CTAs to `$49 / $99 / $149` + PAYG.

### After close

- LTD users remain ambassadors (Step 9)
- New customers only via subscription/PAYG/trial
- Resist reopening LTDs when cash feels tight — reopen trains the market to wait

### Exit criteria

LTD SKUs disabled in Stripe/product config, pricing page shows only ongoing plans, and a written “no more lifetime deals” stance for sales conversations.

---

## Step 9 — Reviews, Reddit, and the live-or-die MRR transition

### Why this step exists

LTD cash is finite. This is the bridge to durable MRR: reviews for trust/SEO, authentic community presence for demand, and relentless conversion of traffic into paid studios.

### Reviews

Ask LTD and early subscribers for honest reviews on:

- G2
- Capterra
- Trustpilot (and any niche directories photographers trust)

**How to ask well**

- Ask after a successful delivery week, not on signup day
- Provide direct links; never script fake 5-stars
- Fix blocking bugs before the review push

### Community / organic

- Scan Reddit for Aryeo / delivery-workflow complaints; answer helpfully
- Participate in photographer forums without hard selling
- Publish 2–3 case studies (tenant #1 + external studios): time saved, unlock speed, cost vs prior stack

### MRR operating rhythm (weekly)

| Metric | Why |
|---|---|
| Trials started | Top of funnel |
| Trials → paid | Offer/UX health |
| Active listings delivered | Product usage |
| Churn / failed Connect onboarding | Revenue leaks |
| Organic + referral signups | Content/review payoff |
| Runway months | Are you winning Step 9 in time? |

### Exit criteria

Steady MRR growth, public reviews live, and a credible path for MRR to cover burn before LTD capital runs out.

---

## Step 10 — Stay lean until ~$10k MRR (then take profits)

### Why this step exists

Most SaaS dies from premature hiring and ad spend. Mike’s model: tech-heavy small team, design prioritized, equal founder splits if multi-founder, pay yourselves meaningfully only after ~$10k MRR covers costs, keep profits flowing to founders rather than empire-building.

### StudioFront lean rules

| Do | Don’t |
|---|---|
| Founder-led sales + support early | Hire a full CS team pre-product-market fit |
| Invest in design/UX quality | Spend big on broad paid ads before conversion is proven |
| Automate onboarding (Connect, domain, quotas) | Custom onboarding for every studio |
| Contract help for spikes (docs, design) | Permanent headcount for temporary launch load |
| Reinvest selectively in content + reliability | Rebuild the stack for novelty |

### Team shape (if/when you add co-founders)

- Prefer people who care about UX end-to-end
- Split equity clearly (Mike’s pattern: equal among core founders — adapt to your reality/legal advice)
- Minimize founder fallout risk: work with people you’d still want to work with under stress

### After ~$10k MRR

- Pay founders consistently
- Keep the company intentionally small
- Scale spend only where unit economics are proven (e.g. content that converts, not vanity brand ads)

### Exit criteria

Costs covered by MRR, LTD cash no longer required for survival, and a boring monthly rhythm of acquire → onboard → deliver value → expand seats/listings.

---

## Recommended sequence on a calendar (indicative)

This is sequencing, not a promise of calendar duration — move as fast as production gates and sales capacity allow.

| Stage | Focus |
|---|---|
| **Foundation** | Finish production gates (RLS, R2, Connect, live prices); dogfood full loop on tenant #1 |
| **Steps 3–5** | LTD offer live; no free zombies; private LTD push to cash + users |
| **Step 6** | Competitor/alternative content cluster live; keep publishing |
| **Step 7** | Marketplace deal if needed for capital/users |
| **Step 8** | Final LTD → close forever → subscription-only growth |
| **Step 9** | Reviews + Reddit/community + weekly MRR scoreboard |
| **Step 10** | Hold lean posture through ~$10k MRR; then take profits deliberately |

---

## Anti-patterns (do not do these)

1. Building more Eric-only features instead of selling to studio #2
2. Inviting external tenants before RLS + signed media + Connect are real
3. Free forever tiers that train non-payment
4. Uncapped lifetime deals that destroy gross margin
5. Chasing AI-native category hype with API platform risk as the core product
6. Reopening LTDs after “forever” because runway anxiety hit
7. Paid ads before onboarding conversion and activation are measured
8. Ignoring support themes from LTD users (they are your earliest roadmap truth)

---

## Artifact checklist (create these once)

- [ ] LTD offer page + FAQ + Stripe LTD SKU with caps
- [ ] Sales one-pager vs Aryeo
- [ ] 60-second product Loom
- [ ] Onboarding checklist (Connect, domain, first gallery)
- [ ] Competitor/alternative SEO pages (`docs/CONTENT-PLAN.md`)
- [ ] Review request email templates
- [ ] Weekly scoreboard (trial, paid, listings, churn, runway)
- [ ] Public pricing only for ongoing plans after Step 8

---

## Related docs

- `docs/CONTENT-PLAN.md` — blog/SEO editorial plan (Step 6 detail)
- `PLATFORM-PLAN.md` — product vision, architecture, pricing thesis, engineering gates
- `DEPLOY.md` — production deploy path
- `docs/TECH-STACK.md` — stack and host model
- `docs/STRIPE-SETUP.md` — billing / Connect setup
- `docs/BOOKING-FLOW.md` — booking and delivery behavior
- `docs/SCREENS.md` — UI map for marketing and admin surfaces

---

## Changelog

| Date | Change |
|---|---|
| 2026-08-20 | Initial playbook adapted from Mike’s 10-step framework to StudioFront |
| 2026-08-20 | Linked Step 6 to `docs/CONTENT-PLAN.md` |
