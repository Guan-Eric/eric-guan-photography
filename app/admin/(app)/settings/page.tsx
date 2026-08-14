import type { Metadata } from "next";
import { StudioSettingsPanel } from "@/components/studio-settings-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage() {
  return <StudioSettingsPanel />;
}
