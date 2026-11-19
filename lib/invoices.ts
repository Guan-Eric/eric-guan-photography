import { and, eq, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { SelectedAddOn } from "@/lib/addons";
import { getDb, qGet, qRun, schema } from "@/lib/db";
import type { Invoice, Order, Payment } from "@/lib/db/schema";
import { suggestComplianceRegion } from "@/lib/listing-compliance";
import { readMediaFile, writeMediaFile } from "@/lib/media-storage";
import { sendEmail } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { parseTenantConfig, getTenantRow } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";
import type { Tenant } from "@/lib/tenant-schema";

const invoiceId = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 12);
const DEFAULT_ACCENT = "#2f5d50";
const MM = 72 / 25.4;
const PAGE_WIDTH = 210 * MM; // A4
const PAGE_HEIGHT = 297 * MM;
const MARGIN_X = 20 * MM;
const MARGIN_TOP = 18 * MM;
const LINE_HEIGHT_FACTOR = 1.4;

export type InvoiceLineItem = {
  description: string;
  amountCents: number;
};

export type InvoicePdfData = {
  number: string;
  invoiceDate: string;
  serviceDate: string;
  businessName: string;
  photographerName: string;
  businessEmail: string;
  businessPhone: string | null;
  businessAddressLines?: string[];
  siteUrl: string;
  accent: string;
  billTo: string[];
  property: string[];
  items: InvoiceLineItem[];
  totalLabel: string;
  currency: string;
  paymentLines: string[];
  closingLine: string;
};

function nowIso() {
  return new Date().toISOString();
}

function parseHexColor(hex: string) {
  const raw = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
    return rgb(47 / 255, 93 / 255, 80 / 255);
  }
  return rgb(
    Number.parseInt(raw.slice(0, 2), 16) / 255,
    Number.parseInt(raw.slice(2, 4), 16) / 255,
    Number.parseInt(raw.slice(4, 6), 16) / 255,
  );
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function moneyPlain(cents: number) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : money(cents);
}

function lineHeightFor(size: number) {
  return size * LINE_HEIGHT_FACTOR;
}

function formatLongDate(isoOrDate: string, timeZone: string) {
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return isoOrDate;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }
}

function yearInTimeZone(iso: string, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
    }).formatToParts(new Date(iso));
    const year = parts.find((part) => part.type === "year")?.value;
    return year ? Number(year) : new Date(iso).getFullYear();
  } catch {
    return new Date(iso).getFullYear();
  }
}

export function invoicePrefixForTenant(tenant: Tenant) {
  const configured = tenant.invoice?.prefix?.trim();
  if (configured) return configured.toUpperCase().slice(0, 8);
  const fromSlug = tenant.slug.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (fromSlug === "SILENTSHUTTER" || fromSlug.startsWith("ERIC")) return "SS";
  return fromSlug.slice(0, 4) || "INV";
}

export function resolveInvoiceSettings(tenant: Tenant) {
  const invoice = tenant.invoice ?? {};
  return {
    prefix: invoicePrefixForTenant(tenant),
    businessName: invoice.businessName?.trim() || tenant.studioName,
    businessAddressLines: invoice.businessAddressLines ?? [],
    businessPhone: invoice.businessPhone ?? tenant.phone,
    businessEmail: invoice.businessEmail?.trim() || tenant.email,
    taxNumbers: invoice.taxNumbers ?? [],
  };
}

/** Invoice PDFs must never show a localhost URL. */
export function resolveInvoiceSiteUrl(options: {
  storedSiteUrl?: string | null;
  tenantSiteUrl?: string | null;
  slug: string;
}) {
  const candidates = [
    options.storedSiteUrl?.trim(),
    options.tenantSiteUrl?.trim(),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (!/localhost/i.test(candidate)) {
      return candidate.endsWith("/") ? candidate : `${candidate}/`;
    }
  }

  const root = (process.env.PLATFORM_ROOT_DOMAIN ?? "").trim().toLowerCase();
  if (root && root !== "localhost" && !root.includes("localhost")) {
    return `https://${options.slug}.${root}/`;
  }

  // Known production studiofront hosts when local rewrite hid the stored URL.
  if (options.slug === "silentshutter" || options.slug === "ericguan") {
    return "https://silentshutter.studiofront.ca/";
  }

  throw new Error(
    `Refuse to generate invoice: site URL contains localhost or is missing (slug=${options.slug}).`,
  );
}

