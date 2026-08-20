import type { BlogPost } from "./types";

export const post: BlogPost = {
  slug: "switch-from-aryeo",
  title: "How to Switch From Aryeo Without Losing Active Clients",
  description:
    "A practical migration playbook for real estate photographers leaving Aryeo: parallel runs, client communication, gallery handoff, and when to cut over.",
  date: "2026-08-20",
  tags: ["migration", "aryeo"],
  cta: "trial",
  body: `Switching delivery platforms is one of the highest-anxiety decisions a real estate photography business makes. You are not just changing software. You are changing how agents receive listing media, how invoices get paid, and how your brand shows up on every job.

This guide is written for photographers who already have active clients on Aryeo and want to move without a messy gap. **Disclosure:** we build [StudioFront](/signup), a real estate photography platform. We will compare honestly and focus on what protects your client relationships during a switch.

## Why photographers leave Aryeo (and why that is normal)

Aryeo is a mature product with a large agent network. Many studios stay for years. Others leave when their business model changes:

- **Fixed monthly cost in slow months** feels heavy when shoot volume drops.
- **Agent login portals** create friction for busy listing agents who refuse another account.
- **Branding** matters more as you grow a white-label studio identity.
- **Delivery workflow** needs pay-to-unlock or token galleries instead of portal-only access.

None of these mean Aryeo is bad. They mean your studio may have outgrown a specific workflow.

## The migration principle: parallel, then cut over

The biggest mistake is a hard switch on a Monday morning. Agents mid-transaction do not care about your internal tooling change.

Use a **parallel run**:

1. Keep Aryeo live for in-flight jobs until delivery and payment are complete.
2. Route **new bookings** to the new platform from a clear cutover date.
3. Send one proactive email to active agents before the first new-platform delivery.

Most studios run parallel for **2–4 weeks**, not months.

## Pre-migration checklist

Complete these before you announce anything to clients:

| Task | Owner | Done |
| --- | --- | --- |
| Export client list (name, email, brokerage) | You | [ ] |
| Document active open jobs and delivery status | You | [ ] |
| Set up new studio site, packages, and pricing | You | [ ] |
| Configure domain or subdomain for white-label | You | [ ] |
| Test a full job: book → shoot → deliver → pay | You | [ ] |
| Prepare agent announcement email (template below) | You | [ ] |
| Identify 2–3 friendly agents for a pilot delivery | You | [ ] |

## Week-by-week cutover plan

### Week 1: Pilot with friendly agents

Deliver **one or two new listings** through the new system only. Watch for:

- Do agents open the gallery link without asking for a login?
- Is pay-to-unlock (if you use it) clear before they download?
- Does your branded domain look correct on mobile?

Fix copy and email templates before you email everyone.

### Week 2: New bookings only on the new platform

Stop creating new jobs in Aryeo. Existing Aryeo galleries stay accessible until closed.

Add a line to your booking confirmation:

> New orders after [date] are delivered via [your studio URL]. You will receive a single gallery link — no account required.

### Week 3–4: Drain Aryeo

Finish outstanding Aryeo deliveries. Do not migrate historical galleries unless an agent asks; agents rarely revisit old listings.

### After drain: downgrade or cancel Aryeo

Keep read-only access if your plan allows it for 30 days. Export anything you need for taxes or disputes.

## What to tell agents (copy you can use)

Subject: **Simpler photo delivery from [Studio Name]**

> Hi [Agent Name],
>
> Quick update: we are improving how you receive listing photos.
>
> Starting [date], you will get **one link per listing** — no new login or portal account. Preview photos in the browser, pay if your office requires it, then download MLS-ready files.
>
> Bookings and scheduling still work the same on our site: [your URL]
>
> Questions? Reply to this email.

Short, specific, and focused on **their** friction (logins), not your software stack.

## Mapping Aryeo workflows to a link-first platform

| Aryeo habit | Link-first equivalent |
| --- | --- |
| Agent portal login | Token gallery URL per listing |
| Order in Aryeo dashboard | Order in your studio admin |
| Branded delivery via Aryeo | White-label site on your domain |
| Invoice through Aryeo | Pay-in-gallery or Stripe Connect payout |
| Agent roster in Aryeo | Your CRM + booking emails (you own the list) |

On [StudioFront](/signup), token galleries and pay-to-unlock are built for this pattern: agents get a link, you keep branding, and payouts run through Stripe Connect on plans that include it.

## Protecting revenue during the switch

- **Do not** change pricing and platform the same week unless you have to.
- **Do** keep payment terms identical (net-0 in gallery vs invoice) so accounting does not surprise brokerages.
- **Do** run one paid test transaction before the first real client payment on the new stack.

If you use per-listing pricing on the new platform ([see plans](/pricing)), model your slow month and busy month so you know the bill before you commit.

## Data you should own before you cancel

Regardless of destination, export:

- Client emails and brokerage names
- Package and pricing history (for your records)
- Tax-relevant payment summaries

Your client relationships live in **your** list, not inside any vendor portal.

## When to stay on Aryeo a bit longer

Stay parallel longer if:

- You have a large batch of twilight or video jobs mid-production
- A brokerage contract mandates Aryeo-specific delivery (rare but real)
- You are rebranding and changing domains at the same time — do one thing at a time

## FAQ

**Will agents lose access to old galleries?**  
Only if you delete them in Aryeo. Leave completed jobs until agents download, or send a final reminder with links.

**Do I need to migrate every historical listing?**  
No. Agents almost never need 2019 files. Migrate on request only.

**How long does setup take on a new platform?**  
A focused afternoon for basics; see our [onboarding checklist](/blog/photographer-software-onboarding-checklist) for an under-one-hour path.

**Is it unprofessional to switch tools?**  
Agents care about reliable delivery and fast downloads. They do not care which SaaS you use.

**Can I try the new workflow before canceling Aryeo?**  
Yes — and you should. [Start a 14-day trial](/signup), run pilot jobs, then cancel Aryeo when the pipeline is clean.

---

Switching platforms is a project management problem more than a technical one. Parallel runs, clear agent email, and a pilot week prevent 90% of migration headaches. When you are ready to test link-based delivery with white-label branding, [start your StudioFront trial](/signup) and run your next two listings side by side with confidence.`,
};
