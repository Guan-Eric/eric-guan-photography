import type { Metadata } from "next";
import { AdminOrderBoard } from "@/components/admin-order-board";
import { getPhotographerSession } from "@/lib/auth";
import { listMedia, listRecentGalleries } from "@/lib/galleries";
import { listOrders } from "@/lib/orders";
import { studioOrigin } from "@/lib/platform";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;

  const tenant = getTenant(session.activeTenantId);
  const siteUrl = studioOrigin({ slug: tenant.slug, domain: tenant.domain });
  const orders = listOrders(tenant.id);
  const galleries = listRecentGalleries(tenant.id).map((gallery) => ({
    id: gallery.id,
    orderId: gallery.orderId,
    state: gallery.state,
    publicToken: gallery.publicToken,
    trustTier: gallery.trustTier,
    brandMode: gallery.brandMode,
    mediaCount: listMedia(gallery.id).length,
  }));

  return (
    <AdminOrderBoard
      initialOrders={orders}
      initialGalleries={galleries}
      bookingUrl={`${siteUrl}/book`}
    />
  );
}
