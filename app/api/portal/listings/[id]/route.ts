import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentSession } from "@/lib/agent-auth";
import {
  AGENCY_LICENSE_TYPES,
  BROKER_LICENSE_TYPES,
  COMPLIANCE_REGIONS,
  LISTING_STATUSES,
} from "@/lib/db/schema";
import { listingSectionSchema, openHouseSchema } from "@/lib/listing-content";
import {
  getListingPageForAgent,
  updateListingPage,
} from "@/lib/listing-pages";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { id: string };

const patchSchema = z.object({
  headline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  sections: z.array(listingSectionSchema).max(8).optional(),
  openHouses: z.array(openHouseSchema).max(8).optional(),
  brokerage: z.string().trim().max(160).nullable().optional(),
  brokeragePhone: z.string().trim().max(40).nullable().optional(),
  agentPhone: z.string().trim().max(40).nullable().optional(),
  complianceRegion: z.enum(COMPLIANCE_REGIONS).optional(),
  licenseDisplayName: z.string().trim().max(160).nullable().optional(),
  licenseType: z.enum(BROKER_LICENSE_TYPES).nullable().optional(),
  agencyLegalName: z.string().trim().max(200).nullable().optional(),
  agencyLicenseType: z.enum(AGENCY_LICENSE_TYPES).nullable().optional(),
  listingStatus: z.enum(LISTING_STATUSES).optional(),
  advertisingEndsAt: z.string().trim().max(40).nullable().optional(),
  deedSignedAt: z.string().trim().max(40).nullable().optional(),
  renew: z.boolean().optional(),
  published: z.boolean().optional(),
});

async function agentPage(id: string) {
  const tenant = await getRequestTenant();
  const session = await getAgentSession();
  if (!tenant || !session || session.tenantId !== tenant.id) {
    return { error: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 }) };
  }
  const page = await getListingPageForAgent(id, tenant.id, session.email);
  if (!page) {
    return { error: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }) };
  }
  return { tenant, session, page };
}

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  const loaded = await agentPage(id);
  if ("error" in loaded) return loaded.error;
  return NextResponse.json({ ok: true, page: loaded.page });
}

export async function PATCH(request: Request, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  const loaded = await agentPage(id);
  if ("error" in loaded) return loaded.error;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Check the listing fields and try again." },
      { status: 400 },
    );
  }

  const result = await updateListingPage(loaded.page.id, loaded.tenant.id, parsed.data);
  if (!result.ok) {
    const status = "checklistErrors" in result && result.checklistErrors ? 400 : 404;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
