import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getPhotographerSession } from "@/lib/auth";
import { getInviteByToken, isInviteEmailMismatch } from "@/lib/invites";

export const metadata: Metadata = {
  title: "Accept invite",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error: acceptError } = await searchParams;
  const invite = await getInviteByToken(token);
  if (!invite) {
    return (
      <AuthShell line="Join the studio that invited you.">
        <div className="auth-form-intro">
          <h1>Invite expired</h1>
          <p>Ask the studio owner to send a new invite.</p>
        </div>
      </AuthShell>
    );
  }

  const session = await getPhotographerSession();
  if (!session) {
    redirect(`/signup?invite=${encodeURIComponent(token)}`);
  }

  if (isInviteEmailMismatch(invite, session.user.email)) {
    redirect(`/api/auth/switch-account?invite=${encodeURIComponent(token)}`);
  }

  if (acceptError) {
    return (
      <AuthShell line="Join the studio that invited you.">
        <div className="auth-form-intro">
          <h1>Couldn’t join</h1>
          <p>{acceptError}</p>
          <p className="auth-form-foot">
            <a href={`/signup?invite=${encodeURIComponent(token)}`}>Create an account</a>
            {" · "}
            <a href={`/login?invite=${encodeURIComponent(token)}`}>Sign in</a>
          </p>
        </div>
      </AuthShell>
    );
  }

  redirect(`/api/invite/${encodeURIComponent(token)}/accept`);
}
