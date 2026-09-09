import type { Metadata } from "next";
import { PlatformSilentDemo } from "@/components/platform-silent-demo";
import { lifetimeOfferStatus } from "@/lib/billing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "60-second walkthrough",
  description:
    "Silent demo of StudioFront: agents book on your site, open a gallery link, and pay to unlock MLS and full-res files. No agent account.",
  alternates: { canonical: "/demo" },
};

export default async function SaasDemoPage() {
  const offer = await lifetimeOfferStatus();
  return <PlatformSilentDemo offer={offer} />;
}
