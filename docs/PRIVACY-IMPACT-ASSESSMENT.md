# Privacy impact assessment — out-of-Québec processors

**Date:** 2026-09-19  
**Owner:** Privacy Officer (`privacy@studiofront.ca`)  
**Statute:** CQLR c. P-39.1 s. 3.3 (Law 25)

## Purpose

Document privacy impacts of communicating personal information outside Québec when operating Studiofront (booking, gallery delivery, billing, email, hosting).

## Categories of personal information

| Category | Examples | Sensitivity |
|----------|----------|-------------|
| Account | name, email, password hash | Medium |
| Booking | agent name/email/phone, property address, access notes | Medium–high (access notes) |
| Media | property photos | Medium (may show interiors) |
| Billing | Stripe customer / Connect IDs | Medium |
| Calendar | Google OAuth token, calendar events | Medium |

## Processors outside Québec / Canada

| Processor | Role | Location (typical) | Safeguards |
|-----------|------|--------------------|------------|
| Stripe | Payments, Connect | US / EU | Contractual DPA; no full PAN stored by us |
| Resend | Transactional email | US | Contractual terms; purpose-limited |
| Cloudflare | Workers hosting, R2 media, Web Analytics | Global edge | Contractual terms; cookieless analytics on apex only |
| Neon | Postgres | US (configurable) | Encrypted in transit; access controlled |
| Google | Optional Calendar OAuth | US | Limited Use policy; disconnect deletes tokens |

## Assessment summary

- **Necessity:** Each processor is required to operate the product (payments, email, hosting, optional calendar).
- **Minimization:** Card numbers are not stored; analytics are cookieless and marketing-apex-only; gallery events are first-party product metrics.
- **Risk:** Residual risk of unauthorized access at a processor is mitigated by vendor contracts, least-privilege keys, and revocation paths (disconnect Google, revoke galleries, delete studio).
- **Decision:** Transfers are approved for the listed purposes. Revisit this assessment when adding identifying/locating/profiling tech or new processors.

## Review

Re-assess on material product changes or annually.
