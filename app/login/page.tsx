import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin-login-form";
import { AuthShell } from "@/components/auth-shell";
import { getPhotographerSession } from "@/lib/auth";
import { getInviteByToken, inviteAcceptanceError } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const inviteRow = invite ? await getInviteByToken(invite) : null;
  const session = await getPhotographerSession();

  if (session) {
    if (invite && inviteRow && !inviteAcceptanceError(inviteRow, session.user.email)) {
      redirect(`/invite/${invite}`);
    }
    if (invite && inviteRow && inviteAcceptanceError(inviteRow, session.user.email)) {
      redirect(`/api/auth/switch-account?invite=${encodeURIComponent(invite)}`);
    }
    if (!invite) {
      if (!session.activeTenantId) redirect("/onboarding");
      redirect("/admin");
    }
  }

  return (
    <AuthShell line="Book the shoot. Deliver the gallery. Get paid.">
      <Suspense>
        <AdminLoginForm inviteEmail={inviteRow?.email ?? null} />
      </Suspense>
    </AuthShell>
  );
}
