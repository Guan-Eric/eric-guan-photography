# StudioFront Positioning Rewrite Plan

> Rewrite marketing so we stop overclaiming vs Aryeo and sell an honest, durable wedge.
>
> **Status:** Plan approved for implementation (homepage + comparison + outreach).  
> **Product:** StudioFront — multi-tenant OS for real estate photographers.  
> **Date:** 2026-09-18

---

## 1. Why this plan exists

Aryeo already ships many features we previously implied were unique:

| Capability | Aryeo | Implication |
|---|---|---|
| Branded delivery / download pages | Yes (incl. Lite) | Do not claim “only we brand delivery” |
| Link-based download center | Yes | Do not claim “Aryeo forces login for every delivery” |
| Payment before download | Yes | Do not claim we invented pay-to-unlock |
| White-label / branding | Yes (marketed) | Do not claim white-label as a unique invention |
| Booking + Stripe/Square | Yes | Feature parity is not a wedge |
| Pricing ~$49 / $99 / $179 | Yes (Pro tiers) | Do not claim “dramatically cheaper tiers” alone |

**If we keep selling a fake feature gap, we lose trust on the first demo call.**

Aryeo’s real center of gravity is still:

1. **Agent login portal as the product** (history, reorders, invoices, marketing tools)
2. **Broad media OS** (video, 3D, marketing suite, payroll, team scale)
3. **Zillow / Showcase ecosystem gravity**

StudioFront must sell **defaults, focus, and economics** — not “Aryeo lacks X.”

---

## 2. New positioning (source of truth)

### One-liner

> **StudioFront is the no-login, usage-priced studio brand stack for independent real estate photographers who don’t need a Zillow/portal OS.**

### Category frame

| | Aryeo (and peers) | StudioFront |
|---|---|---|
| Category | Industry media / portal OS | Photographer-owned studio OS |
| Default agent UX | Portal-first (login is a feature) | Link-first (no agent account by design) |
| Breadth | Video, 3D, marketing builder, Showcase | Book → proof → pay → unlock → MLS |
| Buyer | Scaling media teams + Zillow workflows | Solo / small studios optimizing cash + brand |
| Pricing stance | Free Lite delivery + Pro suite rent | True **$5/listing PAYG** with $0 base, or flat bands |

### Who we win

- Solo / small studios tired of portal support tickets
- Seasonal markets where software rent hurts in winter
- Photographers building equity in **their** name, not a marketplace skin
- Studios starting fresh or willing to parallel-run new jobs for 2–4 weeks
- People leaving Drive/Dropbox who don’t want to buy a full media OS

### Who we concede (say out loud)

- Brokerages that **mandate** Aryeo
- Teams that need Showcase / Zillow Media Advantage pipelines
- Multi-shooter shops deep in Aryeo scheduling + marketing suite
- Anyone for whom free Lite delivery is already enough

---

## 3. Claim rules (non-negotiable)

### Never say

- “Aryeo doesn’t have pay-before-download”
- “Aryeo isn’t white-label”
- “Only StudioFront has branded galleries”
- “Agents must always log into Aryeo to get files”
- “We’re cheaper on every plan” (their Lite is $0; Pro bands overlap)
- “Feature parity with Aryeo” (false and unnecessary)

### Always say (honest contrasts)

- **Default:** agents never create accounts — link galleries are the product, not an alternate path
- **Scope:** listing photography loop, not a full media company suite
- **Economics:** $5/listing PAYG with no monthly minimum when volume swings
- **Independence:** not a Zillow Showcase / portal ecosystem play
- **Ownership:** your brand, your Stripe Connect customers, export-friendly posture
- **Disclosure on comparison pages:** we build StudioFront

### Proof language to prefer

| Weak | Strong |
|---|---|
| “Unlike Aryeo, we unlock after pay” | “Pay and unlock on the same gallery link — the default path agents use” |
| “Full white-label Aryeo doesn’t have” | “Booking site + delivery URL carry your studio name end-to-end” |
| “Beat Aryeo on features” | “Built for independents who don’t need the portal OS” |
| “No monthly rent anywhere” | “$5/listing PAYG when shoots drop; flat plans when the calendar fills” |

---

