import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudioSettingsPanel } from "@/components/studio-settings-panel";
import { getPhotographerSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studio settings",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const session = await getPhotographerSession();
  if (!session) redirect("/admin/login");
  if (session.memberships.length === 0) redirect("/onboarding");

  return (
    <main className="admin-shell" id="main">
      <StudioSettingsPanel />
    </main>
  );
}
