import { NextResponse } from "next/server";
import {
  type AppsumoWebhookPayload,
  upsertLicenseFromWebhook,
  verifyWebhookSignature,
} from "@/lib/appsumo";

export const runtime = "nodejs";

function successResponse(event: string) {
  return NextResponse.json({ event, success: true });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp =
    request.headers.get("x-appsumo-timestamp") ??
    request.headers.get("X-Appsumo-Timestamp");
  const signature =
    request.headers.get("x-appsumo-signature") ??
    request.headers.get("X-Appsumo-Signature");

  const verified = await verifyWebhookSignature(rawBody, timestamp, signature);
  if (!verified.ok) {
    return NextResponse.json(
      { event: "unknown", success: false, message: verified.error },
      { status: 401 },
    );
  }

  let payload: AppsumoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as AppsumoWebhookPayload;
  } catch {
    return NextResponse.json(
      { event: "unknown", success: false, message: "Invalid JSON." },
      { status: 400 },
    );
  }

  const event = payload.event?.trim() || "purchase";

  // Partner Portal validation — acknowledge with no side effects.
  if (payload.test === true) {
    return successResponse(event);
  }

  // Add-ons / migrate: acknowledge only in v1 (no seat packs sold yet).
  if (event === "migrate" || payload.parent_license_key) {
    return successResponse(event);
  }

  try {
    await upsertLicenseFromWebhook(payload);
  } catch (error) {
    console.error("[appsumo.webhook]", error);
  }

  // AppSumo requires HTTP 200 + { event, success: true } for every delivery.
  return successResponse(event);
}
