-- Migrate referral tables from agent-scoped to photographer-scoped
-- Safe to run multiple times (uses IF EXISTS / IF NOT EXISTS)

-- Drop old indexes
DROP INDEX IF EXISTS referral_codes_tenant_code_idx;
DROP INDEX IF EXISTS referral_credits_agent_idx;

-- Recreate referral_codes for photographer-to-photographer flow
DROP TABLE IF EXISTS referral_credits;
DROP TABLE IF EXISTS referral_codes;

CREATE TABLE IF NOT EXISTS referral_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_idx ON referral_codes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_idx ON referral_codes(code);

CREATE TABLE IF NOT EXISTS referral_credits (
  id TEXT PRIMARY KEY,
  referral_code_id TEXT NOT NULL,
  referrer_user_id TEXT NOT NULL,
  new_tenant_id TEXT NOT NULL,
  bonus_days INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS referral_credits_referrer_idx ON referral_credits(referrer_user_id);
