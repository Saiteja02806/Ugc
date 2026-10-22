import type { Metadata } from "next";

import { PricingPage } from "@/components/pricing/pricing-page";
import { parseBillingInterval } from "@/lib/pricing/plans";

export const metadata: Metadata = {
  alternates: { canonical: "/pricing" },
  title: "Pricing",
  description:
    "Try UGC Pilot free for seven days. Compare daily slideshow allowances, custom AI credits, editing and supported Instagram, TikTok and YouTube scheduling.",
};

type PricingRouteProps = {
  searchParams: Promise<{
    billing?: string | string[];
  }>;
};

export default async function Page({ searchParams }: PricingRouteProps) {
  const { billing } = await searchParams;

  return <PricingPage initialBillingInterval={parseBillingInterval(billing)} />;
}
