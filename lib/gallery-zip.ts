import { PassThrough } from "node:stream";
import type { Archiver } from "archiver";
import type { Gallery, MediaAsset } from "@/lib/db/schema";
import { resolveMediaPath } from "@/lib/media-storage";

// CJS package; Next bundles this only on the Node.js runtime download route.
const archiver = require("archiver") as (
  format: "zip",
  options?: { zlib?: { level?: number } },
) => Archiver;

export type ZipKind = "mls" | "full";

function fileName(asset: MediaAsset, index: number, kind: ZipKind, branded: boolean) {
  const n = String(index + 1).padStart(2, "0");
  const room = asset.roomLabel
    ? `-${asset.roomLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : "";
  const brand = branded ? "" : "-unbranded";
  return `${n}${room}-${kind}${brand}.jpg`;
}

export async function buildGalleryZip(options: {
  gallery: Gallery;
  media: MediaAsset[];
  kind: ZipKind;
  branded: boolean;
}) {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  options.media.forEach((asset, index) => {
    const relative =
      options.kind === "mls" ? asset.pathMls : asset.pathOriginal;
    archive.file(resolveMediaPath(relative), {
      name: fileName(asset, index, options.kind, options.branded),
    });
  });

  const done = archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  await done;

  return Buffer.concat(chunks);
}
