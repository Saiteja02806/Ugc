import type { Metadata } from "next";

import { PricingPage } from "@/components/pricing/pricing-page";
import { parseBillingInterval } from "@/lib/pricing/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare monthly and annual UGCPilot Creator and Pro plans with one shared generation credit balance.",
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
