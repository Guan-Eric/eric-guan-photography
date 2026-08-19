import { NextResponse } from "next/server";
import { platformRootDomain } from "@/lib/platform";

export const runtime = "nodejs";

function expireCookie(name: string, domain?: string) {
  let header = `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  if (domain) header += `; Domain=${domain}`;
  return header;
}

export async function POST() {
  const response = NextResponse.json({ ok: true });

  const names = ["eg_photographer_session", "eg_active_tenant"];
  const domains: (string | undefined)[] = [undefined, ".localhost"];
  const root = platformRootDomain();
  if (root && root !== "localhost" && root !== "127.0.0.1") {
    domains.push(`.${root}`);
  }

  for (const name of names) {
    for (const domain of domains) {
      response.headers.append("Set-Cookie", expireCookie(name, domain));
    }
  }

  return response;
}
