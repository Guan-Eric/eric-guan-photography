import { NextResponse } from "next/server";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import {
  calendarOAuthStartUrl,
  calendarSyncEnabled,
  createCalendarOAuthState,
  disconnectGoogleCalendar,
  getCalendarPublicState,
  safeCalendarReturnTo,
  updateCalendarSettings,
} from "@/lib/calendar";
import { requestPublicOrigin } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const state = await getCalendarPublicState(session.activeTenantId);
  return NextResponse.json({ ok: true, ...state });
}

export async function POST(request: Request) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "connect") {
    if (!calendarSyncEnabled()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Google Calendar is not configured. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET.",
        },
        { status: 400 },
      );
    }
    const origin = requestPublicOrigin(request);
    const returnTo =
      safeCalendarReturnTo(`${origin}/admin/schedule`) ?? `${origin}/admin/schedule`;
    const state = createCalendarOAuthState({
      tenantId: session.activeTenantId,
      userId: session.user.id,
      returnTo,
    });
    return NextResponse.json({ ok: true, url: calendarOAuthStartUrl(state) });
  }

  if (action === "disconnect") {
    await disconnectGoogleCalendar(session.activeTenantId);
    return NextResponse.json({ ok: true });
  }

  if (action === "settings") {
    const result = await updateCalendarSettings(session.activeTenantId, {
      blockExternalEvents:
        typeof body?.blockExternalEvents === "boolean"
          ? body.blockExternalEvents
          : undefined,
      calendarId:
        typeof body?.calendarId === "string" && body.calendarId.trim()
          ? body.calendarId.trim()
          : undefined,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    const state = await getCalendarPublicState(session.activeTenantId);
    return NextResponse.json({ ok: true, ...state });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
