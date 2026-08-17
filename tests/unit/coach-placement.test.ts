import { describe, expect, it } from "vitest";
import { resolvePlacement } from "@/components/coach-tour";

const tip = { width: 320, height: 220 };
const desktop = { width: 1440, height: 900 };
const phone = { width: 320, height: 568 };

describe("resolvePlacement", () => {
  it("places below the target when there is room", () => {
    const pos = resolvePlacement({ top: 100, left: 200, width: 180, height: 40 }, tip, desktop);
    expect(pos.placement).toBe("below");
    expect(pos.top).toBe(152);
    expect(pos.left).toBe(200);
  });

  it("flips above when the target sits near the bottom", () => {
    const pos = resolvePlacement({ top: 780, left: 200, width: 180, height: 40 }, tip, desktop);
    expect(pos.placement).toBe("above");
    expect(pos.top).toBe(548);
  });

  it("never leaves the right edge", () => {
    const pos = resolvePlacement({ top: 100, left: 1380, width: 40, height: 40 }, tip, desktop);
    expect(pos.left + tip.width).toBeLessThanOrEqual(desktop.width - 12);
  });

  it("never leaves the left edge on a narrow viewport", () => {
    const pos = resolvePlacement({ top: 40, left: 8, width: 300, height: 40 }, tip, phone);
    expect(pos.left).toBeGreaterThanOrEqual(12);
    expect(pos.top).toBeGreaterThanOrEqual(12);
  });

  it("keeps a tall tip inside a short viewport", () => {
    const tall = { width: 320, height: 700 };
    const pos = resolvePlacement({ top: 200, left: 20, width: 100, height: 40 }, tall, phone);
    expect(pos.top).toBe(12);
    expect(pos.left).toBeGreaterThanOrEqual(12);
  });

  it("centres when there is no target", () => {
    const pos = resolvePlacement(null, tip, desktop);
    expect(pos.placement).toBe("center");
    expect(pos.left).toBe(560);
  });

  it("goes beside the target when it fills the vertical space", () => {
    const pos = resolvePlacement({ top: 12, left: 12, width: 200, height: 860 }, tip, desktop);
    expect(pos.placement).toBe("right");
    expect(pos.left).toBe(224);
  });
});
