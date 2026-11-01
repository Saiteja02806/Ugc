import { FREE_TRIAL_CONTENT_DAYS, FREE_TRIAL_DAILY_CONTENT_PIECES } from "../billing/free-trial-policy.ts";
import { PAID_PLAN_MONTHLY_CREDITS } from "../billing/policy.ts";

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
  oneTimeCredits: number;
  prices: Record<BillingInterval, number>;
  sharedMonthlyCredits: number;
  slug: "free" | "starter" | "growth" | "startup";
};
export type PlanAllowanceView = "credits" | "full" | "hooks";
export type PlanPricing = {
  billedAmount: number;
  billingSummary: string;
  monthlyEquivalent: number;
  savings: number;
};
const usdPriceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2,
});
export const HOOK_VIDEO_SECONDS = 3;
export const FULL_VIDEO_SECONDS = 6;
const HOOK_VIDEO_CREDITS = HOOK_VIDEO_SECONDS * 4;
const FULL_VIDEO_CREDITS = FULL_VIDEO_SECONDS * 4;
export function formatPricingAmount(amount: number) { return usdPriceFormatter.format(amount); }
export function getPlanVideoAllowance(monthlyCredits: number) {
  return {
    fullVideos: Math.floor(monthlyCredits / FULL_VIDEO_CREDITS),
    hookVideos: Math.floor(monthlyCredits / HOOK_VIDEO_CREDITS),
  };
}
export function formatPlanAllowance(
  monthlyCredits: number,
  view: PlanAllowanceView,
) {
  const allowance = getPlanVideoAllowance(monthlyCredits);
  if (view === "hooks") return `${allowance.hookVideos} video hooks`;
  if (view === "full") return `${allowance.fullVideos} full videos`;
  return `${monthlyCredits.toLocaleString("en-US")} credits`;
}
function monthlyVideoFeatures(monthlyCredits: number) {
  const allowance = getPlanVideoAllowance(monthlyCredits);
  return [
    `${allowance.hookVideos} three-second hook videos each month`,
    `${allowance.fullVideos} six-second videos each month`,
    `${monthlyCredits.toLocaleString("en-US")} AI credits each month`,
  ];
}
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
    description: "See what Vidmake can create for your business before choosing a plan.",
    prices: { monthly: 0, yearly: 0 }, sharedMonthlyCredits: 0, oneTimeCredits: 0,
    dailyContentPieces: `${FREE_TRIAL_DAILY_CONTENT_PIECES}/day for ${FREE_TRIAL_CONTENT_DAYS} days`,
    instagramAccounts: 1,
    capacityLabel: "No AI credits",
    features: [
      `Access to daily content workflows for ${FREE_TRIAL_CONTENT_DAYS} days`,
      `${FREE_TRIAL_DAILY_CONTENT_PIECES} daily concepts for ${FREE_TRIAL_CONTENT_DAYS} days`,
      "Daily slideshows; hooks & text-led videos in Explore",
      "Review, edit & save your content",
      "Download finished carousels and videos",
      "Connect Instagram, TikTok & YouTube",
      "Video editing and export",
      "No credit card required",
    ],
  },
  {
    slug: "starter", name: "Starter", bestFor: "For your everyday content",
    description: "Daily content and custom AI generation for your growing brand.",
    prices: { monthly: 29, yearly: 290 }, sharedMonthlyCredits: PAID_PLAN_MONTHLY_CREDITS.starter, oneTimeCredits: 0,
    dailyContentPieces: 20, instagramAccounts: 3,
    capacityLabel: "360 credits / month",
    features: [
      ...monthlyVideoFeatures(PAID_PLAN_MONTHLY_CREDITS.starter),
      "Access to all available workflows",
      "20 daily slideshow concepts to review",
      "Hooks, text-led videos & slideshows in Explore",
      "AI Studio image & video generation",
      "AI character creation with shared credits",
      "Review, edit and export finished videos",
      "Connect Instagram, TikTok & YouTube",
      "Video editing and export",
    ],
  },
  {
    slug: "growth", name: "Growth", bestFor: "For a bigger content calendar",
    description: "More daily ideas, more AI credits and room for multiple brands.",
    prices: { monthly: 49, yearly: 490 }, sharedMonthlyCredits: PAID_PLAN_MONTHLY_CREDITS.growth, oneTimeCredits: 0,
    dailyContentPieces: 50, instagramAccounts: 5,
    highlighted: true, badgeLabel: "Best seller",
    capacityLabel: "720 credits / month",
    features: [
      ...monthlyVideoFeatures(PAID_PLAN_MONTHLY_CREDITS.growth),
      "Access to all available workflows",
      "50 daily slideshow concepts to review",
      "Hooks, text-led videos & slideshows in Explore",
      "AI Studio image & video generation",
      "AI character creation with shared credits",
      "Review, edit and export finished videos",
      "Connect Instagram, TikTok & YouTube",
      "Video editing and export",
    ],
  },
  {
    slug: "startup", name: "Startup", bestFor: "For a larger content operation",
    description: "The larger monthly video allowance for teams publishing every day.",
    prices: { monthly: 99, yearly: 990 }, sharedMonthlyCredits: PAID_PLAN_MONTHLY_CREDITS.startup, oneTimeCredits: 0,
    dailyContentPieces: 50, instagramAccounts: 5,
    capacityLabel: "1,800 credits / month",
    features: [
      ...monthlyVideoFeatures(PAID_PLAN_MONTHLY_CREDITS.startup),
      "Access to all available workflows",
      "50 daily slideshow concepts to review",
      "Hooks, text-led videos & slideshows in Explore",
      "AI Studio image & video generation",
      "AI character creation with shared credits",
      "Review, edit and export finished videos",
      "Connect Instagram, TikTok & YouTube",
      "Video editing and export",
    ],
  },
];

export const displayedPricingPlans = pricingPlans.filter((plan) => plan.slug !== "free");

export const pricingWorkflows = [
  { id: "daily", title: "Daily slideshows", description: "Business-aware slideshow concepts in Trending. Create hooks and text-led videos separately in Explore.", access: "Trial, Starter, Growth & Startup" },
  { id: "studio", title: "AI Studio", description: "Create custom images and videos with the models and settings you choose.", access: "Monthly credits on paid plans" },
  { id: "characters", title: "AI characters", description: "Build a reusable creator for your brand and generate character images.", access: "Uses credits on a paid plan" },
  { id: "publish", title: "Review & export", description: "Review the finished image or video, then download the version you approve.", access: "Included with the account" },
] as const;
