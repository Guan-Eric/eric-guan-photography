import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import { getPhotographerSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create studio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getPhotographerSession();
  if (!session) redirect("/signup");
  if (session.memberships.length > 0) redirect("/admin");

  return (
    <AuthShell line="Your name on the site. Agents never create an account.">
      <OnboardingForm defaultName={session.user.name} />
    </AuthShell>
  );
}
