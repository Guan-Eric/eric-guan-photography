---
name: Measure and prove
overview: Install Cloudflare Web Analytics on the marketing site, generate real product screenshots with Playwright, and replace the stock Unsplash hero with actual product imagery plus a Silent Shutter founder proof section.
todos:
  - id: cf-analytics
    content: Add Cloudflare Web Analytics beacon to app/layout.tsx gated on no-tenant + token; wire .env.example, wrangler.jsonc vars, optional setup-check, privacy line
    status: pending
  - id: screens-capture
    content: Add tests/e2e/screens.spec.ts + chromium-screens project + brand:screens script; add ~6 real Silent Shutter fixture photos; output four PNGs to public/screens/
    status: pending
  - id: homepage-swap
    content: Replace Unsplash HERO and DELIVERY in components/platform-home.tsx with own listing photo and gallery-proofing.png
    status: pending
  - id: proof-section
    content: Add Silent Shutter founder proof section to the homepage using only verifiable numbers
    status: pending
isProject: false
---

# Measure the funnel, then prove the product

Three problems, in order of cost: you cannot see traffic, the homepage shows no product, and there is no proof anyone uses it.

## 1. Cloudflare Web Analytics

Cookieless, free, and you already have the Cloudflare account. No consent banner needed.

In [app/layout.tsx](app/layout.tsx), `RootLayout` already resolves `const tenant = await getRequestTenant()`. Render the beacon **only when there is no tenant**, so photographer studio sites stay untracked (their visitors are not yours to measure):

```tsx
{
  !tenant && process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN ? (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={`{"token":"${process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN}"}`}
    />
  ) : null;
}
```

Wiring, following existing conventions:

- Add `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` to [.env.example](.env.example) with a comment
- Add it to `vars` in [wrangler.jsonc](wrangler.jsonc) (public token, not a secret, so not `wrangler secret put`)
- Add an **optional** check in [scripts/setup-check.mjs](scripts/setup-check.mjs) — detail string starting with `optional` so it warns instead of failing
- One line in the privacy page noting cookieless analytics on the marketing site

Guarding on the token keeps local dev and tests clean.

## 2. Real product screenshots

Repo precedent is [scripts/generate-studiofront-mark.mjs](scripts/generate-studiofront-mark.mjs), which drives Chromium directly. Better here to reuse the Playwright harness, since it already boots the app with the right env.

Add `tests/e2e/screens.spec.ts` tagged `@screens`, plus a `chromium-screens` project in [playwright.config.ts](playwright.config.ts) and a `brand:screens` script in [package.json](package.json). It reuses the existing pipeline from [tests/e2e/portal-gallery.spec.ts](tests/e2e/portal-gallery.spec.ts): `signupStudio` → `createBooking` → `POST /api/admin/orders/{id}/upload` → `POST .../delivery` → stub unlock, with `skipCoachTours` and `clearUiOverlays` from [tests/e2e/helpers/app.ts](tests/e2e/helpers/app.ts) so no tour overlay lands in the shot.

Fixed viewport 1440x900 at `deviceScaleFactor: 2`. Captures committed to `public/screens/`:

- `gallery-proofing.png` — watermarked proofs with the Pay and unlock button
- `gallery-unlocked.png` — downloads available
- `admin-orders.png` — the shoot board
- `listing-page.png` — a published `/p/{slug}`

`tests/fixtures/` currently holds a single `e2e-photo.jpg`, which makes a sparse gallery. Add about six **of your own Silent Shutter listing photos**. That matters beyond the screenshot: the demo gallery stops looking like a stock-photo mockup.

## 3. Homepage swap

[components/platform-home.tsx](components/platform-home.tsx) currently pulls both images from `images.unsplash.com` (`HERO` and `DELIVERY` consts). Replace with:

- `HERO` → one of your own listing photos, served locally from `public/`
- `DELIVERY` band → `gallery-proofing.png`, so the "Proofs, pay, and files on the same link" section actually shows that happening

Keep the Unsplash entry in `next.config.ts` `remotePatterns` for now, since [components/auth-shell.tsx](components/auth-shell.tsx) and [content/tenants/eric-guan.ts](content/tenants/eric-guan.ts) still use it.

## 4. Silent Shutter proof section

Add a section to the homepage above the final CTA: you built this to run your own studio, and it does. Use only numbers you can verify from your own data (listings delivered through StudioFront, typical time from delivery to payment). No invented logos, no fake counts, no "trusted by hundreds."

A longer founder case study post under [content/blog/](content/blog/) is the natural follow-on once the section exists, but it is not required for this pass.

## Verification

Run `npm run setup:check` (the new key should WARN, not FAIL, when unset), then `npm run brand:screens` and confirm four PNGs land in `public/screens/`. Load `/` and check the beacon script tag is present, then load a tenant studio host and confirm it is absent.

## Out of scope

Redesigning type, color, or layout. Funnel or conversion-goal tracking. Replacing Unsplash in auth and tenant content. The ungate plan is tracked separately.
