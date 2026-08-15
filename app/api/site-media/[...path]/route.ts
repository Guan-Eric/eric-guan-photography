import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { mediaExists, readMediaStream } from "@/lib/media-storage";

export const runtime = "nodejs";

type Params = { path: string[] };

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const { path: parts } = await context.params;
  if (!parts?.length) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const relativePath = parts.map(decodeURIComponent).join("/");
  if (
    relativePath.includes("..") ||
    !/^[a-z0-9_-]+\/portfolio\//i.test(relativePath)
  ) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  try {
    if (!mediaExists(relativePath)) {
      // R2-only deployments may still stream successfully.
    }
    const stream = await readMediaStream(relativePath);
    const webStream = Readable.toWeb(stream) as ReadableStream;
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
}
