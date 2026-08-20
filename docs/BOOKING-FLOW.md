# Studiofront — Booking lifecycle (complete flow)

Minute-by-minute product runbook: every actor, screen, button, API call, side effect, and email.

**Actors**

| Actor | How they access |
|---|---|
| **Agent** | Public studio URL (`{slug}.studiofront.ca` or custom domain). No login. Capability URLs use `publicToken`. |
| **Photographer / editor** | `/admin` after login. Session + tenant membership. |
| **System** | Stripe webhooks, cron (`CRON_SECRET`), Resend. |

**Happy path (short)**

```text
Agent books → emails both
Photographer confirms → appointment + emails both
… shoot / editing status updates → emails both
Upload → Publish → emails both (gallery ready)
Agent pays → Stripe webhook → unlock → emails both
```

---

## 0. Prerequisites

| Need | Why |
|---|---|
| Studio exists (signup) | Host resolves to tenant |
| Plan allows listings | New booking blocked if annual listing quota exhausted |
| `RESEND_API_KEY` | Real email; without it, emails log to console (`[email:stub]`) |
| Stripe keys (optional for gallery pay) | Without Stripe, pay uses local stub unlock (dev / `ALLOW_GALLERY_STUB_UNLOCK`) |
| Photographer Connect (optional) | Gallery checkout can route payouts via Connect |

---

## 1. Agent requests a shoot

### 1.1 Open booking page

| Step | Detail |
|---|---|
| URL | `https://{studio}/book` optional `?package={packageId}` |
| Page | [`app/book/page.tsx`](../app/book/page.tsx) → [`BookingForm`](../components/booking-form.tsx) |
| First visit | Optional coach tour (`sf_tour_agent_book_v1` in `localStorage`) |

### 1.2 Fill the form

**Required**

| UI field | Validation |
|---|---|
| Package | Must be bookable (`isBookablePackage`) |
| Square footage | 400–20,000 |
| Property address | Trimmed, ≥5 characters |
| Postal / ZIP | Client length ≥3; server 6–10 |
| City | Required in UI |
| Preferred times | 1–3 slots (`PreferredTimesPicker`) |
| Agent name | ≥2 characters |
| Agent email | Valid email |

**Optional**

- Phone, brokerage, notes  
- Access block (defaults: vacant + lockbox): occupancy, access type, access notes, pets, parking, meeting contact  

### 1.3 Live quote & availability (automatic)

On package / sqft change (≈280ms debounce), browser calls in parallel:

| API | Body / effect |
|---|---|
| `POST /api/quote` | Returns price label / cents, or “quote later”, or contact-only |
| `POST /api/availability` | Slots for preferred-times picker |

Quote modes:

- **Priced** — dollars shown  
- **Quote later** — `priceCents: 0`; photographer sets price later in admin  
- **Contact only** — not bookable online  

### 1.4 Submit

| Control | Action |
|---|---|
| Button **“Request this shoot”** | `POST /api/book` |

**Server** ([`createBooking`](../lib/orders.ts)):

1. Auth: public (tenant from host)  
2. Listing quota check  
3. Postal / service-area gate  
4. Re-quote + slot availability + duration match  
5. Insert order: `status = "requested"`  
6. Increment listings used  
7. **Hold** all preferred times immediately (they disappear from `/api/availability`)  
8. If Google Calendar is connected, upsert a **tentative** event for the primary slot 

Redirect:

```text
/book/confirmation/{orderId}?token={publicToken}
```

(`&local=1` if email was stubbed)

### 1.5 Confirmation page

| Control | Action |
|---|---|
| View summary | Order details, preferred times, access |
| Prep checklist link | `/prep` |
| Email photographer | `mailto:` studio email |

Token must match `publicToken` or page fails.

### 1.6 Emails — booking created

| # | To | Subject | Contents (summary) |
|---|---|---|---|
| 1 | Agent | `We received your shoot request — {address}` | Thanks; preferred times; quote; CTA confirmation URL; prep checklist |
| 2 | Photographer (`tenant.email`) | `New shoot request — {address}` | Agent, property, package, quote, slots; CTA admin board |

---