## 4. Messaging pillars (homepage + ads)

Use these three pillars everywhere. Order matters.

1. **No agent password by design**  
   Support tickets and MLS delays die when delivery is a link, not a portal signup.

2. **Get paid on the same link**  
   Watermarked proofs → checkout → MLS/full-res unlock. Cash and delivery are one step.

3. **Price tracks your shoots**  
   PAYG $5/listing with $0 base, or $49 / $99 / $149 listing bands — so slow months don’t punish you.

**Supporting (never lead):** white-label theme/domain, shoot board, property pages, multi-seat, dogfood story (Silent Shutter / founder studio).

---

## 5. Homepage copy outline (`components/platform-home.tsx`)

### Hero

- **H1 options (pick one in impl):**
  - `Your brand. Their photos. No agent logins.`
  - `Run your studio without a portal OS.`
  - `Book, deliver, and get paid — without agent accounts.`
- **Lede:** White-label booking + watermarked galleries that unlock when agents pay. Priced per listing so slow months don’t punish you.
- **CTAs:** Keep `Start 14-day trial` + secondary `See pricing` (Lifetime secondary or tertiary — don’t lead with LTD on hero if positioning is the goal).
- **Proof chips (new):** No agent accounts · Pay-to-unlock · $5/listing PAYG available

### Product section

Reframe from generic “everything” to the **tight loop**:

1. Book on your site  
2. Shoot on one board  
3. Deliver a link (no signup)  
4. Unlock after pay  

Add one line of honesty: *Built for listing photographers — not a Zillow Showcase suite.*

### Delivery section

Keep screen shot. Copy should emphasize **default path**, not uniqueness vs Aryeo’s download center.

### “Built for the work” / dogfood

Keep founder studio story — it’s authentic differentiation. Reframe bullets to pillars above; drop any “Aryeo can’t…” implication.

### Plans teaser

Surface **PAYG** next to flat plans (currently under-emphasized on home). Slow-month story belongs here.

### New section to add: “Who this is (and isn’t) for”

| For you if… | Stay on your current stack if… |
|---|---|
| Agents resist another login | Brokerage mandates a portal |
| Volume swings seasonally | You need Showcase / Zillow media pipelines |
| You want brand-owned booking + delivery | You need deep video/3D/marketing builder |
| You’re OK parallel-running for a few weeks | Switching cost outweighs friction savings |

This section builds trust and reduces bad-fit churn.

---

## 6. Comparison / SEO content rewrite list

Update these posts so tables and “wins if” sections match claim rules. Keep disclosures.

| File | Priority | Rewrite focus |
|---|---|---|
| `content/blog/aryeo-vs-studiofront.ts` | P0 | Admit Aryeo has pay-lock, branded delivery, white-label; contrast defaults, scope, PAYG, ecosystem |
| `content/blog/aryeo-alternative.ts` | P0 | Same; kill “not every platform makes pay-in-gallery first-class” as Aryeo jab |
| `content/blog/switch-from-aryeo.ts` | P1 | Motives = support tax / seasonal rent / brand independence — not missing features |
| `content/blog/spiro-vs-studiofront.ts` | P1 | Align claim language (already closer) |
| `content/blog/hdphotohub-vs-studiofront.ts` | P2 | Same honesty pass |
| `content/blog/best-real-estate-photography-software.ts` | P2 | Framework: choose portal OS vs studio OS |
| `docs/SAAS-SUCCESS-PLAYBOOK.md` | P1 | Update Step 1 wedge + one-pager facts |
| `PLATFORM-PLAN.md` “Why this can win vs Aryeo” table | P1 | Replace inaccurate rows (payment unlock, white-label, agent login absolutes) |
| `docs/CONTENT-PLAN.md` | P2 | Keyword angles: “no agent login by default,” “PAYG RE photo software,” “Aryeo without portal” |
| `docs/LTD-PRIVATE-SALES.md` + outreach DMs | P1 | Objection script: “Aryeo already has X” → stance answer |

### Canonical comparison table (use everywhere)

