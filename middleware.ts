import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Host routing (Edge Middleware — required by OpenNext Cloudflare).
 * Next.js 16 prefers `proxy.ts` (Node), but Workers still need Edge middleware.
 *
 * - localhost / apex → SaaS marketing (rewrite /, /pricing, /lifetime to /saas)
 * - {slug}.localhost → photographer studio
 *
 * Keep this file free of app/lib imports so the edge bundle stays isolated.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  const root = (process.env.PLATFORM_ROOT_DOMAIN ?? "localhost").toLowerCase();
  const contentType = request.headers.get("content-type") ?? "";
  // Cloning the request (NextResponse.next({ request: { headers } })) breaks
  // multipart bodies — FormData parse fails with "expected boundary after body".
  const isMultipart = contentType.includes("multipart/form-data");

  const isApex =
    !hostname ||
    hostname === root ||
    hostname === `www.${root}` ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";

  function saasRewrite(path: string) {
    if (path === "/") return "/saas";
    if (path === "/pricing") return "/saas/pricing";
    if (path === "/lifetime" || path === "/ltd") return "/saas/lifetime";
    return null;
  }

  if (isMultipart) {
    // Admin uploads auth via session cookie; skip header rewrite to preserve body.
    if (isApex) {
      const path = request.nextUrl.pathname;
      const rewritten = saasRewrite(path);
      if (rewritten) {
        const url = request.nextUrl.clone();
        url.pathname = rewritten;
        return NextResponse.rewrite(url);
      }
    }
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  // Never trust client-supplied tenant id — resolve from host/slug only.
  requestHeaders.delete("x-tenant-id");
  if (host) {
    requestHeaders.set("x-tenant-host", host);
  }
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const requestInit = { request: { headers: requestHeaders } };

  if (isApex) {
    requestHeaders.set("x-platform-host", "1");
    const path = request.nextUrl.pathname;
    const rewritten = saasRewrite(path);
    if (rewritten) {
      const url = request.nextUrl.clone();
      url.pathname = rewritten;
      return NextResponse.rewrite(url, requestInit);
    }
    return NextResponse.next(requestInit);
  }

  if (hostname.endsWith(`.${root}`)) {
    const slugHint = hostname.slice(0, -(root.length + 1)).split(".")[0] ?? "";
    if (slugHint) {
      requestHeaders.set("x-tenant-slug", slugHint);
    }
  }

  return NextResponse.next(requestInit);
}

export const config = {
  matcher: [
    // Skip static assets and large multipart upload APIs (body buffering in
    // middleware truncates >10MB by default and breaks FormData parsing).
    "/((?!_next/static|_next/image|favicon.ico|api/admin/portfolio/upload|api/admin/orders/.*/upload|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
