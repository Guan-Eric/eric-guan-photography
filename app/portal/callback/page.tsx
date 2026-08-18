import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { requireRequestTenant } from "@/lib/tenants";
import { safePortalPath } from "@/lib/platform";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const tenant = await requireRequestTenant();
  const { token, next: rawNext } = await searchParams;
  if (!token) redirect("/portal/login");
  const next = safePortalPath(rawNext);

  return (
    <AuthShell line={`Listings and downloads from ${tenant.studioName}.`}>
      <div className="auth-form-intro">
        <h1>Sign in to your listings</h1>
        <p>Confirm below to finish signing in. This keeps email apps from using the link before you do.</p>
      </div>
      <form className="auth-form" action="/api/portal/callback" method="POST">
        <input type="hidden" name="token" value={token} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <button className="btn btn-solid" type="submit">
          Continue to your listings
        </button>
      </form>
    </AuthShell>
  );
}
