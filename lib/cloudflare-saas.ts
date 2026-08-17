/**
 * Cloudflare for SaaS — Custom Hostnames API for tenant vanity domains.
 * Requires CLOUDFLARE_ZONE_ID + CF_SAAS_API_TOKEN (SSL and Certificates Edit).
 * Do not name the token CLOUDFLARE_API_TOKEN — Wrangler hijacks that for its own auth.
 */

export type CustomHostnameSslStatus =
  | "initializing"
  | "pending_validation"
  | "deleted"
  | "pending_issuance"
  | "pending_deployment"
  | "pending_expiration"
  | "expired"
  | "active"
  | "holding_deployment"
  | "error"
  | "unknown";

export type CustomHostnameRecord = {
  id: string;
  hostname: string;
  status: string;
  sslStatus: CustomHostnameSslStatus;
  sslMethod?: string;
  verificationErrors?: string[];
};

export type CloudflareSaasResult<T> =
  | { ok: true; data: T; skipped?: false }
  | { ok: true; data: null; skipped: true; message: string }
  | { ok: false; error: string; code?: number };

function zoneId() {
  return process.env.CLOUDFLARE_ZONE_ID?.trim() || "";
}

function apiToken() {
  return process.env.CF_SAAS_API_TOKEN?.trim() || "";
}

export function cloudflareSaasConfigured() {
  return Boolean(zoneId() && apiToken());
}

function baseUrl() {
  return `https://api.cloudflare.com/client/v4/zones/${zoneId()}/custom_hostnames`;
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${apiToken()}`,
    "Content-Type": "application/json",
  };
}

function mapSslStatus(raw: unknown): CustomHostnameSslStatus {
  if (typeof raw !== "string" || !raw) return "unknown";
  return raw as CustomHostnameSslStatus;
}

function parseHostname(payload: Record<string, unknown>): CustomHostnameRecord {
  const ssl =
    payload.ssl && typeof payload.ssl === "object"
      ? (payload.ssl as Record<string, unknown>)
      : {};
  const errors = Array.isArray(payload.verification_errors)
    ? payload.verification_errors.filter(
        (item): item is string => typeof item === "string",
      )
    : undefined;
  return {
    id: String(payload.id ?? ""),
    hostname: String(payload.hostname ?? "").toLowerCase(),
    status: String(payload.status ?? "unknown"),
    sslStatus: mapSslStatus(ssl.status),
    sslMethod: typeof ssl.method === "string" ? ssl.method : undefined,
    verificationErrors: errors,
  };
}

async function cfFetch(
  url: string,
  init?: RequestInit,
): Promise<CloudflareSaasResult<Record<string, unknown>>> {
  if (!cloudflareSaasConfigured()) {
    return {
      ok: true,
      data: null,
      skipped: true,
      message:
        "Cloudflare SaaS not configured (set CLOUDFLARE_ZONE_ID and CF_SAAS_API_TOKEN).",
    };
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    });
    const json = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      result?: Record<string, unknown> | Record<string, unknown>[];
      errors?: Array<{ message?: string; code?: number }>;
    };

    if (!response.ok || json.success === false) {
      const first = json.errors?.[0];
      return {
        ok: false,
        error: first?.message ?? `Cloudflare API HTTP ${response.status}`,
        code: first?.code,
      };
    }

    const result = json.result;
    if (Array.isArray(result)) {
      return { ok: true, data: { __list: result } };
    }
    return { ok: true, data: (result as Record<string, unknown>) ?? {} };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Cloudflare request failed",
    };
  }
}

/**
 * Find an existing custom hostname by exact hostname match.
 */
export async function findCustomHostname(
  hostname: string,
): Promise<CloudflareSaasResult<CustomHostnameRecord | null>> {
  const normalized = hostname.trim().toLowerCase();
  const url = `${baseUrl()}?hostname=${encodeURIComponent(normalized)}`;
  const result = await cfFetch(url, { method: "GET" });
  if (!result.ok) return result;
  if (result.skipped) {
    return { ok: true, data: null, skipped: true, message: result.message };
  }

  const list = result.data.__list;
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: true, data: null };
  }
  const match =
    list.find(
      (item) =>
        String((item as Record<string, unknown>).hostname ?? "")
          .toLowerCase()
          .replace(/\.$/, "") === normalized,
    ) ?? list[0];
  return { ok: true, data: parseHostname(match as Record<string, unknown>) };
}

export async function getCustomHostname(
  id: string,
): Promise<CloudflareSaasResult<CustomHostnameRecord>> {
  const result = await cfFetch(`${baseUrl()}/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  if (!result.ok) return result;
  if (result.skipped) {
    return { ok: true, data: null, skipped: true, message: result.message };
  }
  return { ok: true, data: parseHostname(result.data) };
}

