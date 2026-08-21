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

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const session = await getPhotographerSession();
  if (!session) {
    const next = params.next?.startsWith("/") ? params.next : null;
    redirect(next ? `/signup?next=${encodeURIComponent(next)}` : "/signup");
  }
  // redirect() never returns; narrow for TypeScript.
  const active = session!;
  if (active.memberships.length > 0) {
    const next = params.next?.startsWith("/") ? params.next : null;
    redirect(next ?? "/admin");
  }

  return (
    <AuthShell line="Your name on the site. Agents never create an account.">
      <OnboardingForm defaultName={active.user.name} />
    </AuthShell>
  );
}
