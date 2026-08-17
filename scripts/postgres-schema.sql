-- Postgres schema matching the SQLite tables in lib/db/index.ts.
-- TEXT / INTEGER types stay compatible with the existing Drizzle column shapes.
-- Apply before scripts/postgres-rls.sql when migrating off SQLite.
--
--   psql "$DATABASE_URL" -f scripts/postgres-schema.sql
--   psql "$DATABASE_URL" -f scripts/postgres-rls.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  domain TEXT,
  domain_cf_id TEXT,
  domain_status TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Toronto',
  config_json TEXT NOT NULL,
  stripe_connect_account_id TEXT,
  stripe_connect_status TEXT NOT NULL DEFAULT 'not_started',
  storage_bytes_used BIGINT NOT NULL DEFAULT 0,
  media_quota_bytes BIGINT NOT NULL DEFAULT 10737418240,
  stripe_customer_id TEXT,
  plan TEXT NOT NULL DEFAULT 'trial',
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  stripe_subscription_id TEXT,
  trial_ends_at TEXT,
  listing_quota_annual INTEGER NOT NULL DEFAULT 100,
  seats_quota INTEGER NOT NULL DEFAULT 1,
  listings_used_year INTEGER NOT NULL DEFAULT 0,
  listings_year INTEGER NOT NULL DEFAULT 2026,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_domain_unique_idx
  ON tenants (domain)
  WHERE domain IS NOT NULL AND domain <> '';

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_rate_limits (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  upload_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  duration_minutes INTEGER NOT NULL,
  square_footage INTEGER NOT NULL,
  property_address TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT,
  preferred_start TEXT NOT NULL,
  preferred_end TEXT NOT NULL,
  preferred_slots_json TEXT NOT NULL DEFAULT '[]',
  agent_name TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  agent_phone TEXT,
  brokerage TEXT,
  occupancy TEXT NOT NULL,
  access_type TEXT NOT NULL,
  access_notes TEXT,
  pets TEXT,
  parking_notes TEXT,
  meeting_contact TEXT,
  notes TEXT,
  place_id TEXT,
  map_lat TEXT,
  map_lng TEXT,
  public_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  buffer_minutes INTEGER NOT NULL DEFAULT 45,
  postal_code TEXT NOT NULL,
  on_my_way_at TEXT,
  arrived_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  state TEXT NOT NULL DEFAULT 'proofing',
  public_token TEXT NOT NULL,
  brand_mode TEXT NOT NULL DEFAULT 'branded',
  trust_tier TEXT NOT NULL DEFAULT 'pay_first',
  title TEXT NOT NULL,
  property_address TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  unlocked_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  gallery_id TEXT NOT NULL REFERENCES galleries(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  original_name TEXT NOT NULL,
  room_label TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes_original BIGINT NOT NULL,
  path_original TEXT NOT NULL,
  path_web TEXT NOT NULL,
  path_proof TEXT NOT NULL,
  path_mls TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_links (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  gallery_id TEXT REFERENCES galleries(id),
  listing_page_id TEXT,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'link',
  url TEXT,
  storage_path TEXT,
  title TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  brand_mode TEXT NOT NULL DEFAULT 'both',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  gallery_id TEXT NOT NULL REFERENCES galleries(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  provider_session_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  stripe_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listing_pages (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  gallery_id TEXT,
  slug TEXT NOT NULL,
  brand_mode TEXT NOT NULL DEFAULT 'branded',
  title TEXT NOT NULL,
  property_address TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  agent_phone TEXT,
  brokerage TEXT,
  map_lat TEXT,
  map_lng TEXT,
  headline TEXT,
  description TEXT,
  theme TEXT NOT NULL DEFAULT 'gallery',
  hero_asset_id TEXT,
  sections_json TEXT NOT NULL DEFAULT '[]',
  open_house_json TEXT NOT NULL DEFAULT '[]',
  lead_capture INTEGER NOT NULL DEFAULT 1,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listing_domains (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  listing_page_id TEXT NOT NULL REFERENCES listing_pages(id),
  hostname TEXT NOT NULL,
  cf_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  purchased_by_email TEXT,
  paid_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gallery_events (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  gallery_id TEXT NOT NULL REFERENCES galleries(id),
  order_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS membership_invites (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  token TEXT NOT NULL,
  invited_by_user_id TEXT NOT NULL,
  accepted_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminder_sends (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_login_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_codes (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_credits (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  source_order_id TEXT,
  applied_order_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_requests (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  token TEXT NOT NULL,
  sent_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  order_id TEXT,
  agent_name TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  body TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  approved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants(slug);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_user_tenant_idx ON memberships(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS orders_tenant_status_idx ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS appointments_tenant_starts_idx ON appointments(tenant_id, starts_at);
CREATE UNIQUE INDEX IF NOT EXISTS galleries_token_idx ON galleries(public_token);
CREATE INDEX IF NOT EXISTS galleries_order_idx ON galleries(order_id);
CREATE INDEX IF NOT EXISTS media_gallery_idx ON media_assets(gallery_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS listing_domains_hostname_idx ON listing_domains(hostname);
CREATE INDEX IF NOT EXISTS listing_domains_tenant_idx ON listing_domains(tenant_id, status);
CREATE INDEX IF NOT EXISTS media_links_tenant_idx ON media_links(tenant_id, kind);
CREATE INDEX IF NOT EXISTS media_links_gallery_idx ON media_links(gallery_id, sort_order);
CREATE INDEX IF NOT EXISTS upload_rate_tenant_idx ON upload_rate_limits(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS listing_pages_tenant_slug_idx ON listing_pages(tenant_id, slug);
CREATE INDEX IF NOT EXISTS listing_pages_order_idx ON listing_pages(order_id);
CREATE INDEX IF NOT EXISTS gallery_events_gallery_idx ON gallery_events(gallery_id, kind);
CREATE UNIQUE INDEX IF NOT EXISTS membership_invites_token_idx ON membership_invites(token);
CREATE INDEX IF NOT EXISTS billing_events_tenant_idx ON billing_events(tenant_id);
CREATE INDEX IF NOT EXISTS reminder_sends_order_kind_idx ON reminder_sends(order_id, kind);
CREATE UNIQUE INDEX IF NOT EXISTS agent_login_tokens_token_idx ON agent_login_tokens(token);
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_tenant_code_idx ON referral_codes(tenant_id, code);
CREATE INDEX IF NOT EXISTS referral_credits_agent_idx ON referral_credits(tenant_id, agent_email);
CREATE UNIQUE INDEX IF NOT EXISTS review_requests_token_idx ON review_requests(token);
CREATE INDEX IF NOT EXISTS testimonials_tenant_idx ON testimonials(tenant_id, approved_at);
