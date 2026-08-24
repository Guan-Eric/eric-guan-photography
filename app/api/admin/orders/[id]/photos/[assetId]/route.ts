import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { requireActiveStudio } from "@/lib/admin-guards";
import { requireTenantMembership } from "@/lib/auth";
import { deleteMediaAsset, getGalleryByOrderId, listMedia } from "@/lib/galleries";
import { openMediaStream } from "@/lib/media-storage";
import { getOrder } from "@/lib/orders";
import { addTenantStorageUsage } from "@/lib/tenant-store";

export const runtime = "nodejs";

type Params = { id: string; assetId: string };

async function loadOwnedAsset(orderId: string, assetId: string) {
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
  const gallery = await getGalleryByOrderId(orderId, order.tenantId);
  if (!gallery) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }),
    };
  }
  const asset = (await listMedia(gallery.id)).find((item) => item.id === assetId);
  if (!asset) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }),
    };
  }
  return { ok: true as const, order, asset };
}

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const { id, assetId } = await context.params;
  const loaded = await loadOwnedAsset(id, assetId);
  if (!loaded.ok) return loaded.response;

  const nodeStream = await openMediaStream(loaded.asset.pathWeb);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const { id, assetId } = await context.params;
  const loaded = await loadOwnedAsset(id, assetId);
  if (!loaded.ok) return loaded.response;

  const active = await requireActiveStudio(loaded.order.tenantId);
  if (!active.ok) {
    return NextResponse.json({ ok: false, error: active.error }, { status: 403 });
  }

  const removed = await deleteMediaAsset(loaded.order.tenantId, assetId);
  if (!removed) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  await addTenantStorageUsage(loaded.order.tenantId, -removed.bytesOriginal);
  return NextResponse.json({ ok: true });
}
