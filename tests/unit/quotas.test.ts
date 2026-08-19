import { describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/quotas";

describe("in-memory rate limit", () => {
  it("allows up to the limit then blocks", () => {
    resetRateLimits();
    const first = checkRateLimit("lead:test", 2, 60_000);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.remaining).toBe(1);

    const second = checkRateLimit("lead:test", 2, 60_000);
    expect(second.ok).toBe(true);

    const third = checkRateLimit("lead:test", 2, 60_000);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("prunes stale keys once the map grows past 5000", () => {
    resetRateLimits();
    for (let i = 0; i < 5001; i += 1) {
      checkRateLimit(`stale-${i}`, 5, 1);
    }
    const later = Date.now() + 5;
    while (Date.now() < later) {
      /* wait out the 1ms window */
    }
    const fresh = checkRateLimit("fresh-key", 5, 1);
    expect(fresh.ok).toBe(true);
    resetRateLimits();
  });
});
