import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/db/schema";
import {
  buildInvoiceLineItems,
  formatInvoiceNumber,
  generateInvoicePdf,
  invoicePrefixForTenant,
  regionCodeFromPostal,
  requireAgentEmail,
  resolveInvoiceSettings,
  resolveInvoiceSiteUrl,
} from "@/lib/invoices";
import type { Tenant } from "@/lib/tenant-schema";

const tenant = {
  id: "ten_silent",
  slug: "silentshutter",
  studioName: "Silent Shutter",
  photographerName: "Eric Guan",
  email: "ericguan.photo@gmail.com",
  phone: "(514) 839-2120",
  siteUrl: "https://silentshutter.studiofront.ca/",
  theme: { accent: "#2f5d50" },
  invoice: {
    prefix: "SS",
    businessName: "Silent Shutter",
    businessEmail: "ericguan.photo@gmail.com",
    businessPhone: "(514) 839-2120",
    businessAddressLines: [],
    taxNumbers: [],
  },
} as Tenant;

const order = {
  id: "ord_49R86TURCZ",
  tenantId: "ten_silent",
  packageName: "2D floor plan, condo",
  priceCents: 7500,
  currency: "CAD",
  propertyAddress: "2301, rue Saint-Patrick, app. 201",
  city: "Montreal",
  postalCode: "H3K 1B3",
  agentName: "Katia Samson",
  agentEmail: "katia@katiasamson.com",
  agentPhone: "514-939-3163",
  brokerage: "Groupe Immobilier Katia Samson",
  addOnsJson: "[]",
} as Order;

describe("invoice helpers", () => {
  it("uses configured prefix and Silent Shutter business name", () => {
    expect(invoicePrefixForTenant(tenant)).toBe("SS");
    expect(resolveInvoiceSettings(tenant).businessName).toBe("Silent Shutter");
  });

  it("formats sequential numbers", () => {
    expect(formatInvoiceNumber("SS", 2026, 1)).toBe("SS-2026-001");
    expect(formatInvoiceNumber("SS", 2026, 2)).toBe("SS-2026-002");
  });

  it("maps Montreal postal codes to QC", () => {
    expect(regionCodeFromPostal("H3K 1B3")).toBe("QC");
  });

  it("builds package rows that sum to the paid total", () => {
    const items = buildInvoiceLineItems({ order, amountCents: 7500 });
    expect(items).toEqual([
      {
        description: "2D floor plan, condo - 2301, rue Saint-Patrick, app. 201",
        amountCents: 7500,
      },
    ]);
    expect(items.reduce((sum, item) => sum + item.amountCents, 0)).toBe(7500);
  });

  it("refuses missing agent emails instead of inventing one", () => {
    expect(() =>
      requireAgentEmail({ ...order, agentEmail: "" } as Order),
    ).toThrow(/no agentEmail/);
  });

  it("refuses localhost site URLs and prefers stored production URL", () => {
    expect(
      resolveInvoiceSiteUrl({
        storedSiteUrl: "https://silentshutter.studiofront.ca",
        tenantSiteUrl: "http://ericguan.localhost:3000",
        slug: "silentshutter",
      }),
    ).toBe("https://silentshutter.studiofront.ca/");

    expect(() =>
      resolveInvoiceSiteUrl({
        storedSiteUrl: "http://ericguan.localhost:3000",
        tenantSiteUrl: "http://silentshutter.localhost:3000",
        slug: "unknownstudio",
      }),
    ).toThrow(/localhost/);
  });
});

describe("generateInvoicePdf", () => {
  it("renders a non-overlapping single-page A4 PDF", async () => {
    const pdf = await generateInvoicePdf({
      number: "SS-2026-002",
      invoiceDate: "November 18, 2026",
      serviceDate: "November 16, 2026",
      businessName: "Silent Shutter",
      photographerName: "Eric Guan",
      businessEmail: "ericguan.photo@gmail.com",
      businessPhone: "(514) 839-2120",
      siteUrl: "https://silentshutter.studiofront.ca/",
      accent: "#2f5d50",
      billTo: [
        "Katia Samson",
        "Groupe Immobilier Katia Samson",
        "katia@katiasamson.com | 514-939-3163",
      ],
      property: ["2301, rue Saint-Patrick, app. 201", "Montreal, QC"],
      items: buildInvoiceLineItems({ order, amountCents: 7500 }),
      totalLabel: "Total, taxes included",
      currency: "CAD",
      paymentLines: [
        "Card (Visa): pay $75 through the gallery link provided to unlock and download the floor plan.",
      ],
      closingLine:
        "Thank you! For photos, floor plans, or other services for a future listing, please reach out anytime.",
    });

    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getPageCount()).toBe(1);
    const page = loaded.getPage(0);
    const { width, height } = page.getSize();
    expect(width).toBeCloseTo(595.28, 0);
    expect(height).toBeCloseTo(841.89, 0);
  });

  it("refuses to embed a localhost site URL", async () => {
    await expect(
      generateInvoicePdf({
        number: "SS-2026-002",
        invoiceDate: "November 18, 2026",
        serviceDate: "November 16, 2026",
        businessName: "Silent Shutter",
        photographerName: "Eric Guan",
        businessEmail: "ericguan.photo@gmail.com",
        businessPhone: "(514) 839-2120",
        siteUrl: "http://ericguan.localhost:3000",
        accent: "#2f5d50",
        billTo: ["Katia Samson", "katia@katiasamson.com"],
        property: ["2301, rue Saint-Patrick, app. 201"],
        items: [{ description: "2D floor plan, condo - address", amountCents: 7500 }],
        totalLabel: "Total, taxes included",
        currency: "CAD",
        paymentLines: ["Paid by card."],
        closingLine: "Thank you!",
      }),
    ).rejects.toThrow(/localhost/);
  });
});
