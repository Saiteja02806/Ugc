import type { Metadata } from "next";

import { PricingPage } from "@/components/pricing/pricing-page";
import { parseBillingInterval } from "@/lib/pricing/plans";

export const metadata: Metadata = {
  alternates: { canonical: "/pricing" },
  title: "Pricing",
  description:
    "Try UGCPilot free for seven days. Compare Starter and Growth plans for daily content, custom AI images and videos, credits, editing and scheduling.",
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
