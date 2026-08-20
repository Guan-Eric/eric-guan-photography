import type { BlogPost } from "./types";

export const post: BlogPost = {
  slug: "white-label-real-estate-photography-website",
  title: "White-Label Real Estate Photography Websites (What Matters)",
  description:
    "What white-label actually means for RE photo studios, which branding elements agents notice, and a checklist for domain, galleries, and booking on your brand.",
  date: "2026-08-20",
  tags: ["white-label", "branding", "website"],
  cta: "trial",
  body: `"White-label" gets slapped on every real estate photography SaaS landing page. For studio owners, it should mean one thing: **agents experience your brand, not your vendor's.**

This post separates cosmetic white-label (a logo upload) from operational white-label (domain, emails, galleries, payments) — and gives a checklist for what actually moves trust and rebookings.

**Disclosure:** [StudioFront](/signup) is built around white-label studio sites, token galleries on your domain, and photographer-owned client relationships.

## What white-label is (and is not)

| Claim | Weak white-label | Strong white-label |
| --- | --- | --- |
| Logo on dashboard | ✓ | ✓ |
| Public site on your domain | Sometimes | Required |
| Gallery URLs on your domain | Rare | Required |
| Checkout shows your studio | Sometimes | Required |
| Agent sees vendor name in email | Often | Should be no |
| Export your client list | Varies | Required |

If agents still Google a vendor name after working with you, you are co-branding, not white-label.

## Why agents and brokerages care

Brokerage marketing departments notice:

- **URL bar** — `photos.yourstudio.com` vs `app.vendor.com/job/8842`
- **Email from** — `hello@yourstudio.com` vs `noreply@vendor.io`
- **Invoice/receipt branding** — matches your price sheet
- **Consistency** — booking page matches gallery matches business card

You book more repeat work when you look like a **studio**, not a login on someone else's portal.

## The four surfaces to own

### 1. Marketing site

Packages, portfolio samples, service area, book-now CTA. Can be standalone WordPress or bundled in your RE platform.

Minimum: mobile-fast, one clear package, contact + book button.

### 2. Booking flow

Agent picks package, slot, property address. Confirmation email from **your** domain.

Friction killer: forcing account creation before they see availability.

### 3. Delivery gallery

Token link per listing on **your** subdomain. Previews, pay-to-unlock, MLS download.

Related: [pay-to-unlock galleries](/blog/pay-to-unlock-real-estate-galleries).

### 4. Payment receipts

Stripe receipts with your business name. Connect onboarding uses your legal entity — see [Stripe Connect guide](/blog/stripe-connect-real-estate-photographers).

Miss any surface and the illusion breaks.

## Domain strategy (practical)

| Pattern | Example | Notes |
| --- | --- | --- |
| Subdomain | photos.studio.com | Fastest; CNAME to platform |
| Apex | studio.com | Marketing + book |
| Separate shoot domain | studio.media | Optional brand play |

Do not delay launch for perfect DNS. Ship on default URL, add CNAME when ready — [onboarding checklist](/blog/photographer-software-onboarding-checklist).

## White-label checklist before you announce rebrand

### Brand assets

- [ ] Logo SVG or PNG (light + dark if needed)
- [ ] Primary hex color
- [ ] Favicon
- [ ] One hero image or portfolio grid

### Domain and email

- [ ] CNAME record for gallery/booking subdomain
- [ ] SPF/DKIM for sending (`hello@yourdomain.com`)
- [ ] SSL active (padlock on mobile)

### Content

- [ ] Three packages max on public page
- [ ] Service area statement
- [ ] Turnaround and weather policy one-liner
- [ ] Link to [pricing](/pricing) or embedded packages

### Delivery test

- [ ] Incognito gallery link shows studio name only
- [ ] Payment receipt shows studio legal name
- [ ] Download page has studio contact footer

### Agent comms

- [ ] Update email signature with new booking URL
- [ ] One-pager PDF for brokerages with new link format

## White-label vs marketplace portals

Some platforms are **marketplaces** — agents search photographers inside the vendor ecosystem. That can bring leads but **owns the relationship**.

| | Marketplace portal | White-label studio site |
| --- | --- | --- |
| Lead source | Platform | You (SEO, referrals, brokerages) |
| Brand | Shared | Yours |
| Client list | Platform-mediated | Yours |
| Fee model | Often commission | Subscription / per listing |

StudioFront targets studios who already have agent relationships and want infrastructure, not a marketplace ranking game.

## Common white-label mistakes

1. **Custom domain on marketing only** — galleries still on vendor URL (agents notice)
2. **Generic gallery copy** — "Your photos are ready" without studio name in subject
3. **Mismatched colors** — booking page blue, gallery green
4. **Ignoring mobile** — agents open links in parking lots
5. **Rebrand + platform migration same week** — do one stress event at a time

## Measuring if white-label works

Track quarterly:

- Repeat booking rate from same agent email domain
- "Who is this?" support emails (should drop)
- Direct traffic to your domain vs referral only
- Time from delivery email to download (faster = less confusion)

Vanity metrics (page views) matter less than **rebookings**.

## FAQ

**Do I need a separate Squarespace site?**  
Not if your platform includes public booking pages. Avoid duplicating package lists in two places.

**Will white-label help SEO?**  
Owned domain with consistent NAP (name, address, phone) helps local studio search — not a magic bullet.

**What about agents who only know Aryeo links?**  
Education email once — [migration templates](/blog/switch-from-aryeo) — then consistent URLs.

**Is white-label only for big studios?**  
No — solos benefit most because brand is the whole company.

**Does StudioFront remove all vendor branding?**  
On appropriate plans, public surfaces are yours; confirm details on [pricing](/pricing).

**Can I white-label email if I use Gmail?**  
Use a professional `hello@domain` with proper DNS; free Gmail "send as" works with SPF setup.

---

White-label is not a logo upload — it is every URL, email, and receipt saying **your studio name**. Use the checklist, fix the gallery domain first, then polish marketing copy. [Start a StudioFront trial](/signup), connect your subdomain, and send the next delivery from your brand — not a vendor's.`,
};
