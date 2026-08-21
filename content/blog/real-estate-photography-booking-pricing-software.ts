import type { BlogPost } from "./types";

export const post: BlogPost = {
  slug: "real-estate-photography-booking-pricing-software",
  title: "Real Estate Photography Booking & Pricing Software: What You Actually Need",
  description:
    "The booking → quote → shoot → deliver → get paid loop, and which features matter for RE photo studios.",
  date: "2026-08-20",
  tags: ["booking", "pricing"],
  cta: "trial",
  body: `Most "booking software" lists were written for salons and yoga studios. Real estate photographers need something narrower and harder: **quote by square footage**, **schedule around drive time**, **deliver MLS-ready files**, and **get paid without a finance department**. If your stack does not cover that loop, you are the integration — answering the same pricing DM fourteen times a week.

This article maps the **booking → quote → shoot → deliver → get paid** workflow, separates must-haves from nice-to-haves, and shows where popular tools break. We build StudioFront for this loop; use the framework to evaluate any vendor.

Related: [best real estate photography software](/blog/best-real-estate-photography-software) · [deliver without agent login](/blog/deliver-listing-photos-without-agent-login)

## The loop (and where money leaks)

| Stage | Job to be done | Typical failure |
| --- | --- | --- |
| **Book** | Agent picks package, adds address, chooses time | Back-and-forth email instead of self-serve |
| **Quote** | Sq ft, travel, rush, add-ons priced correctly | Underpriced shoots discovered after edit |
| **Shoot** | Calendar, prep sheet, lockbox notes | Double bookings, missing access info |
| **Deliver** | Proofs → approval → MLS files | Portal login stalls upload |
| **Get paid** | Collect before or at delivery | Invoice net-30 while MLS already live |

Software should shrink each column. If it only solves "calendar," you still bleed hours on delivery and collections.

## Must-have vs nice-to-have

### Must-have (month one)

- **Public pricing/packages** agents can understand without a call
- **Sq ft or tiered residential packages** (not generic "services" menu)
- **Travel or zone rules** so you are not guessing drive time fee each shoot
- **Booking requests** with property address, access, agent contact
- **Proof gallery** with watermarks
- **Full-res unlock** tied to payment or explicit approval
- **Downloads sized for MLS** (your preset, every time)

### Nice-to-have (month three+)

- Team assignment and shooter calendars
- Automated reminders (prep, lockbox, weather)
- QuickBooks / Xero export
- Virtual staging partner hooks
- Client review analytics

### Noise (ignore until revenue justifies)

- Generic CRM pipelines built for SaaS sales teams
- 40-page admin manuals
- Features that require agents to create accounts if your market hates logins

## Package and sq ft pricing patterns that work

Agents compare photographers on **clarity**, not footnotes.

**Flat packages by bracket**

- Under 2,000 sq ft — $X
- 2,000–3,500 sq ft — $Y
- 3,500+ — custom quote

Works for residential volume; easy on mobile booking pages.

**Per-sq-ft with floor**

- $0.08/sq ft, $250 minimum

Scales with property size; disclose the minimum upfront to avoid "why was my condo $250" tickets.

**Add-ons as line items**

- Drone, twilight, floor plan, rush, virtual staging

Show add-ons **before** checkout, not in a surprise invoice.

**Travel zones**

- Zone A (included), Zone B (+$40), Zone C (custom)

Map zones in plain language ("north of [highway]") on your pricing page.

Your booking software should express these rules without you retyping them in email.

## Where tools break (by category)

### Generic schedulers (Calendly, Acuity)

Great for "pick a time," weak for sq ft pricing, property address capture, and delivery. You will bolt on Drive + PayPal and become the workflow.

### Portal platforms (Aryeo, Spiro)

Strong operations and brokerage familiarity; agent **login** is part of the model. Fit when portals are mandated; friction when agents want a link. Compare: [Aryeo vs StudioFront](/blog/aryeo-vs-studiofront).

### Gallery-only hosts

Solve delivery, ignore booking math. You still quote manually.

### DIY stack

Drive + Zelle + Google Calendar costs $0 until you spend **10+ hours/month** on resends and payment status archaeology.

## The StudioFront loop (what we built)

StudioFront is multi-tenant SaaS for real estate photographers — booking, pricing, delivery, and payment on **your** white-label site.

**1. Book**

Agent visits your studio domain, picks a package, enters address and sq ft, selects add-ons, submits a time request.

**2. Quote**

Rules engine applies brackets, travel zones, and rush fees. Agent sees total before you accept the job.

**3. Shoot**

Admin board shows upcoming shoots, access notes, and assignment. Prep details live with the job, not scattered threads.

**4. Deliver**

Upload proofs to a **token gallery** — no agent account. Watermarked previews on mobile.

**5. Get paid**

Agent pays in gallery; full-res unlocks immediately via Stripe Connect. No separate "invoice coming soon" step.

**Pricing (August 2026)**

| Plan | Monthly | Listings/year band |
| --- | --- | --- |
| Starter | $49 | 125 |
| Growth | $99 | 250 |
| Studio | $149 | 500 |
| PAYG | $5/listing | No monthly minimum |

14-day trial on subscription plans. Details: [pricing](/pricing).

**Wedge vs legacy platforms**

- Per-listing / usage-first economics vs flat rent in slow months
- No agent login — link galleries
- Pay-in-gallery unlock
- White-label brand
- Photographer-owned data

We are not pursuing Zillow Showcase exclusivity; we are not building an agent marketplace on your clients.

## Evaluating vendors: 12 questions to ask in a demo

1. Can agents book **without** emailing me a PDF price list?
2. How do sq ft brackets and travel fees calculate — can I edit them?
3. What does the agent see on mobile at delivery?
4. Is login required to download MLS files?
5. Can payment and download happen in one step?
6. What is the effective cost at **8 listings/month**? At **20**?
7. Can I use my domain on booking and delivery?
8. How do I export clients if I leave?
9. How fast can I go live with real packages?
10. Where do revision requests land?
11. Does slow season mean slow software bill? (PAYG option?)
12. Who owns the agent relationship — me or the platform?

If answers are vague on pricing math or exports, schedule a second demo or walk away.

## Slow month vs busy month: software should flex

Photographers feel SaaS pain in January: same subscription, half the shoots. Usage-aligned pricing changes the conversation:

- **Busy June:** subscription band keeps per-listing cost low.
- **Slow January:** PAYG at $5/listing tracks reality.

Run your trailing twelve months before you commit annually. See economics in [best RE photo software](/blog/best-real-estate-photography-software).

## Onboarding in one afternoon

You do not need a quarter-long implementation for a solo studio:

1. Copy packages from your website or PDF into the booking builder.
2. Set travel zones and add-ons.
3. Connect Stripe for pay-in-gallery.
4. Send yourself a test booking; shoot a closet, deliver a fake gallery.
5. Forward the next real agent job through the new flow.

If a platform requires certification before your first gallery ships, weigh that time against revenue.

## FAQ

### Do I need separate booking and delivery tools?

You can stitch tools together, but every handoff is a support ticket. Integrated loops win for solos and small studios.

### What if my pricing is "call for quote"?

Commercial and luxury shoots can stay custom — but publish residential brackets so 80% of agents self-serve.

### Can I migrate from Aryeo?

Yes — finish open jobs there, route new work through StudioFront. Guide: [Aryeo alternative](/blog/aryeo-alternative).

### Does booking software replace a CRM?

For most photographers, a lightweight client list inside the studio tool beats Salesforce. You are not running enterprise sales; you are scheduling drive-bys.

### How do teams with multiple shooters work?

Assign shoots on an admin board; keep one branded agent experience. Higher listing bands fit multi-shooter volume.

### What is the fastest way to test?

[Start a 14-day trial](/signup), clone your top three packages, run one paid listing end-to-end.

## Bottom line

Real estate photography booking and pricing software is not about generic appointments — it is about **quoting correctly**, **showing up informed**, **delivering through a link agents will actually open**, and **getting paid when the MLS goes live**. Buy (or build) for that loop, not for feature count.

If you want white-label booking, token galleries, and pay-in-gallery on usage-friendly pricing, StudioFront is built for you. If brokerages mandate a portal incumbent, use this article as a checklist for what still needs to happen outside that portal.

[Start your 14-day trial](/signup) · [Compare plans](/pricing)
`,
};
