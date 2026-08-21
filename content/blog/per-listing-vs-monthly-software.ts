import type { BlogPost } from "./types";

export const post: BlogPost = {
  slug: "per-listing-vs-monthly-software",
  title: "Per-Listing Pricing vs Monthly Software Rent",
  description:
    "When pay-per-listing beats a fixed SaaS bill, when monthly plans win, and sample math for slow vs busy months in real estate photography.",
  date: "2026-08-20",
  tags: ["pricing", "economics", "saas"],
  cta: "pricing",
  body: `Real estate photography is seasonal. January might bring eight shoots; May might bring forty. Fixed software rent feels great in May and terrible in January.

This post compares **per-listing (usage-based)** pricing with **monthly platform rent** so you can pick a model that matches your volume — not a vendor's preferred billing cycle.

**Disclosure:** [StudioFront](/pricing) offers monthly plans (49, 99, and 149 USD) and pay-as-you-go at **5 USD per listing**, plus a 14-day trial. We will show math with those numbers; substitute your vendor's rates for other tools.

## Definitions

| Term | Meaning | Example |
| --- | --- | --- |
| Monthly rent | Flat fee regardless of shoots | 99 USD/month |
| Per-listing | Fee per delivered gallery/job | 5 USD/listing |
| Hybrid | Base plan + overage | 49 USD/mo + per listing above cap |

Most studios underestimate how many **zero-shoot weeks** they have per year.

## Sample year: solo photographer

Assume:

- 6 slow months averaging **6 listings/month**
- 6 busy months averaging **22 listings/month**
- Annual total: **168 listings**

### Monthly rent at 99 USD

- 99 × 12 = **1,188 USD/year**
- Effective cost per listing: 1,188 ÷ 168 ≈ **7.07 USD/listing**

### Pay-as-you-go at 5 USD/listing

- 168 × 5 = **840 USD/year**
- Effective cost per listing: **5.00 USD**

In this profile, per-listing wins on annual total **if** you would otherwise sit on a 99 USD plan all year.

### Monthly at 49 USD (lighter plan)

- 49 × 12 = **588 USD/year**
- Effective: **3.50 USD/listing** — beats PAYG if you truly use the platform all year

The winner depends on **which features** each tier includes (white-label, Connect, seats). Never compare price without comparing capability.

## When monthly rent makes sense

Choose a monthly plan when:

- You deliver **15+ listings/month** most months
- You need **white-label domain**, team seats, or advanced admin every week
- The platform replaces **multiple tools** (booking + delivery + payments)
- Predictable budgeting matters more than squeezing slow months

Busy studios often land on **99 or 149 USD** tiers because per-listing math crosses over quickly.

## When per-listing wins

Choose pay-as-you-go when:

- You are **seasonal** or returning from a break
- You average **under 10 listings/month** annually
- You are **testing** a platform during migration
- You hate paying full rent in December when shoots die

At 5 USD/listing, 10 listings/month costs **50 USD** — comparable to entry monthly, without December guilt.

Read [why photographers hate SaaS in slow months](/blog/saas-cost-slow-season-photographers) for the psychology, not just the math.

## Break-even table (StudioFront PAYG vs monthly)

Listings per month | PAYG at 5 USD | vs 49 plan | vs 99 plan | vs 149 plan
--- | --- | --- | --- | ---
4 | 20 | PAYG wins | PAYG wins | PAYG wins
10 | 50 | Rough tie | PAYG wins | PAYG wins
12 | 60 | Monthly 49 wins | PAYG wins | PAYG wins
20 | 100 | Monthly wins | PAYG wins | PAYG wins
25 | 125 | Monthly wins | Monthly wins | PAYG wins
30 | 150 | Monthly wins | Monthly wins | Rough tie

"PAYG wins" means lower cash for that month at listed prices. Feature gaps may still push you to a plan.

## Hidden costs neither model lists

| Cost | Per-listing | Monthly |
| --- | --- | --- |
| Onboarding time | Same | Same |
| Agent support | Same | Same |
| Switching penalty | Low if PAYG | Sunk if annual contract |
| Opportunity cost of slow unlock | High everywhere | Feels worse when rent due |

Software price is one line item. **Hours saved on link support** often exceed the delta between 49 and 99 USD.

## Hybrid strategy many studios use

1. **PAYG or entry plan** during migration and slow Q1
2. **Upgrade to 99** when spring volume is predictable
3. **Downgrade or PAYG** in December if shoots vanish

Vendors win when you forget to downgrade. Set a quarterly calendar reminder.

## Comparing to percentage-of-GMV models

Some platforms charge **percent of shoot revenue**. That tracks growth but punishes high-ticket commercial work.

| Model | Good for | Bad for |
| --- | --- | --- |
| Flat monthly | Stable volume | Empty months |
| Per-listing | Variable volume | Very high volume without cap |
| % of GMV | Vendor-aligned growth | Premium pricing |

StudioFront uses flat and per-listing, not GMV share — predictable for photographers who already know their package prices.

## Decision checklist

- [ ] Calculate listings delivered in last 12 months (not booked — **delivered**)
- [ ] Divide annual software spend by that count for effective per-listing cost
- [ ] Model your worst month at zero shoots — what do you still pay?
- [ ] List features you will actually use in slow months (booking page alone may justify 49 USD)
- [ ] Check trial terms — [14-day trial](/signup) should cover two real deliveries before you commit

## FAQ

**Is per-listing "more expensive" at scale?**  
Often yes — that is by design. Platforms trade predictable revenue for your seasonal flexibility.

**Can I switch between PAYG and monthly?**  
On StudioFront, yes — pick what fits each quarter. Confirm with any vendor before annual contracts elsewhere.

**What counts as a "listing" for PAYG?**  
Typically one delivered gallery/job. Clarify in billing docs for multi-family or commercial splits.

**Do agents pay the software fee?**  
No — you do. Your package price should absorb it (roughly 2% of a 250 USD shoot at 5 USD).

**What about Aryeo-style all-in-one rent?**  
Compare effective per-listing cost — [how much should RE photo software cost](/blog/real-estate-photography-software-cost) in 2026.

**Which CTA should I use today?**  
If unsure, run PAYG through trial, then [compare plans](/pricing) after 15–20 real deliveries.

---

Neither model is morally better. Monthly rent buys predictability and features; per-listing buys honesty with your slow season. Run your last 12 months through the break-even table, then [see StudioFront pricing](/pricing) with eyes open.`,
};
