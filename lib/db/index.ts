/**
 * Local default: SQLite via better-sqlite3 (no DATABASE_URL).
 * Production (Cloudflare Workers / Neon): set DATABASE_URL=postgres://…
 * Apply migrations before deploy:
 *   - scripts/postgres-schema.sql
 *   - scripts/postgres-rls.sql
 * Postgres skips auto-seed; seed locally or via SQL.
 */
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { seedPlatform } from "@/lib/platform-seed";
import * as sqliteSchema from "./schema";
import * as pgSchema from "./schema.pg";

export const schema = (
  process.env.DATABASE_URL ? pgSchema : sqliteSchema
) as typeof sqliteSchema;

const usePostgres = Boolean(process.env.DATABASE_URL);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppDb = any;

let neonDb: AppDb | null = null;
let sqliteDb: AppDb | null = null;
let seeded = false;

/**
 * Unify SQLite (.all()) and Neon (Promise<T[]>) select results.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function qAll<T>(built: any): Promise<T[]> {
  if (built && typeof built.all === "function") return built.all() as T[];
  return built as Promise<T[]>;
}

/**
 * Unify SQLite (.get()) and Neon (Promise<T[]>) single-row selects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function qGet<T>(built: any): Promise<T | undefined> {
  if (built && typeof built.get === "function") return built.get() as T | undefined;
  const rows = await (built as Promise<T[]>);
  return Array.isArray(rows) ? rows[0] : undefined;
}

/**
 * Unify SQLite (.run()) and Neon (Promise) mutations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function qRun(built: any): Promise<void> {
  if (built && typeof built.run === "function") {
    built.run();
    return;
  }
  await built;
}

/**
 * Ensures SQLite tables/columns for local and single-node deploys.
 */
