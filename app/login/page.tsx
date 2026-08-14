import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { AuthShell } from "@/components/auth-shell";
import { getPhotographerSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await getPhotographerSession();
  if (session) {
    if (!session.activeTenantId) redirect("/onboarding");
    redirect("/admin");
  }

  return (
    <AuthShell line="Book the shoot. Deliver the gallery. Get paid.">
      <AdminLoginForm />
    </AuthShell>
  );
}
