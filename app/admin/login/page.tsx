import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { getPhotographerSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studio login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const session = await getPhotographerSession();
  if (session) {
    if (session.memberships.length === 0) redirect("/onboarding");
    redirect("/admin");
  }

  return (
    <main className="admin-shell" id="main">
      <AdminLoginForm />
    </main>
  );
}
