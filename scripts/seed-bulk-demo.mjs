/**
 * Dev-only bulk seed for admin UX walkthroughs.
 *
 * Usage:
 *   npx tsx scripts/seed-bulk-demo.mjs <studio-slug>
 */
import fs from "node:fs";
import { customAlphabet } from "nanoid";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  if (!(m[1] in process.env)) process.env[m[1]] = m[2];
}

const { getDb, qRun, schema } = await import("../lib/db/index.ts");
const {
  getTenantRowBySlug,
  updateTenantConfig,
  parseTenantConfig,
} = await import("../lib/tenant-store.ts");

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npx tsx scripts/seed-bulk-demo.mjs <studio-slug>");
    process.exit(1);
  }

  const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);
  const row = await getTenantRowBySlug(slug);
  if (!row) {
    console.error(`No studio with slug "${slug}".`);
    process.exit(1);
  }
  const tenantId = row.id;
  const config = parseTenantConfig(row);
  const now = new Date().toISOString();
  const end = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const gallery = Array.from({ length: 40 }, (_, i) => ({
    src: `https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=60&sig=${i}`,
    alt: `Portfolio sample ${i + 1}`,
    width: 1200,
    height: 800,
    room: i % 3 === 0 ? "Exterior" : i % 3 === 1 ? "Kitchen" : "Living",
    note: "Seeded sample",
    wide: i % 5 === 0,
  }));
  await updateTenantConfig(tenantId, { gallery });

  const db = getDb();
  const pkg =
    config.packages.find((p) => !p.upsell) ??
    config.packages[0] ?? {
      id: "standard",
      name: "Standard listing",
      durationMinutes: 60,
      priceCents: 19900,
    };
  const priceCents =
    typeof pkg.priceCents === "number" && Number.isFinite(pkg.priceCents)
      ? pkg.priceCents
      : 19900;
  const durationMinutes =
    typeof pkg.durationMinutes === "number" && Number.isFinite(pkg.durationMinutes)
      ? pkg.durationMinutes
      : 60;

  for (let i = 0; i < 50; i += 1) {
    const orderId = `ord_seed_${id()}`;
    const status =
      i % 7 === 0 ? "paid" : i % 5 === 0 ? "delivered" : "confirmed";
    await qRun(
      db.insert(schema.orders).values({
        id: orderId,
        tenantId,
        status,
        packageId: pkg.id,
        packageName: pkg.name,
        priceCents,
        currency: config.seo?.currency ?? "CAD",
        durationMinutes,
        squareFootage: 1500 + i * 10,
        propertyAddress: `${100 + i} Seed Street, Montréal QC`,
        postalCode: "H2X 1Y4",
        city: "Montréal",
        preferredStart: now,
        preferredEnd: end,
        agentName: `Agent ${i + 1}`,
        agentEmail: `agent${i + 1}@example.com`,
        agentPhone: "514-555-0100",
        brokerage: "Seed Brokerage",
        occupancy: "vacant",
        accessType: "lockbox",
        publicToken: `tok_seed_${id()}`,
        createdAt: now,
        updatedAt: now,
      }),
    );

    if (i < 5) {
      await qRun(
        db.insert(schema.listingPages).values({
          id: `lp_seed_${id()}`,
          tenantId,
          orderId,
          galleryId: null,
          slug: `seed-street-${100 + i}-${id()}`,
          brandMode: "branded",
          title: `${100 + i} Seed Street`,
          propertyAddress: `${100 + i} Seed Street, Montréal QC`,
          agentName: `Agent ${i + 1}`,
          agentEmail: `agent${i + 1}@example.com`,
          agentPhone: null,
          brokerage: i === 0 ? null : "Seed Brokerage",
          brokeragePhone: i === 0 ? null : "514-555-0100",
          complianceRegion: "ca_qc",
          advertisingEndsAt: new Date(
            Date.now() + 86400000 * 365,
          ).toISOString(),
          publishedAt: null,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
  }

  console.log(
    `Seeded studio ${slug}: 40 portfolio images, 50 orders, 5 draft listings.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
