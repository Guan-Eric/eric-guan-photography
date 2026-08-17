import { describe, expect, it } from "vitest";
import {
  TenantIsolationError,
  assertSameTenant,
  belongsToTenant,
} from "@/lib/isolation";

describe("isolation", () => {
  it("belongsToTenant is strict equality", () => {
    expect(belongsToTenant("eric-guan", "eric-guan")).toBe(true);
    expect(belongsToTenant("eric-guan", "demo-studio")).toBe(false);
    expect(belongsToTenant(null, "eric-guan")).toBe(false);
    expect(belongsToTenant(undefined, "eric-guan")).toBe(false);
  });

  it("assertSameTenant throws TenantIsolationError on mismatch", () => {
    expect(() => assertSameTenant("eric-guan", "eric-guan")).not.toThrow();
    expect(() => assertSameTenant("eric-guan", "demo-studio", "Order")).toThrow(
      TenantIsolationError,
    );
    expect(() => assertSameTenant("eric-guan", "demo-studio", "Order")).toThrow(
      /Order does not belong/,
    );
  });
});
