import type { BillingInterval } from "@/lib/pricing/plans";

export type PurchaseIntent = {
  billingInterval: BillingInterval;
  planSlug: "free" | "growth" | "starter";
};

export function parsePurchaseIntent(
  searchParams: Pick<URLSearchParams, "get">,
): PurchaseIntent | null {
  const rawPlan = searchParams.get("plan");

  if (rawPlan !== "free" && rawPlan !== "starter" && rawPlan !== "growth") {
    return null;
  }

  return {
    billingInterval:
      searchParams.get("billing") === "yearly" ? "yearly" : "monthly",
    planSlug: rawPlan,
  };
}

export function getPostSignInDestination(
  searchParams: Pick<URLSearchParams, "get">,
) {
  const intent = parsePurchaseIntent(searchParams);

  if (!intent || intent.planSlug === "free") {
    return "/dashboard";
  }

  const params = new URLSearchParams({
    checkout: "continue",
    plan: intent.planSlug,
  });

  if (intent.billingInterval === "yearly") {
    params.set("billing", "yearly");
  }

  return `/pricing?${params.toString()}`;
}