## 2. Photographer admin — Orders board

| Surface | Path |
|---|---|
| Board | `/admin` → [`AdminOrderBoard`](../components/admin-order-board.tsx) |
| Auth | Photographer session; APIs: `requireTenantMembership` |

Owners and editors have the **same** order powers. Only invites are owner-only.

### 2.1 Board chrome

| Control | What happens | API |
|---|---|---|
| **Booking page** | Opens public `/book` | — |
| Status filter | `all` or one status | Client filter only |
| **Expand all** / **Collapse all** | Accordion UI | — |
| Empty state **Open booking page** | Opens `/book` | — |

### 2.2 Per-order row (collapsed)

| Control | What happens | API |
|---|---|---|
| Row / chevron | Expand or collapse details | — |
| **Status** `<select>` (always visible) | Sets order status immediately | `PATCH /api/admin/orders/{id}` `{ status }` |

Status options (any can be chosen anytime — no hard transition graph):

| Value | Label |
|---|---|
| `requested` | Requested |
| `confirmed` | Confirmed |
| `shot` | Shot |
| `editing` | Editing |
| `delivered` | Delivered |
| `paid` | Paid |
| `cancelled` | Cancelled |

There is **no** separate Confirm / Cancel button — use the status dropdown.

### 2.3 Expanded — details & price

| Control | What happens | API |
|---|---|---|
| Preferred times / property / agent / package | Read-only (`mailto:` agent) | — |
| **Set price (dollars)** + **Save price** | Shown only if `priceCents <= 0` (“quote later”) | `PATCH /api/admin/orders/{id}` `{ priceCents }` |

**Price change side effects**

- Updates order + matching gallery `amountCents`  
- Emails agent + photographer (quote updated)  

### 2.4 Delivery step 1 — Upload

Shown when order needs media.

| Control | What happens | API |
|---|---|---|
| **Choose files** | JPEG / PNG / WebP / HEIC, multi | — |
| **Upload** | Sends files | `POST /api/admin/orders/{id}/upload` |
| **Preview gallery** | Opens `/g/{token}` | — |

Upload creates/extends gallery; storage quotas apply.

### 2.5 Delivery step 2 — Publish

| Control | What happens | API |
|---|---|---|
| **Preview gallery** | Opens gallery | — |
| **Publish & email agent** (or **Publish again**) | Publishes delivery | `POST /api/admin/orders/{id}/delivery` `{ action: "publish" }` |

**Publish side effects** ([`publishDelivery`](../lib/galleries.ts) + delivery route):

1. Requires ≥1 photo  
2. Gallery state: `proofing` (pay-first) or `unlocked` (net7 trust)  
3. Order status → `delivered`  
4. Listing page published if plan has property pages (Growth+)  
5. Emails agent + photographer (gallery ready)  

Returns branded gallery URL, unbranded URL, optional listing URL.

### 2.6 Delivery step 3 — Share links

| Control | What happens |
|---|---|
| **Copy link** | Clipboard: branded `/g/{token}` |
| **Open gallery** | New tab |
| **Open mail app** | `mailto:` with subject `Your photos — {address}` |
| MLS copy | `/g/{token}?brand=off` |
| Property page copy | `/p/{slug}` from last publish (if any) |

### 2.7 Delivery step 4 — Unlock

| Control | What happens | API |
|---|---|---|
| **Mark paid & unlock** | Force unlock + mark paid | `POST …/delivery` `{ action: "unlock", markPaid: true }` |
| Disabled label **Already unlocked** | When already paid/unlocked | — |

Emails: same as Stripe “paid” (agent + photographer).

### 2.8 Share kit & reports (`<details>`)

| Control | Gate | API / page |
|---|---|---|
| **Share copy** | Studio `shareKit` | `GET /api/admin/orders/{id}/share` |
| **Flyer PDF** | Studio | `…/share?flyer=1` |
| **IG crop** | Studio | `…/share?preset=ig` |
| **Report** | Studio `reports` | `GET /api/admin/orders/{id}/report` |
| **Agent report** | Studio | Opens `/g/{token}/report` |

### 2.9 Delivery phase helper (UI)

