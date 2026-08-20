import type { BlogPost } from "./types";

export const post: BlogPost = {
  slug: "photographer-software-onboarding-checklist",
  title: "Photographer Onboarding Checklist: Live in Under an Hour",
  description:
    "A timed checklist to configure booking, token galleries, pay-to-unlock, and white-label branding so your studio can deliver the next listing today.",
  date: "2026-08-20",
  tags: ["onboarding", "workflow", "checklist"],
  cta: "trial",
  body: `Most real estate photography platforms fail onboarding in the first hour — not because they are hard, but because owners try to configure everything at once.

This checklist gets you **live for the next listing** in under 60 minutes. Skip nice-to-haves until after your first successful delivery.

We wrote this for [StudioFront](/signup) (14-day trial, plans from 49 USD/month, pay-as-you-go at 5 USD per listing), but the sequence applies to any link-first RE delivery stack.

## Before you start (5 minutes)

Gather:

- [ ] Studio logo (PNG, square or horizontal)
- [ ] Primary brand color hex code
- [ ] One package with a clear price (e.g. "Standard stills")
- [ ] Stripe account email (for Connect payouts)
- [ ] Domain or subdomain you want for galleries (optional day one)

Do not import five years of clients on day one. You need **one clean test job**.

## Minute 0–10: Account and studio profile

- [ ] [Sign up](/signup) and verify email
- [ ] Set studio display name (what agents see)
- [ ] Upload logo
- [ ] Set contact email and phone on public site
- [ ] Choose timezone for booking slots

**Done when:** your public studio URL loads with name and logo.

## Minute 10–20: Packages and pricing

Start with **one package**. You can add twilight, video, and sq-ft tiers later.

- [ ] Create "Standard Photo Package" with fixed price
- [ ] Add turnaround note in description (e.g. "Delivered next business day")
- [ ] Enable online booking if you take direct agent orders
- [ ] Set service area or "contact for travel" if applicable

| Package field | Example |
| --- | --- |
| Name | Standard stills (up to 3,000 sq ft) |
| Price | 275 |
| Duration on calendar | 90 minutes |
| Deliverable | 25–35 edited photos |

**Done when:** you can book a test order from the public site.

## Minute 20–35: Delivery and galleries

- [ ] Create a test listing / job from admin
- [ ] Upload 5–10 sample JPGs (not full shoot — speed matters)
- [ ] Generate token gallery link
- [ ] Open link in incognito window (simulates agent with no login)
- [ ] Confirm previews load on mobile

Token galleries mean **no agent account**. The link is the credential.

**Done when:** incognito preview works on your phone.

## Minute 35–45: Pay-to-unlock (if you collect at delivery)

Skip this block if you invoice brokerages net-30 separately.

- [ ] Connect Stripe (Connect onboarding)
- [ ] Enable pay-to-unlock on the test gallery
- [ ] Run a **1 USD test payment** with your own card
- [ ] Confirm download unlocks after payment
- [ ] Verify payout shows in Stripe dashboard

Read [Stripe Connect for photographers](/blog/stripe-connect-real-estate-photographers) if Connect language is confusing.

**Done when:** test payment unlocks download.

## Minute 45–55: White-label basics

Full custom domain can wait. Do these now:

- [ ] Set primary brand color on public pages
- [ ] Confirm gallery page shows studio name, not generic platform branding
- [ ] Add link to your pricing or packages page in gallery footer if available

Advanced: point `photos.yourdomain.com` CNAME when DNS is ready — not required for first delivery.

**Done when:** a friend says "this looks like your studio site."

## Minute 55–60: Send a real delivery email

Use this template:

Subject: **Photos ready: [Address]**

> Hi [Agent],
>
> Your listing gallery is ready: [gallery URL]
>
> Preview in the browser, complete payment if required, then download MLS-ready files. No account needed.
>
> — [Studio Name]

Send to yourself and one trusted agent.

**Done when:** email sent and link opened on mobile.

## Post-hour: week-one enhancements (optional)

| Priority | Task | Why |
| --- | --- | --- |
| High | Add second package (twilight or drone) | Upsell |
| High | Custom domain | Trust with brokerages |
| Medium | Import top 20 agent emails | Faster rebooking |
| Medium | Pay-as-you-go vs monthly plan decision | See [pricing](/pricing) |
| Low | Team seats for second shooter | Scale |

## Common onboarding mistakes

1. **Configuring six packages before first delivery** — agents only need one clear offer to book.
2. **Skipping incognito test** — you will not see login assumptions until an agent complains.
3. **Connecting Stripe last** — payment bugs on a real job are stressful; test with 1 USD first.
4. **Migrating every old gallery** — forward-only for new jobs; migrate history on request.

## FAQ

**Can I go live without a custom domain?**  
Yes. Use the default studio URL until DNS is ready.

**Do agents need accounts?**  
No — token gallery links are enough for preview and download.

**What if I only shoot 4 listings this month?**  
Consider pay-as-you-go at 5 USD per listing instead of a monthly plan — see [per-listing vs monthly](/blog/per-listing-vs-monthly-software).

**Is 60 minutes realistic?**  
Yes for one package and a test delivery. Custom domain DNS may add 24–48 hours propagation outside that hour.

**What about migrating from Aryeo or Drive?**  
Run parallel for new jobs only — [switch from Aryeo](/blog/switch-from-aryeo) or [leave Google Drive](/blog/google-drive-listing-galleries) without moving history day one.

**Who is this checklist for?**  
Solo photographers and small studios who need to deliver the **next** listing professionally, not perfect every integration on day one.

---

Onboarding is a delivery problem, not a settings marathon. One package, one test gallery, one payment test, one agent email — then iterate. [Start your 14-day StudioFront trial](/signup) and use this checklist on your first session.`,
};
