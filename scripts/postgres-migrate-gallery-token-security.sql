-- Gallery token security: 14-day expiry + Limited Marketing License acceptance
-- Safe to run multiple times

ALTER TABLE galleries ADD COLUMN IF NOT EXISTS expires_at TEXT;
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS license_accepted_at TEXT;
