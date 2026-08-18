-- Google Calendar sync (idempotent).
-- Apply with: node scripts/apply-calendar-migration.mjs

ALTER TABLE orders ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

CREATE TABLE IF NOT EXISTS calendar_connections (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  provider TEXT NOT NULL DEFAULT 'google',
  account_email TEXT,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  calendar_name TEXT,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  token_expires_at TEXT,
  block_external_events INTEGER NOT NULL DEFAULT 0,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS calendar_connections_tenant_idx
  ON calendar_connections (tenant_id);
