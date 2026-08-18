# Studiofront — screen inventory

Purpose of this file: a design/copy spec for every screen so you can rebuild or restyle without Figma. Hosts, chrome, type, color, and per-page content (headings, buttons, images, forms) are listed as they exist in the code today.

Product: **Studiofront** — software for real-estate photographers. Agents never create a Studiofront account for the main loop; they book and pay from signed links.

---

## How to read hosts

| Host | What it is |
|---|---|
| `studiofront.ca` (apex) | Marketing + photographer signup/login |
| `{slug}.studiofront.ca` | One studio’s public site + admin + galleries |
| Example | `silentshutter.studiofront.ca` |

Local equivalents: `localhost:3000` (apex) and `{slug}.localhost:3000` (studio). Chrome treats `*.localhost` as loopback.

Apex `/` rewrites to the SaaS home. Apex `/pricing` rewrites to SaaS pricing. The same `/pricing` path on a studio host is the photographer’s package page.

Every HTML page includes a **Skip to content** link (visually hidden until focused).

---

## Feel (visual language)

Calm listing-photography, not a SaaS dashboard chrome on public pages. Sage paper, dark ink, one accent green.

| Token | Default | Role |
|---|---|---|
| `--bg` / `--bg-deep` | `#e8ebe6` / `#dfe4dd` | Page wash: sage → slightly deeper sage |
| `--ink` / `--ink-soft` | `#171a17` / `#4a524c` | Headlines / body |
| `--accent` / `--accent-soft` | `#2f5d50` / `#3f7a69` | Buttons, focus ring, links on dark |
| `--paper` | `#ffffff` | Solid cards, header, admin rail — never glass over other UI |
| `--radius` | `2px` | Almost square — editorial, not pill-app |
| Display font | **Syne** (500–800) | Headings, logo, eyebrows |
| Body font | **Figtree** (400–600, italic) | UI copy, forms |

Background: two soft radial washes (green at top-left, charcoal at top-right) over a vertical sage gradient, `background-attachment: fixed`. A faint **noise overlay** sits on `body`.

**Motion:** short ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`). Sections with `data-reveal` fade/rise as they enter the viewport. Buttons show `is-busy` while submitting.

**Buttons (public + admin):**

- `.btn-primary` — filled accent, used on heroes over photography
- `.btn-solid` — filled ink/accent on paper backgrounds (primary form submit)
- `.btn-ghost` / `.btn-outline` — stroke, secondary
- `.header-cta` — compact header primary (“Start free trial” / “Book a listing”)
- `.text-link` — inline, no chrome

**Type pattern on marketing/studio pages:** small caps-ish **eyebrow** → large **h1** → quieter **lede** / **section-copy**.

Photographers can restyle a studio via CSS variables on `<html>` (theme). Listing pages can pick a separate listing theme.

---

## Shared chrome

### Platform header (apex only)

Logo: `/studiofront-icon.png` (28×28) + word **Studiofront**. Links: **Product** (`/#product`), **Pricing**, **Sign in**. CTA: **Start free trial** → `/signup`. Hamburger (three bars) on small screens; Escape closes. Over a hero it sits on the photo (`on-media`); after ~24px scroll it becomes solid paper. Inner pages pass `solid`.

### Platform footer

`© {year} Studiofront · Software for real estate photographers`. Links: Pricing, Start trial, Terms, Privacy.

### Studio public header

Text logo = **studio name** (no icon unless the tenant adds one later). Nav from tenant config, default: **Work**, **Pricing**, **Prep**, **Book**. CTA: **Book a listing**. Same hamburger / scroll-solid behavior. Inner pages (`solid`) have an **opaque white** bar immediately — no frosted glass over the page title.

### Studio public footer

`© {year} {studio} · Real Estate Photography`. Links: Book, Pricing, Before your shoot, **Your listings** (`/portal`), Email (`mailto:` studio).

### Auth shell (signup, login, forgot, reset, invite, agent portal login)

Split layout:

- **Left (~55%):** full-bleed Unsplash living room (`photo-1600596542815-ffad4c1539a9`, alt “Bright living room ready for listing photographs”), dark veil, **Studiofront** wordmark linking home, tagline under it.
- **Right:** paper panel with the form (`#main`).

Tagline on photographer auth: *Book the shoot. Deliver the gallery. Get paid.*

### Studio admin shell (`/admin/*` after login)

Left **rail**: studio name (link to Orders), slug under it, nav, then **View site** (new tab), signed-in email, **Sign out** (busy label *Signing out…*).

Nav items (active state on current path):

