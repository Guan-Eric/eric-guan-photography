import { NextResponse } from "next/server";
import { clearPhotographerSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearPhotographerSession();
  return NextResponse.json({ ok: true });
}
