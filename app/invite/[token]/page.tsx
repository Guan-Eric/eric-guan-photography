import type { Metadata } from "next";
import { redirect } from "next/navigation";
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

  const invite = getInviteByToken(token);
  if (!invite) {
    return (
      <main className="admin-shell" id="main">
        <p>This invite is invalid.</p>
      </main>
    );
  }

  const result = acceptInvite({
    token,
    userId: session.user.id,
    userEmail: session.user.email,
  });

  if (!result.ok) {
    return (
      <main className="admin-shell" id="main">
        <p>{result.error}</p>
      </main>
    );
  }

  await setActiveTenantCookie(result.tenantId);
  redirect("/admin");
}
