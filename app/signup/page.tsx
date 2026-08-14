import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/signup-form";
import { getPhotographerSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getPhotographerSession();
  if (session) {
    if (session.memberships.length === 0) redirect("/onboarding");
    redirect("/admin");
  }

  return (
    <main className="admin-shell" id="main">
      <SignupForm />
    </main>
  );
}
