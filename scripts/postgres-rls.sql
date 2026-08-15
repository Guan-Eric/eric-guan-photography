-- Postgres RLS policies for a future DATABASE_URL swap.
-- Apply after scripts/postgres-schema.sql (or an equivalent migration).
-- Every business table is isolated by tenant_id (tenants row by id).
--
-- Session variable: SET app.tenant_id = '<tenant-uuid>';
-- Application should SET LOCAL this inside a transaction per request.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_isolation ON tenants
  USING (id = current_setting('app.tenant_id', true));

CREATE POLICY memberships_isolation ON memberships
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY orders_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY appointments_isolation ON appointments
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY galleries_isolation ON galleries
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY media_assets_isolation ON media_assets
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY payments_isolation ON payments
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY listing_pages_isolation ON listing_pages
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY gallery_events_isolation ON gallery_events
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY membership_invites_isolation ON membership_invites
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY billing_events_isolation ON billing_events
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY upload_rate_limits_isolation ON upload_rate_limits
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY reminder_sends_isolation ON reminder_sends
  USING (tenant_id = current_setting('app.tenant_id', true));

-- users is global identity (email login across tenants); isolate via memberships.
-- Optional: enable RLS on users only if you introduce a per-tenant user model.
