import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { requireRequestTenant } from "@/lib/tenants";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const tenant = await requireRequestTenant();
  const { token } = await searchParams;
  if (!token) redirect("/portal/login");

  return (
    <AuthShell line={`Listings and downloads from ${tenant.studioName}.`}>
      <div className="auth-form-intro">
        <h1>Sign in to your listings</h1>
        <p>Confirm below to finish signing in. This keeps email apps from using the link before you do.</p>
      </div>
      <form className="auth-form" action="/api/portal/callback" method="POST">
        <input type="hidden" name="token" value={token} />
        <button className="btn btn-solid" type="submit">
          Continue to your listings
        </button>
      </form>
    </AuthShell>
  );
}
