import type { BlogPost } from "./types";

export const post: BlogPost = {
  slug: "stripe-connect-real-estate-photographers",
  title: "Stripe Connect for Real Estate Photographers (Plain English)",
  description:
    "What Stripe Connect is, why RE studios use it for pay-to-unlock galleries, and how onboarding, payouts, and fees work without the fintech jargon.",
  date: "2026-08-20",
  tags: ["payments", "stripe", "pay-to-unlock"],
  cta: "trial",
  body: `Stripe Connect sounds like enterprise payment infrastructure. For real estate photography studios, it is simply the mechanism that lets **you** get paid when an agent pays inside a gallery — while the platform handles compliance and card processing.

This post explains Connect in plain English: what you set up, what agents see, and what hits your bank account.

**Disclosure:** [StudioFront](/signup) uses Stripe Connect for pay-to-unlock and studio payouts. We are not Stripe; confirm fee details in your own Stripe dashboard and terms.

## The problem Connect solves

Without Connect, you have two bad options:

1. **Invoice after delivery** — agents delay payment; you chase accounting departments.
2. **Platform holds all money** — you trust a vendor to pay you out (slow, opaque).

Connect lets a platform (StudioFront) facilitate checkout **to your connected Stripe account**. The agent pays; Stripe routes funds per the rules you agreed to with the platform.

## Three roles (simplified)

| Role | Who | What they do |
| --- | --- | --- |
| Platform | StudioFront | Hosts gallery, triggers checkout |
| Connected account | Your studio | Receives payouts for your jobs |
| Customer | Listing agent | Pays by card in the gallery |

You complete **Connect onboarding** once as the studio owner. Agents never create Stripe accounts.

## What onboarding asks for

Stripe must verify you are a real business (KYC — know your customer). Expect:

- Legal name and business type (sole prop or LLC)
- Tax ID or SSN (US) / local equivalent
- Bank account for deposits
- Sometimes ID verification photo

Plan **15–30 minutes** uninterrupted. Doing this on a phone in a parking lot leads to typos and delays.

## What the agent experiences

1. Opens gallery link (no login)
2. Sees previews
3. Clicks pay / unlock
4. Enters card on a Stripe-hosted checkout (secure, familiar)
5. Downloads full-resolution files immediately after success

The agent does not see "Connect." They see your studio name and a payment step.

## Payout timing

Stripe pays **your bank** on a schedule (often rolling 2-day in the US for established accounts; first payouts can take longer). The platform may take an application fee per transaction — check [StudioFront pricing](/pricing) for what applies to your plan.

| Event | Typical timing |
| --- | --- |
| Agent pays | Instant authorization |
| Funds available in Stripe balance | 1–2 business days |
| Payout to your bank | Per your Stripe payout schedule |

Holiday weekends shift dates. Check the Stripe dashboard, not your anxiety.

## Fees: who pays what

Rough structure (confirm current Stripe rates in your country):

- **Card processing** — percentage + fixed fee per successful charge (standard Stripe pricing)
- **Connect** — may add platform-specific application fee
- **Disputes/chargebacks** — your responsibility as merchant of record for your sales

Some studios absorb card fees; others add a line item. Be explicit on your price sheet.

## Pay-to-unlock vs traditional invoice

| | Invoice after delivery | Pay-to-unlock in gallery |
| --- | --- | --- |
| Cash flow | Delayed | Immediate on unlock |
| Agent friction | Email + portal | One link |
| Brokerage net-30 | Common | Requires policy change |
| Best for | Large broker contracts | Direct agent pay |

Many studios use **both**: net-30 for signed brokerage accounts, pay-to-unlock for everyone else.

Deep dive: [pay-to-unlock galleries](/blog/pay-to-unlock-real-estate-galleries).

## Connect vs "just use Venmo"

Venmo and Zelle work for side gigs. They break for studios because:

- No automatic tie between payment and download
- Weak dispute and receipt paper trail
- Brokerages want card records
- Does not scale with volume or VA staff

Connect professionalizes the same moment Venmo handles casually.

## Setup checklist for studios

- [ ] Stripe account created with business email
- [ ] Connect onboarding completed (all green checks in Stripe)
- [ ] Test charge at 1 USD on a private gallery
- [ ] Confirm download unlocks after test payment
- [ ] Refund test charge (optional cleanup)
- [ ] Add "payment due at download" to agent welcome PDF
- [ ] Train VA: never send full zip before payment unless brokerage contract says otherwise

## Troubleshooting first-week issues

**"Connect onboarding pending"**  
Stripe needs more documents. Respond in dashboard within 24 hours.

**Payment succeeded but no download**  
Usually a webhook delay — refresh gallery. If persistent, support ticket with payment intent ID from Stripe.

**Payout missing**  
Check Stripe → Balance → Payouts. First payout often takes longer.

**Agent wants net-30**  
Disable pay-to-unlock for that job or mark as invoiced in your admin — do not fight brokerage AP over a 275 USD shoot.

## Compliance and taxes

You are the seller of record for your shoots. Connect does not replace:

- Sales tax collection where required
- 1099-K / local reporting thresholds
- Written contracts with brokerages

Talk to an accountant for your state. Software moves money; it does not file your taxes.

## FAQ

**Do I need Connect if I only invoice?**  
No. Connect matters when you want card payment inside the gallery.

**Can I use my existing Stripe account?**  
Usually yes — Connect links an existing or new Stripe account during onboarding.

**Are agents charged extra fees at checkout?**  
Only if you configure pass-through; default is your listed package price plus whatever Stripe displays as standard processing (region-dependent).

**Is Connect safe for brokerages?**  
Stripe is widely accepted; branded checkout on your gallery is more professional than ad hoc links.

**Does StudioFront store card numbers?**  
No — Stripe hosts card entry. StudioFront sees payment status, not full PAN.

**What if I switch platforms later?**  
Your Stripe account remains yours; transaction history stays in Stripe.

---

Stripe Connect is not a separate product you sell — it is plumbing so agents can pay you at the moment they want files. Complete onboarding once, test with a dollar, then make pay-to-unlock your default for non-net-30 clients. [Start a StudioFront trial](/signup) and walk through Connect during your first test gallery.`,
};
