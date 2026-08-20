# Database migrations (Postgres / Neon)

Apply in order on each new environment. Idempotent scripts are safe to re-run.

| Order | Script | Apply helper |
|------:|--------|--------------|
| 1 | `scripts/postgres-schema.sql` | manual / Neon SQL editor |
| 2 | `scripts/postgres-migrate-parity.sql` | `node scripts/apply-parity-migration.mjs` |
| 3 | `scripts/postgres-migrate-calendar.sql` | `node scripts/apply-calendar-migration.mjs` |
| 4 | `scripts/postgres-migrate-referrals.sql` | `node scripts/apply-referrals-migration.mjs` |
| 5 | `scripts/postgres-migrate-custom-domain.sql` | `node scripts/apply-custom-domain-migration.mjs` |
| 6 | `scripts/postgres-migrate-bigint-storage.sql` | manual |
| 7 | `scripts/postgres-rls.sql` | optional — RLS policies (app must set `app.tenant_id` to enforce) |

**Pre-deploy:** run any scripts added since last deploy against production Neon **before** `npm run deploy`.

**CI:** migration files are version-controlled; apply remains manual until a runner is wired in deploy.
