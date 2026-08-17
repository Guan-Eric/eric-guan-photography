import { NextResponse } from "next/server";
import { requireTenantMembership } from "@/lib/auth";
import { ensureGalleryForOrder } from "@/lib/galleries";
import {
  addMediaDocument,
  addMediaLink,
  deleteMediaLink,
  listMediaLinksForOrder,
} from "@/lib/media-links";
import { writeMediaFile } from "@/lib/media-storage";
import { getOrder } from "@/lib/orders";
import { assertWithinStorageQuota } from "@/lib/quotas";
import { addTenantStorageUsage } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { id: string };

const MAX_PDF_BYTES = 25 * 1024 * 1024;

async function loadOrder(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 }),
    };
  }
  const auth = await requireTenantMembership(order.tenantId);
  if (!auth.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: auth.error }, { status: 401 }),
    };
  }
  return { ok: true as const, order };
}

export async function GET(request: Request, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  const loaded = await loadOrder(id);
  if (!loaded.ok) return loaded.response;
  const links = await listMediaLinksForOrder(id, loaded.order.tenantId);
  return NextResponse.json({ ok: true, links });
}

export async function POST(request: Request, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  const loaded = await loadOrder(id);
  if (!loaded.ok) return loaded.response;
  const { order } = loaded;

  const tenant = await getTenant(order.tenantId);
  const gallery = await ensureGalleryForOrder(order, tenant);
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Choose a PDF." }, { status: 400 });
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { ok: false, error: "Floor plans must be PDF files." },
        { status: 415 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_PDF_BYTES) {
      return NextResponse.json(
        { ok: false, error: "PDF is larger than 25 MB." },
        { status: 413 },
      );
    }
    const quota = await assertWithinStorageQuota(order.tenantId, buffer.byteLength);
    if (!quota.ok) return NextResponse.json(quota, { status: 413 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
    const relative = `${order.tenantId}/${gallery.id}/docs/${Date.now()}-${safeName}`;
    await writeMediaFile(relative, buffer, "application/pdf");
    await addTenantStorageUsage(order.tenantId, buffer.byteLength);

    const created = await addMediaDocument({
      tenantId: order.tenantId,
      orderId: order.id,
      galleryId: gallery.id,
      storagePath: relative,
      title: form.get("title")?.toString().trim() || file.name,
      kind: form.get("kind")?.toString() === "doc" ? "doc" : "floorplan",
      brandMode: brandModeFrom(form.get("brandMode")?.toString()),
    });
    return NextResponse.json({ ok: true, link: created.link });
  }

  const body = await request.json().catch(() => ({}));
  const created = await addMediaLink({
    tenantId: order.tenantId,
    orderId: order.id,
    galleryId: gallery.id,
    url: typeof body?.url === "string" ? body.url : "",
    kind: kindFrom(body?.kind),
    title: typeof body?.title === "string" ? body.title : null,
    brandMode: brandModeFrom(body?.brandMode),
  });
  if (!created.ok) return NextResponse.json(created, { status: 400 });
  return NextResponse.json({ ok: true, link: created.link });
}

export async function DELETE(request: Request, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  const loaded = await loadOrder(id);
  if (!loaded.ok) return loaded.response;

  const url = new URL(request.url);
  const linkId = url.searchParams.get("linkId") ?? "";
  if (!linkId) {
    return NextResponse.json({ ok: false, error: "Missing linkId." }, { status: 400 });
  }
  await deleteMediaLink(linkId, loaded.order.tenantId);
  return NextResponse.json({ ok: true });
}

function kindFrom(value: unknown) {
  return value === "video" || value === "tour" || value === "floorplan" || value === "doc"
    ? value
    : undefined;
}

function brandModeFrom(value: unknown) {
  return value === "branded" || value === "unbranded" ? value : ("both" as const);
}
