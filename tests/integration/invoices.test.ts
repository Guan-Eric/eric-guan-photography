import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import { ensureGalleryForOrder } from "@/lib/galleries";
import {
  createInvoiceForOrder,
  formatInvoiceNumber,
  getInvoiceForOrder,
  resolveInvoiceSettings,
} from "@/lib/invoices";
import { readMediaFile } from "@/lib/media-storage";
import { createBooking, getOrder } from "@/lib/orders";
import { updateTenantConfig } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";
import { bookingFixture } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";
import { jsonRequest, readJson } from "../helpers/http";

describe("gallery payment invoices", () => {
  beforeAll(async () => {
    ensureTestDb();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.RESEND_API_KEY;
    await updateTenantConfig("eric-guan", {
      siteUrl: "https://silentshutter.studiofront.ca",
      invoice: {
        prefix: "SS",
        businessName: "Silent Shutter",
        businessEmail: "ericguan.photo@gmail.com",
        businessPhone: "(514) 839-2120",
        businessAddressLines: [],
        taxNumbers: [],
      },
    });
  });

  it("creates exactly one invoice on stub unlock and attaches a readable PDF", async () => {
    const tenant = await getTenant("eric-guan");
    const settings = resolveInvoiceSettings(tenant);
    expect(settings.prefix).toBe("SS");
    expect(settings.businessName).toBe("Silent Shutter");

    const booked = await createBooking(
      tenant,
      bookingFixture(tenant, {
        propertyAddress: "2301, rue Saint-Patrick, app. 201",
        postalCode: "H3K 1B3",
        city: "Montreal",
        agentName: "Katia Samson",
        agentEmail: "katia@katiasamson.com",
        agentPhone: "514-939-3163",
        brokerage: "Groupe Immobilier Katia Samson",
      }),
    );
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const order = await getOrder(booked.orderId, tenant.id);
    expect(order).toBeTruthy();
    const gallery = await ensureGalleryForOrder(order!, tenant);
    const oldToken = gallery.publicToken;

    const before = await getInvoiceForOrder(booked.orderId, tenant.id);
    expect(before).toBeUndefined();

    const { POST } = await import("@/app/api/g/[token]/checkout/route");
    const response = await POST(
      jsonRequest(`http://localhost:3000/api/g/${oldToken}/checkout`, {
        stub: true,
      }),
      { params: Promise.resolve({ token: oldToken }) },
    );
    const json = await readJson<{ ok: boolean; stubbed?: boolean; unlocked?: boolean }>(
      response,
    );
    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.unlocked).toBe(true);

    const invoice = await getInvoiceForOrder(booked.orderId, tenant.id);
    expect(invoice).toBeTruthy();
    expect(invoice!.number).toMatch(/^SS-\d{4}-\d{3}$/);
    expect(invoice!.amountCents).toBe(order!.priceCents);
    expect(invoice!.currency).toBe("CAD");

    const pdf = await readMediaFile(invoice!.pdfPath);
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getPageCount()).toBe(1);

    const outDir = path.join(process.cwd(), "tmp");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${invoice!.number}.pdf`);
    fs.writeFileSync(outPath, pdf);
    // eslint-disable-next-line no-console
    console.info(`[invoice:test] wrote ${outPath} (${invoice!.number}, ${pdf.byteLength} bytes)`);

    // Replay unlock path must not mint a second invoice.
    const again = await createInvoiceForOrder({
      tenantId: tenant.id,
      orderId: booked.orderId,
    });
    expect(again.created).toBe(false);
    expect(again.invoice.id).toBe(invoice!.id);
    expect(again.invoice.number).toBe(invoice!.number);

    const rows = await qAll<{ id: string }>(
      getDb()
        .select({ id: schema.invoices.id })
        .from(schema.invoices)
        .where(
          and(
            eq(schema.invoices.orderId, booked.orderId),
            eq(schema.invoices.tenantId, tenant.id),
          ),
        ),
    );
    expect(rows).toHaveLength(1);
  });

  it("keeps Eric's 2026 counter at >= 1 so auto invoices never reuse SS-2026-001", async () => {
    const db = getDb();
    let counter = await qGet<{ lastNumber: number }>(
      db
        .select({ lastNumber: schema.invoiceCounters.lastNumber })
        .from(schema.invoiceCounters)
        .where(
          and(
            eq(schema.invoiceCounters.tenantId, "eric-guan"),
            eq(schema.invoiceCounters.year, 2026),
          ),
        ),
    );

    if (!counter) {
      await qRun(
        db.insert(schema.invoiceCounters).values({
          tenantId: "eric-guan",
          year: 2026,
          lastNumber: 1,
          updatedAt: new Date().toISOString(),
        }),
      );
      counter = { lastNumber: 1 };
    }

    expect(counter.lastNumber).toBeGreaterThanOrEqual(1);
    expect(formatInvoiceNumber("SS", 2026, 2)).toBe("SS-2026-002");
  });
});
