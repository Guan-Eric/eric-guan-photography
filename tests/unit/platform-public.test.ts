import { afterEach, describe, expect, it } from "vitest";
import { platformName } from "@/lib/platform-public";

describe("platform-public", () => {
  const previous = process.env.NEXT_PUBLIC_PLATFORM_NAME;

  afterEach(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_NAME;
    else process.env.NEXT_PUBLIC_PLATFORM_NAME = previous;
  });

  it("prefers the public platform name", () => {
    process.env.NEXT_PUBLIC_PLATFORM_NAME = "Frontstage";
    expect(platformName()).toBe("Frontstage");
  });

  it("falls back to PLATFORM_NAME then Studiofront", () => {
    delete process.env.NEXT_PUBLIC_PLATFORM_NAME;
    const previous = process.env.PLATFORM_NAME;
    process.env.PLATFORM_NAME = "FromEnv";
    expect(platformName()).toBe("FromEnv");
    delete process.env.PLATFORM_NAME;
    expect(platformName()).toBe("Studiofront");
    if (previous === undefined) delete process.env.PLATFORM_NAME;
    else process.env.PLATFORM_NAME = previous;
  });
});
