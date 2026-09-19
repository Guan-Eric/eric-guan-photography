-- Listing compliance: broker identity, advertising window, enhancement tags, license language
-- Safe to run multiple times

ALTER TABLE galleries ADD COLUMN IF NOT EXISTS license_accepted_language TEXT;

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS enhancement_tag TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS original_disclosure_asset_id TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS disclosure_public INTEGER NOT NULL DEFAULT 0;

ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS brokerage_phone TEXT;
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS listing_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS advertising_ends_at TEXT;
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS deed_signed_at TEXT;
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS compliance_region TEXT NOT NULL DEFAULT 'ca_other';
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS license_display_name TEXT;
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS license_type TEXT;
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS agency_legal_name TEXT;
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS agency_license_type TEXT;
ALTER TABLE listing_pages ADD COLUMN IF NOT EXISTS alteration_disclaimer INTEGER NOT NULL DEFAULT 0;