function ensureSchema(db: import("better-sqlite3").Database) {
  db.exec(`
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
      storage_bytes_used INTEGER NOT NULL DEFAULT 0,
      media_quota_bytes INTEGER NOT NULL DEFAULT 10737418240,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

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
      calendar_event_id TEXT,
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
      bytes_original INTEGER NOT NULL,
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

    CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
    CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants(slug);
    CREATE UNIQUE INDEX IF NOT EXISTS memberships_user_tenant_idx ON memberships(user_id, tenant_id);
    CREATE INDEX IF NOT EXISTS orders_tenant_status_idx ON orders(tenant_id, status);
    CREATE INDEX IF NOT EXISTS appointments_tenant_starts_idx ON appointments(tenant_id, starts_at);
    CREATE UNIQUE INDEX IF NOT EXISTS calendar_connections_tenant_idx ON calendar_connections(tenant_id);
    CREATE UNIQUE INDEX IF NOT EXISTS galleries_token_idx ON galleries(public_token);
    CREATE INDEX IF NOT EXISTS galleries_order_idx ON galleries(order_id);
    CREATE INDEX IF NOT EXISTS media_gallery_idx ON media_assets(gallery_id, sort_order);
    CREATE INDEX IF NOT EXISTS media_links_tenant_idx ON media_links(tenant_id, kind);
    CREATE INDEX IF NOT EXISTS media_links_gallery_idx ON media_links(gallery_id, sort_order);
    CREATE INDEX IF NOT EXISTS upload_rate_tenant_idx ON upload_rate_limits(tenant_id);

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
      user_id TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referral_credits (
      id TEXT PRIMARY KEY NOT NULL,
      referral_code_id TEXT NOT NULL,
      referrer_user_id TEXT NOT NULL,
      new_tenant_id TEXT NOT NULL,
      bonus_days INTEGER NOT NULL,
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

    CREATE UNIQUE INDEX IF NOT EXISTS listing_domains_hostname_idx ON listing_domains(hostname);
    CREATE INDEX IF NOT EXISTS listing_domains_tenant_idx ON listing_domains(tenant_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS listing_pages_tenant_slug_idx ON listing_pages(tenant_id, slug);
    CREATE INDEX IF NOT EXISTS listing_pages_order_idx ON listing_pages(order_id);
    CREATE INDEX IF NOT EXISTS gallery_events_gallery_idx ON gallery_events(gallery_id, kind);
    CREATE UNIQUE INDEX IF NOT EXISTS membership_invites_token_idx ON membership_invites(token);
    CREATE INDEX IF NOT EXISTS billing_events_tenant_idx ON billing_events(tenant_id);
    CREATE UNIQUE INDEX IF NOT EXISTS agent_login_tokens_token_idx ON agent_login_tokens(token);
    CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_idx ON referral_codes(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_idx ON referral_codes(code);
    CREATE INDEX IF NOT EXISTS referral_credits_referrer_idx ON referral_credits(referrer_user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS review_requests_token_idx ON review_requests(token);
    CREATE INDEX IF NOT EXISTS testimonials_tenant_idx ON testimonials(tenant_id, approved_at);
  `);

  const columns = db
    .prepare(`PRAGMA table_info(orders)`)
    .all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "preferred_slots_json")) {
    db.exec(
      `ALTER TABLE orders ADD COLUMN preferred_slots_json TEXT NOT NULL DEFAULT '[]'`,
    );
  }

  addColumnIfMissing(db, "tenants", "stripe_customer_id", "TEXT");
  addColumnIfMissing(db, "tenants", "plan", "TEXT NOT NULL DEFAULT 'trial'");
  addColumnIfMissing(
    db,
    "tenants",
    "subscription_status",
    "TEXT NOT NULL DEFAULT 'trialing'",
  );
  addColumnIfMissing(db, "tenants", "stripe_subscription_id", "TEXT");
  addColumnIfMissing(db, "tenants", "trial_ends_at", "TEXT");
  addColumnIfMissing(
    db,
    "tenants",
    "listing_quota_annual",
    "INTEGER NOT NULL DEFAULT 100",
  );
  addColumnIfMissing(db, "tenants", "seats_quota", "INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(
    db,
    "tenants",
    "listings_used_year",
    "INTEGER NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    db,
    "tenants",
    "listings_year",
    "INTEGER NOT NULL DEFAULT 2026",
  );
  addColumnIfMissing(db, "tenants", "domain_cf_id", "TEXT");
  addColumnIfMissing(db, "tenants", "domain_status", "TEXT");
  addColumnIfMissing(db, "listing_pages", "headline", "TEXT");
  addColumnIfMissing(db, "listing_pages", "description", "TEXT");
  addColumnIfMissing(db, "listing_pages", "theme", "TEXT NOT NULL DEFAULT 'gallery'");
  addColumnIfMissing(db, "listing_pages", "hero_asset_id", "TEXT");
  addColumnIfMissing(
    db,
    "listing_pages",
    "sections_json",
    "TEXT NOT NULL DEFAULT '[]'",
  );
  addColumnIfMissing(
    db,
    "listing_pages",
    "open_house_json",
    "TEXT NOT NULL DEFAULT '[]'",
  );
  addColumnIfMissing(
    db,
    "listing_pages",
    "lead_capture",
    "INTEGER NOT NULL DEFAULT 1",
  );
  addColumnIfMissing(db, "orders", "place_id", "TEXT");
  addColumnIfMissing(db, "orders", "map_lat", "TEXT");
  addColumnIfMissing(db, "orders", "map_lng", "TEXT");
  addColumnIfMissing(db, "appointments", "on_my_way_at", "TEXT");
  addColumnIfMissing(db, "appointments", "arrived_at", "TEXT");
  addColumnIfMissing(db, "appointments", "completed_at", "TEXT");
  addColumnIfMissing(db, "orders", "calendar_event_id", "TEXT");
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS tenants_domain_unique_idx ON tenants(domain) WHERE domain IS NOT NULL AND domain != ''`,
  );
}

function addColumnIfMissing(
  db: import("better-sqlite3").Database,
  table: string,
  name: string,
  ddl: string,
) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
  }
}

function getSqliteDb(): AppDb {
  if (sqliteDb) return sqliteDb;

  // Lazy require so Cloudflare Workers (DATABASE_URL set) never load native sqlite.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as typeof import("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3") as typeof import("drizzle-orm/better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("node:path") as typeof import("node:path");

  const dataDir = path.join(process.cwd(), "data");
  const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, "platform.sqlite");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  ensureSchema(sqlite);

  sqliteDb = drizzle(sqlite, { schema: sqliteSchema });

  if (!seeded) {
    seeded = true;
    seedPlatform(sqliteDb);
  }

  return sqliteDb;
}

function isRetryableNeonFetch(error: unknown) {
  const text =
    error instanceof Error
      ? `${error.message} ${error.cause instanceof Error ? error.cause.message : error.cause ?? ""}`
      : String(error);
  return /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|Connect Timeout|network|socket/i.test(
    text,
  );
}

async function neonFetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const attempts = 4;
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.status >= 500 && attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
        continue;
      }
      return response;
    } catch (error) {
      last = error;
      if (attempt === attempts - 1 || !isRetryableNeonFetch(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw last;
}

neonConfig.fetchConnectionCache = true;
neonConfig.fetchFunction = neonFetchWithRetry;

function getNeonDb(): AppDb {
  if (neonDb) return neonDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for Postgres.");
  const sql = neon(url);
  neonDb = drizzleNeon(sql, { schema: pgSchema });
  return neonDb;
}

export function getDb(): AppDb {
  if (usePostgres) return getNeonDb();
  return getSqliteDb();
}
