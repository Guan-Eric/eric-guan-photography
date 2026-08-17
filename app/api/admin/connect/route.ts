import { NextResponse } from "next/server";
import { requireTenantMembership, getPhotographerSession } from "@/lib/auth";
import { entitlements } from "@/lib/billing";
import {
  deleteCustomHostname,
  getCustomHostname,
  isCustomHostnameLive,
  summarizeCustomHostname,
  upsertCustomHostname,
  type CustomHostnameRecord,
} from "@/lib/cloudflare-saas";
import {
  expectedDomainTarget,
  normalizeCustomDomain,
  verifyCustomDomain,
} from "@/lib/custom-domain";
import { createConnectOnboardingLink, refreshConnectStatus } from "@/lib/stripe-connect";
import {
  parseTenantConfig,
  setTenantDomain,
  getTenantRow,
  getTenantRowByDomain,
  updateTenantConfig,
  updateTenantDomainMeta,
} from "@/lib/tenant-store";
import { syncDomainAddonQuantity } from "@/lib/domain-billing";
import type { ServiceAreaGate } from "@/lib/tenant-schema";

export const runtime = "nodejs";

function domainPayload(options: {
  domain: string | null;
  domainStatus: string | null;
  domainCfId: string | null;
  verification: Awaited<ReturnType<typeof verifyCustomDomain>>;
  cf: CustomHostnameRecord | null;
  note?: string;
}) {
  const summary = summarizeCustomHostname(options.cf, {
    dnsVerified: options.verification.verified,
    expectedTarget: options.verification.expectedTarget,
  });
  const live = isCustomHostnameLive(options.cf) && options.verification.verified;
  return {
    ok: true as const,
    domain: options.domain,
    domainVerified: options.verification.verified,
    domainLive: live,
    domainStatus: options.domainStatus ?? summary.domainStatus,
    domainCfId: options.domainCfId,
    domainCfStatus: options.cf?.status ?? null,
    domainSslStatus: options.cf?.sslStatus ?? null,
    expectedDnsTarget: options.verification.expectedTarget,
    dnsRecords: options.verification.records,
    note: options.note ?? options.verification.message ?? summary.note,
  };
}

async function refreshDomainFromCloudflare(row: NonNullable<
  Awaited<ReturnType<typeof getTenantRow>>
>) {
  if (!row.domain) {
    return domainPayload({
      domain: null,
      domainStatus: row.domainStatus,
      domainCfId: row.domainCfId,
      verification: await verifyCustomDomain(null),
      cf: null,
      note: "No custom domain set.",
    });
  }

  const verification = await verifyCustomDomain(row.domain);
  let cf: CustomHostnameRecord | null = null;

  if (row.domainCfId) {
    const fetched = await getCustomHostname(row.domainCfId);
    if (fetched.ok && !fetched.skipped && fetched.data) {
      cf = fetched.data;
    }
  }

  if (cf) {
    const summary = summarizeCustomHostname(cf, {
      dnsVerified: verification.verified,
      expectedTarget: verification.expectedTarget,
    });
    const status = verification.verified ? summary.domainStatus : "pending";
    if (status !== row.domainStatus || cf.id !== row.domainCfId) {
      await updateTenantDomainMeta(row.id, {
        domainCfId: cf.id,
        domainStatus: status,
      });
    }
    return domainPayload({
      domain: row.domain,
      domainStatus: status,
      domainCfId: cf.id,
      verification,
      cf,
      note: verification.verified ? summary.note : verification.message,
    });
  }

  return domainPayload({
    domain: row.domain,
    domainStatus: row.domainStatus ?? "pending",
    domainCfId: row.domainCfId,
    verification,
    cf: null,
  });
}

