import type { Metadata } from "next";

import { PricingPage } from "@/components/pricing/pricing-page";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare UGCPilot Creator and Pro monthly plans for image and video generation credits.",
};

export default function Page() {
  return <PricingPage />;
}
