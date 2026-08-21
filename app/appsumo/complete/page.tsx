import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth-shell";
import { AppsumoCompleteClient } from "@/app/appsumo/complete/appsumo-complete-client";
import {
  APPSUMO_PENDING_COOKIE,
  appsumoSupportEmail,
  decodePendingCookie,
} from "@/lib/appsumo";
import { getPhotographerSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AppSumo activation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AppsumoCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const session = await getPhotographerSession();
  const cookieStore = await cookies();
  const pending = decodePendingCookie(
    cookieStore.get(APPSUMO_PENDING_COOKIE)?.value,
  );

  return (
    <AuthShell line="AppSumo lifetime deals link to your Studiofront plan.">
      <AppsumoCompleteClient
        signedIn={Boolean(session?.user)}
        hasStudio={Boolean(session?.activeTenantId)}
        hasPendingLicense={Boolean(pending)}
        errorFromQuery={params.error ?? null}
        supportEmail={appsumoSupportEmail()}
      />
    </AuthShell>
  );
}
