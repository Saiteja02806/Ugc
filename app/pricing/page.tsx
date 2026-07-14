import type { Metadata } from "next";

import { PricingPage } from "@/components/pricing/pricing-page";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Choose a UGC Pilot monthly plan for UGC-style image and video generation credits.",
};

export default function Page() {
  return <PricingPage />;
}
