import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminOrderBoard } from "@/components/admin-order-board";
import { getPhotographerSession } from "@/lib/auth";
import { listMedia, listRecentGalleries } from "@/lib/galleries";
import { listOrders } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getPhotographerSession();
  if (!session) redirect("/admin/login");
  if (!session.activeTenantId) redirect("/onboarding");

  const tenant = getTenant(session.activeTenantId);
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
    <main className="admin-shell" id="main">
      <p className="muted" style={{ marginBottom: "0.75rem" }}>
        Signed in as {session.user.email} · studio <strong>{tenant.studioName}</strong>{" "}
        (<code>{tenant.slug}</code>) · <a href="/admin/settings">Settings</a>
      </p>
      <AdminOrderBoard initialOrders={orders} initialGalleries={galleries} />
    </main>
  );
}
