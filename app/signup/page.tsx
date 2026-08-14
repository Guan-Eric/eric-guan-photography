import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/signup-form";
import { getPhotographerSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getPhotographerSession();
  if (session) {
    if (!session.activeTenantId) redirect("/onboarding");
    redirect("/admin");
  }

  return (
    <AuthShell line="Book the shoot. Deliver the gallery. Get paid.">
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
