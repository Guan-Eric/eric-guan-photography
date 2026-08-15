import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import sharp from "sharp";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import { writeMediaFile } from "@/lib/media-storage";

export const runtime = "nodejs";

const newId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);

export async function POST(request: Request) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Choose an image file." }, { status: 400 });
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Image must be under 12MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let pipeline: ReturnType<typeof sharp>;
  try {
    pipeline = sharp(buffer, { failOn: "none" }).rotate();
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read that image." }, { status: 400 });
  }

  const meta = await pipeline.metadata();
  const width = meta.width ?? 1800;
  const height = meta.height ?? 1200;
  const web = await pipeline
    .clone()
    .resize({ width: 2400, height: 1800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const relativePath = `${session.activeTenantId}/portfolio/${newId()}.jpg`;
  await writeMediaFile(relativePath, web);
  const src = `/api/site-media/${relativePath.split("/").map(encodeURIComponent).join("/")}`;

  return NextResponse.json({
    ok: true,
    src,
    width,
    height,
    alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
  });
}
