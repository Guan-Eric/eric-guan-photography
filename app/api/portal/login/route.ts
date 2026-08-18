import { NextResponse } from "next/server";
import { z } from "zod";
import { createAgentLoginToken } from "@/lib/agent-auth";
import { agentPortalLoginEmail, sendEmail } from "@/lib/email";
import { listOrdersByAgentEmail } from "@/lib/orders";
import { publicStudioUrl, safePortalPath } from "@/lib/platform";
import { checkRateLimit } from "@/lib/quotas";
import { getRequestTenant } from "@/lib/tenants";
import { getTenantRow } from "@/lib/tenant-store";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().email().max(160),
  next: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const tenant = await getRequestTenant();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Studio not found." }, { status: 404 });
  }

  const limited = checkRateLimit(`portal:${request.headers.get("cf-connecting-ip") ?? "ip"}`, 8, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "Too many sign-in emails. Wait a minute." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }

  const orders = await listOrdersByAgentEmail(tenant.id, parsed.data.email);
  if (orders.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const token = await createAgentLoginToken(tenant.id, parsed.data.email);
  const row = await getTenantRow(tenant.id);
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: row?.domain,
    siteUrl: tenant.siteUrl,
    domainStatus: row?.domainStatus,
  });
  const next = safePortalPath(parsed.data.next);
  const loginUrl = `${siteUrl.replace(/\/$/, "")}/portal/callback?token=${token}${
    next ? `&next=${encodeURIComponent(next)}` : ""
  }`;
  await sendEmail(
    agentPortalLoginEmail({
      tenant,
      agentEmail: parsed.data.email.trim().toLowerCase(),
      loginUrl,
    }),
  );
  return NextResponse.json({ ok: true });
}
