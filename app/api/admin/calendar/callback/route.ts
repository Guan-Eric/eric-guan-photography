import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  connectGoogleCalendar,
  parseCalendarOAuthState,
  safeCalendarReturnTo,
} from "@/lib/calendar";
import { getDb, qGet, schema } from "@/lib/db";
import type { Membership } from "@/lib/db/schema";
import { platformPublicUrl } from "@/lib/platform";

export const runtime = "nodejs";

function fallbackScheduleUrl() {
  return `${platformPublicUrl().replace(/\/$/, "")}/admin/schedule`;
}

function redirectWith(returnTo: string, params: Record<string, string>) {
  const url = new URL(returnTo);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const errorParam = url.searchParams.get("error");
  const state = parseCalendarOAuthState(url.searchParams.get("state"));
  const returnTo = safeCalendarReturnTo(state?.returnTo ?? "") ?? fallbackScheduleUrl();

  if (errorParam) {
    return redirectWith(returnTo, {
      calendar: "error",
      reason: "Google did not complete the connection.",
    });
  }

  if (!state) {
    return redirectWith(fallbackScheduleUrl(), {
      calendar: "error",
      reason: "This calendar link expired. Try connecting again.",
    });
  }

  const membership = await qGet<Membership>(
    getDb()
      .select()
      .from(schema.memberships)
      .where(
        and(
          eq(schema.memberships.userId, state.userId),
          eq(schema.memberships.tenantId, state.tenantId),
        ),
      ),
  );
  if (!membership) {
    return redirectWith(returnTo, {
      calendar: "error",
      reason: "You no longer have access to that studio.",
    });
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return redirectWith(returnTo, {
      calendar: "error",
      reason: "Google did not return an authorization code.",
    });
  }

  const connected = await connectGoogleCalendar({
    tenantId: state.tenantId,
    code,
  });
  if (!connected.ok) {
    return redirectWith(returnTo, {
      calendar: "error",
      reason: connected.error,
    });
  }

  return redirectWith(returnTo, { calendar: "connected" });
}
