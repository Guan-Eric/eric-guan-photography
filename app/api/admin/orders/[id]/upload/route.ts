import { NextResponse } from "next/server";
import { requireTenantMembership } from "@/lib/auth";
import { addUploadsToGallery } from "@/lib/galleries";
import { getOrder } from "@/lib/orders";
import { assertUploadRateLimit, assertWithinStorageQuota } from "@/lib/quotas";
import { addTenantStorageUsage } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { id: string };

export async function POST(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { id: orderId } = await context.params;
  const order = getOrder(orderId);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const auth = await requireTenantMembership(order.tenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "Choose one or more photos." }, { status: 400 });
  }

  const rate = assertUploadRateLimit(order.tenantId, files.length);
  if (!rate.ok) {
    return NextResponse.json(rate, { status: 429 });
  }

  const prepared = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
    })),
  );

  const incomingBytes = prepared.reduce((sum, file) => sum + file.buffer.byteLength, 0);
  const quota = assertWithinStorageQuota(order.tenantId, incomingBytes);
  if (!quota.ok) {
    return NextResponse.json(quota, { status: 413 });
  }

  const tenant = getTenant(order.tenantId);
  const result = await addUploadsToGallery({
    tenant,
    order,
    files: prepared,
  });

  const storedBytes = result.created.reduce((sum, asset) => sum + asset.bytesOriginal, 0);
  addTenantStorageUsage(order.tenantId, storedBytes);

  return NextResponse.json({
    ok: true,
    galleryId: result.gallery.id,
    token: result.gallery.publicToken,
    uploaded: result.created.length,
    state: result.gallery.state,
  });
}