| Phase | Condition |
|---|---|
| 1 | No media yet |
| 2 | Media exists, not delivered |
| 3 | Delivered |
| 4 | Paid / unlocked |

---

## 3. Status machine (system detail)

```text
requested → confirmed → shot → editing → delivered → paid
                 ↘ cancelled (terminal escape; UI allows jump to cancelled from most states)
```

Defined in [`lib/db/schema.ts`](../lib/db/schema.ts). Enforced loosely: admin may jump statuses.

### Side effects on status change ([`updateOrderStatus`](../lib/orders.ts))

| New status | Calendar | Emails |
|---|---|---|
| `requested` | Preferred times already held; Google event is tentative if connected | **None** (lifecycle templates skip it) |
| `confirmed` | Create appointment from the chosen preferred slot; Google event becomes confirmed | Agent + photographer |
| `shot` | Keep appointment | Agent + photographer |
| `editing` | Keep | Agent + photographer |
| `delivered` | Keep | Agent + photographer |
| `paid` | Keep | Agent + photographer |
| `cancelled` | **Delete** appointments and Google event; slot is bookable again | Agent + photographer |

**Confirm note:** pick one of the agent's preferred times on the order (primary is used when there is only one). Confirm re-checks that the slot is still free, ignoring this order's own hold.

Confirmed agent email includes a **Scheduled** line when an appointment exists.

---

## 4. Agent gallery — view, pay, download

### 4.1 Open gallery

| Item | Detail |
|---|---|
| URL | `/g/{publicToken}` |
| Query | `?brand=off` unbranded; `?paid=1` / `?cancelled=1` after Stripe return |
| Auth | Token only (no login) |
| Events | Records a gallery `view` |
| UI | [`PublicGallery`](../components/public-gallery.tsx); coach tour once |

Proofs are watermarked until unlock.

### 4.2 Pay & unlock

| Control | Action |
|---|---|
| **Pay & unlock** | `POST /api/g/{token}/checkout` |

Server branches:

| Condition | Result |
|---|---|
| `amountCents <= 0` | 400 — photographer must set price first |
| Already unlocked | `{ alreadyUnlocked: true }` |
| Stripe configured | Checkout Session → redirect to Stripe |
| No Stripe / stub | [`localStubUnlock`](../lib/stripe.ts) → mark paid + unlock + emails |

Optional Studio **upsells** can be included in checkout body.

Dev-only stub button if `NODE_ENV === "development"` or `ALLOW_GALLERY_STUB_UNLOCK=1`.

### 4.3 Stripe webhook (production pay)

```text
Agent completes Checkout
  → Stripe checkout.session.completed
  → POST /api/stripe/webhook
  → markPaymentPaidBySession(session.id)
  → unlockGallery(markOrderPaid: true)
  → notifyGalleryPaid (agent + photographer emails)
```

Subscription events on the same webhook update billing plans (separate from gallery).

### 4.4 Downloads

| Control / route | Gate |
|---|---|
| MLS / full zip `/api/g/{token}/download?kind=mls\|full` | Gallery `state === "unlocked"` else **402** |
| Asset variants `…/media/{id}?v=proof\|web\|full\|mls` | full/mls gated |

### 4.5 Trust tier

| Rule | Effect |
|---|---|
| Agent email has a prior **paid** order at this studio | `net7` — may publish already unlocked |
| Otherwise | `pay_first` — proofing until pay |

---

## 5. Listing / property page

After publish (Growth+ `propertyPages`):

| Item | Detail |
|---|---|
| URL | `/p/{slug}` |
| Content | Photos, agent block, optional map |
| Brand | `?brand=off` supported |

Skipped on Starter.

---

## 6. Day-before reminders (cron)

| Item | Detail |
|---|---|
| Endpoint | `GET /api/cron/reminders` |
| Auth | `Authorization: Bearer {CRON_SECRET}` |
| Window | Appointment start between **24h and 36h** from now |
| Dedup | `reminder_sends` row `kind = day_before` |
| Skip | Cancelled orders; already reminded |
| Sends | Agent reminder + photographer reminder |

Only **confirmed** shoots (appointment exists) are eligible.

