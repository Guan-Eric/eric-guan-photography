import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { entitlements } from "@/lib/billing";
import type { MediaAsset, Order } from "@/lib/db/schema";
import { readMediaFile } from "@/lib/media-storage";
import { getTenantRow } from "@/lib/tenant-store";
import type { Tenant } from "@/lib/tenant-schema";

export const SHARE_PRESETS = {
  ig: { width: 1080, height: 1080, label: "Instagram feed" },
  story: { width: 1080, height: 1920, label: "Instagram story" },
  fb: { width: 1200, height: 630, label: "Facebook / OG" },
} as const;

export type SharePreset = keyof typeof SHARE_PRESETS;

export function assertShareKit(tenantId: string) {
  const row = getTenantRow(tenantId);
  if (!row) return { ok: false as const, error: "Studio not found." };
  if (!entitlements(row.plan).shareKit) {
    return { ok: false as const, error: "Share kit is on the Studio plan." };
  }
  return { ok: true as const, row };
}

export function shareCaptions(options: {
  tenant: Tenant;
  order: Order;
  listingUrl?: string | null;
  galleryUrl?: string;
}) {
  const lines = [
    `Just delivered: ${options.order.propertyAddress}.`,
    `${options.tenant.turnaround} turnaround · MLS-ready photos from ${options.tenant.studioName}.`,
    options.listingUrl ? `Listing page: ${options.listingUrl}` : null,
    options.galleryUrl ? `Gallery: ${options.galleryUrl}` : null,
  ].filter(Boolean);
  return {
    caption: lines.join(" "),
    short: `${options.order.propertyAddress} — photos by ${options.tenant.photographerName}.`,
  };
}

export async function cropShareImage(asset: MediaAsset, preset: SharePreset) {
  const size = SHARE_PRESETS[preset];
  const buffer = await readMediaFile(asset.pathWeb);
  return sharp(buffer)
    .rotate()
    .resize(size.width, size.height, { fit: "cover", position: "attention" })
    .jpeg({ quality: 86 })
    .toBuffer();
}

export async function buildFlyerPdf(options: {
  tenant: Tenant;
  order: Order;
  asset?: MediaAsset | null;
  listingUrl?: string | null;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  if (options.asset) {
    try {
      const jpg = await cropShareImage(options.asset, "fb");
      const image = await pdf.embedJpg(jpg);
      page.drawImage(image, { x: 36, y: 420, width: 540, height: 284 });
    } catch {
      // skip image if derivative missing
    }
  }

  page.drawText(options.order.propertyAddress, {
    x: 36,
    y: 370,
    size: 18,
    font: bold,
    color: rgb(0.09, 0.1, 0.09),
  });
  page.drawText(`${options.order.packageName} · ${options.order.squareFootage} sq ft`, {
    x: 36,
    y: 346,
    size: 12,
    font,
    color: rgb(0.3, 0.32, 0.3),
  });
  page.drawText(`Agent: ${options.order.agentName}`, {
    x: 36,
    y: 318,
    size: 12,
    font,
  });
  if (options.order.brokerage) {
    page.drawText(options.order.brokerage, { x: 36, y: 302, size: 11, font });
  }
  page.drawText(`Photos by ${options.tenant.photographerName} · ${options.tenant.studioName}`, {
    x: 36,
    y: 70,
    size: 11,
    font,
  });
  if (options.listingUrl) {
    page.drawText(options.listingUrl, { x: 36, y: 52, size: 9, font, color: rgb(0.2, 0.36, 0.31) });
  }

  return Buffer.from(await pdf.save());
}
