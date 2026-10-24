import type { Metadata } from "next";

import { JsonLd } from "@/components/marketing/json-ld";
import { PricingPage } from "@/components/pricing/pricing-page";
import { getPlanPricing, parseBillingInterval, pricingPlans } from "@/lib/pricing/plans";

export const metadata: Metadata = {
  alternates: { canonical: "/pricing" },
  title: "Pricing",
  description:
    "Try UGC Pilot free for seven days. Compare daily slideshow allowances, AI Studio credits, and video editing on Starter and Growth.",
  openGraph: {
    type: "website",
    url: "https://getugcpilot.com/pricing",
    siteName: "UGC Pilot",
    title: "Pricing",
    description:
      "Try UGC Pilot free for seven days. Compare daily slideshow allowances, AI Studio credits, and video editing on Starter and Growth.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "UGC Pilot pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | UGC Pilot",
    description:
      "Try UGC Pilot free for seven days. Compare daily slideshow allowances, AI Studio credits, and video editing on Starter and Growth.",
    images: ["/twitter-image"],
  },
};

function pricingJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "UGC Pilot",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    url: "https://getugcpilot.com/pricing",
    offers: pricingPlans.flatMap((plan) => {
      const intervals = plan.prices.monthly === 0 ? (["monthly"] as const) : (["monthly", "yearly"] as const);
      return intervals.map((interval) => {
        const pricing = getPlanPricing(plan, interval);
        return {
          "@type": "Offer",
          name: plan.prices.monthly === 0 ? plan.name : `${plan.name} (${interval})`,
          url: "https://getugcpilot.com/pricing",
          price: String(pricing.billedAmount),
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          description: `${plan.description} ${plan.capacityLabel}.`,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: String(pricing.billedAmount),
            priceCurrency: "USD",
            unitText: plan.prices.monthly === 0 ? "trial" : interval === "yearly" ? "year" : "month",
          },
        };
      });
    }),
  };
}

type PricingRouteProps = {
  searchParams: Promise<{
    billing?: string | string[];
  }>;
};

export default async function Page({ searchParams }: PricingRouteProps) {
  const { billing } = await searchParams;

  return (
    <>
      <JsonLd data={pricingJsonLd()} />
      <PricingPage initialBillingInterval={parseBillingInterval(billing)} />
    </>
  );
}
