import { describe, expect, it } from "vitest";
import {
  proofWatermarkLabel,
  renderWatermarkPng,
  watermarkFontUrl,
} from "@/lib/watermark-overlay";

describe("proofWatermarkLabel", () => {
  it("uppercases and strips punctuation CF Images latin subsets may lack", () => {
    expect(proofWatermarkLabel("Eric Guan Photography")).toBe(
      "ERIC GUAN PHOTOGRAPHY  |  PROOF - NOT FOR MLS",
    );
    expect(proofWatermarkLabel("Caf\u00e9 \u2014 L\u2019Atelier")).toBe(
      "CAFE - L'ATELIER  |  PROOF - NOT FOR MLS",
    );
  });

  it("falls back when the studio name is empty", () => {
    expect(proofWatermarkLabel("   ")).toBe("STUDIO  |  PROOF - NOT FOR MLS");
  });
});

describe("watermarkFontUrl", () => {
  it("defaults to Google-hosted Inter, not jsDelivr", () => {
    const prev = process.env.WATERMARK_FONT_URL;
    delete process.env.WATERMARK_FONT_URL;
    expect(watermarkFontUrl()).toContain("fonts.gstatic.com");
    expect(watermarkFontUrl()).not.toContain("jsdelivr");
    if (prev === undefined) delete process.env.WATERMARK_FONT_URL;
    else process.env.WATERMARK_FONT_URL = prev;
  });
});

describe("renderWatermarkPng", () => {
  it("encodes a PNG with opaque white glyphs", async () => {
    const png = renderWatermarkPng("STUDIO  |  PROOF - NOT FOR MLS");
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );

    const sharp = (await import("sharp")).default;
    const image = sharp(png);
    const meta = await image.metadata();
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);
    expect((meta.width ?? 0) > 200).toBe(true);
    expect((meta.height ?? 0) > 40).toBe(true);

    const stats = await sharp(png).stats();
    expect(stats.channels[0]?.max ?? 0).toBeGreaterThan(200);
    expect(stats.channels[3]?.max ?? 0).toBeGreaterThan(200);
  });
});