export function requireAgentEmail(order: Order) {
  const email = order.agentEmail?.trim();
  if (!email) {
    throw new Error(
      `Refuse to generate invoice: order ${order.id} has no agentEmail.`,
    );
  }
  return email;
}

export function formatInvoiceNumber(prefix: string, year: number, sequence: number) {
  return `${prefix}-${year}-${String(sequence).padStart(3, "0")}`;
}

export function regionCodeFromPostal(postalCode: string | null | undefined) {
  const region = suggestComplianceRegion(postalCode);
  if (region === "ca_qc") return "QC";
  if (region === "us_ca") return "CA";
  const raw = (postalCode ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return null;
  const letter = raw[0];
  const canadian: Record<string, string> = {
    A: "NL",
    B: "NS",
    C: "PE",
    E: "NB",
    G: "QC",
    H: "QC",
    J: "QC",
    K: "ON",
    L: "ON",
    M: "ON",
    N: "ON",
    P: "ON",
    R: "MB",
    S: "SK",
    T: "AB",
    V: "BC",
    X: "NT",
    Y: "YT",
  };
  return canadian[letter] ?? null;
}

export function parseOrderAddOns(order: Order): SelectedAddOn[] {
  try {
    const parsed = JSON.parse(order.addOnsJson || "[]") as SelectedAddOn[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function buildInvoiceLineItems(options: {
  order: Order;
  amountCents: number;
}): InvoiceLineItem[] {
  const addOns = parseOrderAddOns(options.order);
  const addOnTotal = addOns.reduce((sum, item) => sum + (item.priceCents || 0), 0);
  const packageCents = Math.max(0, options.amountCents - addOnTotal);
  const address = options.order.propertyAddress;

  const items: InvoiceLineItem[] = [
    {
      description:
        packageCents === 0
          ? `${options.order.packageName} - free, as agreed`
          : `${options.order.packageName} - ${address}`,
      amountCents: packageCents,
    },
  ];

  for (const addOn of addOns) {
    const amount = addOn.priceCents || 0;
    items.push({
      description:
        amount === 0
          ? `${addOn.name} - free, as agreed`
          : `${addOn.name} - ${address}`,
      amountCents: amount,
    });
  }

  const sum = items.reduce((total, item) => total + item.amountCents, 0);
  if (sum !== options.amountCents) {
    console.warn("[invoice] line items do not sum to payment amount", {
      orderId: options.order.id,
      sum,
      amountCents: options.amountCents,
    });
    if (items.length > 0) {
      const delta = options.amountCents - sum;
      const nextAmount = Math.max(0, items[0].amountCents + delta);
      items[0] = {
        ...items[0],
        amountCents: nextAmount,
        description:
          nextAmount === 0
            ? `${options.order.packageName} - free, as agreed`
            : `${options.order.packageName} - ${address}`,
      };
    }
  }

  return items;
}

function paymentWhatLabel(packageName: string) {
  const lower = packageName.trim().toLowerCase();
  if (/floor\s*plan/.test(lower)) return "the floor plan";
  if (/photo/.test(lower)) return "the photos";
  return packageName;
}

function titleCaseBrand(brand: string) {
  const cleaned = brand.trim();
  if (!cleaned) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

async function resolveCardBrand(payment: Payment | null | undefined) {
  if (!payment?.providerSessionId || payment.provider !== "stripe") return null;
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    const session = await stripe.checkout.sessions.retrieve(payment.providerSessionId, {
      expand: ["payment_intent.payment_method"],
    });
    const pi = session.payment_intent;
    if (!pi || typeof pi === "string") return null;
    const method = pi.payment_method;
    if (!method || typeof method === "string") return null;
    const brand = method.card?.brand;
    return brand ? titleCaseBrand(brand) : null;
  } catch {
    return null;
  }
}

export async function getInvoiceForOrder(orderId: string, tenantId?: string) {
  const db = getDb();
  const conditions = tenantId
    ? and(eq(schema.invoices.orderId, orderId), eq(schema.invoices.tenantId, tenantId))
    : eq(schema.invoices.orderId, orderId);
  return qGet<Invoice>(db.select().from(schema.invoices).where(conditions));
}

async function getPaidPaymentForOrder(orderId: string, tenantId: string) {
  const db = getDb();
  return qGet<Payment>(
    db
      .select()
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.orderId, orderId),
          eq(schema.payments.tenantId, tenantId),
          eq(schema.payments.status, "paid"),
        ),
      ),
  );
}

async function getServiceDateIso(order: Order) {
  const db = getDb();
  const appointment = await qGet<{ startsAt: string }>(
    db
      .select({ startsAt: schema.appointments.startsAt })
      .from(schema.appointments)
      .where(eq(schema.appointments.orderId, order.id)),
  );
  return appointment?.startsAt ?? order.preferredStart;
}

async function reserveInvoiceSequence(tenantId: string, year: number) {
  const db = getDb();
  const updatedAt = nowIso();

  await qRun(
    db
      .insert(schema.invoiceCounters)
      .values({
        tenantId,
        year,
        lastNumber: 1,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [schema.invoiceCounters.tenantId, schema.invoiceCounters.year],
        set: {
          lastNumber: sql`${schema.invoiceCounters.lastNumber} + 1`,
          updatedAt,
        },
      }),
  );

  const row = await qGet<{ lastNumber: number }>(
    db
      .select({ lastNumber: schema.invoiceCounters.lastNumber })
      .from(schema.invoiceCounters)
      .where(
        and(
          eq(schema.invoiceCounters.tenantId, tenantId),
          eq(schema.invoiceCounters.year, year),
        ),
      ),
  );
  if (!row?.lastNumber) {
    throw new Error("Failed to reserve invoice number.");
  }
  return row.lastNumber;
}

async function reclaimInvoiceSequence(
  tenantId: string,
  year: number,
  sequence: number,
) {
  const db = getDb();
  const row = await qGet<{ lastNumber: number }>(
    db
      .select({ lastNumber: schema.invoiceCounters.lastNumber })
      .from(schema.invoiceCounters)
      .where(
        and(
          eq(schema.invoiceCounters.tenantId, tenantId),
          eq(schema.invoiceCounters.year, year),
        ),
      ),
  );
  if (!row || row.lastNumber !== sequence) return;
  await qRun(
    db
      .update(schema.invoiceCounters)
      .set({ lastNumber: Math.max(0, sequence - 1), updatedAt: nowIso() })
      .where(
        and(
          eq(schema.invoiceCounters.tenantId, tenantId),
          eq(schema.invoiceCounters.year, year),
          eq(schema.invoiceCounters.lastNumber, sequence),
        ),
      ),
  );
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Cursor-based PDF layout. pdf-lib drawText uses absolute baselines and does
 * not advance — every call must subtract a full line height first.
 */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  if (/localhost/i.test(data.siteUrl)) {
    throw new Error("Refuse to generate invoice PDF with a localhost site URL.");
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = parseHexColor(data.accent || DEFAULT_ACCENT);
  const dark = rgb(34 / 255, 34 / 255, 34 / 255);
  const grey = rgb(102 / 255, 102 / 255, 102 / 255);
  const rule = rgb(221 / 255, 221 / 255, 221 / 255);
  const white = rgb(1, 1, 1);

  // Baseline cursor: start at top content edge, then always subtract before draw.
  let y = PAGE_HEIGHT - MARGIN_TOP;
  const contentWidth = PAGE_WIDTH - MARGIN_X * 2;

  const drawLine = (
    text: string,
    options: {
      x?: number;
      size: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
      align?: "left" | "right";
      width?: number;
    },
  ) => {
    const usedFont = options.font ?? font;
    const size = options.size;
    const height = lineHeightFor(size);
    const color = options.color ?? dark;
    const xLeft = options.x ?? MARGIN_X;
    const maxWidth = options.maxWidth ?? contentWidth;
    const lines = wrapText(text, usedFont, size, maxWidth);

    for (const line of lines) {
      y -= height;
      let x = xLeft;
      if (options.align === "right") {
        const width = options.width ?? maxWidth;
        x = xLeft + width - usedFont.widthOfTextAtSize(line, size);
      }
      page.drawText(line, { x, y, size, font: usedFont, color });
    }
    return lines.length * height;
  };

  const gap = (points: number) => {
    y -= points;
  };

  // Header
  drawLine(data.businessName.toUpperCase(), {
    size: 24,
    font: bold,
    color: accent,
  });
  drawLine(`Real Estate Photography  |  ${data.photographerName}`, {
    size: 10,
  });
  for (const line of data.businessAddressLines ?? []) {
    if (line.trim()) drawLine(line.trim(), { size: 10 });
  }
  const contact = data.businessPhone
    ? `${data.businessEmail}  |  ${data.businessPhone}`
    : data.businessEmail;
  drawLine(contact, { size: 10 });
  drawLine(data.siteUrl, { size: 10 });
  gap(10);

  // Title
  drawLine(`Invoice ${data.number}`, {
    size: 16,
    font: bold,
    color: accent,
  });
  drawLine(
    `Invoice date: ${data.invoiceDate}    Service date: ${data.serviceDate}`,
    { size: 11 },
  );
  gap(14);

  // Bill to / Property — two independent cursors, then resume from the lower one.
  const colWidth = 85 * MM;
  const colGap = 8 * MM;
  const headingSize = 11;
  const bodySize = 11;
  const headingHeight = lineHeightFor(headingSize);
  const bodyHeight = lineHeightFor(bodySize);

  y -= headingHeight;
  const headingBaseline = y;
  page.drawText("Bill to", {
    x: MARGIN_X,
    y: headingBaseline,
    size: headingSize,
    font: bold,
    color: accent,
  });
  page.drawText("Property", {
    x: MARGIN_X + colWidth + colGap,
    y: headingBaseline,
    size: headingSize,
    font: bold,
    color: accent,
  });

  const drawColumn = (lines: string[], x: number) => {
    let cursor = headingBaseline;
    for (const raw of lines) {
      for (const wrapped of wrapText(raw, font, bodySize, colWidth)) {
        cursor -= bodyHeight;
        page.drawText(wrapped, {
          x,
          y: cursor,
          size: bodySize,
          font,
          color: dark,
        });
      }
    }
    return cursor;
  };

  const billBottom = drawColumn(data.billTo, MARGIN_X);
  const propBottom = drawColumn(data.property, MARGIN_X + colWidth + colGap);
  y = Math.min(billBottom, propBottom);
  gap(14);

  // Items table
  const descWidth = 130 * MM;
  const amountWidth = 40 * MM;
  const tableFontSize = 11;
  const tableRowHeight = lineHeightFor(tableFontSize);
  const tablePadX = 4;

  const drawTableRow = (
    description: string,
    amount: string,
    options: { header?: boolean; boldTotal?: boolean },
  ) => {
    y -= tableRowHeight;
    const usedFont = options.header || options.boldTotal ? bold : font;
    const textColor = options.header ? white : dark;

    if (options.header) {
      page.drawRectangle({
        x: MARGIN_X,
        y,
        width: descWidth + amountWidth,
        height: tableRowHeight,
        color: accent,
      });
    }

    // Vertically center text inside the row band.
    const textY = y + (tableRowHeight - tableFontSize) / 2;
    page.drawText(description, {
      x: MARGIN_X + tablePadX,
      y: textY,
      size: tableFontSize,
      font: usedFont,
      color: textColor,
    });

    const amountWidthPx = usedFont.widthOfTextAtSize(amount, tableFontSize);
    page.drawText(amount, {
      x: MARGIN_X + descWidth + amountWidth - amountWidthPx - tablePadX,
      y: textY,
      size: tableFontSize,
      font: usedFont,
      color: textColor,
    });

    if (!options.header && !options.boldTotal) {
      page.drawLine({
        start: { x: MARGIN_X, y },
        end: { x: MARGIN_X + descWidth + amountWidth, y },
        thickness: 0.5,
        color: rule,
      });
    }
  };

  drawTableRow("Description", `Amount (${data.currency.toUpperCase()})`, {
    header: true,
  });

  for (const item of data.items) {
    // Wrap long descriptions into extra rows without overlapping amounts.
    const descLines = wrapText(
      item.description,
      font,
      tableFontSize,
      descWidth - tablePadX * 2,
    );
    descLines.forEach((line, index) => {
      drawTableRow(line, index === 0 ? money(item.amountCents) : "", {});
    });
  }

  const totalCents = data.items.reduce((sum, item) => sum + item.amountCents, 0);
  const totalSize = 12;
  const totalHeight = lineHeightFor(totalSize);
  y -= totalHeight;
  const totalTextY = y + (totalHeight - totalSize) / 2;
  page.drawText(data.totalLabel, {
    x: MARGIN_X + tablePadX,
    y: totalTextY,
    size: totalSize,
    font: bold,
    color: dark,
  });
  const totalText = money(totalCents);
  const totalWidth = bold.widthOfTextAtSize(totalText, totalSize);
  page.drawText(totalText, {
    x: MARGIN_X + descWidth + amountWidth - totalWidth - tablePadX,
    y: totalTextY,
    size: totalSize,
    font: bold,
    color: dark,
  });
  gap(16);

  // Payment
  drawLine("Payment", { size: 13, font: bold, color: accent });
  for (const line of data.paymentLines) {
    drawLine(line, { size: 11 });
  }
  gap(12);

  drawLine(data.closingLine, { size: 10, color: grey });
  gap(16);

  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_WIDTH - MARGIN_X, y },
    thickness: 0.5,
    color: rule,
  });
  gap(6);
  const footerPhone = data.businessPhone ? `  |  ${data.businessPhone}` : "";
  drawLine(
    `${data.businessName} - ${data.photographerName}  |  ${data.businessEmail}${footerPhone}`,
    { size: 10, color: grey },
  );

  return Buffer.from(await pdf.save());
}

