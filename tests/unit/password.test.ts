import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("round-trips a valid password", () => {
    const stored = hashPassword("ValidPassw0rd!");
    expect(stored).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
    expect(verifyPassword("ValidPassw0rd!", stored)).toBe(true);
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("rejects a malformed stored hash", () => {
    expect(verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(verifyPassword("anything", "")).toBe(false);
    expect(verifyPassword("anything", "abcd:00")).toBe(false);
  });
});
