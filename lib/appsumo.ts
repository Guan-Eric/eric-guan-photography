import { eq } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { customAlphabet } from "nanoid";
import { applyPlanToTenant, recordBillingEvent } from "@/lib/billing";
import { getDb, qGet, qRun, schema } from "@/lib/db";
import type { AppsumoLicense, AppsumoLicenseStatus, PlanId } from "@/lib/db/schema";
import { cookieDomain, hostnameFromHost, platformPublicUrl } from "@/lib/platform";
import { authSessionSecret } from "@/lib/secrets";

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 14);

export const APPSUMO_PENDING_COOKIE = "eg_appsumo_pending";
const PENDING_MAX_AGE_SECONDS = 60 * 30;

export type AppsumoWebhookPayload = {
  license_key?: string;
  prev_license_key?: string | null;
  event?: string;
  event_timestamp?: number | string;
  created_at?: number | string;
  license_status?: string;
  tier?: number;
  test?: boolean;
  partner_plan_name?: string | null;
  parent_license_key?: string | null;
  unit_quantity?: number;
  extra?: { reason?: string };
};

export function appsumoApiKey() {
  return process.env.APPSUMO_API_KEY?.trim() || "";
}

export function appsumoClientId() {
  return process.env.APPSUMO_CLIENT_ID?.trim() || "";
}

export function appsumoClientSecret() {
  return process.env.APPSUMO_CLIENT_SECRET?.trim() || "";
}

export function appsumoRedirectUri() {
  return (
    process.env.APPSUMO_REDIRECT_URI?.trim() ||
    `${platformPublicUrl()}/api/appsumo/oauth`
  );
}

/** Tier 1/2/3 → starter / growth / studio. */
export function tierToPlan(tier: number): PlanId {
  if (tier >= 3) return "studio";
  if (tier === 2) return "growth";
  return "starter";
}

function nowIso() {
  return new Date().toISOString();
}

function eventTimestampIso(value: number | string | undefined) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  // AppSumo sends ms for event_timestamp.
  const ms = n > 1e12 ? n : n * 1000;
  return new Date(ms).toISOString();
}

function statusFromPayload(
  licenseStatus: string | undefined,
  event: string | undefined,
): AppsumoLicenseStatus {
  if (event === "deactivate") return "deactivated";
  if (licenseStatus === "active" || licenseStatus === "deactivated" || licenseStatus === "inactive") {
    return licenseStatus;
  }
  if (event === "activate" || event === "upgrade" || event === "downgrade") return "active";
  return "inactive";
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify AppSumo webhook HMAC-SHA256 of `timestamp + body` with the API key.
 * When API key is unset (local stub), verification is skipped.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = appsumoApiKey();
  if (!apiKey) {
    return { ok: true };
  }
  if (!timestamp || !signature) {
    return { ok: false, error: "Missing AppSumo signature headers." };
  }
  const expected = await hmacSha256Hex(apiKey, `${timestamp}${rawBody}`);
  const provided = signature.trim().toLowerCase();
  if (!timingSafeEqualHex(expected, provided)) {
    return { ok: false, error: "Invalid AppSumo signature." };
  }
  return { ok: true };
}

export async function getLicenseByKey(licenseKey: string) {
  const db = getDb();
  return qGet(
    db
      .select()
      .from(schema.appsumoLicenses)
      .where(eq(schema.appsumoLicenses.licenseKey, licenseKey))
      .limit(1),
  ) as Promise<AppsumoLicense | undefined>;
}

export async function getLicenseByTenantId(tenantId: string) {
  const db = getDb();
  return qGet(
    db
      .select()
      .from(schema.appsumoLicenses)
      .where(eq(schema.appsumoLicenses.tenantId, tenantId))
      .limit(1),
  ) as Promise<AppsumoLicense | undefined>;
}

