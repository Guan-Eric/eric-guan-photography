import { NextResponse } from "next/server";
import { clearPhotographerSession } from "@/lib/auth";
import { platformRootDomain } from "@/lib/platform";

export const runtime = "nodejs";

export async function POST() {
  await clearPhotographerSession();
  const response = NextResponse.json({ ok: true });
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  response.cookies.set("eg_photographer_session", "", base);
  response.cookies.set("eg_active_tenant", "", base);
  response.cookies.set("eg_photographer_session", "", { ...base, domain: ".localhost" });
  response.cookies.set("eg_active_tenant", "", { ...base, domain: ".localhost" });
  const root = platformRootDomain();
  if (root && root !== "localhost" && root !== "127.0.0.1") {
    response.cookies.set("eg_photographer_session", "", { ...base, domain: `.${root}` });
    response.cookies.set("eg_active_tenant", "", { ...base, domain: `.${root}` });
  }
  return response;
}
