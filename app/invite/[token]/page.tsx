import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getPhotographerSession, setActiveTenantCookie } from "@/lib/auth";
import { acceptInvite, getInviteByToken } from "@/lib/invites";

export const metadata: Metadata = {
  title: "Accept invite",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getPhotographerSession();
  if (!session) {
    redirect(`/signup?invite=${token}`);
  }

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

  const result = await acceptInvite({
    token,
    userId: session.user.id,
    userEmail: session.user.email,
  });

  if (!result.ok) {
    return (
      <AuthShell line="Join the studio that invited you.">
        <div className="auth-form-intro">
          <h1>Couldn’t join</h1>
          <p>{result.error}</p>
        </div>
      </AuthShell>
    );
  }

  await setActiveTenantCookie(result.tenantId);
  redirect("/admin");
}
