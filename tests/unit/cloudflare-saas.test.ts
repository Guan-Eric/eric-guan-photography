import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cloudflareSaasConfigured,
  deleteCustomHostname,
  findCustomHostname,
  isCustomHostnameLive,
  summarizeCustomHostname,
  upsertCustomHostname,
} from "@/lib/cloudflare-saas";

describe("cloudflare-saas", () => {
  const previous = {
    zone: process.env.CLOUDFLARE_ZONE_ID,
    token: process.env.CF_SAAS_API_TOKEN,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    if (previous.zone === undefined) delete process.env.CLOUDFLARE_ZONE_ID;
    else process.env.CLOUDFLARE_ZONE_ID = previous.zone;
    if (previous.token === undefined) delete process.env.CF_SAAS_API_TOKEN;
    else process.env.CF_SAAS_API_TOKEN = previous.token;
  });

  it("reports unconfigured when secrets missing", () => {
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.CF_SAAS_API_TOKEN;
    expect(cloudflareSaasConfigured()).toBe(false);
  });

  it("skips API calls when unconfigured", async () => {
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.CF_SAAS_API_TOKEN;
    const result = await upsertCustomHostname("photos.example.com");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.skipped).toBe(true);
      expect(result.data).toBeNull();
    }
  });

  it("creates custom hostname with http DV SSL", async () => {
    process.env.CLOUDFLARE_ZONE_ID = "zone_test";
    process.env.CF_SAAS_API_TOKEN = "token_test";

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("hostname=") && (!init || init.method === "GET")) {
        return Response.json({ success: true, result: [] });
      }
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.hostname).toBe("photos.example.com");
        expect(body.ssl).toEqual({ type: "dv", method: "http" });
        return Response.json({
          success: true,
          result: {
            id: "ch_1",
            hostname: "photos.example.com",
            status: "pending",
            ssl: { status: "pending_validation", method: "http" },
          },
        });
      }
      throw new Error(`Unexpected fetch ${url} ${init?.method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await upsertCustomHostname("Photos.Example.com");
    expect(result.ok).toBe(true);
    if (result.ok && !result.skipped) {
      expect(result.data.id).toBe("ch_1");
      expect(result.data.sslStatus).toBe("pending_validation");
    }
    expect(fetchMock).toHaveBeenCalled();
  });

  it("reuses existing hostname on find", async () => {
    process.env.CLOUDFLARE_ZONE_ID = "zone_test";
    process.env.CF_SAAS_API_TOKEN = "token_test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          result: [
            {
              id: "ch_existing",
              hostname: "photos.example.com",
              status: "active",
              ssl: { status: "active" },
            },
          ],
        }),
      ),
    );

    const found = await findCustomHostname("photos.example.com");
    expect(found.ok).toBe(true);
    if (found.ok && !found.skipped) {
      expect(found.data?.id).toBe("ch_existing");
      expect(isCustomHostnameLive(found.data)).toBe(true);
    }
  });

  it("treats missing delete as success", async () => {
    process.env.CLOUDFLARE_ZONE_ID = "zone_test";
    process.env.CF_SAAS_API_TOKEN = "token_test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: false,
          errors: [{ code: 1436, message: "Hostname not found" }],
        }),
      ),
    );
    const result = await deleteCustomHostname("ch_gone");
    expect(result.ok).toBe(true);
  });

  it("summarizes live vs pending", () => {
    expect(
      summarizeCustomHostname({
        id: "1",
        hostname: "a.com",
        status: "active",
        sslStatus: "active",
      }).domainStatus,
    ).toBe("active");
    expect(
      summarizeCustomHostname(
        {
          id: "1",
          hostname: "a.com",
          status: "pending",
          sslStatus: "pending_validation",
        },
        { dnsVerified: false, expectedTarget: "sites.studiofront.ca" },
      ).note,
    ).toMatch(/sites\.studiofront\.ca/);
  });
});
