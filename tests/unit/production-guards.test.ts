import { beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.hoisted(() => ({
  get: vi.fn<(name: string) => string | null>(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: headersMock.get,
  }),
}));

describe("getRequestTenant", () => {
  beforeEach(() => {
    headersMock.get.mockReset();
    process.env.PLATFORM_ROOT_DOMAIN = "localhost";
  });

  it("ignores spoofed x-tenant-id and resolves from x-tenant-slug", async () => {
    headersMock.get.mockImplementation((name: string) => {
      if (name === "x-tenant-id") return "eric-guan";
      if (name === "x-tenant-slug") return "demo";
      if (name === "x-tenant-host") return "demo.localhost:3000";
      if (name === "host") return "demo.localhost:3000";
      return null;
    });

    const { ensureTestDb } = await import("../helpers/db");
    ensureTestDb();

    const { getRequestTenant } = await import("@/lib/tenants");
    const tenant = await getRequestTenant();
    expect(tenant?.id).toBe("demo-studio");
    expect(tenant?.id).not.toBe("eric-guan");
  });
});

describe("authSessionSecret", () => {
  it("throws in production when unset", async () => {
    const prevNode = process.env.NODE_ENV;
    const prevAuth = process.env.AUTH_SESSION_SECRET;
    const prevAdmin = process.env.ADMIN_SESSION_SECRET;
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_SESSION_SECRET;
    delete process.env.ADMIN_SESSION_SECRET;
    vi.resetModules();
    const { authSessionSecret } = await import("@/lib/secrets");
    expect(() => authSessionSecret()).toThrow(/AUTH_SESSION_SECRET/);
    process.env.NODE_ENV = prevNode;
    if (prevAuth) process.env.AUTH_SESSION_SECRET = prevAuth;
    if (prevAdmin) process.env.ADMIN_SESSION_SECRET = prevAdmin;
  });
});

describe("galleryStubUnlockAllowed", () => {
  it("is false in production even with ALLOW_GALLERY_STUB_UNLOCK", async () => {
    const prevNode = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_GALLERY_STUB_UNLOCK;
    process.env.NODE_ENV = "production";
    process.env.ALLOW_GALLERY_STUB_UNLOCK = "1";
    vi.resetModules();
    const { galleryStubUnlockAllowed } = await import("@/lib/gallery-stub");
    expect(galleryStubUnlockAllowed()).toBe(false);
    process.env.NODE_ENV = prevNode;
    process.env.ALLOW_GALLERY_STUB_UNLOCK = prevAllow;
  });
});
