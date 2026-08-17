import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { PortalLoginForm } from "@/components/portal-login-form";
import { requireRequestTenant } from "@/lib/tenants";

export const metadata: Metadata = {
  title: "Agent portal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalLoginPage() {
  const tenant = await requireRequestTenant();
  return (
    <AuthShell line={`Listings and downloads from ${tenant.studioName}.`}>
      <div className="auth-form-intro">
        <h1>Agent portal</h1>
        <p>We’ll email a sign-in link. No password.</p>
      </div>
      <PortalLoginForm />
    </AuthShell>
  );
}
