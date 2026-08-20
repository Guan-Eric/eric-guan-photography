import { NextResponse } from "next/server";
import { requireActiveStudio } from "@/lib/admin-guards";
import { requireTenantMembership } from "@/lib/auth";
import { addUploadsToGallery } from "@/lib/galleries";
import { getOrder } from "@/lib/orders";
import { assertUploadRateLimit, assertWithinStorageQuota } from "@/lib/quotas";
import { addTenantStorageUsage } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { id: string };

function isUploadBlob(
  entry: FormDataEntryValue,
): entry is File {
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof (entry as File).arrayBuffer === "function" &&
    typeof (entry as File).size === "number" &&
    (entry as File).size > 0
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<Params> },
) {
  try {
    const { id: orderId } = await context.params;
    const order = await getOrder(orderId);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
    }

    const auth = await requireTenantMembership(order.tenantId);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }
    const active = await requireActiveStudio(order.tenantId);
    if (!active.ok) {
      return NextResponse.json({ ok: false, error: active.error }, { status: 403 });
    }

    const form = await request.formData();
    const blobs = form.getAll("files").filter(isUploadBlob);

    if (blobs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Choose one or more photos." },
        { status: 400 },
      );
    }

    const rate = await assertUploadRateLimit(order.tenantId, blobs.length);
    if (!rate.ok) {
      return NextResponse.json(rate, { status: 429 });
    }

    const prepared = await Promise.all(
      blobs.map(async (file, index) => ({
        name:
          typeof file.name === "string" && file.name.trim()
            ? file.name
            : `photo-${index + 1}.jpg`,
        buffer: Buffer.from(await file.arrayBuffer()),
      })),
    );

    const incomingBytes = prepared.reduce(
      (sum, file) => sum + file.buffer.byteLength,
      0,
    );
    const quota = await assertWithinStorageQuota(order.tenantId, incomingBytes);
    if (!quota.ok) {
      return NextResponse.json(quota, { status: 413 });
    }

    const tenant = await getTenant(order.tenantId);
    const result = await addUploadsToGallery({
      tenant,
      order,
      files: prepared,
    });

    const storedBytes = result.created.reduce(
      (sum, asset) => sum + asset.bytesOriginal,
      0,
    );
    await addTenantStorageUsage(order.tenantId, storedBytes);

    return NextResponse.json({
      ok: true,
      galleryId: result.gallery.id,
      token: result.gallery.publicToken,
      uploaded: result.created.length,
      state: result.gallery.state,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly.";
    console.error("[upload]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