export async function buildInvoicePdfData(options: {
  tenant: Tenant;
  order: Order;
  payment: Payment;
  number: string;
  siteUrl: string;
  cardBrand?: string | null;
  timeZone?: string;
}): Promise<InvoicePdfData> {
  const agentEmail = requireAgentEmail(options.order);
  if (/localhost/i.test(options.siteUrl)) {
    throw new Error("Refuse to generate invoice: site URL contains localhost.");
  }

  const settings = resolveInvoiceSettings(options.tenant);
  const row = await getTenantRow(options.tenant.id);
  const timeZone = options.timeZone ?? row?.timezone ?? "America/Toronto";
  const invoiceDateIso = options.payment.updatedAt || options.payment.createdAt || nowIso();
  const serviceIso = await getServiceDateIso(options.order);
  const region = regionCodeFromPostal(options.order.postalCode);
  const cityLine = [options.order.city, region].filter(Boolean).join(", ");

  const contactLine = [agentEmail, options.order.agentPhone?.trim() || null]
    .filter(Boolean)
    .join(" | ");

  const billTo = [
    options.order.agentName,
    options.order.brokerage || null,
    contactLine || null,
  ].filter(Boolean) as string[];

  const property = [options.order.propertyAddress, cityLine || null].filter(
    Boolean,
  ) as string[];

  const items = buildInvoiceLineItems({
    order: options.order,
    amountCents: options.payment.amountCents,
  });

  const brand = options.cardBrand?.trim() || null;
  const amountLabel = moneyPlain(options.payment.amountCents);
  const what = paymentWhatLabel(options.order.packageName);
  const paymentLines = brand
    ? [
        `Card (${brand}): pay ${amountLabel} through the gallery link provided to unlock and download ${what}.`,
      ]
    : [
        `Paid by card through the gallery link on ${formatLongDate(invoiceDateIso, timeZone)}.`,
      ];

  return {
    number: options.number,
    invoiceDate: formatLongDate(invoiceDateIso, timeZone),
    serviceDate: formatLongDate(serviceIso, timeZone),
    businessName: settings.businessName,
    photographerName: options.tenant.photographerName,
    businessEmail: settings.businessEmail,
    businessPhone: settings.businessPhone,
    businessAddressLines: settings.businessAddressLines.filter((line) => line.trim()),
    siteUrl: options.siteUrl,
    accent: options.tenant.theme?.accent || DEFAULT_ACCENT,
    billTo,
    property,
    items,
    totalLabel:
      settings.taxNumbers.length > 0 ? "Total" : "Total, taxes included",
    currency: options.payment.currency || options.order.currency || "CAD",
    paymentLines,
    closingLine:
      "Thank you! For photos, floor plans, or other services for a future listing, please reach out anytime.",
  };
}

