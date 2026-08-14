import type { Metadata } from "next";
import { PlatformPricing } from "@/components/platform-pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  alternates: { canonical: "/pricing" },
};

export default function SaasPricingPage() {
  return <PlatformPricing />;
}
