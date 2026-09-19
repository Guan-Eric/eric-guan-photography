import { deflateSync } from "node:zlib";

/**
 * CF Images `.text({ font: { url } })` fetches that URL as a draw overlay.
 * jsDelivr sits on Cloudflare and often returns 500 to that fetcher
 * (IMAGES_TRANSFORM_ERROR 9410). Keep an override for ops, but default to
 * Google-hosted Inter so the fetch is not a Cloudflare-to-Cloudflare hop.
 */
export function watermarkFontUrl() {
  return (
    process.env.WATERMARK_FONT_URL?.trim() ||
    "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiA.woff2"
  );
}

/** ASCII-only label so a single latin font file covers every glyph. */
export function proofWatermarkLabel(studioName: string) {
  const studio = studioName
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/[^A-Z0-9&.,'"\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 42);
  return `${studio || "STUDIO"}  |  PROOF - NOT FOR MLS`;
}

/** 5x7 bitmap, bit4 = left column. */
const GLYPHS: Record<string, readonly number[]> = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "|": [0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  ".": [0, 0, 0, 0, 0, 0x04, 0x04],
  ",": [0, 0, 0, 0, 0x04, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  "&": [0x0a, 0x15, 0x0a, 0x15, 0x11, 0x11, 0x0e],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x01, 0x01, 0x01, 0x01, 0x11, 0x11, 0x0e],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x0e, 0x11, 0x01, 0x06, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of data) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function pngChunk(type: string, data: Uint8Array) {
  const typeBytes = Buffer.from(type, "ascii");
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const chunk = new Uint8Array(8 + data.length + 4);
  chunk.set(u32(data.length), 0);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  chunk.set(u32(crc32(crcInput)), 8 + data.length);
  return chunk;
}

function encodePngRgba(width: number, height: number, pixels: Uint8Array) {
  const stride = width * 4;
  const raw = new Uint8Array(height * (1 + stride));
  for (let y = 0; y < height; y += 1) {
    const dest = y * (1 + stride);
    raw[dest] = 0;
    raw.set(pixels.subarray(y * stride, y * stride + stride), dest + 1);
  }
  const ihdr = new Uint8Array(13);
  ihdr.set(u32(width), 0);
  ihdr.set(u32(height), 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts = [
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", new Uint8Array()),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return Buffer.from(out);
}

function stampGlyph(
  pixels: Uint8Array,
  width: number,
  height: number,
  glyph: readonly number[],
  originX: number,
  originY: number,
  scale: number,
) {
  for (let row = 0; row < 7; row += 1) {
    const bits = glyph[row] ?? 0;
    for (let col = 0; col < 5; col += 1) {
      if ((bits & (1 << (4 - col))) === 0) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const x = Math.round(originX + col * scale + dx);
          const y = Math.round(originY + row * scale + dy);
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const i = (y * width + x) * 4;
          pixels[i] = 255;
          pixels[i + 1] = 255;
          pixels[i + 2] = 255;
          pixels[i + 3] = 255;
        }
      }
    }
  }
}

/**
 * Transparent PNG of diagonal proof text. Passed to CF Images `.draw()` as
 * bytes so watermarking never depends on fetching a remote font/overlay URL.
 */
export function renderWatermarkPng(text: string) {
  const chars = [...text.toUpperCase()].map((ch) =>
    GLYPHS[ch] ? ch : ch === "—" || ch === "–" ? "-" : " ",
  );
  const scale = 4;
  const advance = 5 * scale + scale;
  const glyphH = 7 * scale;
  const angle = (28 * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pad = 28;
  const width = Math.max(
    64,
    Math.ceil(Math.abs(chars.length * advance * cos) + glyphH + pad * 2),
  );
  const height = Math.max(
    48,
    Math.ceil(Math.abs(chars.length * advance * sin) + glyphH + pad * 2),
  );
  const pixels = new Uint8Array(width * height * 4);
  const startX = pad;
  const startY = height - pad - glyphH;

  chars.forEach((ch, index) => {
    stampGlyph(
      pixels,
      width,
      height,
      GLYPHS[ch] ?? GLYPHS[" "]!,
      startX + index * advance * cos,
      startY - index * advance * sin,
      scale,
    );
  });

  return encodePngRgba(width, height, pixels);
}
