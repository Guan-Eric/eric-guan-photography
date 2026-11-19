/**
 * Apply gallery invoice tables + counter seeds on Neon (idempotent).
 *
 *   node scripts/apply-invoices-migration.mjs
 *
 * After DDL + static Silent Shutter seeds, also seeds last_number=1 (DO NOTHING)
 * for every distinct tenant_id present in orders, so live tenants are covered.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const COUNTER_YEAR = 2026;

function loadEnv(filename) {
  const full = path.join(root, filename);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const file = path.join(root, "scripts", "postgres-migrate-invoices.sql");
const source = fs.readFileSync(file, "utf8");

const statements = source
  .split(/;\s*(?:\r?\n|$)/)
  .map((chunk) =>
    chunk
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

const sql = neon(process.env.DATABASE_URL);
const host = new URL(process.env.DATABASE_URL).host;
console.log(`Applying invoice migration against ${host}`);

for (const [index, statement] of statements.entries()) {
  try {
    await sql.query(statement);
  } catch (error) {
    console.error(`FAILED statement ${index + 1}:\n${statement}\n`, error);
    process.exit(1);
  }
}

const orderTenants = await sql`
  SELECT DISTINCT tenant_id
  FROM orders
  ORDER BY tenant_id
`;

const updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
for (const row of orderTenants) {
  await sql`
    INSERT INTO invoice_counters (tenant_id, year, last_number, updated_at)
    VALUES (${row.tenant_id}, ${COUNTER_YEAR}, 1, ${updatedAt})
    ON CONFLICT (tenant_id, year) DO NOTHING
  `;
}

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('invoices', 'invoice_counters')
  ORDER BY table_name
`;

const counters = await sql`
  SELECT tenant_id, year, last_number
  FROM invoice_counters
  WHERE year = ${COUNTER_YEAR}
  ORDER BY tenant_id
`;

const counterIds = new Set(counters.map((row) => row.tenant_id));
const missingOrderTenants = orderTenants
  .map((row) => row.tenant_id)
  .filter((id) => !counterIds.has(id));

const requiredSeeds = ["eric-guan", "ten_x0wnara5wf", "ten_3lj41dmg09"];
const missingRequired = requiredSeeds.filter((id) => !counterIds.has(id));

console.log(
  `MIGRATION_OK ${statements.length} statements; tables: ${tables
    .map((row) => row.table_name)
    .join(", ")}`,
);
console.log(
  "invoice_counters:",
  counters.map((row) => `${row.tenant_id}@${row.year}=${row.last_number}`),
);
console.log(
  `order tenant ids covered: ${orderTenants.length - missingOrderTenants.length}/${orderTenants.length}`,
);

if (missingOrderTenants.length || missingRequired.length) {
  console.error("SEED_GAP", { missingOrderTenants, missingRequired });
  process.exit(2);
}

console.log("SEED_OK all order tenant ids and required Silent Shutter ids have counters");