async function insertLicenseRow(values: {
  licenseKey: string;
  prevLicenseKey?: string | null;
  tier: number;
  status: AppsumoLicenseStatus;
  partnerPlanName?: string | null;
  eventTimestamp?: string | null;
  tenantId?: string | null;
  userId?: string | null;
}) {
  const db = getDb();
  const stamp = nowIso();
  const row = {
    id: `asl_${id()}`,
    licenseKey: values.licenseKey,
    prevLicenseKey: values.prevLicenseKey ?? null,
    tier: values.tier,
    status: values.status,
    tenantId: values.tenantId ?? null,
    userId: values.userId ?? null,
    partnerPlanName: values.partnerPlanName ?? null,
    eventTimestamp: values.eventTimestamp ?? null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await qRun(db.insert(schema.appsumoLicenses).values(row));
  return row as AppsumoLicense;
}

/**
 * Upsert license from webhook. On upgrade/downgrade, find by prev_license_key,
 * swap key + tier, and re-apply plan when already linked to a tenant.
 */
export async function upsertLicenseFromWebhook(payload: AppsumoWebhookPayload) {
  const licenseKey = payload.license_key?.trim();
  if (!licenseKey) {
    return { ok: false as const, error: "Missing license_key." };
  }

  const event = payload.event?.trim() || "purchase";
  const tier =
    payload.tier != null && Number.isFinite(Number(payload.tier))
      ? Number(payload.tier)
      : null;
  const status = statusFromPayload(payload.license_status, event);
  const eventTimestamp = eventTimestampIso(payload.event_timestamp);
  const partnerPlanName = payload.partner_plan_name ?? null;
  const prevKey = payload.prev_license_key?.trim() || null;

  if (event === "deactivate") {
    return deactivateLicense(licenseKey, {
      eventTimestamp,
      partnerPlanName,
    });
  }

  if ((event === "upgrade" || event === "downgrade") && prevKey) {
    const previous = await getLicenseByKey(prevKey);
    if (previous) {
      const nextTier = tier ?? previous.tier;
      const db = getDb();
      await qRun(
        db
          .update(schema.appsumoLicenses)
          .set({
            licenseKey,
            prevLicenseKey: prevKey,
            tier: nextTier,
            status: "active",
            partnerPlanName,
            eventTimestamp,
            updatedAt: nowIso(),
          })
          .where(eq(schema.appsumoLicenses.id, previous.id)),
      );
      if (previous.tenantId) {
        await applyPlanToTenant(previous.tenantId, tierToPlan(nextTier), {
          status: "active",
          trialEndsAt: null,
        });
        await recordBillingEvent({
          tenantId: previous.tenantId,
          type: event === "upgrade" ? "appsumo.upgraded" : "appsumo.downgraded",
          payload: { licenseKey, prevLicenseKey: prevKey, tier: nextTier, event },
        });
      }
      return { ok: true as const, license: await getLicenseByKey(licenseKey) };
    }
  }

  const existing = await getLicenseByKey(licenseKey);
  if (existing) {
    const nextTier = tier ?? existing.tier;
    const db = getDb();
    await qRun(
      db
        .update(schema.appsumoLicenses)
        .set({
          tier: nextTier,
          status: status === "deactivated" ? "deactivated" : status,
          partnerPlanName,
          eventTimestamp,
          ...(prevKey ? { prevLicenseKey: prevKey } : {}),
          updatedAt: nowIso(),
        })
        .where(eq(schema.appsumoLicenses.id, existing.id)),
    );
    if (existing.tenantId && status !== "deactivated") {
      await applyPlanToTenant(existing.tenantId, tierToPlan(nextTier), {
        status: "active",
        trialEndsAt: null,
      });
    }
    return { ok: true as const, license: await getLicenseByKey(licenseKey) };
  }

  const created = await insertLicenseRow({
    licenseKey,
    prevLicenseKey: prevKey,
    tier: tier ?? 1,
    status,
    partnerPlanName,
    eventTimestamp,
  });
  return { ok: true as const, license: created };
}

export async function applyLicenseToTenant(
  licenseKey: string,
  tenantId: string,
  options?: { userId?: string | null },
) {
  const license = await getLicenseByKey(licenseKey);
  if (!license) {
    return { ok: false as const, error: "License not found. Complete AppSumo activation again." };
  }
  if (license.status === "deactivated") {
    return { ok: false as const, error: "This AppSumo license has been deactivated." };
  }
  if (license.tenantId && license.tenantId !== tenantId) {
    return {
      ok: false as const,
      error: "This license is already linked to another studio. Contact support if that is unexpected.",
    };
  }

  const plan = tierToPlan(license.tier);
  await applyPlanToTenant(tenantId, plan, {
    status: "active",
    trialEndsAt: null,
  });

  const db = getDb();
  await qRun(
    db
      .update(schema.appsumoLicenses)
      .set({
        tenantId,
        userId: options?.userId ?? license.userId,
        status: "active",
        updatedAt: nowIso(),
      })
      .where(eq(schema.appsumoLicenses.id, license.id)),
  );

  await recordBillingEvent({
    tenantId,
    type: "appsumo.activated",
    payload: {
      licenseKey,
      tier: license.tier,
      plan,
      userId: options?.userId ?? null,
    },
  });

  return {
    ok: true as const,
    plan,
    license: await getLicenseByKey(licenseKey),
  };
}

export async function deactivateLicense(
  licenseKey: string,
  options?: {
    eventTimestamp?: string | null;
    partnerPlanName?: string | null;
  },
) {
  let license = await getLicenseByKey(licenseKey);
  if (!license) {
    license = await insertLicenseRow({
      licenseKey,
      tier: 1,
      status: "deactivated",
      eventTimestamp: options?.eventTimestamp ?? null,
      partnerPlanName: options?.partnerPlanName ?? null,
    });
  } else {
    const db = getDb();
    await qRun(
      db
        .update(schema.appsumoLicenses)
        .set({
          status: "deactivated",
          eventTimestamp: options?.eventTimestamp ?? license.eventTimestamp,
          partnerPlanName: options?.partnerPlanName ?? license.partnerPlanName,
          updatedAt: nowIso(),
        })
        .where(eq(schema.appsumoLicenses.id, license.id)),
    );
  }

  const linked = await getLicenseByKey(licenseKey);
  if (linked?.tenantId) {
    await applyPlanToTenant(linked.tenantId, "trial", {
      status: "canceled",
      trialEndsAt: null,
    });
    await recordBillingEvent({
      tenantId: linked.tenantId,
      type: "appsumo.deactivated",
      payload: { licenseKey },
    });
  }

  return { ok: true as const, license: linked };
}

export async function exchangeCodeForLicense(code: string) {
  const clientId = appsumoClientId();
  const clientSecret = appsumoClientSecret();
  const redirectUri = appsumoRedirectUri();
  if (!clientId || !clientSecret) {
    return {
      ok: false as const,
      error: "AppSumo OAuth is not configured (missing client id/secret).",
    };
  }

  const tokenRes = await fetch("https://appsumo.com/openid/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    }),
  });
  const tokenJson = (await tokenRes.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  } | null;
  if (!tokenRes.ok || !tokenJson?.access_token) {
    return {
      ok: false as const,
      error:
        tokenJson?.error_description ||
        tokenJson?.error ||
        "Could not exchange AppSumo authorization code.",
    };
  }

  const licenseRes = await fetch(
    `https://appsumo.com/openid/license_key/?access_token=${encodeURIComponent(tokenJson.access_token)}`,
  );
  const licenseJson = (await licenseRes.json().catch(() => null)) as {
    license_key?: string;
    status?: string;
  } | null;
  if (!licenseRes.ok || !licenseJson?.license_key) {
    return {
      ok: false as const,
      error: "Could not fetch AppSumo license key.",
    };
  }

  return {
    ok: true as const,
    licenseKey: licenseJson.license_key,
    status: licenseJson.status ?? "inactive",
  };
}

