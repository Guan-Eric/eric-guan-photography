import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import "../helpers/next-mocks";
import { getPhotographerSession } from "@/lib/auth";
import { getTenantRowBySlug } from "@/lib/tenant-store";
import { ensureTestDb } from "../helpers/db";
import { jsonRequest, readJson } from "../helpers/http";
import {
  absorbResponseCookies,
  getCookieValue,
  resetCookieStore,
} from "../helpers/next-mocks";

describe("signup + session", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  beforeEach(() => {
    resetCookieStore();
  });

  it("registers a user with studio and sets session cookies", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const stamp = Date.now();
    const studioName = `Vitest Studio ${stamp}`;
    const response = await POST(
      jsonRequest("http://localhost:3000/api/auth/signup", {
        firstName: "Vitest",
        lastName: "Owner",
        studioName,
        email: `vitest-owner-${stamp}@example.com`,
        password: "ValidPassw0rd!",
      }),
    );
    const json = await readJson<{
      ok: boolean;
      hasStudio?: boolean;
      slug?: string;
      userId?: string;
      error?: string;
    }>(response);

    absorbResponseCookies(response);

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.hasStudio).toBe(true);
    expect(json.slug).toBeTruthy();
    expect(getCookieValue("eg_photographer_session")).toBeTruthy();
    expect(getCookieValue("eg_active_tenant")).toBeTruthy();

    const row = await getTenantRowBySlug(json.slug!);
    expect(row).toBeTruthy();

    const session = await getPhotographerSession();
    expect(session?.user.id).toBe(json.userId);
    expect(session?.activeTenantId).toBe(row!.id);
  });

  it("logs in an existing seeded owner", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/auth/login", {
        email: "demo@example.com",
        password: process.env.ADMIN_PASSWORD ?? "dev-admin",
      }),
    );
    const json = await readJson<{ ok: boolean; hasStudio?: boolean }>(response);
    absorbResponseCookies(response);
    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.hasStudio).toBe(true);
    expect(getCookieValue("eg_photographer_session")).toBeTruthy();
  });

  it("rejects weak passwords on signup", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/auth/signup", {
        firstName: "Weak",
        lastName: "Pass",
        studioName: "Weak Studio",
        email: `weak-${Date.now()}@example.com`,
        password: "short",
      }),
    );
    expect(response.status).toBe(400);
    const json = await readJson<{ ok: boolean }>(response);
    expect(json.ok).toBe(false);
  });
});
