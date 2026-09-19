import { describe, expect, it } from "vitest";
import { buildProofBuffer } from "@/lib/media-process";

describe("buildProofBuffer", () => {
  it("watermarks a JPEG with sharp when CF Images is unavailable", async () => {
    const sharp = (await import("sharp")).default;
    const original = await sharp({
      create: { width: 640, height: 480, channels: 3, background: "#2c4a42" },
    })
      .jpeg()
      .toBuffer();

    const proof = await buildProofBuffer(original, "Eric Guan Photography");
    expect(proof.data.byteLength).toBeGreaterThan(1000);
    expect(proof.width).toBeGreaterThan(0);
    expect(proof.height).toBeGreaterThan(0);

    const meta = await sharp(proof.data).metadata();
    expect(meta.format).toBe("jpeg");
  });
});
