import { expect, test } from "@playwright/test";
import { signupStudio } from "./helpers/app";

test.describe("API auth contract scenarios", () => {
  test("@regression unauthenticated protected APIs return auth errors (not 500)", async ({ page }) => {
    const routes = ["/api/admin/billing", "/api/admin/connect?refresh=1", "/api/admin/invites"];

    for (const route of routes) {
      const response = await page.request.get(route);
      expect(response.status(), `unexpected status for ${route}`).toBeGreaterThanOrEqual(400);
      expect(response.status(), `unexpected status for ${route}`).toBeLessThan(500);
      const json = (await response.json()) as { ok?: boolean; error?: string };
      expect(json.ok).toBeFalsy();
      expect(typeof json.error).toBe("string");
    }
  });

  test("@critical @regression authenticated protected APIs return success payload", async ({ page }) => {
    const stamp = String(Date.now());
    await signupStudio(page, stamp, "apiauth");

    const billing = await page.request.get("/api/admin/billing");
    expect(billing.ok(), await billing.text()).toBeTruthy();
    const billingJson = (await billing.json()) as { ok: boolean; plan?: string };
    expect(billingJson.ok).toBe(true);
    expect(typeof billingJson.plan).toBe("string");

    const connect = await page.request.get("/api/admin/connect?refresh=1");
    expect(connect.ok(), await connect.text()).toBeTruthy();
    const connectJson = (await connect.json()) as { ok: boolean; connectStatus?: string };
    expect(connectJson.ok).toBe(true);
    expect(typeof connectJson.connectStatus).toBe("string");

    const invites = await page.request.get("/api/admin/invites");
    expect(invites.ok(), await invites.text()).toBeTruthy();
    const invitesJson = (await invites.json()) as { ok: boolean; invites?: unknown[] };
    expect(invitesJson.ok).toBe(true);
    expect(Array.isArray(invitesJson.invites)).toBe(true);
  });
});
