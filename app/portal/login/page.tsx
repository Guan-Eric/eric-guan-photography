import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { PortalLoginForm } from "@/components/portal-login-form";
import { getAgentSession } from "@/lib/agent-auth";
import { platformRootDomain, safePortalPath } from "@/lib/platform";
import { getRequestTenant } from "@/lib/tenants";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Agent portal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const tenant = await getRequestTenant();
  const { error, next: rawNext } = await searchParams;
  const next = safePortalPath(rawNext);

  if (!tenant) {
    const root = platformRootDomain();
    return (
      <AuthShell line="Access listings and downloads from your photographer.">
        <div className="auth-form-intro">
          <h1>Agent portal</h1>
          <p>
            Open your photographer&apos;s studio site to sign in — for example{" "}
            <strong>{`your-agent.${root}/portal`}</strong>.
          </p>
          <p className="auth-form-foot">
            The portal link is on booking confirmations and gallery emails from your photographer.
          </p>
        </div>
      </AuthShell>
    );
  }

  const session = await getAgentSession();
  if (session && session.tenantId === tenant.id) {
    redirect(next ?? "/portal");
  }

  return (
    <AuthShell line={`Listings and downloads from ${tenant.studioName}.`}>
      <div className="auth-form-intro">
        <h1>Agent portal</h1>
        <p>We&apos;ll email a sign-in link. No password.</p>
      </div>
      {error === "expired" ? (
        <p className="form-error">That sign-in link expired. Request a new one.</p>
      ) : null}
      <PortalLoginForm next={next} />
    </AuthShell>
  );
}
