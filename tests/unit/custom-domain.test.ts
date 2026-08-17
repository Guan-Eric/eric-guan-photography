import { afterEach, describe, expect, it } from "vitest";
import { expectedDomainTarget, verifyCustomDomain } from "@/lib/custom-domain";

describe("custom-domain", () => {
  const previous = {
    custom: process.env.CUSTOM_DOMAIN_TARGET,
    root: process.env.PLATFORM_ROOT_DOMAIN,
  };

  afterEach(() => {
    if (previous.custom === undefined) delete process.env.CUSTOM_DOMAIN_TARGET;
    else process.env.CUSTOM_DOMAIN_TARGET = previous.custom;
    if (previous.root === undefined) delete process.env.PLATFORM_ROOT_DOMAIN;
    else process.env.PLATFORM_ROOT_DOMAIN = previous.root;
  });

  it("resolves expected DNS target from env", () => {
    process.env.CUSTOM_DOMAIN_TARGET = "cname.example.com";
    expect(expectedDomainTarget()).toBe("cname.example.com");
    delete process.env.CUSTOM_DOMAIN_TARGET;
    process.env.PLATFORM_ROOT_DOMAIN = "StudioFront.CA";
    expect(expectedDomainTarget()).toBe("sites.studiofront.ca");
  });

  it("defaults localhost when root is localhost", () => {
    delete process.env.CUSTOM_DOMAIN_TARGET;
    process.env.PLATFORM_ROOT_DOMAIN = "localhost";
    expect(expectedDomainTarget()).toBe("localhost");
  });

  it("skips DNS for localhost / cleared domains", async () => {
    process.env.PLATFORM_ROOT_DOMAIN = "localhost";
    const cleared = await verifyCustomDomain(null);
    expect(cleared.status).toBe("cleared");
    expect(cleared.verified).toBe(true);

    const local = await verifyCustomDomain("https://MyStudio.localhost/");
    expect(local.verified).toBe(true);
    expect(local.domain).toBe("mystudio.localhost");
    expect(local.message).toMatch(/DNS check skipped/);
  });
});
