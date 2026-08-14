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
  const result = authenticateUser(email, password);
  if (!result.ok) {
    return NextResponse.json(result, { status: 401 });
  }
  await createPhotographerSession(result.user.id);
  return NextResponse.json({ ok: true });
}