| Label | Path |
|---|---|
| Orders | `/admin` |
| Today | `/admin/today` |
| Listings | `/admin/listings` |
| Reviews | `/admin/reviews` |
| Work | `/admin/work` |
| Pricing | `/admin/pricing` |
| Booking | `/admin/booking` |
| Schedule | `/admin/schedule` |
| Settings | `/admin/settings` |

First-run **coach tour** (`photo_v1`) highlights Work → Schedule → Pricing → Settings → Orders.

`/admin/login` **redirects to `/login`**. `/work` **redirects to `/admin/work`**.

---

## A. Apex — marketing & photographer account

### A1. SaaS home — `/` (`app/saas`)

**Purpose:** Sell Studiofront to photographers. Not a studio site.

**Feel:** Full-bleed hero photography, then quiet sage sections. Confident, not playful.

**Hero image:** Unsplash modern home `photo-1600596542815-ffad4c1539a9` (2400×1600), alt “Bright modern home ready for listing photographs”. Dark veil. Copy over the photo:

- Eyebrow/brand: **Studiofront**
- H1: *The studio platform for real estate photographers.*
- Lede: *Book the shoot, deliver the gallery, and get paid — on your brand.*
- Buttons: **Start 14-day trial** (primary) → `/signup`; **See plans** (ghost) → `/pricing`

**Product (`#product`):** eyebrow *Product*, h2 *Everything from the first inquiry to the final zip.* Four cards: Grow the job / Run the day / See the work / Look like the studio.

**Delivery (`#delivery`):** h2 *Proofs, pay, and files on the same link.* Band image Unsplash `photo-1600585154340-be6161a56a0c` (sunlit living room).

**Studios (`#studios`):** two numbered steps — Working alone / Growing a bench.

**Plans (`#plans`):** three numbered rows from `PLAN_DEFS` — Starter $49, Growth $99, Studio $149 (listings/year + seats). Button **Compare plans** → `/pricing#compare`.

**Get started:** h2 *Your brand on the site. Your files in the zip.* Button **Start 14-day trial**.

---

### A2. SaaS pricing — `/pricing` on apex

**Purpose:** Pick a software plan. Header is solid (no hero photo).

**H1:** *Pay per listing, or go flat as you grow.* Copy mentions $5/listing payg, $49 / $99 / $149 flats, 14-day trial, no agent accounts. Jump link **Compare plans and the PAYG math** → `#compare`.

**Four cards:**

| Plan | Price | Badge |
|---|---|---|
| Pay as you go | $5/listing | — |
| Starter | $49/mo | — |
| Growth | $99/mo | **Most studios** (featured) |
| Studio | $149/mo | — |

Each lists listings or unlimited, seats, white-label + booking, gated galleries + MLS zips, subdomain vs custom domain, property websites / share kit where entitled, overage $3/listing on flat plans. CTA **Start free** (payg) or **Start trial** → `/signup?plan={id}`.

**Compare (`#compare`):** feature matrix (price, listings, overage, seats, storage, domain, property pages, share kit, reports, upsells) plus PAYG break-even cards and a yearly cost table at 24 / 48 / 96 / 120 / 250 / 500 listings. Starter includes 125 listings so the $49 rent beats PAYG inside the quota (118 listings/year).

---

### A3. Sign up — `/signup`

Auth shell. H1 *Create your account.* If `?invite=` is present: *You’ll join the studio that invited you after this step.* and **no studio name field**.

**Fields:** First name, Last name, Studio name (placeholder `Northlight Media`, unless invite), Email, Password, Confirm password.

**Password checklist** (items turn `is-met` as typed): at least 12 characters; upper and lowercase; at least one number; at least one special character.

Submit **Create account** / *Creating…*. Footer: *Already have an account?* **Sign in**. Success toast *Account created.* → `/admin?welcome=1` (optional `&plan=`) or `/onboarding` or `/invite/{token}`.

---

### A4. Sign in — `/login`

Auth shell. H1 *Sign in.* Sub: *Use the email you registered with to open your studio.*

**Fields:** Email, Password. Submit **Sign in** / *Signing in…*. Footer: **Create an account** · **Forgot password?**

If already signed in: redirect `/admin` or `/onboarding`.

---

### A5. Forgot password — `/forgot-password`

H1 *Forgot password.* *We’ll email a one-hour reset link if that account exists.* Email + **Send reset link** / *Sending…*. **Back to sign in**.

---

### A6. Reset password — `/reset-password?token=`

H1 *Choose a new password.* Same password rules as signup. **Update password** / *Saving…*. Missing token shows an error and disables submit. Success → `/login`.

---

### A7. Onboarding — `/onboarding`

