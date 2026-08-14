import { NextResponse } from "next/server";
import {
  authenticateUser,
  createPhotographerSession,
  registerUser,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name : "";

  if (!email || !password || !name) {
    return NextResponse.json(
      { ok: false, error: "Name, email, and password are required." },
      { status: 400 },
    );
  }

  const created = registerUser({ email, password, name });
  if (!created.ok) {
    return NextResponse.json(created, { status: 400 });
  }

  await createPhotographerSession(created.user.id);
  return NextResponse.json({ ok: true, userId: created.user.id });
}
