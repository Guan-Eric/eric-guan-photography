---
name: Ungate reports share kit
overview: Give gallery reports and the share kit to every plan (including Starter and the $199 Lifetime) so the people you actually sell to can see the differentiating features. In-gallery upsells stay a paid upgrade lever.
todos:
  - id: entitlements
    content: Flip shareKit/reports on for all plans in lib/plan-defs.ts; give trial upsells; reword the two Studio-plan error strings
    status: completed
  - id: pricing-copy
    content: Split share kit/reports from upsells on the pricing cards and rewrite the plan-math upgrade note
    status: completed
  - id: lifetime-copy
    content: Add reports + share kit to the Lifetime page includes/FAQ and drop the exclusion from the LTD and outreach docs
    status: completed
  - id: tests
    content: Update billing-quotas entitlement assertions to the new policy and run the unit tests
    status: completed
isProject: false
---

# Ungate gallery reports + share kit

Today `entitlements()` in [lib/plan-defs.ts](lib/plan-defs.ts) gives `shareKit`, `reports`, and `upsells` only to `studio` and `payg`. Your target buyer is a solo shooter under 125 listings a year, who lands on Starter or the $199 Lifetime, so they never see any of it. This flips reports and share kit on everywhere and leaves upsells as the upgrade reason.

## 1. The entitlement change

In [lib/plan-defs.ts](lib/plan-defs.ts), the non-PAYG branch becomes:

```ts
return {
  customDomain: plan === "trial" || plan === "growth" || plan === "studio",
  propertyPages: plan === "trial" || plan === "growth" || plan === "studio",
  shareKit: true,
  reports: true,
  upsells: plan === "trial" || plan === "studio",
};
```

`trial` gains `upsells` so a 14-day demo shows the whole product. `starter`, `growth`, and `lifetime` get reports and share kit; only `upsells` still separates them from Studio.

Nothing else needs new wiring. The call sites already read `entitlements()`:

- [lib/share-kit.ts](lib/share-kit.ts) `assertShareKit`
- [app/api/admin/orders/[id]/report/route.ts](app/api/admin/orders/[id]/report/route.ts)
- [app/g/[token]/report/page.tsx](app/g/[token]/report/page.tsx) (currently `notFound()`)
- [app/api/g/[token]/checkout/route.ts](app/api/g/[token]/checkout/route.ts) and [app/g/[token]/page.tsx](app/g/[token]/page.tsx) for upsells

Keep the guards in place as defense, but reword the two "on the Studio plan" error strings since they no longer describe reality.

## 2. Pricing page copy

[components/platform-pricing.tsx](components/platform-pricing.tsx) line ~100 lumps all three together:

```tsx
{
  extras.shareKit ? <li>Share kit + reports + upsells</li> : null;
}
```

Split it so every card lists "Share kit + gallery reports" and only `extras.upsells` adds "In-gallery upsells". The plan-math note near line 233 still credits Growth and Studio with "share kit, reports" as the reason to upgrade; rewrite it around seats, quota, storage, custom domain, and property websites.

The comparison table rows in [lib/plan-compare.ts](lib/plan-compare.ts) derive from `entitlements()`, so they update themselves.

## 3. Lifetime page

Reports and share kit are now a genuine part of the $199 offer. Add them to the includes list and the "What do I get?" FAQ in [components/platform-lifetime.tsx](components/platform-lifetime.tsx), and drop "Studio-tier extras" from the Lifetime "Not included" lines in [docs/LTD-PRIVATE-SALES.md](docs/LTD-PRIVATE-SALES.md), [docs/outreach/instagram-cold-dms.md](docs/outreach/instagram-cold-dms.md), and [docs/outreach/facebook-cold-dms.md](docs/outreach/facebook-cold-dms.md).

## 4. Tests

[tests/unit/billing-quotas.test.ts](tests/unit/billing-quotas.test.ts) asserts the old policy and will fail:

```ts
expect(entitlements("growth").shareKit).toBe(false);
```

Replace with assertions for the new rule: `shareKit` and `reports` true for starter, growth, studio, payg, trial, and lifetime; `upsells` true only for trial, studio, and payg.

Verify with `npx vitest run tests/unit/billing-quotas.test.ts tests/unit/plan-compare.test.ts`, then load an order on a Starter or Lifetime studio and confirm Share copy and the `/g/{token}/report` page work instead of returning the plan-gate error.

## Out of scope

Ungating custom domain or property websites, new report content, pricing changes, seat or quota changes.
