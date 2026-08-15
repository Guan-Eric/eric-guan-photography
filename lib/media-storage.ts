import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { Readable } from "node:stream";

/**
 * Media storage adapter.
 * - Default: local filesystem under data/media
 * - When CLOUDFLARE_R2_* is set: signed S3 PutObject/GetObject against R2
 * - R2_FORCE_REMOTE=1: skip local mirror (production)
 * - R2 configured without FORCE_REMOTE: write to both during transition
 */

const MEDIA_ROOT =
  process.env.MEDIA_ROOT ??
  path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "media");

let s3Client: S3Client | null = null;

function r2Configured() {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_BUCKET,
  );
}

function forceRemote() {
  return r2Configured() && process.env.R2_FORCE_REMOTE === "1";
}

function r2Endpoint() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID!;
  return (
    process.env.CLOUDFLARE_R2_ENDPOINT ??
    `https://${accountId}.r2.cloudflarestorage.com`
  );
}

function getS3Client() {
  if (!r2Configured()) {
    throw new Error("R2 is not configured.");
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint(),
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

function r2Bucket() {
  return process.env.CLOUDFLARE_R2_BUCKET!;
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
  if (forceRemote()) return `${tenantId}/${galleryId}`;
  const dir = galleryDir(tenantId, galleryId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function writeLocal(relativePath: string, data: Buffer) {
  const absolute = path.join(/*turbopackIgnore: true*/ MEDIA_ROOT, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, data);
}

async function writeR2(relativePath: string, data: Buffer) {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: relativePath,
      Body: data,
      ContentType: "image/jpeg",
    }),
  );
}

export async function writeMediaFile(relativePath: string, data: Buffer) {
  if (r2Configured()) {
    await writeR2(relativePath, data);
    if (!forceRemote()) {
      await writeLocal(relativePath, data);
    }
    return relativePath;
  }
  await writeLocal(relativePath, data);
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
  if (!forceRemote() && existsSync(/*turbopackIgnore: true*/ resolveMediaPath(relativePath))) {
    return true;
  }
  // Remote-only existence is checked at read time via GetObject.
  return r2Configured();
}

async function readR2Buffer(relativePath: string): Promise<Buffer> {
  const client = getS3Client();
  const result = await client.send(
    new GetObjectCommand({
      Bucket: r2Bucket(),
      Key: relativePath,
    }),
  );
  if (!result.Body) {
    throw new Error(`R2 object missing body: ${relativePath}`);
  }
  const bytes = await result.Body.transformToByteArray();
  return Buffer.from(bytes);
}

async function readR2Stream(relativePath: string): Promise<Readable> {
  const client = getS3Client();
  const result = await client.send(
    new GetObjectCommand({
      Bucket: r2Bucket(),
      Key: relativePath,
    }),
  );
  if (!result.Body) {
    throw new Error(`R2 object missing body: ${relativePath}`);
  }
  // SDK Body is a web/Node stream depending on runtime — normalize to Node Readable.
  const body = result.Body as Readable | { transformToWebStream: () => ReadableStream };
  if (typeof (body as Readable).pipe === "function") {
    return body as Readable;
  }
  return Readable.fromWeb(
    (body as { transformToWebStream: () => ReadableStream }).transformToWebStream() as import("stream/web").ReadableStream,
  );
}

function localExists(relativePath: string) {
  try {
    return existsSync(/*turbopackIgnore: true*/ resolveMediaPath(relativePath));
  } catch {
    return false;
  }
}

/**
 * Prefer local when mirrored; otherwise GetObject from R2 when configured.
 * With R2_FORCE_REMOTE=1, always read from R2.
 */
export async function openMediaStream(relativePath: string): Promise<Readable> {
  if (forceRemote() || (r2Configured() && !localExists(relativePath))) {
    return readR2Stream(relativePath);
  }
  return createReadStream(/*turbopackIgnore: true*/ resolveMediaPath(relativePath));
}

export async function readMediaFile(relativePath: string) {
  if (forceRemote() || (r2Configured() && !localExists(relativePath))) {
    return readR2Buffer(relativePath);
  }
  return fs.readFile(/*turbopackIgnore: true*/ resolveMediaPath(relativePath));
}

export async function readMediaStream(relativePath: string): Promise<Readable> {
  return openMediaStream(relativePath);
}
