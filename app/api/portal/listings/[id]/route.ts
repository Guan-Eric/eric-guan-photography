import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentSession } from "@/lib/agent-auth";
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
  leadCapture: z.boolean().optional(),
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

  const result = await updateListingPage(loaded.page.id, loaded.tenant.id, {
    headline: parsed.data.headline,
    description: parsed.data.description,
    sections: parsed.data.sections,
    openHouses: parsed.data.openHouses,
    leadCapture: parsed.data.leadCapture,
  });
  if (!result.ok) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
