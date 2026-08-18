import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AgentListingCopyEditor } from "@/components/agent-listing-copy-editor";
import { getAgentSession } from "@/lib/agent-auth";
import { parseOpenHouses, parseSections } from "@/lib/listing-content";
import { getListingPageForAgent } from "@/lib/listing-pages";
import { publicStudioUrl } from "@/lib/platform";
import { getRequestTenant } from "@/lib/tenants";
import { getTenantRow } from "@/lib/tenant-store";

export const metadata: Metadata = {
  title: "Listing copy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AgentListingCopyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await getRequestTenant();
  if (!tenant) redirect("/portal/login");
  const { id } = await params;
  const session = await getAgentSession();
  if (!session || session.tenantId !== tenant.id) {
    redirect(`/portal/login?next=${encodeURIComponent(`/portal/listings/${id}`)}`);
  }

  const page = await getListingPageForAgent(id, tenant.id, session.email);
  if (!page) notFound();

  const row = await getTenantRow(tenant.id);
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: row?.domain,
    siteUrl: tenant.siteUrl,
    domainStatus: row?.domainStatus,
  });

  return (
    <main className="page-section" id="main">
      <div className="page-inner">
        <AgentListingCopyEditor
          pageId={page.id}
          publicUrl={`${siteUrl.replace(/\/$/, "")}/p/${page.slug}`}
          propertyAddress={page.propertyAddress}
          initial={{
            headline: page.headline ?? "",
            description: page.description ?? "",
            sections: parseSections(page.sectionsJson),
            openHouses: parseOpenHouses(page.openHouseJson),
            leadCapture: page.leadCapture === 1,
          }}
        />
      </div>
    </main>
  );
}
