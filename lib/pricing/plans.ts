import { FREE_TRIAL_CONTENT_DAYS, FREE_TRIAL_DAILY_CONTENT_PIECES } from "../billing/free-trial-policy.ts";

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
  style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2,
});
export function formatPricingAmount(amount: number) { return usdPriceFormatter.format(amount); }
export function parseBillingInterval(value: string | string[] | null | undefined): BillingInterval {
  return (Array.isArray(value) ? value[0] : value) === "yearly" ? "yearly" : "monthly";
}
export function getPlanPricing(plan: PricingPlan, interval: BillingInterval): PlanPricing {
  if (plan.prices.monthly === 0) return {
    billedAmount: 0, billingSummary: `${FREE_TRIAL_CONTENT_DAYS}-day free trial`, monthlyEquivalent: 0, savings: 0,
  };
  if (interval === "monthly") return {
    billedAmount: plan.prices.monthly,
    billingSummary: `Billed ${formatPricingAmount(plan.prices.monthly)} monthly`,
    monthlyEquivalent: plan.prices.monthly, savings: 0,
  };
  return {
    billedAmount: plan.prices.yearly,
    billingSummary: `Billed ${formatPricingAmount(plan.prices.yearly)} yearly`,
    monthlyEquivalent: plan.prices.yearly / 12,
    savings: plan.prices.monthly * 12 - plan.prices.yearly,
  };
}

export const pricingPlans: PricingPlan[] = [
  {
    slug: "free", name: "Free trial", bestFor: "Try your content workflow",
    description: "See what UGCPilot can create for your business before choosing a plan.",
    prices: { monthly: 0, yearly: 0 }, sharedMonthlyCredits: 0,
    dailyContentPieces: `${FREE_TRIAL_DAILY_CONTENT_PIECES}/day for ${FREE_TRIAL_CONTENT_DAYS} days`,
    instagramAccounts: 1,
    capacityLabel: `${FREE_TRIAL_CONTENT_DAYS} days · ${FREE_TRIAL_DAILY_CONTENT_PIECES} daily concepts`,
    features: [
      `${FREE_TRIAL_DAILY_CONTENT_PIECES} daily concepts for ${FREE_TRIAL_CONTENT_DAYS} days`,
      "Hooks, Wall of Text videos & carousels",
      "Review, edit & save your content",
      "Unlimited Instagram scheduling during trial",
      "1 connected Instagram account",
      "No credit card required",
    ],
  },
  {
    slug: "starter", name: "Starter", bestFor: "For your everyday content",
    description: "Daily content and custom AI generation for your growing brand.",
    prices: { monthly: 19, yearly: 190 }, sharedMonthlyCredits: 200,
    dailyContentPieces: 20, instagramAccounts: 3,
    capacityLabel: "200 credits / month",
    features: [
      "20 ready-to-post concepts daily",
      "Hooks, Wall of Text videos & carousels",
      "AI Studio image & video generation",
      "AI character creation with shared credits",
      "Review, edit, schedule & track performance",
      "3 connected Instagram accounts",
    ],
  },
  {
    slug: "growth", name: "Growth", bestFor: "For a bigger content calendar",
    description: "More daily ideas, more AI credits and room for multiple brands.",
    prices: { monthly: 49, yearly: 490 }, sharedMonthlyCredits: 600,
    dailyContentPieces: 50, instagramAccounts: 5,
    highlighted: true, badgeLabel: "More capacity",
    capacityLabel: "600 credits / month",
    features: [
      "50 ready-to-post concepts daily",
      "Hooks, Wall of Text videos & carousels",
      "AI Studio image & video generation",
      "AI character creation with shared credits",
      "Review, edit, schedule & track performance",
      "5 connected Instagram accounts",
    ],
  },
];

export const pricingWorkflows = [
  { id: "daily", title: "Daily content", description: "Business-aware hooks, Wall of Text videos and carousels to review each day.", access: "Trial, Starter & Growth" },
  { id: "studio", title: "AI Studio", description: "Create custom images and videos with the models and settings you choose.", access: "Starter & Growth · uses credits" },
  { id: "characters", title: "AI characters", description: "Build a reusable creator for your brand and generate character images.", access: "1 free assisted generation; then credits" },
  { id: "publish", title: "Edit & schedule", description: "Refine your content, save it to your library and plan posts on your calendar.", access: "Instagram scheduling during trial" },
] as const;
