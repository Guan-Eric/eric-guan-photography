import { PassThrough } from "node:stream";
import { ZipArchive } from "archiver";
import type { Gallery, MediaAsset } from "@/lib/db/schema";
import { readMediaFile } from "@/lib/media-storage";

export type ZipKind = "mls" | "full";

function fileName(asset: MediaAsset, index: number, kind: ZipKind, branded: boolean) {
  const n = String(index + 1).padStart(2, "0");
  const room = asset.roomLabel
    ? `-${asset.roomLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : "";
  const brand = branded ? "" : "-unbranded";
  return `${n}${room}-${kind}${brand}.jpg`;
}

/**
 * Build an MLS or full-res zip. Reads via media-storage (local and/or R2).
 */
export async function buildGalleryZip(options: {
  gallery: Gallery;
  media: MediaAsset[];
  kind: ZipKind;
  branded: boolean;
}) {
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  const collect = (async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  })();

  for (let index = 0; index < options.media.length; index += 1) {
    const asset = options.media[index]!;
    const relative =
      options.kind === "mls" ? asset.pathMls : asset.pathOriginal;
    const buffer = await readMediaFile(relative);
    archive.append(buffer, {
      name: fileName(asset, index, options.kind, options.branded),
    });
  }

  await archive.finalize();
  return collect;
}
