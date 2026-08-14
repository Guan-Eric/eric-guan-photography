import sharp from "sharp";
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

function relativeBase(tenantId: string, galleryId: string, assetId: string) {
  return `${tenantId}/${galleryId}/${assetId}`;
}

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
  const fontSize = Math.max(28, Math.round(Math.min(info.width, info.height) * 0.045));

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

  const proof = await sharp(data)
    .composite([{ input: Buffer.from(svg), gravity: "center" }])
    .jpeg({ quality: 68, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return proof;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function processUpload(options: {
  tenantId: string;
  galleryId: string;
  originalName: string;
  buffer: Buffer;
  studioName: string;
}): Promise<ProcessedMedia> {
  const assetId = id();
  const base = relativeBase(options.tenantId, options.galleryId, assetId);

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
