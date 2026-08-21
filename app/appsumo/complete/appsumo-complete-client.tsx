"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast";

type Props = {
  signedIn: boolean;
  hasStudio: boolean;
  hasPendingLicense: boolean;
  errorFromQuery: string | null;
  supportEmail: string;
};

export function AppsumoCompleteClient({
  signedIn,
  hasStudio,
  hasPendingLicense,
  errorFromQuery,
  supportEmail,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(errorFromQuery);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (!signedIn || !hasStudio || !hasPendingLicense || linked || busy) return;
    let cancelled = false;
    async function link() {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/appsumo/link", { method: "POST" });
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          redirect?: string;
          plan?: string;
        } | null;
        if (cancelled) return;
        if (!json?.ok) {
          const message = json?.error ?? "Could not link AppSumo license.";
          setError(message);
          toastError(message);
          setBusy(false);
          return;
        }
        setLinked(true);
        toastSuccess(
          json.plan
            ? `AppSumo plan activated (${json.plan}).`
            : "AppSumo license linked.",
        );
        router.replace(json.redirect ?? "/admin?appsumo=1");
        router.refresh();
      } catch {
        if (!cancelled) {
          setError("Network error linking AppSumo license.");
          toastError("Network error linking AppSumo license.");
          setBusy(false);
        }
      }
    }
    void link();
    return () => {
      cancelled = true;
    };
  }, [signedIn, hasStudio, hasPendingLicense, linked, busy, router]);

  const next = encodeURIComponent("/appsumo/complete");

  return (
    <div className="auth-form">
      <div className="auth-form-intro">
        <p className="eyebrow">AppSumo</p>
        <h1>Activate your license</h1>
        <p>
          Connect your Studiofront account to finish AppSumo activation. We never
          receive your email from AppSumo — sign in here with the account you want
          linked.
        </p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {!hasPendingLicense && !errorFromQuery ? (
        <p className="muted">
          No pending license found. Start from your AppSumo purchase page, or email{" "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a> with your license
          key.
        </p>
      ) : null}

      {!signedIn ? (
        <div className="form-actions" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="btn btn-solid" href={`/login?next=${next}`}>
            Sign in
          </Link>
          <Link className="btn" href={`/signup?next=${next}`}>
            Create account
          </Link>
        </div>
      ) : null}

      {signedIn && !hasStudio ? (
        <div className="form-actions">
          <p className="muted">Create your studio, then we&apos;ll apply the license.</p>
          <Link className="btn btn-solid" href={`/onboarding?next=${next}`}>
            Create studio
          </Link>
        </div>
      ) : null}

      {signedIn && hasStudio && hasPendingLicense ? (
        <p className="muted">{busy || linked ? "Linking license…" : "Ready to link."}</p>
      ) : null}

      {signedIn && hasStudio && !hasPendingLicense ? (
        <div className="form-actions">
          <Link className="btn btn-solid" href="/admin">
            Go to admin
          </Link>
        </div>
      ) : null}
    </div>
  );
}
