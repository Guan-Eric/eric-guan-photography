import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { Readable } from "node:stream";

/**
 * Media storage adapter.
 * - Default: local filesystem under data/media
 * - When CLOUDFLARE_R2_* env vars are set: S3-compatible R2 via fetch (Put/Get)
 */

const MEDIA_ROOT =
  process.env.MEDIA_ROOT ??
  path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "media");

function r2Configured() {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_BUCKET,
  );
}

export function mediaRoot() {
  return MEDIA_ROOT;
}

export function usingR2() {
  return r2Configured();
}

export function galleryDir(tenantId: string, galleryId: string) {
  return path.join(/*turbopackIgnore: true*/ MEDIA_ROOT, tenantId, galleryId);
}

export async function ensureGalleryDir(tenantId: string, galleryId: string) {
  if (r2Configured()) return `${tenantId}/${galleryId}`;
  const dir = galleryDir(tenantId, galleryId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function r2ObjectUrl(relativePath: string) {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID!;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET!;
  const endpoint =
    process.env.CLOUDFLARE_R2_ENDPOINT ??
    `https://${accountId}.r2.cloudflarestorage.com`;
  return `${endpoint}/${bucket}/${relativePath}`;
}

/**
 * R2 write stub: requires AWS Signature V4 in production.
 * Production path: install `@aws-sdk/client-s3`, set CLOUDFLARE_R2_* and
 * R2_FORCE_REMOTE=1, then replace writeR2() with signed PutObject.
 * Do not invite a second live tenant onto local-mirror storage.
 */
async function writeR2(relativePath: string, data: Buffer) {
  if (process.env.R2_FORCE_REMOTE === "1") {
    // Placeholder for signed PutObject — not enabled until SDK is added.
    console.warn(
      `[r2:stub] would PUT ${r2ObjectUrl(relativePath)} (${data.byteLength} bytes)`,
    );
  }
  // Always mirror locally until signed R2 client is enabled.
  const absolute = path.join(/*turbopackIgnore: true*/ MEDIA_ROOT, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, data);
  return relativePath;
}

export async function writeMediaFile(relativePath: string, data: Buffer) {
  if (r2Configured()) {
    return writeR2(relativePath, data);
  }
  const absolute = path.join(/*turbopackIgnore: true*/ MEDIA_ROOT, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, data);
  return relativePath;
}

export function resolveMediaPath(relativePath: string) {
  const absolute = path.resolve(/*turbopackIgnore: true*/ MEDIA_ROOT, relativePath);
  const root = path.resolve(/*turbopackIgnore: true*/ MEDIA_ROOT);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    throw new Error("Invalid media path.");
  }
  return absolute;
}

export function mediaExists(relativePath: string) {
  return existsSync(/*turbopackIgnore: true*/ resolveMediaPath(relativePath));
}

export function openMediaStream(relativePath: string) {
  return createReadStream(/*turbopackIgnore: true*/ resolveMediaPath(relativePath));
}

export async function readMediaFile(relativePath: string) {
  return fs.readFile(/*turbopackIgnore: true*/ resolveMediaPath(relativePath));
}

export async function readMediaStream(relativePath: string): Promise<Readable> {
  return openMediaStream(relativePath);
}
