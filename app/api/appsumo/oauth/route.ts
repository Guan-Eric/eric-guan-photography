import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  APPSUMO_PENDING_COOKIE,
  encodePendingCookie,
  exchangeCodeForLicense,
  pendingCookieOptions,
  upsertLicenseFromWebhook,
} from "@/lib/appsumo";
import { platformPublicUrl } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();

  // Partner Portal validation: GET with no code → 200 OK.
  if (!code) {
    return new NextResponse("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const exchanged = await exchangeCodeForLicense(code);
  if (!exchanged.ok) {
    const fail = new URL("/appsumo/complete", platformPublicUrl());
    fail.searchParams.set("error", exchanged.error);
    return NextResponse.redirect(fail);
  }

  // Ensure a license row exists (webhook may have arrived first).
  await upsertLicenseFromWebhook({
    license_key: exchanged.licenseKey,
    event: "activate",
    license_status: exchanged.status,
  });

  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? null;
  const complete = new URL("/appsumo/complete", platformPublicUrl());
  const response = NextResponse.redirect(complete);
  response.cookies.set(
    APPSUMO_PENDING_COOKIE,
    encodePendingCookie(exchanged.licenseKey),
    pendingCookieOptions(host),
  );
  return response;
}
