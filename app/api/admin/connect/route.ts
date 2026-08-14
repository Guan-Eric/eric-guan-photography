import { NextResponse } from "next/server";
import { requireTenantMembership, getPhotographerSession } from "@/lib/auth";
import { entitlements } from "@/lib/billing";
import { createConnectOnboardingLink, refreshConnectStatus } from "@/lib/stripe-connect";
import { parseTenantConfig, setTenantDomain, getTenantRow, updateTenantConfig } from "@/lib/tenant-store";
import type { ServiceAreaGate } from "@/lib/tenant-schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const row = getTenantRow(session.activeTenantId);
  if (request.url.includes("refresh=1") && row?.stripeConnectAccountId) {
    await refreshConnectStatus(session.activeTenantId);
  }

  const latest = getTenantRow(session.activeTenantId);
  const config = latest ? parseTenantConfig(latest) : null;
  return NextResponse.json({
    ok: true,
    connectStatus: latest?.stripeConnectStatus ?? "not_started",
    connectAccountId: latest?.stripeConnectAccountId ?? null,
    domain: latest?.domain ?? null,
    slug: latest?.slug,
    storageBytesUsed: latest?.storageBytesUsed ?? 0,
    mediaQuotaBytes: latest?.mediaQuotaBytes ?? 0,
    serviceAreaGate: config?.serviceAreaGate ?? null,
    canCustomDomain: latest ? entitlements(latest.plan).customDomain : false,
  });
}

export async function POST(request: Request) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const origin = new URL(request.url).origin;

  if (body?.action === "domain") {
    const latest = getTenantRow(session.activeTenantId);
    if (!latest || !entitlements(latest.plan).customDomain) {
      return NextResponse.json(
        { ok: false, error: "Custom domains require the Growth or Studio plan." },
        { status: 403 },
      );
    }
    const domain =
      typeof body.domain === "string" && body.domain.trim()
        ? body.domain.trim().toLowerCase()
        : null;
    setTenantDomain(session.activeTenantId, domain);
    return NextResponse.json({
      ok: true,
      domain,
      note: "DNS: point the domain (CNAME) to the platform host, then attach SSL in Cloudflare.",
    });
  }

  if (body?.action === "serviceArea") {
    const gate: ServiceAreaGate = {
      enabled: Boolean(body.enabled),
      region: body.region === "US" || body.region === "CA" ? body.region : "none",
      prefixes: String(body.prefixes ?? "")
        .split(",")
        .map((item: string) => item.trim().toUpperCase())
        .filter(Boolean),
      message:
        typeof body.message === "string" && body.message.trim()
          ? body.message.trim()
          : "This studio does not currently cover that area.",
    };
    updateTenantConfig(session.activeTenantId, { serviceAreaGate: gate });
    return NextResponse.json({ ok: true, serviceAreaGate: gate });
  }

  const link = await createConnectOnboardingLink({
    tenantId: session.activeTenantId,
    email: session.user.email,
    returnUrl: `${origin}/admin/settings?connect=return`,
    refreshUrl: `${origin}/admin/settings?connect=refresh`,
  });

  if (!link.ok) {
    return NextResponse.json(link, { status: link.stubbed ? 501 : 400 });
  }

  return NextResponse.json(link);
}
