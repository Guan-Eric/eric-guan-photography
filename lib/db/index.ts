import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@/lib/db/schema";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH ?? path.join(DATA_DIR, "platform.sqlite");

let sqlite: Database.Database | null = null;
let seeded = false;

/**
 * Local default remains SQLite. Set DATABASE_URL=postgres://… later and swap
 * the Drizzle driver — table shapes stay the same.
 */
function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL,
      domain TEXT,
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
      bytes_original INTEGER NOT NULL,
      path_original TEXT NOT NULL,
      path_web TEXT NOT NULL,
      path_proof TEXT NOT NULL,
      path_mls TEXT NOT NULL,
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
    CREATE UNIQUE INDEX IF NOT EXISTS galleries_token_idx ON galleries(public_token);
    CREATE INDEX IF NOT EXISTS galleries_order_idx ON galleries(order_id);
    CREATE INDEX IF NOT EXISTS media_gallery_idx ON media_assets(gallery_id, sort_order);
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

    CREATE UNIQUE INDEX IF NOT EXISTS listing_pages_tenant_slug_idx ON listing_pages(tenant_id, slug);
    CREATE INDEX IF NOT EXISTS listing_pages_order_idx ON listing_pages(order_id);
    CREATE INDEX IF NOT EXISTS gallery_events_gallery_idx ON gallery_events(gallery_id, kind);
    CREATE UNIQUE INDEX IF NOT EXISTS membership_invites_token_idx ON membership_invites(token);
    CREATE INDEX IF NOT EXISTS billing_events_tenant_idx ON billing_events(tenant_id);
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
}

function addColumnIfMissing(
  db: Database.Database,
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

export function getDb() {
  if (!sqlite) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    ensureSchema(sqlite);
  }

  const db = drizzle(sqlite, { schema });
  if (!seeded) {
    seeded = true;
    // Lazy import avoids circular init with tenant content.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedPlatform } = require("@/lib/platform-seed") as typeof import("@/lib/platform-seed");
    seedPlatform(db);
  }
  return db;
}

export { schema };
