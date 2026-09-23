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

  it("stamps the Studiofront badge in the bottom-right corner", async () => {
    const sharp = (await import("sharp")).default;
    const original = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: "#101010" },
    })
      .jpeg()
      .toBuffer();

    const proof = await buildProofBuffer(original, "Eric Guan Photography");
    const meanOf = async (left: number, top: number) => {
      const crop = await sharp(proof.data)
        .extract({ left, top, width: 80, height: 30 })
        .toBuffer();
      const stats = await sharp(crop).stats();
      return stats.channels[0]!.mean;
    };

    const bottomRight = await meanOf(proof.width - 20 - 80 - 90, proof.height - 20 - 45);
    const topLeft = await meanOf(20, 20);
    expect(bottomRight).toBeGreaterThan(topLeft + 80);
  });
});