Same auth panel (no split required beyond layout of the form). H1 *Name your studio.* *This is the brand agents see on booking and galleries. You start with a 14-day trial.*

**Fields:** Studio name, Your name (prefilled), Subdomain optional (placeholder `northlight`, sanitized a–z0–9-), Timezone select + hint *Shoot times and availability use this timezone.*, Currency select + hint *Agents pay you in this currency. Studiofront SaaS billing stays in USD.*

Submit **Open studio** / *Creating…* → `/admin`.

---

### A8. Invite — `/invite/[token]`

If logged out → `/signup?invite=`. If invite missing: H1 *Invite expired.* If accept fails: *Couldn’t join* + error. Success sets tenant cookie and redirects `/admin`.

---

### A9. Privacy — `/privacy`

Solid platform header. Eyebrow *Legal*, h1 *Privacy Policy.* Prose: what is stored, processors (Stripe, Resend, Cloudflare/R2), retention (revoke anytime; ~90 day archive is studio policy, not auto-delete).

---

### A10. Terms — `/terms`

Eyebrow *Legal*, h1 *Terms of Service.* Sections: Accounts and studios, Subscriptions (USD, 14-day trial), Acceptable use, Media license defaults (marketing the property; no resale).

---

## B. Studio public site (`{slug}.studiofront.ca`)

All use studio header/footer unless noted. Copy is tenant-driven (name, tagline, packages, hero). Defaults below are from studio seed/defaults.

### B1. Studio home — `/`

**Purpose:** Convert agents. Photography-first.

**Hero:** tenant `hero.src` (Unsplash or uploaded `/api/…` media), veil, photographer name as brand line, **tagline** as h1, **lede**, proof chips (turnaround, *MLS-ready sizes included*, city if set).

Buttons: **Request a shoot** → `/book`; **View work** → `#work`.

**Selected work (`#work`):** masonry/gallery of portfolio images, or *Portfolio photos will appear here once uploaded.* Placeholder note if still using stock.

**Agents (`#reviews`):** only if published testimonials. Name, quote, `{rating}/5`.

**For agents (`#services`):** package name, summary, price. Link **See what’s included** → `/pricing`.

**Process (`#process`):** three numbered tenant steps.

**Book (`#contact`):** *Have a listing that needs photos?* Email + link to prep. Button **Book a listing shoot**.

---

### B2. Studio pricing — `/pricing` on studio host

Eyebrow *Pricing*. H1 *Straightforward packages, no surprises.* Cards for non-upsell packages; featured package gets badge **Most booked**. Meta: *About N minutes on site*. Includes list. CTA **Book {package}** or **Request {package}** if quote-later, else **Email to book**.

**FAQ** (`<details>`): How fast / sizes / be at the shoot / home not ready / when to pay / use after sale.

---

### B3. Book — `/book`

Eyebrow *Book*. H1 *Request a shoot with a firm quote.* Optional coach tour for first-time agents.

Legend: required fields marked `*`.

Desktop is two columns flush to the viewport gutters: title + form on the left, **sticky Shoot Summary** top-right. On small screens the summary sits under the required-fields legend, then the form card.

**Shoot Summary** — heading *Shoot Summary*. Rows: package + `{priceLabel}`, `{bandLabel}` + sq ft, On site + minutes. **Total Quote** with large Syne `{priceLabel}`. *No credit card charged today. Gallery payment required upon delivery of previews.* Loading: *Calculating quote…* Retainer fallback emails the studio. **Send request** on this card (desktop); the left column repeats it on small screens.

**1. Package & size** — Package select (`Name (price)`), Square footage (400–20,000, default 1800). Changing either updates `/api/quote` (and the sticky summary). Selected package **includes** list (and summary, if set) under the fields and on Shoot Summary.

**2. Property** — Address autocomplete, Postal/ZIP (placeholder `H2X 1Y4`), City. Button **Add access details** / **Hide access details**. Access: Occupied or vacant; Access (Lockbox / Meet / Key / Other); Access notes; Pets (`None / dog crated upstairs`); Parking (`Street / driveway`); Who is meeting (`Name + phone`). If collapsed: *Optional for now — occupancy defaults to vacant with lockbox access.* Out-of-area postal shows the studio’s service-area message.

**3. Preferred times** — 1–3 slots from availability picker (studio timezone).

**4. Your details** — Name*, Email*, Phone optional, Brokerage optional, Notes optional. Hidden referral from `?ref=`.

Submit **Send request** / *Sending request…* on the summary card (and at the bottom of the form on small screens). Errors scroll to first invalid field. Success → confirmation URL with public token.

---

