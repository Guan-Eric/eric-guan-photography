import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import "../helpers/next-mocks";
import {
  consumeAgentLoginToken,
  createAgentLoginToken,
  getAgentSession,
} from "@/lib/agent-auth";
import { getTenant } from "@/lib/tenants";
import { ensureTestDb } from "../helpers/db";
import {
  absorbResponseCookies,
  getCookieValue,
  resetCookieStore,
} from "../helpers/next-mocks";

describe("agent portal magic link", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  beforeEach(() => {
    resetCookieStore();
  });

  it("consumes a token once and rejects reuse", async () => {
    const tenant = await getTenant("eric-guan");
    const email = "jane.doe@realty.example.com";
    const token = await createAgentLoginToken(tenant.id, email);

    const first = await consumeAgentLoginToken(token);
    const second = await consumeAgentLoginToken(token);
    expect(first).toEqual({ tenantId: tenant.id, email });
    expect(second).toBeNull();
  });

  it("sets a session for emails with dots via callback", async () => {
    const tenant = await getTenant("eric-guan");
    const email = "jane.doe@realty.example.com";
    const token = await createAgentLoginToken(tenant.id, email);

    const { POST } = await import("@/app/api/portal/callback/route");
    const response = await POST(
      new Request("https://studiofront.workers.dev/api/portal/callback", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          host: "studiofront.workers.dev",
          "x-forwarded-host": "silentshutter.studiofront.ca",
          "x-forwarded-proto": "https",
        },
        body: new URLSearchParams({ token }).toString(),
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://silentshutter.studiofront.ca/portal",
    );
    absorbResponseCookies(response);
    expect(getCookieValue("sf_agent")).toBeTruthy();
    const session = await getAgentSession();
    expect(session).toEqual({ tenantId: tenant.id, email });
  });

  it("rejects a missing token", async () => {
    const { POST } = await import("@/app/api/portal/callback/route");
    const response = await POST(
      new Request("http://localhost:3000/api/portal/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams().toString(),
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/portal/login?error=expired");
  });
});
