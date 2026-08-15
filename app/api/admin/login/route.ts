import { NextResponse } from "next/server";
import {
  authenticateUser,
  createPhotographerSession,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  // Legacy: single password field maps to seeded owner when email omitted.
  if (!email && password) {
    const legacyEmail = process.env.SEED_OWNER_EMAIL ?? "ericguan.photo@gmail.com";
    const result = await authenticateUser(legacyEmail, password);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "Wrong email or password. Use /login with email." },
        { status: 401 },
      );
    }
    await createPhotographerSession(result.user.id);
    return NextResponse.json({ ok: true, legacy: true });
  }

  const result = await authenticateUser(email, password);
  if (!result.ok) {
    return NextResponse.json(result, { status: 401 });
  }

  await createPhotographerSession(result.user.id);
  return NextResponse.json({ ok: true });
}