Production scheduler: **Cloudflare Cron Trigger** (daily 14:00 UTC via [`workers/entry.ts`](../workers/entry.ts)). Manual HTTP fallback: same endpoint with `CRON_SECRET` (see [`DEPLOY.md`](../DEPLOY.md)).

---

## 7. Complete email matrix

Transport: [`sendEmail`](../lib/email.ts) → Resend or console stub.  
Orchestration: [`lib/order-notify.ts`](../lib/order-notify.ts).

| Event | Trigger | Agent subject | Photographer subject |
|---|---|---|---|
| Booking requested | `createBooking` | `We received your shoot request — {address}` | `New shoot request — {address}` |
| Confirmed | Status → `confirmed` | `Your shoot is confirmed — {address}` | `Shoot confirmed — {address}` |
| Shot | Status → `shot` | `Shoot complete — {address}` | `Marked shot — {address}` |
| Editing | Status → `editing` | `Editing in progress — {address}` | `Editing started — {address}` |
| Delivered | Publish or status → `delivered` | `Your photos are ready — {address}` | `Gallery delivered — {address}` |
| Paid | Stripe / stub / Mark paid / status → `paid` | `Downloads unlocked — {address}` | `Payment received — {address}` |
| Cancelled | Status → `cancelled` | `Shoot cancelled — {address}` | `Shoot cancelled — {address}` |
| Quote changed | **Save price** | `Updated quote — {address}` | `Quote updated — {address}` |
| Day-before | Cron | `Reminder: shoot tomorrow — {address}` | `Tomorrow: {address}` |

**Does not send lifecycle email**

| Action | Why |
|---|---|
| Setting status back to `requested` | No template |
| Filtering / expanding board | UI only |
| Copy link / open gallery / mailto share | No server mail (mailto opens client) |
| Upload only | No email until publish |
| Brand mode API | Not exposed as board button |

**Non-booking emails (for completeness)**

| Event | Subject pattern |
|---|---|
| Password reset | `Reset your {brand} password` |
| Studio invite | `You're invited to join {studio} on {brand}` |

---

## 8. Scenario catalog

### A. Ideal full cycle

1. Agent completes `/book` → **Request this shoot**  
2. Emails: agent + photographer (request)  
3. Photographer sets status **Confirmed**  
4. Appointment created; emails both (confirm)  
5. (Optional) status **Shot** → emails; **Editing** → emails  
6. **Upload** photos → **Publish & email agent** → emails both (delivered)  
7. Agent **Pay & unlock** → Stripe → webhook → emails both (paid)  
8. Agent downloads MLS / full  

### B. Quote-later booking

1. Package quotes $0 / “after request”  
2. Agent still books  
3. Photographer **Save price** → emails both (quote updated)  
4. Then confirm / shoot / publish / pay as above  
5. Pay blocked until price &gt; 0  

### C. Photographer marks paid offline

1. Gallery published  
2. Agent paid by e-transfer / invoice outside Stripe  
3. Photographer clicks **Mark paid & unlock**  
4. Same paid emails as Stripe  

### D. Cancel before shoot

1. Status → **Cancelled**  
2. Appointment deleted  
3. Emails both  
4. No day-before reminder  

### E. Cancel after confirm

Same as D; calendar slot freed.

### F. Republish

1. **Publish again** after more uploads  
2. Delivered emails send again  

### G. Net7 returning agent

1. Prior paid order same agent email  
2. Publish may unlock without pay  
3. Downloads may work immediately depending on state  

### H. Local / no Stripe

1. Checkout stub unlock  
2. Paid emails still fire  

### I. Day-before

1. Confirmed appointment ~24–36h out  
2. Cron runs → agent + photographer reminders once  

### J. Custom domain studio

Same flows; public URLs use custom host when live (`studioOrigin` / `siteUrl`).

### K. Service area rejection

1. Agent submits postal outside gate  
2. `POST /api/book` fails — **no order, no emails**  

### L. Listing quota exhausted

1. Plan annual listings used up  
2. Booking API rejects — **no emails**  

### M. Jump status (e.g. Requested → Delivered)

