import type { Metadata } from "next";
import { PlatformPricing } from "@/components/platform-pricing";

export const dynamic = "force-dynamic";

const pricingDescription =
  "Pay per listing at $5, or flat plans from $49–$149/mo. 14-day trial, white-label booking and galleries, no agent accounts.";

export const metadata: Metadata = {
  title: "Pricing",
  description: pricingDescription,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing",
    description: pricingDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing",
    description: pricingDescription,
  },
};

export default function SaasPricingPage() {
  return <PlatformPricing />;
}
