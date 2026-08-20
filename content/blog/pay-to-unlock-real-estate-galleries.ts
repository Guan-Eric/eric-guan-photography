import type { BlogPost } from "./types";

export const post: BlogPost = {
  slug: "pay-to-unlock-real-estate-galleries",
  title: "Pay-to-Unlock Galleries Explained for Listing Media",
  description:
    "How pay-to-unlock works for real estate photo delivery, when to use it vs net-30 invoicing, agent UX best practices, and setup with Stripe Connect.",
  date: "2026-08-20",
  tags: ["pay-to-unlock", "payments", "galleries"],
  cta: "trial",
  body: `Pay-to-unlock means the agent can **preview** listing media in the browser, but **full-resolution download** (or the entire zip) is gated until payment succeeds.

For real estate photographers, it is the cleanest way to tie delivery to collection without a separate invoice chase — when your client base allows it.

**Disclosure:** [StudioFront](/signup) supports pay-to-unlock galleries with Stripe Connect payouts. This explainer covers the pattern industry-wide.

## The basic flow

1. You finish editing and publish the gallery
2. Agent receives a **token link** (no account)
3. Agent browses watermarked or web-sized previews
4. Agent clicks pay / unlock
5. Card checkout completes (Stripe or similar)
6. Full MLS-sized files unlock immediately

No portal login. No "I'll ask accounting" before they have seen a single image.

## Why studios adopt pay-to-unlock

| Problem with invoice-first | Pay-to-unlock fix |
| --- | --- |
| Delivery before payment | Payment at point of value |
| Agents forget to forward invoice | One link, one step |
| 30–45 day brokerage AP | Cash when allowed by policy |
| Separate tools for files vs money | Same gallery page |

It does not replace **signed net-30 contracts** with large brokerages. It replaces awkward email invoicing for everyone else.

## What agents see (good vs bad UX)

### Good

- Clear banner: "Preview ready — pay to download MLS files"
- Package name and price match the order
- Mobile-friendly preview grid
- Instant download after success
- Receipt email from **your studio**

### Bad

- Surprise price at unlock after they shared link internally
- Tiny preview thumbs with no full-screen view
- Unlock button buried below fold
- Vendor branding on checkout
- Broken download on iOS Safari

Test on a phone in incognito before every new workflow launch.

## Preview tiers (choose one policy)

| Tier | Agent sees before pay | Best for |
| --- | --- | --- |
| Web JPEG grid | Medium resolution | Most residential |
| Heavy watermark | Obvious proof | High-trust risk clients |
| Count only ("42 photos") | Thumbnails | Rare; feels stingy |
| Partial set | First 5 free | Upsell-heavy studios |

Most studios use **web-quality previews** without watermark — agents need to approve composition, not pixel-peep MLS files.

## Pay-to-unlock vs deposit vs invoice

| Model | When to use |
| --- | --- |
| Pay-to-unlock at delivery | Direct agent pay, small brokerages |
| 50% deposit at booking | High cancellation risk markets |
| Net-30 invoice | Signed brokerage agreements |
| Cash at door | Declining; hard to scale |

You can mix: net-30 for three anchor brokerages, pay-to-unlock for everyone else. Mark jobs accordingly in admin.

## Money flow with Stripe Connect

The agent pays in checkout; funds route to your connected account per platform rules. You do not manually mark "paid" on honor system.

Setup details: [Stripe Connect for RE photographers](/blog/stripe-connect-real-estate-photographers).

On [StudioFront](/pricing), Connect is available on plans that include payments — confirm current plan matrix before assuming.

## Implementation checklist

- [ ] Connect onboarding complete and verified
- [ ] Package price on job matches unlock price
- [ ] Preview vs full file sizes configured
- [ ] Test payment at 1 USD, confirm unlock + refund
- [ ] Delivery email mentions payment step explicitly
- [ ] VA script: "Do not email zip manually before pay unless brokerage exception"

## Email copy that reduces disputes

Subject: **Preview ready: [Address] — download after payment**

> Hi [Agent],
>
> Your listing gallery is live: [URL]
>
> Browse previews on any device. When you are ready, complete payment in the gallery to download MLS-ready files. No separate invoice.
>
> Questions on billing? Reply here.
>
> — [Studio Name]

Transparency beats surprise at the unlock button.

## Objections you will hear (and answers)

**"Our office is net-30 only."**  
Disable pay-to-unlock for that job; deliver after PO or send traditional invoice. Do not argue on a 250 USD shoot.

**"I need files for the seller before I pay."**  
Offer web previews for seller approval; MLS download after pay. Policy on your price sheet.

**"Can you bill the brokerage?"**  
If you have a billing relationship, invoice separately. Pay-to-unlock is for card-on-file moments.

**"Card fees?"**  
Absorb or disclose per your state norms — see [software and payment cost context](/blog/real-estate-photography-software-cost).

## Security and misuse

- Token links should be long, unguessable URLs
- Revoke and reissue if a link leaks on social
- Do not post unlock links in public MLS remarks
- Log download events if your platform supports it

Pay-to-unlock is not DRM — a paid agent can forward files. That is normal for listing media; your goal is **payment**, not perpetual lock.

## Pairing with white-label brand

Checkout on a generic subdomain undermines trust. Pair pay-to-unlock with [white-label domains](/blog/white-label-real-estate-photography-website) so the URL bar matches your business card.

## FAQ

**Is pay-to-unlock unprofessional?**  
No more than requiring payment before handing a USB drive. Professionalism is clarity and consistency.

**Do top brokerages accept it?**  
Mega-brokerages often mandate AP workflows — segment your clients.

**What about twilight upsells?**  
Publish base gallery unlocked after base pay; add-on invoice or second unlock for extras.

**Can agents expense on corporate card?**  
Yes — most pay-to-unlock flows are standard card checkout with receipt.

**Failure after payment?**  
Rare webhook delays — refresh; support with Stripe payment ID if needed.

**How does this relate to token galleries?**  
Token = access without login. Pay-to-unlock = commercial gate on that access. Together they replace agent portals — [delivery without login](/blog/google-drive-listing-galleries).

**Trial test?**  
[14-day StudioFront trial](/signup) — run one paid unlock before rolling out to all agents.

---

Pay-to-unlock aligns **seeing** photos with **paying** for them — one link, one checkout, immediate download. Set policy for net-30 exceptions, test on mobile, and pair with your brand on the URL. [Start a trial](/signup) and run a 1 USD unlock on your next listing before you change agent expectations fleet-wide.`,
};