export async function GET(request: Request) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const row = await getTenantRow(session.activeTenantId);
  if (request.url.includes("refresh=1") && row?.stripeConnectAccountId) {
    await refreshConnectStatus(session.activeTenantId);
  }

  const latest = await getTenantRow(session.activeTenantId);
  const config = latest ? parseTenantConfig(latest) : null;

  let domainFields: Record<string, unknown> = {
    domain: latest?.domain ?? null,
    domainStatus: latest?.domainStatus ?? null,
    domainCfId: latest?.domainCfId ?? null,
    expectedDnsTarget: expectedDomainTarget(),
    domainVerified: false,
    domainLive: false,
    domainCfStatus: null,
    domainSslStatus: null,
  };

  if (latest?.domain && entitlements(latest.plan).customDomain) {
    const refreshed = await refreshDomainFromCloudflare(latest);
    domainFields = {
      domain: refreshed.domain,
      domainStatus: refreshed.domainStatus,
      domainCfId: refreshed.domainCfId,
      expectedDnsTarget: refreshed.expectedDnsTarget,
      domainVerified: refreshed.domainVerified,
      domainLive: refreshed.domainLive,
      domainCfStatus: refreshed.domainCfStatus,
      domainSslStatus: refreshed.domainSslStatus,
      dnsRecords: refreshed.dnsRecords,
      note: refreshed.note,
    };
  }

  return NextResponse.json({
    ok: true,
    connectStatus: latest?.stripeConnectStatus ?? "not_started",
    connectAccountId: latest?.stripeConnectAccountId ?? null,
    slug: latest?.slug,
    storageBytesUsed: latest?.storageBytesUsed ?? 0,
    mediaQuotaBytes: latest?.mediaQuotaBytes ?? 0,
    serviceAreaGate: config?.serviceAreaGate ?? null,
    canCustomDomain: latest ? entitlements(latest.plan).customDomain : false,
    ...domainFields,
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
    const latest = await getTenantRow(session.activeTenantId);
    if (!latest || !entitlements(latest.plan).customDomain) {
      return NextResponse.json(
        { ok: false, error: "Custom domains require the Growth or Studio plan." },
        { status: 403 },
      );
    }

    const domain =
      typeof body.domain === "string" && body.domain.trim()
        ? normalizeCustomDomain(body.domain)
        : null;

    if (domain) {
      const owner = await getTenantRowByDomain(domain);
      if (owner && owner.id !== session.activeTenantId) {
        return NextResponse.json(
          { ok: false, error: "That domain is already linked to another studio." },
          { status: 409 },
        );
      }
    }

    const previousCfId = latest.domainCfId;

    if (!domain) {
      if (previousCfId) {
        await deleteCustomHostname(previousCfId);
      }
      await setTenantDomain(session.activeTenantId, null, {
        domainCfId: null,
        domainStatus: "cleared",
      });
      await syncDomainAddonQuantity(session.activeTenantId);
      const verification = await verifyCustomDomain(null);
      return NextResponse.json(
        domainPayload({
          domain: null,
          domainStatus: "cleared",
          domainCfId: null,
          verification,
          cf: null,
          note: verification.message,
        }),
      );
    }

    // Changing hostname: drop previous CF record first
    if (previousCfId && latest.domain && latest.domain !== domain) {
      await deleteCustomHostname(previousCfId);
    }

    await setTenantDomain(session.activeTenantId, domain, {
      domainCfId: latest.domain === domain ? previousCfId : null,
      domainStatus: "pending",
    });

    const verification = await verifyCustomDomain(domain);
    const upserted = await upsertCustomHostname(domain);

    if (!upserted.ok) {
      await updateTenantDomainMeta(session.activeTenantId, {
        domainStatus: "error",
      });
      return NextResponse.json({
        ok: false,
        error: `Domain saved in Studiofront, but Cloudflare hostname failed: ${upserted.error}`,
        domain,
        domainVerified: verification.verified,
        expectedDnsTarget: verification.expectedTarget,
        dnsRecords: verification.records,
        note: verification.message,
      });
    }

    if (upserted.skipped) {
      await updateTenantDomainMeta(session.activeTenantId, {
        domainStatus: verification.verified ? "pending" : "pending",
      });
      return NextResponse.json(
        domainPayload({
          domain,
          domainStatus: "pending",
          domainCfId: null,
          verification,
          cf: null,
          note: `${verification.message} ${upserted.message}`,
        }),
      );
    }

    const cf = upserted.data;
    const summary = summarizeCustomHostname(cf, {
      dnsVerified: verification.verified,
      expectedTarget: verification.expectedTarget,
    });
    const status = verification.verified ? summary.domainStatus : "pending";
    await updateTenantDomainMeta(session.activeTenantId, {
      domainCfId: cf.id,
      domainStatus: status,
    });
    await syncDomainAddonQuantity(session.activeTenantId);

    return NextResponse.json(
      domainPayload({
        domain,
        domainStatus: status,
        domainCfId: cf.id,
        verification,
        cf,
        note: verification.verified ? summary.note : verification.message,
      }),
    );
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
    await updateTenantConfig(session.activeTenantId, { serviceAreaGate: gate });
    return NextResponse.json({ ok: true, serviceAreaGate: gate });
  }

  const link = await createConnectOnboardingLink({
    tenantId: session.activeTenantId,
    email: session.user.email,
    returnUrl: `${origin}/admin/settings?connect=return`,
    refreshUrl: `${origin}/admin/settings?connect=refresh`,
  });

  if (!link.ok) {
    return NextResponse.json({ ok: false, error: link.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, url: link.url });
}