Allowed in UI. Side effects for the **target** status only (e.g. delivered emails if set via dropdown; publish path is preferred for gallery URLs).

### N. Editor vs owner

Editors can run the full order board. They cannot invite seats.

---

## 9. What is *not* built yet

| Gap | Notes |
|---|---|
| Agent-initiated change / reschedule request | No public “request change” form; quote changes are photographer-driven |
| Outlook / Apple Calendar sync | Google Calendar only |
| Hard status transition rules | Dropdown allows any status |
| Email when only uploading | Intentional — wait for publish |
| Separate “change requested” status | Not in `ORDER_STATUSES` |

---

## 10. Key file index

| Area | Files |
|---|---|
| Booking UI / APIs | `components/booking-form.tsx`, `lib/booking-schema.ts`, `app/api/book`, `app/api/quote`, `app/api/availability`, `lib/orders.ts`, `lib/availability.ts` |
| Calendar sync | `lib/calendar.ts`, `lib/google-calendar.ts`, `app/api/admin/calendar`, `components/studio-calendar-sync.tsx` |
| Admin board | `components/admin-order-board.tsx`, `app/admin/(app)/page.tsx` |
| Order APIs | `app/api/admin/orders/[id]/route.ts`, `…/upload`, `…/delivery`, `…/share`, `…/report` |
| Gallery / pay | `lib/galleries.ts`, `lib/stripe.ts`, `app/api/g/[token]/checkout`, `app/api/stripe/webhook`, `components/public-gallery.tsx` |
| Emails | `lib/email.ts`, `lib/order-notify.ts` |
| Cron | `app/api/cron/reminders/route.ts` |
| Auth | `lib/auth.ts` |

---

## 11. Quick ops checklist

- [ ] `RESEND_API_KEY` on Worker  
- [ ] `PLATFORM_EMAIL_FROM` verified in Resend  
- [ ] Stripe webhook → `/api/stripe/webhook` for live pay emails  
- [ ] Cloudflare Cron Trigger active on **studiofront** (`0 14 * * *` UTC) — or manual `/api/cron/reminders` with `CRON_SECRET`  
- [ ] Studio `tenant.email` correct (photographer inbox)  

When testing without Resend, watch Worker / server logs for `[email:stub]` to confirm payloads.

---

## 12. Address lookup, portal, referrals, reviews, shoot day

| Flow | Detail |
|---|---|
| Address autocomplete | Booking form calls `POST /api/geo/suggest` then `POST /api/geo/resolve` (Google Places, session token). Missing `GOOGLE_PLACES_API_KEY` degrades to plain text. Coords stored on `orders.place_id` / `map_lat` / `map_lng` and reused when publishing a listing page. |
| Agent portal | `{studio}/portal/login` emails a magic link to `/portal/callback?token=`. Cookie `sf_agent`. Index of that email's galleries, listing pages, book-again, referral link. |
| Referrals | `?ref=` on `/book` credits the referrer $25 on their next booking (`referral_credits`). |
| Reviews | After gallery pay, `ensureReviewRequest` queues an email (cron, 3 days later) to `/review/{token}`. Admin `/admin/reviews` approves; approved reviews render on the home page + LocalBusiness JSON-LD. |
| Shoot day | `/admin/today` lists today's appointments. On my way / arrived emails the agent. |
| Google Calendar | Photographer connects on `/admin/schedule`. Requested/confirmed shoots upsert events. Optional **Block booking times when I have other calendar events** treats non-Studiofront events as busy. |
| Listing custom domain | Photographer saves a hostname on `/admin/listings/[id]`. SSL via Cloudflare for SaaS. Agent can pay via Connect checkout on the listing page. Platform bills the photographer $5/mo per live hostname (`STRIPE_PRICE_DOMAIN_ADDON`). A live listing hostname on `/` redirects to `/p/{slug}`. |

## 13. Parity backlog (not in this ship)

Appointment splitting, territory radius, Outlook sync, pay-at-close, filename-preserved QC, homeowner SMS, AI staging, Dropbox/AutoHDR, live GPS dispatch, native apps, Zillow Showcase (no third-party API).

