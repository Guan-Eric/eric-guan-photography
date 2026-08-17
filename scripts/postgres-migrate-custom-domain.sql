-- Custom domain status for Cloudflare for SaaS vanity hostnames.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_cf_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_status TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_domain_unique_idx
  ON tenants (domain)
  WHERE domain IS NOT NULL AND domain <> '';
