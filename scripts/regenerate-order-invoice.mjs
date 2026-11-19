#!/usr/bin/env node
/**
 * Regenerate / create the gallery invoice for a paid order.
 *
 * Usage:
 *   DATABASE_URL=postgres://… node --import tsx scripts/regenerate-order-invoice.mjs ord_49R86TURCZ
 *
 * Steps:
 * 1. Ensure invoice tables exist (applies migrate SQL).
 * 2. Delete any prior invoice for the order (so numbering can be corrected).
 * 3. Ensure counter for the tenant/year is 1 when issuing SS-2026-002 after a cleanup.
 * 4. Create the invoice from live order/payment/appointment rows only.
 */
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const orderId = process.argv[2];
if (!orderId) {
  console.error("Usage: node --import tsx scripts/regenerate-order-invoice.mjs <orderId>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const migratePath = path.join(
  process.cwd(),
  "scripts/postgres-migrate-invoices.sql",
);

async function ensureTables() {
  const migrate = fs.readFileSync(migratePath, "utf8");
  // Strip the seed INSERT — we manage the counter explicitly below.
  const ddl = migrate
    .split("\n")
    .filter((line) => !/INSERT INTO invoice_counters/i.test(line))
    .filter((line) => !/ON CONFLICT \(tenant_id, year\) DO UPDATE/i.test(line))
    .filter((line) => !/SET last_number = 1/i.test(line))
    .join("\n");
  // neon http can run one statement at a time; split on semicolons carefully.
  const statements = ddl
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
  for (const statement of statements) {
    await sql(statement);
  }
}

async function main() {
  await ensureTables();

  const orders = await sql`
    SELECT id, tenant_id, status, package_name, price_cents, property_address,
           city, postal_code, agent_name, agent_email, agent_phone, brokerage,
           preferred_start, add_ons_json
    FROM orders WHERE id = ${orderId}
  `;
  if (!orders.length) {
    console.error(`Order not found: ${orderId}`);
    process.exit(2);
  }
  const order = orders[0];
  console.log("order", {
    id: order.id,
    tenantId: order.tenant_id,
    status: order.status,
    package: order.package_name,
    priceCents: order.price_cents,
    agentEmail: order.agent_email,
    address: order.property_address,
  });

  const payments = await sql`
    SELECT id, amount_cents, currency, status, created_at, updated_at
    FROM payments
    WHERE order_id = ${orderId} AND status = 'paid'
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (!payments.length) {
    console.error("No paid payment for order.");
    process.exit(3);
  }
  console.log("payment", payments[0]);

  const appts = await sql`
    SELECT starts_at FROM appointments WHERE order_id = ${orderId} LIMIT 1
  `;
  console.log("appointment", appts[0] ?? null);

  const existing = await sql`
    SELECT id, number, sequence, pdf_path FROM invoices WHERE order_id = ${orderId}
  `;
  if (existing.length) {
    console.log("deleting prior invoice(s)", existing);
    await sql`DELETE FROM invoices WHERE order_id = ${orderId}`;
  }

  const year = 2026;
  const counters = await sql`
    SELECT last_number FROM invoice_counters
    WHERE tenant_id = ${order.tenant_id} AND year = ${year}
  `;
  console.log("counter before", counters[0] ?? null);

  // After deleting a prior auto invoice, pin counter at 1 so next mint is 002.
  await sql`
    INSERT INTO invoice_counters (tenant_id, year, last_number, updated_at)
    VALUES (${order.tenant_id}, ${year}, 1, ${new Date().toISOString()})
    ON CONFLICT (tenant_id, year)
    DO UPDATE SET last_number = 1, updated_at = EXCLUDED.updated_at
  `;
  console.log("counter seeded to 1");

  // Use the app module so layout/guards stay single-sourced.
  const { createInvoiceForOrder } = await import("../lib/invoices.ts");
  const created = await createInvoiceForOrder({
    tenantId: order.tenant_id,
    orderId,
  });
  console.log("created", {
    number: created.invoice.number,
    amountCents: created.invoice.amountCents,
    pdfPath: created.invoice.pdfPath,
    created: created.created,
  });

  const out = path.join(process.cwd(), "tmp", `${created.invoice.number}.pdf`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, created.pdf);
  console.log("wrote", out);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
