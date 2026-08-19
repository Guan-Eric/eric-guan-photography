import { NextResponse } from "next/server";
import {
  attachPhotographerSession,
  getPhotographerSession,
} from "@/lib/auth";
import { acceptInvite, getInviteByToken, isInviteEmailMismatch } from "@/lib/invites";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const session = await getPhotographerSession();
  if (!session) {
    return NextResponse.redirect(
      new URL(`/signup?invite=${encodeURIComponent(token)}`, request.url),
    );
  }

  const invite = await getInviteByToken(token);
  if (!invite) {
    return NextResponse.redirect(new URL("/invite/expired", request.url));
  }

  if (isInviteEmailMismatch(invite, session.user.email)) {
    return NextResponse.redirect(
      new URL(`/api/auth/switch-account?invite=${encodeURIComponent(token)}`, request.url),
    );
  }

  const result = await acceptInvite({
    token,
    userId: session.user.id,
    userEmail: session.user.email,
  });

  if (!result.ok) {
    return NextResponse.redirect(
      new URL(
        `/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(result.error)}`,
        request.url,
      ),
    );
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const response = NextResponse.redirect(new URL("/admin", request.url));
  attachPhotographerSession(response, session.user.id, result.tenantId, host);
  return response;
}
