import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { PortalLoginForm } from "@/components/portal-login-form";
import { getAgentSession } from "@/lib/agent-auth";
import { requireRequestTenant } from "@/lib/tenants";

export const metadata: Metadata = {
  title: "Agent portal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const tenant = await requireRequestTenant();
  const session = await getAgentSession();
  if (session && session.tenantId === tenant.id) {
    redirect("/portal");
  }

  const { error } = await searchParams;

  return (
    <AuthShell line={`Listings and downloads from ${tenant.studioName}.`}>
      <div className="auth-form-intro">
        <h1>Agent portal</h1>
        <p>We’ll email a sign-in link. No password.</p>
      </div>
      {error === "expired" ? (
        <p className="form-error">
          That sign-in link expired. Request a new one.
        </p>
      ) : null}
      <PortalLoginForm />
    </AuthShell>
  );
}