export async function createInvoiceForOrder(options: {
  tenantId: string;
  orderId: string;
}): Promise<{ invoice: Invoice; pdf: Buffer; created: boolean }> {
  const existing = await getInvoiceForOrder(options.orderId, options.tenantId);
  if (existing) {
    const pdf = await readMediaFile(existing.pdfPath);
    return { invoice: existing, pdf, created: false };
  }

  const tenant = await getTenant(options.tenantId);
  const db = getDb();
  const order = await qGet<Order>(
    db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.id, options.orderId),
          eq(schema.orders.tenantId, options.tenantId),
        ),
      ),
  );
  if (!order) throw new Error(`Order not found: ${options.orderId}`);
  requireAgentEmail(order);

  const payment = await getPaidPaymentForOrder(options.orderId, options.tenantId);
  if (!payment) {
    throw new Error(`No paid payment found for order ${options.orderId}.`);
  }

  const row = await getTenantRow(options.tenantId);
  if (!row) throw new Error(`Tenant not found: ${options.tenantId}`);
  const storedConfig = parseTenantConfig(row);
  const siteUrl = resolveInvoiceSiteUrl({
    storedSiteUrl: storedConfig.siteUrl,
    tenantSiteUrl: tenant.siteUrl,
    slug: row.slug,
  });

  const timeZone = row.timezone ?? "America/Toronto";
  const invoiceDateIso = payment.updatedAt || payment.createdAt || nowIso();
  const year = yearInTimeZone(invoiceDateIso, timeZone);
  const settings = resolveInvoiceSettings({
    ...tenant,
    ...storedConfig,
    id: tenant.id,
    slug: row.slug,
    siteUrl,
  });
  const sequence = await reserveInvoiceSequence(options.tenantId, year);
  const number = formatInvoiceNumber(settings.prefix, year, sequence);
  const pdfPath = `invoices/${options.tenantId}/${number}.pdf`;

  try {
    const cardBrand = await resolveCardBrand(payment);
    const data = await buildInvoicePdfData({
      tenant: {
        ...tenant,
        ...storedConfig,
        id: tenant.id,
        slug: row.slug,
        siteUrl,
        invoice: {
          ...storedConfig.invoice,
          ...tenant.invoice,
          prefix: settings.prefix,
          businessName: settings.businessName,
          businessEmail: settings.businessEmail,
          businessPhone: settings.businessPhone,
          businessAddressLines: settings.businessAddressLines,
          taxNumbers: settings.taxNumbers,
        },
      },
      order,
      payment,
      number,
      siteUrl,
      cardBrand,
      timeZone,
    });
    const pdf = await generateInvoicePdf(data);
    await writeMediaFile(pdfPath, pdf, "application/pdf");

    const createdAt = nowIso();
    const invoice: Invoice = {
      id: `inv_${invoiceId()}`,
      tenantId: options.tenantId,
      orderId: options.orderId,
      paymentId: payment.id,
      number,
      year,
      sequence,
      amountCents: payment.amountCents,
      currency: payment.currency || order.currency || "CAD",
      pdfPath,
      createdAt,
      updatedAt: createdAt,
    };

    try {
      await qRun(db.insert(schema.invoices).values(invoice));
    } catch (error) {
      const raced = await getInvoiceForOrder(options.orderId, options.tenantId);
      if (raced) {
        await reclaimInvoiceSequence(options.tenantId, year, sequence);
        const racedPdf = await readMediaFile(raced.pdfPath);
        return { invoice: raced, pdf: racedPdf, created: false };
      }
      throw error;
    }

    return { invoice, pdf, created: true };
  } catch (error) {
    await reclaimInvoiceSequence(options.tenantId, year, sequence);
    throw error;
  }
}