### B4. Booking confirmation — `/book/confirmation/[id]?token=`

Eyebrow *Request received*. H1 *Thanks, {first name}.* Mentions email if Resend is configured. Buttons: **Open seller prep checklist**, **Your listings**, **Email {photographer}.** Line: *Coming back later? Open your listings and we’ll email a sign-in link — no password.*

Card **Request summary**: Reference, Status, Property, Package (price · minutes · sq ft), Preferred times (1st/2nd/3rd), Access.

---

### B5. Prep — `/prep`

Eyebrow *Before your shoot*. H1 *Fifteen minutes of prep is worth two hours of editing.* Buttons: **Copy link for seller** (then *Link copied*), **Print checklist**.

Four checkbox groups stored in `localStorage` per studio: Every room / Kitchen and baths / Living and bedrooms / Outside (see `app/prep/page.tsx` for exact bullets). Then prose **On the day** and **What we will and will not do**, plus studio email.

---

### B6. City landing — `/real-estate-photography/[city]`

SEO page for a service-area slug. H1 *Real estate photography in {City}.* Buttons **Request a shoot**, **See pricing**. Gallery + process copy. 404 if slug unknown.

---

### B7. Public gallery — `/g/[token]`

No studio header. Same sage paper as booking. Optional `?brand=off` or gallery `unbranded` hides the studio name only.

**Intro:** eyebrow studio name (if branded), gallery **title** (Syne, book-page size), property address.

**Pay card** (under the intro on mobile; sticky top-right beside the title on desktop, matching **Your quote**):

- Proofing: eyebrow *Your quote*, large `{price}`, *Watermarked proofs until payment. Same link unlocks full + MLS files.* Optional add-on checkboxes. Button **Pay {price} & unlock** (solid). Dev-only **Dev stub unlock**.
- Unlocked: *Unlocked* / large *Ready* / *Full-resolution and MLS zips are on this same link.* **Download MLS zip** (solid), **Download full-res zip** (outline).
- After Stripe: *Payment received — files unlocked.* or *unlocking…* or *Checkout cancelled.*

**Grid:** images via `/api/g/…/media/…?v=proof|web`. Caption = room or filename; proofs show *Proof*; unlocked show **MLS** / **Full** per photo. Empty: *Photos are being prepared. Check back shortly.*

Footer: *Delivered by {photographer}.* **Your listings** (`/portal`). *Questions? Reply to your booking email.* Unbranded galleries still show **Your listings**.

---

### B8. Gallery report — `/g/[token]/report`

Growth+ plans. Eyebrow studio, h1 *Media report*, address, chips `{n} views` / `{n} downloads`. *Forward this page to your seller as proof of activity.*

---

### B9. Listing page — `/p/[slug]`

Seller-facing property site (not the studio chrome). Theme class `listing-page--{theme}`.

- Hero photo (chosen asset or first), headline, address; branded eyebrow = studio name
- Description paragraphs
- Remaining photos with captions
- Matterport/video/PDF embeds if linked
- Extra sections (heading + body)
- Open house list
- **Presented by** agent name, brokerage, email (branded)
- Optional custom-domain upsell CTA
- Lead form **Ask about this home** (name, email, phone, message) → *Message sent*
- OpenStreetMap iframe or *View on OpenStreetMap*
- Footer *Photos by {photographer}.*

Empty photos: *Photos for this listing are still being prepared.*

---

### B10. Review — `/review/[token]`

Minimal page, no chrome. H1 *How was the shoot?* Body about `{propertyAddress}`. Rating (default 5) + comment. Submit. Success confirmation. Invalid token → 404.

---

### B11. Agent portal login — `/portal/login`

Auth shell; tagline *Listings and downloads from {studio}.* H1 *Agent portal.* *We’ll email a sign-in link. No password.* Email + send-link control. Magic-link `/portal/callback?token=` shows *Continue to your listings* (POST, so inbox scanners don’t burn the link). Expired links return here with an error. Already-signed-in visitors go to `/portal`.

---

### B12. Agent portal — `/portal`

Requires magic-link session. Agents reach it from booking confirmation, gallery footer, studio footer **Your listings**, and confirmation/gallery-ready emails. Eyebrow studio, h1 *Your listings*, email, **Sign out**. Referral URL in a `<code>` block. Each order: address, package · status, links **Gallery** / **Listing page** / **Add listing copy** (or **Edit listing**), button **Book again**. Empty: *No listings yet. Book a shoot to see it here.*

Copy editor `/portal/listings/[id]`: headline, description, extra sections, open houses, enquiry-form toggle. Photos and theme stay with the photographer.

---

