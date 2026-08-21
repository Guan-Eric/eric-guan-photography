import type { Metadata } from "next";
import { PlatformLifetime } from "@/components/platform-lifetime";
import { lifetimeOfferStatus } from "@/lib/billing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lifetime deal",
  description:
    "One-time Lifetime Starter for StudioFront: booking, gated galleries, and hard caps. Limited seats.",
  alternates: { canonical: "/lifetime" },
};

export default async function SaasLifetimePage() {
  const offer = await lifetimeOfferStatus();
  return <PlatformLifetime offer={offer} />;
}