/**
 * Create or reuse a custom hostname with HTTP DV SSL.
 */
export async function upsertCustomHostname(
  hostname: string,
): Promise<CloudflareSaasResult<CustomHostnameRecord>> {
  const normalized = hostname.trim().toLowerCase();
  const existing = await findCustomHostname(normalized);
  if (!existing.ok) return existing;
  if (existing.skipped) {
    return { ok: true, data: null, skipped: true, message: existing.message };
  }
  if (existing.data) {
    return { ok: true, data: existing.data };
  }

  const created = await cfFetch(baseUrl(), {
    method: "POST",
    body: JSON.stringify({
      hostname: normalized,
      ssl: { type: "dv", method: "http" },
    }),
  });
  if (!created.ok) {
    // 1406 / duplicate — race; re-fetch
    if (created.code === 1406 || /already exists/i.test(created.error)) {
      const again = await findCustomHostname(normalized);
      if (again.ok && !again.skipped && again.data) {
        return { ok: true, data: again.data };
      }
    }
    return created;
  }
  if (created.skipped) {
    return { ok: true, data: null, skipped: true, message: created.message };
  }
  return { ok: true, data: parseHostname(created.data) };
}

export async function deleteCustomHostname(
  id: string,
): Promise<CloudflareSaasResult<true>> {
  if (!id) return { ok: true, data: true };
  const result = await cfFetch(`${baseUrl()}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!result.ok) {
    // Already gone
    if (result.code === 1436 || /not found/i.test(result.error)) {
      return { ok: true, data: true };
    }
    return result;
  }
  if (result.skipped) {
    return { ok: true, data: null, skipped: true, message: result.message };
  }
  return { ok: true, data: true };
}

export function isCustomHostnameLive(record: CustomHostnameRecord | null) {
  if (!record) return false;
  return record.status === "active" && record.sslStatus === "active";
}

export function summarizeCustomHostname(
  record: CustomHostnameRecord | null,
  options?: { dnsVerified?: boolean; expectedTarget?: string },
) {
  if (!record) {
    return {
      live: false,
      domainStatus: "pending" as const,
      note: options?.expectedTarget
        ? `Add a CNAME to ${options.expectedTarget}, then re-save.`
        : "Custom hostname not provisioned yet.",
    };
  }
  if (isCustomHostnameLive(record)) {
    return {
      live: true,
      domainStatus: "active" as const,
      note: "Custom domain is live (DNS + SSL active).",
    };
  }
  if (record.sslStatus === "pending_validation" || !options?.dnsVerified) {
    return {
      live: false,
      domainStatus: "pending" as const,
      note: options?.expectedTarget
        ? `Waiting on DNS/SSL. CNAME your hostname to ${options.expectedTarget}. SSL may take a few minutes after DNS propagates.`
        : "Waiting on DNS/SSL validation.",
    };
  }
  if (record.sslStatus === "error" || record.status === "deleted") {
    return {
      live: false,
      domainStatus: "error" as const,
      note:
        record.verificationErrors?.join("; ") ||
        `Cloudflare status: ${record.status} / SSL ${record.sslStatus}.`,
    };
  }
  return {
    live: false,
    domainStatus: "pending" as const,
    note: `Provisioning… hostname ${record.status}, SSL ${record.sslStatus}.`,
  };
}
