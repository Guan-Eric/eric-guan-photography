import type { BlogPost } from "./types";

export const post: BlogPost = {
  slug: "custom-domain-photography-studio-website",
  title: "Custom Domain for Your Photography Studio Website",
  description:
    "Why RE photographers should put booking and galleries on their own domain, how DNS works in plain English, and what to launch before the CNAME is perfect.",
  date: "2026-08-21",
  tags: ["domain", "white-label", "branding"],
  cta: "trial",
  body: `A **custom domain** for your photography studio website means agents book and review on \`photos.yourstudio.com\` (or \`www\`) — not on a vendor subdomain that advertises the software company.

For real estate photographers, the domain is part of the product. It is how you look like a media brand instead of “another login on Platform X.”

**Disclosure:** [StudioFront](/signup) supports white-label studio sites and custom hostnames (plan-dependent). This guide stays useful even if you only point DNS at a simple site today.

## Why the domain matters more than the theme

Agents forward links to sellers. Sellers glance for 3 seconds. They notice:

- Does the URL look like your business?  
- Does the page match the business card you handed them?  
- Or does it say a SaaS product name in the browser bar?

White-label without a custom domain is half-finished branding. Full picture: [white-label RE photography websites](/blog/white-label-real-estate-photography-website).

## What “custom domain” usually includes

| Piece | Example |
| --- | --- |
| Apex or www | \`yourstudio.com\` / \`www.yourstudio.com\` |
| Booking | same host, \`/book\` |
| Galleries | token paths on your host **or** stable gallery subdomain |
| Email (separate) | \`hello@yourstudio.com\` via Google / Microsoft — not the same as web DNS |

You can launch web on a custom domain while email stays where it already works. Do not block website cutover on MX record anxiety.

## Plain-English DNS

You will usually add a **CNAME** (or ALIAS/ANAME at the apex) that points your hostname to the platform’s target. The registrar (Namecheap, Cloudflare, GoDaddy, etc.) is where that record lives.

Checklist:

1. Pick the hostname (\`www\` is often easiest)  
2. Add the CNAME the product gives you  
3. Wait for propagation (minutes to a few hours)  
4. Confirm HTTPS shows a valid lock icon  
5. Only then put the URL on your email signature  

If verification fails, 90% of the time it is a typo, a conflicting A record, or proxy/CDN toggles fighting the platform.

## Launch order (do not wait on DNS)

From the [onboarding checklist](/blog/photographer-software-onboarding-checklist):

1. Go live on the platform’s default studio URL  
2. Deliver a real job so the loop is proven  
3. Add custom domain when DNS is calm  
4. Update Google Business Profile, email signature, and print materials  

Delaying first delivery for perfect DNS is a common founder mistake — especially on a 14-day trial clock.

## Galleries on your domain vs platform domain

**Ideal:** proofs and unlock pages inherit your host so the agent never leaves your brand.

**Acceptable interim:** booking on your domain, galleries on a secure platform URL — still better than Dropbox. Move galleries when the product supports custom hostnames for media.

StudioFront’s direction is photographer-owned delivery chrome; confirm current domain add-on pricing on [/pricing](/pricing) (custom hostnames are metered as an add-on in the product).

## SEO note (keep expectations honest)

A custom domain helps **branded** search and trust. It does not automatically rank you for “real estate photographer {city}” without content and reviews. Platform marketing content lives on the StudioFront blog; your studio site should still carry local proof, work samples, and clear packages — see [how to price packages](/blog/how-to-price-real-estate-photography-packages).

## Common mistakes

- Pointing the apex with a wrong record type and breaking email  
- Forgetting to renew the domain (set 2-year renew + auto-renew)  
- Using a free subdomain forever while charging premium rates  
- Changing domains every quarter (agents bookmark old links)  

## FAQ

### Do I need a new domain if I already have one?

No — use the brand agents already know. Add a subdomain if the apex hosts a different site builder.

### Is HTTPS included?

Any modern host should provision certificates automatically after DNS verifies. If you see certificate warnings, do not send agent traffic yet.

### Will old gallery links break when I add a domain?

Plan a transition window. Prefer products that keep tokens resolvable during cutover. Resend active job links once.

### Custom domain vs Google Business website?

GBP can link out to your real studio site. Do not treat the Google free site as your booking system.

### Which StudioFront plans support custom domains?

Entitlements favor Growth+ / trial / PAYG for custom domain features — confirm on the live pricing page before you buy DNS add-ons.

## Next step

Buy or reuse a domain that matches your studio name, ship on the default URL this week, then attach DNS once a gallery has unlocked successfully.

[Start trial](/signup) · [See plans](/pricing) · [White-label deep dive](/blog/white-label-real-estate-photography-website)
`,
};
