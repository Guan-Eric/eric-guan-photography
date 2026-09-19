import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgentOtpChallenge,
  portalDevBypassAllowed,
  verifyAgentOtpChallenge,
} from "@/lib/agent-auth";
import { ensureTestDb } from "../helpers/db";

describe("agent OTP challenges", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("verifies a fresh code once and rejects reuse", async () => {
    const code = await createAgentOtpChallenge("demo-studio", "otp-once@example.com");
    expect(code).toMatch(/^\d{6}$/);

    const first = await verifyAgentOtpChallenge("demo-studio", "otp-once@example.com", code);
    expect(first).toEqual({
      ok: true,
      session: { tenantId: "demo-studio", email: "otp-once@example.com" },
    });

    const second = await verifyAgentOtpChallenge("demo-studio", "otp-once@example.com", code);
    expect(second).toEqual({ ok: false, error: "invalid" });
  });

  it("locks after too many incorrect attempts", async () => {
    const email = `otp-lock-${Date.now()}@example.com`;
    await createAgentOtpChallenge("demo-studio", email);

    for (let i = 0; i < 4; i += 1) {
      const result = await verifyAgentOtpChallenge("demo-studio", email, "000000");
      expect(result).toEqual({ ok: false, error: "invalid" });
    }
    const locked = await verifyAgentOtpChallenge("demo-studio", email, "000000");
    expect(locked).toEqual({ ok: false, error: "locked" });
  });

  it("rejects expired challenges", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const email = `otp-exp-${Date.now()}@example.com`;
    const code = await createAgentOtpChallenge("demo-studio", email);
    vi.setSystemTime(new Date("2026-01-01T12:15:00.000Z"));
    const result = await verifyAgentOtpChallenge("demo-studio", email, code);
    expect(result).toEqual({ ok: false, error: "expired" });
    vi.useRealTimers();
  });
});

describe("portalDevBypassAllowed", () => {
  it("is false in production even with ALLOW_PORTAL_DEV_BYPASS", () => {
    const prevNode = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_PORTAL_DEV_BYPASS;
    process.env.NODE_ENV = "production";
    process.env.ALLOW_PORTAL_DEV_BYPASS = "1";
    expect(portalDevBypassAllowed()).toBe(false);
    process.env.NODE_ENV = prevNode;
    process.env.ALLOW_PORTAL_DEV_BYPASS = prevAllow;
  });

  it("is true in development", () => {
    const prevNode = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_PORTAL_DEV_BYPASS;
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_PORTAL_DEV_BYPASS;
    expect(portalDevBypassAllowed()).toBe(true);
    process.env.NODE_ENV = prevNode;
    process.env.ALLOW_PORTAL_DEV_BYPASS = prevAllow;
  });
});
