-- Fix: media quotas exceed Postgres INTEGER (~2.1GB).
-- Applied to Neon StudioFront 2026-08-15.

ALTER TABLE tenants ALTER COLUMN storage_bytes_used TYPE BIGINT;
ALTER TABLE tenants ALTER COLUMN media_quota_bytes TYPE BIGINT;
ALTER TABLE tenants ALTER COLUMN media_quota_bytes SET DEFAULT 10737418240;
ALTER TABLE media_assets ALTER COLUMN bytes_original TYPE BIGINT;
