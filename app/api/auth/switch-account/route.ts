import { NextResponse } from "next/server";
import { platformRootDomain } from "@/lib/platform";

export const runtime = "nodejs";

function expireCookie(name: string, domain?: string) {
  let header = `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  if (domain) header += `; Domain=${domain}`;
  return header;
}

function clearSessionCookies(response: NextResponse) {
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
}

/** Sign out the current photographer so an invite can be accepted on another account. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const invite = url.searchParams.get("invite")?.trim();
  const next = url.searchParams.get("next") === "signup" ? "signup" : "login";
  const path = invite
    ? `/${next}?invite=${encodeURIComponent(invite)}`
    : `/${next}`;
  const response = NextResponse.redirect(new URL(path, url.origin));
  clearSessionCookies(response);
  return response;
}
