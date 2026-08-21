-- Aryeo/Spiro parity roadmap migration (idempotent).
-- Apply with: node scripts/apply-parity-migration.mjs

-- Phase 3: embeds for video / tours / floor plans
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

CREATE INDEX IF NOT EXISTS media_links_tenant_idx ON media_links (tenant_id, kind);
CREATE INDEX IF NOT EXISTS media_links_gallery_idx ON media_links (gallery_id, sort_order);

-- Phase 3: editable listing pages
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'gallery';
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS hero_asset_id TEXT;
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS sections_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS open_house_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS lead_capture INTEGER NOT NULL DEFAULT 1;

-- Phase 4: per-listing custom domains
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

CREATE UNIQUE INDEX IF NOT EXISTS listing_domains_hostname_idx ON listing_domains (hostname);
CREATE INDEX IF NOT EXISTS listing_domains_tenant_idx ON listing_domains (tenant_id, status);

-- Phase 1b: persist Places coords on the booking so listing pages skip Nominatim
ALTER TABLE orders ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS map_lat TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS map_lng TEXT;

-- Phase 6: shoot-day timestamps
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS on_my_way_at TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS arrived_at TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TEXT;

-- Phase 5: agent portal magic links
CREATE TABLE IF NOT EXISTS agent_login_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_login_tokens_token_idx ON agent_login_tokens (token);

-- Phase 6: referrals
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

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_tenant_code_idx ON referral_codes (tenant_id, code);
CREATE INDEX IF NOT EXISTS referral_credits_agent_idx ON referral_credits (tenant_id, agent_email);

-- Phase 6: reviews
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

CREATE UNIQUE INDEX IF NOT EXISTS review_requests_token_idx ON review_requests (token);
CREATE INDEX IF NOT EXISTS testimonials_tenant_idx ON testimonials (tenant_id, approved_at);

-- AppSumo Licensing API v2
CREATE TABLE IF NOT EXISTS appsumo_licenses (
  id TEXT PRIMARY KEY NOT NULL,
  license_key TEXT NOT NULL,
  prev_license_key TEXT,
  tier INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'inactive',
  tenant_id TEXT,
  user_id TEXT,
  partner_plan_name TEXT,
  event_timestamp TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS appsumo_licenses_key_idx ON appsumo_licenses (license_key);
CREATE INDEX IF NOT EXISTS appsumo_licenses_tenant_idx ON appsumo_licenses (tenant_id);
