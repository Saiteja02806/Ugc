import type { BillingPlanKey, PaidBillingPlanKey } from "./policy";

export type { PaidBillingPlanKey };
export type BillingAccessSource = "complimentary" | "dodo" | "free";

export type BillingAccess = {
  accessSource: BillingAccessSource;
  planKey: BillingPlanKey;
};

/**
 * Product access always uses the highest active tier. If both sources provide
 * the same tier, paid access wins so its real billing cycle remains in use.
 */
export function resolveBillingAccess(params: {
  complimentaryPlanKey: PaidBillingPlanKey | null;
  dodoPlanKey: PaidBillingPlanKey | null;
}): BillingAccess {
  if (!params.complimentaryPlanKey && !params.dodoPlanKey) {
    return { accessSource: "free", planKey: "free" };
  }

  if (!params.dodoPlanKey) {
    return {
      accessSource: "complimentary",
      planKey: params.complimentaryPlanKey!,
    };
  }

  if (!params.complimentaryPlanKey) {
    return { accessSource: "dodo", planKey: params.dodoPlanKey };
  }

  const rank: Record<PaidBillingPlanKey, number> = {
    starter: 1,
    growth: 2,
    startup: 3,
  };

  if (rank[params.complimentaryPlanKey] > rank[params.dodoPlanKey]) {
    return {
      accessSource: "complimentary",
      planKey: params.complimentaryPlanKey,
    };
  }

  return { accessSource: "dodo", planKey: params.dodoPlanKey };
}
