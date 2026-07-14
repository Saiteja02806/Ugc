export type PlanSlug = "creator" | "pro";

export type PricingPlan = {
  billingText: string;
  buttonLabel: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  imageCredits: number;
  monthlyPrice: number;
  name: string;
  slug: PlanSlug;
  videoCredits: number;
};

export const pricingPlans: PricingPlan[] = [
  {
    slug: "creator",
    name: "Creator",
    description: "For focused creators building a consistent content rhythm.",
    monthlyPrice: 19,
    billingText: "per month",
    imageCredits: 200,
    videoCredits: 200,
    highlighted: true,
    buttonLabel: "Choose Creator",
    features: [
      "Watermark-free exports",
      "Commercial usage",
      "Monthly credit renewal",
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    description: "For teams producing more image and video variations.",
    monthlyPrice: 49,
    billingText: "per month",
    imageCredits: 600,
    videoCredits: 600,
    buttonLabel: "Choose Pro",
    features: [
      "Watermark-free exports",
      "Commercial usage",
      "Monthly credit renewal",
      "Higher generation capacity",
    ],
  },
];
