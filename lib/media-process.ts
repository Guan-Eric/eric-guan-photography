import { customAlphabet } from "nanoid";
import { writeMediaFile } from "@/lib/media-storage";

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

const MLS_LONG_EDGE = 2048;
const WEB_LONG_EDGE = 1600;
const PROOF_LONG_EDGE = 1200;

export type ProcessedMedia = {
  assetId: string;
  originalName: string;
  width: number;
  height: number;
  bytesOriginal: number;
  pathOriginal: string;
  pathWeb: string;
  pathProof: string;
  pathMls: string;
};

type ImageInfo = { width: number; height: number; format?: string };

type ImagesBinding = {
  info: (stream: ReadableStream | ArrayBufferView) => Promise<ImageInfo>;
  input: (stream: ReadableStream | ArrayBufferView) => ImageTransformer;
};

type ImageTransformer = {
  transform: (options: Record<string, unknown>) => ImageTransformer;
  draw: (
    overlay: ImageTransformer,
    options?: Record<string, unknown>,
  ) => ImageTransformer;
  output: (options: {
    format: string;
    quality?: number;
  }) => Promise<{ response: () => Response }>;
};

function relativeBase(tenantId: string, galleryId: string, assetId: string) {
  return `${tenantId}/${galleryId}/${assetId}`;
}

function toStream(data: Buffer | Uint8Array): ReadableStream<Uint8Array> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function getImagesBinding(): Promise<ImagesBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    const images = context?.env?.IMAGES as ImagesBinding | undefined;
    return images ?? null;
  } catch {
    return null;
  }
}

async function sharpAvailable() {
  try {
    const sharp = (await import("sharp")).default;
    await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#000" },
    })
      .jpeg()
      .toBuffer();
    return true;
  } catch {
    return false;
  }
}

async function cfResize(
  images: ImagesBinding,
  input: Buffer,
  longEdge: number,
  quality: number,
  info?: ImageInfo,
) {
  const meta = info ?? (await images.info(toStream(input)));
  const landscape = meta.width >= meta.height;
  const result = await images
    .input(toStream(input))
    .transform({
      width: landscape ? longEdge : undefined,
      height: landscape ? undefined : longEdge,
      fit: "scale-down",
    })
    .output({ format: "image/jpeg", quality });
  const response = result.response();
  const data = Buffer.from(await response.arrayBuffer());
  return { data, width: meta.width, height: meta.height };
}

