import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgentListingCopyEditor } from "@/components/agent-listing-copy-editor";
import { StatusPage } from "@/components/status-page";
import { getAgentSession } from "@/lib/agent-auth";
import { parseOpenHouses, parseSections } from "@/lib/listing-content";
import {
  listingPublicState,
  listingStateLabel,
} from "@/lib/listing-compliance";
import {
  getListingPageForAgent,
  listingPageMedia,
} from "@/lib/listing-pages";
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
  if (!page) {
    return (
      <StatusPage
        eyebrow="Not available"
        title="This listing isn’t on your account"
        body="Sign in with the email used to book the shoot, or ask your photographer to share the correct link."
        actions={[
          { href: "/portal", label: "Back to listings", variant: "outline" },
          { href: "/portal/login", label: "Sign in again", variant: "solid" },
        ]}
      />
    );
  }

  const row = await getTenantRow(tenant.id);
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: row?.domain,
    siteUrl: tenant.siteUrl,
    domainStatus: row?.domainStatus,
  });
  const media = await listingPageMedia(page);
  const { state, checklistErrors } = listingPublicState(page, media);
  const publicUrl = `${siteUrl.replace(/\/$/, "")}/p/${page.slug}`;

  return (
    <main className="page-section" id="main">
      <div className="page-inner">
        <AgentListingCopyEditor
          pageId={page.id}
          publicUrl={publicUrl}
          listingLive={state === "live"}
          listingStateLabel={listingStateLabel(state)}
          checklistErrors={checklistErrors}
          propertyAddress={page.propertyAddress}
          initial={{
            headline: page.headline ?? "",
            description: page.description ?? "",
            sections: parseSections(page.sectionsJson),
            openHouses: parseOpenHouses(page.openHouseJson),
            brokerage: page.brokerage ?? "",
            brokeragePhone: page.brokeragePhone ?? "",
            agentPhone: page.agentPhone ?? "",
            complianceRegion: page.complianceRegion ?? "ca_other",
            licenseDisplayName: page.licenseDisplayName ?? "",
            licenseType: page.licenseType ?? "",
            agencyLegalName: page.agencyLegalName ?? "",
            agencyLicenseType: page.agencyLicenseType ?? "",
            listingStatus: page.listingStatus ?? "active",
            advertisingEndsAt: page.advertisingEndsAt
              ? page.advertisingEndsAt.slice(0, 10)
              : "",
            deedSignedAt: Boolean(page.deedSignedAt),
          }}
        />
      </div>
    </main>
  );
}