function signPending(licenseKey: string) {
  return createHmac("sha256", authSessionSecret()).update(licenseKey).digest("hex");
}

export function encodePendingCookie(licenseKey: string) {
  return `${licenseKey}.${signPending(licenseKey)}`;
}

export function decodePendingCookie(raw: string | undefined | null) {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const licenseKey = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!licenseKey || !sig) return null;
  const expected = signPending(licenseKey);
  if (!timingSafeEqualHex(expected, sig)) return null;
  return licenseKey;
}

export function pendingCookieOptions(host: string | null) {
  const domain = cookieDomain(hostnameFromHost(host));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const secure =
    process.env.NODE_ENV === "production" &&
    !siteUrl.startsWith("http://") &&
    process.env.ADMIN_COOKIE_INSECURE !== "1";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: PENDING_MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  };
}

export function maskLicenseKey(licenseKey: string) {
  if (licenseKey.length <= 8) return "••••••••";
  return `${licenseKey.slice(0, 4)}…${licenseKey.slice(-4)}`;
}

export function appsumoSupportEmail() {
  return (
    process.env.PLATFORM_SUPPORT_EMAIL?.trim() ||
    process.env.PLATFORM_EMAIL_FROM?.replace(/^.*<([^>]+)>.*$/, "$1").trim() ||
    "hello@studiofront.ca"
  );
}

/** Same-origin relative path only (blocks open redirects). */
export function safeAppPath(next: string | null | undefined, fallback = "/admin") {
  if (!next) return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  return trimmed;
}
