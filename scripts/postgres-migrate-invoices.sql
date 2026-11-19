-- Gallery payment invoices (PDF attached to paid emails)
-- Safe to run multiple times

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  payment_id TEXT REFERENCES payments(id),
  number TEXT NOT NULL,
  year INTEGER NOT NULL,
  sequence INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  pdf_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_order_id_idx ON invoices(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_number_idx ON invoices(tenant_id, number);
CREATE INDEX IF NOT EXISTS invoices_tenant_idx ON invoices(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS invoice_counters (
  tenant_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, year)
);

-- Silent Shutter already issued SS-2026-001 manually; next must be SS-2026-002.
-- Seed only when missing — never reset last_number on re-run.
-- Cover file-seed id, older Neon Silent Shutter id, and the live production tenant.
INSERT INTO invoice_counters (tenant_id, year, last_number, updated_at)
VALUES ('eric-guan', 2026, 1, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
ON CONFLICT (tenant_id, year) DO NOTHING;

INSERT INTO invoice_counters (tenant_id, year, last_number, updated_at)
VALUES ('ten_x0wnara5wf', 2026, 1, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
ON CONFLICT (tenant_id, year) DO NOTHING;

INSERT INTO invoice_counters (tenant_id, year, last_number, updated_at)
VALUES ('ten_3lj41dmg09', 2026, 1, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
ON CONFLICT (tenant_id, year) DO NOTHING;
