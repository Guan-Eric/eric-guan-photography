import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getPhotographerSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Onboarding",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getPhotographerSession();
  if (!session) redirect("/signup");
  if (session.memberships.length > 0) redirect("/admin");

  return (
    <main className="admin-shell" id="main">
      <OnboardingForm defaultName={session.user.name} />
    </main>
  );
}
