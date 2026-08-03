export type PlanSlug = "creator" | "pro";

export type PricingPlan = {
  badgeLabel?: string;
  bestFor: string;
  billingText: string;
  buttonLabel: string;
  capacityLabel: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  imageCredits: number;
  monthlyPrice: number;
  name: string;
  slug: PlanSlug;
  videoCredits: number;
};

const usdPriceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatPricingAmount(amount: number) {
  return usdPriceFormatter.format(amount);
}

export const pricingPlans: PricingPlan[] = [
  {
    slug: "creator",
    name: "Creator",
    bestFor: "Solo creators",
    description: "For creators publishing on a consistent weekly schedule.",
    monthlyPrice: 19,
    billingText: "per month",
    imageCredits: 200,
    videoCredits: 200,
    highlighted: true,
    badgeLabel: "Most popular",
    buttonLabel: "Start with Creator",
    capacityLabel: "Steady weekly output",
    features: [
      "Watermark-free exports",
      "Commercial usage",
      "Credits renew every month",
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    bestFor: "Teams & studios",
    description: "For higher-volume campaigns, testing, and creative variants.",
    monthlyPrice: 49,
    billingText: "per month",
    imageCredits: 600,
    videoCredits: 600,
    buttonLabel: "Start with Pro",
    capacityLabel: "3x Creator capacity",
    features: [
      "Watermark-free exports",
      "Commercial usage",
      "Credits renew every month",
    ],
  },
];
