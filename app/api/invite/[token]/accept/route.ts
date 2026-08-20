import { NextResponse } from "next/server";
import {
  attachPhotographerSession,
  getPhotographerSession,
} from "@/lib/auth";
import { acceptInvite, getInviteByToken, isInviteEmailMismatch } from "@/lib/invites";
import { requestPublicOrigin } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const origin = requestPublicOrigin(request);
  const session = await getPhotographerSession();
  if (!session) {
    return NextResponse.redirect(
      new URL(`/signup?invite=${encodeURIComponent(token)}`, origin),
    );
  }

  const invite = await getInviteByToken(token);
  if (!invite) {
    return NextResponse.redirect(new URL("/invite/expired", origin));
  }

  if (isInviteEmailMismatch(invite, session.user.email)) {
    return NextResponse.redirect(
      new URL(`/api/auth/switch-account?invite=${encodeURIComponent(token)}`, origin),
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
        origin,
      ),
    );
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const response = NextResponse.redirect(new URL("/admin", origin));
  attachPhotographerSession(response, session.user.id, result.tenantId, host);
  return response;
}
