export type BillingInterval = "monthly" | "yearly";

export type PricingPlan = {
  badgeLabel?: string;
  bestFor: string;
  capacityLabel: string;
  description: string;
  highlighted?: boolean;
  name: string;
  prices: Record<BillingInterval, number>;
  sharedMonthlyCredits: number;
  slug: "creator" | "pro";
};

export type PlanPricing = {
  billedAmount: number;
  billingSummary: string;
  monthlyEquivalent: number;
  savings: number;
};

const usdPriceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatPricingAmount(amount: number) {
  return usdPriceFormatter.format(amount);
}

export function parseBillingInterval(
  value: string | string[] | null | undefined,
): BillingInterval {
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate === "yearly" ? "yearly" : "monthly";
}

export function getPlanPricing(
  plan: PricingPlan,
  interval: BillingInterval,
): PlanPricing {
  if (interval === "monthly") {
    return {
      billedAmount: plan.prices.monthly,
      billingSummary: `Billed ${formatPricingAmount(plan.prices.monthly)} monthly`,
      monthlyEquivalent: plan.prices.monthly,
      savings: 0,
    };
  }

  const savings = plan.prices.monthly * 12 - plan.prices.yearly;

  return {
    billedAmount: plan.prices.yearly,
    billingSummary: `Billed ${formatPricingAmount(plan.prices.yearly)} yearly`,
    monthlyEquivalent: plan.prices.yearly / 12,
    savings,
  };
}

export const pricingPlans: PricingPlan[] = [
  {
    slug: "creator",
    name: "Creator",
    bestFor: "Consistent creators",
    description:
      "For creators building a dependable weekly content workflow.",
    prices: {
      monthly: 19,
      yearly: 190,
    },
    sharedMonthlyCredits: 200,
    highlighted: true,
    badgeLabel: "Most popular",
    capacityLabel: "A focused monthly generation budget",
  },
  {
    slug: "pro",
    name: "Pro",
    bestFor: "High-volume creators",
    description:
      "For brands and creators producing more campaigns and variations.",
    prices: {
      monthly: 49,
      yearly: 490,
    },
    sharedMonthlyCredits: 600,
    capacityLabel: "3x the Creator generation budget",
  },
];
