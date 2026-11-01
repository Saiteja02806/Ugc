import type { Metadata } from "next";

import { JsonLd } from "@/components/marketing/json-ld";
import { PricingPage } from "@/components/pricing/pricing-page";
import { publicOrigin } from "@/lib/marketing/public-origin";
import { displayedPricingPlans, getPlanPricing, parseBillingInterval } from "@/lib/pricing/plans";

export const metadata: Metadata = {
  alternates: { canonical: "/pricing" },
  title: "Pricing",
  description:
    "Starter $29, Growth $49, and Startup $99. See each plan as 3-second hooks, 6-second videos, or monthly AI credits.",
  openGraph: {
    type: "website",
    url: "/pricing",
    siteName: "Vidmake",
    title: "Pricing",
    description:
      "Starter $29, Growth $49, and Startup $99. See each plan as 3-second hooks, 6-second videos, or monthly AI credits.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Vidmake pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | Vidmake",
    description:
      "Starter $29, Growth $49, and Startup $99. See each plan as 3-second hooks, 6-second videos, or monthly AI credits.",
    images: ["/twitter-image"],
  },
};

function pricingJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Vidmake",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    url: `${publicOrigin}/pricing`,
    offers: displayedPricingPlans.flatMap((plan) => {
      const intervals = plan.prices.monthly === 0 ? (["monthly"] as const) : (["monthly", "yearly"] as const);
      return intervals.map((interval) => {
        const pricing = getPlanPricing(plan, interval);
        return {
          "@type": "Offer",
          name: plan.prices.monthly === 0 ? plan.name : `${plan.name} (${interval})`,
          url: `${publicOrigin}/pricing`,
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
