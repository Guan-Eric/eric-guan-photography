import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth";
import { requestPublicOrigin } from "@/lib/platform";
import { rateLimitAuth } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimitAuth(request, "forgot-password");
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }
  const origin = requestPublicOrigin(request);
  await requestPasswordReset(email, origin);
  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link is on the way.",
  });
}
