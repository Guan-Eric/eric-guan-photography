import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  await requestPasswordReset(email, origin);
  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link is on the way.",
  });
}
