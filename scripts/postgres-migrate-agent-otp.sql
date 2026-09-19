-- Agent portal email OTP challenges (replaces magic-link as primary sign-in)
-- Safe to run multiple times

CREATE TABLE IF NOT EXISTS agent_otp_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_otp_challenges_email_idx
  ON agent_otp_challenges(tenant_id, email, created_at);