## C. Photographer admin (`{slug}.studiofront.ca/admin`)

Paper/sage workspace. Left rail always visible on desktop. Toolbars: eyebrow + h1 + muted explanation + optional **View** link to the public page.

First visit (`?welcome=1` or zero orders) shows **Get your studio ready**: four links (portfolio, hours, payouts, packages), **Preview booking page**, optional **Continue with {plan} plan**, **Dismiss**.

### C1. Orders — `/admin`

H1 *Shoots*. Outline button opens public book URL. Empty: *No shoots yet* + CTA to booking page.

Otherwise: search/filter + list/board toggle. Collapsed cards share one height: address is two-line clamped, agent/package/slot ellipsis, one reserved badge row. Each order expands to:

- Status select
- Preferred times (pick one to confirm)
- Property (editable address/city/postal, save)
- Agent contact
- Package + optional custom price
- **Before you confirm** + **Confirm shoot** / decline-style outline
- **Delivery** stepper: upload photos (file button), share/publish gallery, copy branded/unbranded links, zip, listing page, revoke, etc.

This is the operational heart of the product — dense, not marketing.

### C2. Today — `/admin/today`

Eyebrow *Shoot day*, h1 *Today*. Empty: *No shoots today.* Else paper cards: time · address, agent · package, package-include chips. One sequential button: **On my way** → **I've arrived** → **Complete** → **Done** (disabled). On-my-way and arrived emails go to the agent.

### C3. Listings — `/admin/listings`

H1 *Property websites.* *Every published delivery gets a property page. You pick the look and photos; the agent writes the headline and description from their portal.* Starter plan hint if property pages aren’t included (Trial, Growth, Studio, and pay-as-you-go create pages). Visiting the page backfills delivered/paid galleries that never got a row. Empty → **Go to orders**. Rows: title, address · Published/Draft · theme; **Edit**, open public `/p/{slug}`.

### C4. Listing editor — `/admin/listings/[id]`

H1 = property address. Link **View listing page** opens the public page. Hint that headline/description/open houses are written by the agent. Sections: **Look** (theme), **Photos** (hero picker with thumbnails, optional caption per photo — filenames never appear on the public page), **Visibility** (published + branding). Save / view public page. No copy fields.

### C5. Reviews — `/admin/reviews`

Eyebrow *Social proof*, h1 *Reviews*. Empty: *No reviews yet.* List agent quotes, rating, publish/hide, request-review from an order.

### C6. Work — `/admin/work`

H1 *Home & portfolio.* **Intro** (tagline, lede, photographer name). **Hero image** upload/replace. **Selected work** grid upload/reorder/remove. Link to view `#work` on the public site.

### C7. Pricing — `/admin/pricing`

H1 *Packages.* Per package: name, price, duration, includes, sq-ft bands, featured, upsell flag. Add/remove packages. View public `/pricing`.

### C8. Booking — `/admin/booking`

H1 *How agents request a shoot.* **Contact** (public email, etc.). **Service area** gate (region, prefixes, message). View public `/book`.

### C9. Schedule — `/admin/schedule`

H1 *Availability & bookings.* **Weekly hours** (open/close per day). **Booking window** (interval, lead time, horizon). **Google Calendar** (connect, pick calendar, toggle blocking other events). **Incoming bookings** list of requested/confirmed orders.

### C10. Settings — `/admin/settings`

H1 *Plan & studio.*

- **Subscription** — current plan, usage; **Manage billing** (Stripe Customer Portal); upgrade checkout
- **Payouts** — Stripe Connect status; **Set up payouts** / continue onboarding
- **Custom domain** — hostname field, verify/save (plan-gated)
- **Team** — editor email + **Send invite**

---

## D. Global UI that is not a “page”

| Element | Behavior |
|---|---|
| Action toasts | Success/error slide in after form actions |
| Unsaved changes | Work, Pricing, Booking, Schedule, and listing editors prompt before leaving the page or closing the tab |
| Coach tours | Dismissable callouts; photographer vs agent book vs agent gallery |
| Loading buttons | `is-busy` + gerund label (*Creating…*, *Signing in…*) |
| 404 / notFound | Next default; galleries/listings/invites use `notFound()` when tokens die |

---

## E. Suggested capture order (if you later screenshot)

1. Apex home → pricing → signup → login  
2. Studio home → pricing → book → prep  
3. Admin: orders (empty + with job) → today → work → pricing → booking → schedule → settings  
4. `/g/{token}` proofing and unlocked  
5. `/p/{slug}` branded listing  

Live Silent Shutter studio: `https://silentshutter.studiofront.ca` (public) and `/admin` (after photographer sign-in).