| Dimension | Aryeo | StudioFront |
|---|---|---|
| Agent access | Portal + download links | **Link-only by design** (no agent accounts) |
| Pay before download | Yes | Yes (core gallery checkout) |
| White-label / branding | Yes | Yes — site + delivery as the whole product |
| Product breadth | Full media / marketing / Zillow suite | Listing loop only |
| Pricing | Lite $0 delivery; Pro ~$49–$179 suite | **$5/listing PAYG ($0 base)** or $49 / $99 / $149 bands |
| Ecosystem | Zillow Showcase / Media Advantage | Explicit non-goal |
| Best fit | Teams + portal-standardized brokerages | Independents optimizing friction + seasonal cost |

---

## 7. Objection scripts (sales / DM / FAQ)

### “Doesn’t Aryeo already have pay-to-unlock and branded delivery?”

> Yes. Aryeo is a strong portal OS and their download center can lock files until payment. StudioFront is for studios that want **agents to never create accounts**, a **narrow book→paid delivery loop**, and **true per-listing PAYG** when the calendar thins — without buying into a Zillow/portal suite. If your brokerages live in Aryeo and it works, stay.

### “You’re the same price as Aryeo Pro.”

> Flat bands look similar. The difference is **$5/listing with no monthly minimum** when you have a quiet month, and you’re not paying for a suite you don’t use. Compare total cost at *your* listing count, including slow seasons.

### “Agents won’t change.”

> Don’t migrate history. Parallel-run: finish open Aryeo jobs, send **new** deliveries as a single link. Pilot 2 friendly agents first. Most resistance is to *another portal*, not to opening a link.

### “I need Showcase / video / marketing builder.”

> We’re not competing there. Choose Aryeo (or Spiro) for that stack. We win when listing stills + booking + paid delivery is the job.

---

## 8. Implementation phases

### Phase A — Messaging source of truth (this doc) ✅

- [x] Write claim rules, pillars, comparison table, objections

### Phase B — Product marketing surfaces (implementation pass)

1. Rewrite `components/platform-home.tsx` (hero, pillars, PAYG teaser, for/against section)
2. Light pass on `components/platform-pricing.tsx` intro (seasonal / PAYG stance; no Aryeo-bashing)
3. Align SaaS meta descriptions (`app/pricing/page.tsx`, signup, lifetime) with claim rules
4. Update `PLATFORM-PLAN.md` competitive table + `docs/SAAS-SUCCESS-PLAYBOOK.md` Step 1

### Phase C — SEO comparison honesty pass

1. `aryeo-vs-studiofront.ts` + `aryeo-alternative.ts` (P0)
2. `switch-from-aryeo.ts` + outreach docs (P1)
3. Remaining vs/alternative posts (P2)

### Phase D — Sales kit

1. One-pager markdown: `docs/sales/aryeo-honest-one-pager.md` (print/PDF later)
2. Refresh Instagram/Facebook cold DM templates to answer “Aryeo already has X”
3. Demo script (60s): show link-only default + PAYG math + non-goals in one sentence

### Phase E — Measure

| Signal | Target |
|---|---|
| Trial signup reason (optional form field) | “No agent login” / “PAYG” / “Brand” dominate over “cheaper than Aryeo features” |
| Sales calls | Fewer “but Aryeo has that” dead ends |
| Comparison page bounce | Lower on Aryeo vs page after honesty rewrite |
| Bad-fit churn in first 30 days | Down (for/against section doing its job) |

---

## 9. Out of scope (this plan)

- Building new Aryeo-parity features (video suite, Showcase, marketing builder)
- Changing Stripe plan prices
- Repositioning tenant #1 photography marketing site (Eric / Silent Shutter public pages)
- Paid ads creative beyond copy guidelines above

---

## 10. Definition of done

This rewrite is done when:

1. Homepage leads with **stance** (no-login default + PAYG + studio OS), not fake feature exclusivity  
2. Aryeo comparison content **admits overlap** and still explains who should switch  
3. Playbook / PLATFORM-PLAN competitive language matches claim rules  
4. Outreach has a crisp answer to “Aryeo already has that”  
5. A stranger can finish this sentence correctly:  
   **“StudioFront is for ___; Aryeo is for ___.”**

Answer we want memorized:

> StudioFront is for independents who want link-only delivery and usage pricing on their own brand. Aryeo is for teams that want a portal OS and Zillow-connected media suite.
