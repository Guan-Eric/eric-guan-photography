import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Host routing:
 * - localhost / apex → SaaS marketing (rewrite / and /pricing to /saas)
 * - {slug}.localhost → photographer studio
 *
 * Keep this file free of app/lib imports so the edge bundle stays isolated.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  const root = (process.env.PLATFORM_ROOT_DOMAIN ?? "localhost").toLowerCase();

  const isApex =
    !hostname ||
    hostname === root ||
    hostname === `www.${root}` ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";

  const requestHeaders = new Headers(request.headers);
  if (host) {
    requestHeaders.set("x-tenant-host", host);
  }

  const requestInit = { request: { headers: requestHeaders } };

  if (isApex) {
    requestHeaders.set("x-platform-host", "1");
    const path = request.nextUrl.pathname;
    if (path === "/" || path === "/pricing") {
      const url = request.nextUrl.clone();
      url.pathname = path === "/" ? "/saas" : "/saas/pricing";
      return NextResponse.rewrite(url, requestInit);
    }
    return NextResponse.next(requestInit);
  }

  if (hostname.endsWith(`.${root}`)) {
    const slugHint = hostname.slice(0, -(root.length + 1)).split(".")[0] ?? "";
    if (slugHint) {
      requestHeaders.set("x-tenant-slug", slugHint);
    }
    if (slugHint === "ericguan") {
      requestHeaders.set("x-tenant-id", "eric-guan");
    } else if (slugHint === "demo") {
      requestHeaders.set("x-tenant-id", "demo-studio");
    }
  }

  return NextResponse.next(requestInit);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