async function cfWatermarkProof(
  images: ImagesBinding,
  input: Buffer,
  studioName: string,
  info: ImageInfo,
) {
  const resized = await cfResize(images, input, PROOF_LONG_EDGE, 70, info);
  // Approximate output size from long-edge scale-down.
  const scale = Math.min(
    1,
    PROOF_LONG_EDGE / Math.max(info.width, info.height, 1),
  );
  const width = Math.max(1, Math.round(info.width * scale));
  const height = Math.max(1, Math.round(info.height * scale));
  const fontSize = Math.max(28, Math.round(Math.min(width, height) * 0.045));
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(-28 ${width / 2} ${height / 2})" fill="rgba(255,255,255,0.42)"
     font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700"
     letter-spacing="0.08em" text-anchor="middle">
    <text x="50%" y="46%">${escapeXml(studioName.toUpperCase())}</text>
    <text x="50%" y="56%">PROOF — NOT FOR MLS</text>
  </g>
</svg>`;

  try {
    const result = await images
      .input(toStream(resized.data))
      .draw(images.input(toStream(Buffer.from(svg, "utf8"))), {
        opacity: 1,
      })
      .output({ format: "image/jpeg", quality: 68 });
    const data = Buffer.from(await result.response().arrayBuffer());
    return { data, width, height };
  } catch {
    // Overlay may reject SVG on some accounts — keep a compressed proof frame.
    return { data: resized.data, width, height };
  }
}

async function processUploadWithCfImages(
  images: ImagesBinding,
  options: {
    tenantId: string;
    galleryId: string;
    originalName: string;
    buffer: Buffer;
    studioName: string;
  },
): Promise<ProcessedMedia> {
  const assetId = id();
  const base = relativeBase(options.tenantId, options.galleryId, assetId);
  const info = await images.info(toStream(options.buffer));

  const original = await images
    .input(toStream(options.buffer))
    .output({ format: "image/jpeg", quality: 92 });
  const originalData = Buffer.from(await original.response().arrayBuffer());

  const [web, mls, proof] = await Promise.all([
    cfResize(images, options.buffer, WEB_LONG_EDGE, 82, info),
    cfResize(images, options.buffer, MLS_LONG_EDGE, 85, info),
    cfWatermarkProof(images, options.buffer, options.studioName, info),
  ]);

  const pathOriginal = `${base}-original.jpg`;
  const pathWeb = `${base}-web.jpg`;
  const pathProof = `${base}-proof.jpg`;
  const pathMls = `${base}-mls.jpg`;

  await Promise.all([
    writeMediaFile(pathOriginal, originalData),
    writeMediaFile(pathWeb, web.data),
    writeMediaFile(pathProof, proof.data),
    writeMediaFile(pathMls, mls.data),
  ]);

  return {
    assetId,
    originalName: options.originalName,
    width: info.width,
    height: info.height,
    bytesOriginal: originalData.byteLength,
    pathOriginal,
    pathWeb,
    pathProof,
    pathMls,
  };
}

async function processUploadWithSharp(options: {
  tenantId: string;
  galleryId: string;
  originalName: string;
  buffer: Buffer;
  studioName: string;
}): Promise<ProcessedMedia> {
  const sharp = (await import("sharp")).default;
  const assetId = id();
  const base = relativeBase(options.tenantId, options.galleryId, assetId);

  async function resizeLongEdge(input: Buffer, longEdge: number, quality = 82) {
    const image = sharp(input, { failOn: "none" }).rotate();
    const meta = await image.metadata();
    const width = meta.width ?? longEdge;
    const height = meta.height ?? longEdge;
    const landscape = width >= height;

    return image
      .resize({
        width: landscape ? longEdge : undefined,
        height: landscape ? undefined : longEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  }

  async function watermarkProof(input: Buffer, studioName: string) {
    const resized = await resizeLongEdge(input, PROOF_LONG_EDGE, 70);
    const { data, info } = resized;
    const text = studioName.toUpperCase();
    const fontSize = Math.max(
      28,
      Math.round(Math.min(info.width, info.height) * 0.045),
    );

    const svg = `
    <svg width="${info.width}" height="${info.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .w {
            fill: rgba(255,255,255,0.42);
            font-family: Arial, Helvetica, sans-serif;
            font-size: ${fontSize}px;
            font-weight: 700;
            letter-spacing: 0.08em;
          }
        </style>
      </defs>
      <g transform="rotate(-28 ${info.width / 2} ${info.height / 2})">
        <text x="50%" y="46%" text-anchor="middle" class="w">${escapeXml(text)}</text>
        <text x="50%" y="56%" text-anchor="middle" class="w">PROOF — NOT FOR MLS</text>
      </g>
    </svg>
  `;

    return sharp(data)
      .composite([{ input: Buffer.from(svg), gravity: "center" }])
      .jpeg({ quality: 68, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  }

  const originalMeta = await sharp(options.buffer, { failOn: "none" })
    .rotate()
    .metadata();

  const originalJpeg = await sharp(options.buffer, { failOn: "none" })
    .rotate()
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const web = await resizeLongEdge(options.buffer, WEB_LONG_EDGE, 82);
  const mls = await resizeLongEdge(options.buffer, MLS_LONG_EDGE, 85);
  const proof = await watermarkProof(options.buffer, options.studioName);

  const pathOriginal = `${base}-original.jpg`;
  const pathWeb = `${base}-web.jpg`;
  const pathProof = `${base}-proof.jpg`;
  const pathMls = `${base}-mls.jpg`;

  await Promise.all([
    writeMediaFile(pathOriginal, originalJpeg.data),
    writeMediaFile(pathWeb, web.data),
    writeMediaFile(pathProof, proof.data),
    writeMediaFile(pathMls, mls.data),
  ]);

  return {
    assetId,
    originalName: options.originalName,
    width: originalJpeg.info.width || originalMeta.width || 0,
    height: originalJpeg.info.height || originalMeta.height || 0,
    bytesOriginal: originalJpeg.data.byteLength,
    pathOriginal,
    pathWeb,
    pathProof,
    pathMls,
  };
}

export async function processUpload(options: {
  tenantId: string;
  galleryId: string;
  originalName: string;
  buffer: Buffer;
  studioName: string;
}): Promise<ProcessedMedia> {
  if (options.buffer.byteLength === 0) {
    throw new Error("Empty file.");
  }
  if (options.buffer.byteLength > 20 * 1024 * 1024) {
    throw new Error("Each photo must be 20 MB or smaller.");
  }

  const images = await getImagesBinding();
  if (images) {
    return processUploadWithCfImages(images, options);
  }

  if (await sharpAvailable()) {
    return processUploadWithSharp(options);
  }

  throw new Error(
    "Image processing is unavailable. On Cloudflare, enable the Images binding; locally, install sharp.",
  );
}

export async function processPortfolioImage(options: {
  tenantId: string;
  buffer: Buffer;
  originalName: string;
}): Promise<{ src: string; width: number; height: number; alt: string }> {
  if (options.buffer.byteLength === 0) {
    throw new Error("Empty file.");
  }
  if (options.buffer.byteLength > 12 * 1024 * 1024) {
    throw new Error("Image must be under 12MB.");
  }

  const relativePath = `${options.tenantId}/portfolio/${id()}.jpg`;
  let width = 1800;
  let height = 1200;
  let data: Buffer;

  const images = await getImagesBinding();
  if (images) {
    const info = await images.info(toStream(options.buffer));
    width = info.width;
    height = info.height;
    const landscape = width >= height;
    const result = await images
      .input(toStream(options.buffer))
      .transform({
        width: landscape ? 2400 : undefined,
        height: landscape ? undefined : 1800,
        fit: "scale-down",
      })
      .output({ format: "image/jpeg", quality: 82 });
    data = Buffer.from(await result.response().arrayBuffer());
  } else if (await sharpAvailable()) {
    const sharp = (await import("sharp")).default;
    const pipeline = sharp(options.buffer, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();
    width = meta.width ?? 1800;
    height = meta.height ?? 1200;
    data = await pipeline
      .resize({
        width: 2400,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } else {
    throw new Error(
      "Image processing is unavailable. On Cloudflare, enable the Images binding.",
    );
  }

  await writeMediaFile(relativePath, data);
  const src = `/api/site-media/${relativePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const alt = options.originalName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]/g, " ");
  return { src, width, height, alt };
}
