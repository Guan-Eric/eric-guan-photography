import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudioAppShell } from "@/components/studio-app-shell";
import { getPhotographerSession } from "@/lib/auth";
import { studioOrigin } from "@/lib/platform";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function StudioAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPhotographerSession();
  if (!session) redirect("/login");
  if (!session.activeTenantId) redirect("/onboarding");

  const tenant = await getTenant(session.activeTenantId);
  const siteUrl = studioOrigin({
    slug: tenant.slug,
    domain: tenant.domain,
  });

  return (
    <StudioAppShell
      studioName={tenant.studioName}
      slug={tenant.slug}
      email={session.user.email}
      siteUrl={siteUrl}
    >
      {children}
    </StudioAppShell>
  );
}
