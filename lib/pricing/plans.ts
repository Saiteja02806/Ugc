export type BillingInterval = "monthly" | "yearly";

export type PricingPlan = {
  badgeLabel?: string;
  bestFor: string;
  capacityLabel: string;
  dailyContentPieces: number | string;
  description: string;
  features: string[];
  highlighted?: boolean;
  instagramAccounts: number;
  name: string;
  prices: Record<BillingInterval, number>;
  sharedMonthlyCredits: number;
  slug: "free" | "starter" | "growth";
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
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
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
  if (plan.prices.monthly === 0) {
    return {
      billedAmount: 0,
      billingSummary: "Free forever",
      monthlyEquivalent: 0,
      savings: 0,
    };
  }

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
    slug: "free",
    name: "Free",
    bestFor: "Test the waters",
    description: "Explore proven viral formats and preview ready-to-post concepts.",
    prices: {
      monthly: 0,
      yearly: 0,
    },
    sharedMonthlyCredits: 0,
    dailyContentPieces: 3,
    instagramAccounts: 0,
    capacityLabel: "3 daily ready-to-post concepts, with no AI generation credits",
    features: [
      "No credit card required",
      "3 ready-to-post pieces daily",
      "Format discovery mode",
      "Preview ready-to-post concepts",
      "Limited draft saves",
    ],
  },
  {
    slug: "starter",
    name: "Starter",
    bestFor: "Solopreneurs & builders",
    description: "Put your Instagram marketing on autopilot with daily ready-to-post content.",
    prices: {
      monthly: 19,
      yearly: 190,
    },
    sharedMonthlyCredits: 200,
    dailyContentPieces: 20,
    instagramAccounts: 1,
    capacityLabel: "200 shared AI credits for image & video creation",
    features: [
      "20 ready-to-post pieces daily",
      "200 AI generation credits",
      "1 connected Instagram account",
      "Reel hooks, Wall-text & Carousels",
      "1-Click post scheduling & calendar",
      "Advanced performance analytics",
    ],
  },
  {
    slug: "growth",
    name: "Growth",
    bestFor: "Growing brands & multi-product teams",
    description: "Higher daily volume and multiple Instagram brands in one workspace.",
    prices: {
      monthly: 49,
      yearly: 490,
    },
    sharedMonthlyCredits: 600,
    dailyContentPieces: 50,
    instagramAccounts: 3,
    highlighted: true,
    badgeLabel: "Most popular",
    capacityLabel: "600 shared AI credits for high-volume generation",
    features: [
      "50 ready-to-post pieces daily",
      "600 AI generation credits",
      "3 connected Instagram accounts",
      "Higher monthly generation allowance",
      "Advanced performance analytics",
      "Custom brand voice & asset library",
    ],
  },
];
