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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; plan?: string }>;
}) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;

  const query = await searchParams;
  const tenant = await getTenant(session.activeTenantId);
  const siteUrl = studioOrigin({ slug: tenant.slug, domain: tenant.domain });
  const orders = await listOrders(tenant.id);
  const recent = await listRecentGalleries(tenant.id);
  const galleries = await Promise.all(
    recent.map(async (gallery) => ({
      id: gallery.id,
      orderId: gallery.orderId,
      state: gallery.state,
      publicToken: gallery.publicToken,
      trustTier: gallery.trustTier,
      brandMode: gallery.brandMode,
      mediaCount: (await listMedia(gallery.id)).length,
    })),
  );

  return (
    <AdminOrderBoard
      initialOrders={orders}
      initialGalleries={galleries}
      bookingUrl={`${siteUrl}/book`}
      siteUrl={siteUrl}
      welcome={query.welcome === "1" || orders.length === 0}
      plan={query.plan ?? null}
    />
  );
}
