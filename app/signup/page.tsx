import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/signup-form";
import { getPhotographerSession } from "@/lib/auth";
import { getInviteByToken, inviteAcceptanceError } from "@/lib/invites";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignupPage({
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
      redirect(
        `/api/auth/switch-account?invite=${encodeURIComponent(invite)}&next=signup`,
      );
    }
    if (!invite) {
      if (!session.activeTenantId) redirect("/onboarding");
      redirect("/admin");
    }
  }

  return (
    <AuthShell line="Book the shoot. Deliver the gallery. Get paid.">
      <Suspense>
        <SignupForm inviteEmail={inviteRow?.email ?? null} />
      </Suspense>
    </AuthShell>
  );
}