export async function resendInvoice(options: {
  tenantId: string;
  orderId: string;
}) {
  const created = await createInvoiceForOrder(options);
  const tenant = await getTenant(options.tenantId);
  const db = getDb();
  const order = await qGet<Order>(
    db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.id, options.orderId),
          eq(schema.orders.tenantId, options.tenantId),
        ),
      ),
  );
  if (!order) return { ok: false as const, error: "Order not found." };
  const agentEmail = requireAgentEmail(order);

  const filename = `Invoice-${created.invoice.number}.pdf`;
  const result = await sendEmail({
    to: agentEmail,
    subject: `Invoice ${created.invoice.number} — ${order.propertyAddress}`,
    text: [
      `Hi ${order.agentName.split(/\s+/)[0] || "there"},`,
      "",
      `Your invoice ${created.invoice.number} for ${order.propertyAddress} is attached.`,
      "",
      `— ${tenant.photographerName}`,
      tenant.email,
    ].join("\n"),
    replyTo: tenant.email,
    attachments: [
      {
        filename,
        content: created.pdf.toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });

  if (!result.ok) {
    return { ok: false as const, error: result.error, invoice: created.invoice };
  }
  return { ok: true as const, invoice: created.invoice, stubbed: result.stubbed };
}

export function invoiceAttachment(invoice: Invoice, pdf: Buffer) {
  return {
    filename: `Invoice-${invoice.number}.pdf`,
    content: pdf.toString("base64"),
    contentType: "application/pdf",
  };
}
