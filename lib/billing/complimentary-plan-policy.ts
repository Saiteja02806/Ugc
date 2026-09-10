import type { BillingPlanKey } from "./policy";

export type PaidBillingPlanKey = Exclude<BillingPlanKey, "free">;
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

  if (
    params.complimentaryPlanKey === "growth" &&
    params.dodoPlanKey === "starter"
  ) {
    return { accessSource: "complimentary", planKey: "growth" };
  }

  return { accessSource: "dodo", planKey: params.dodoPlanKey };
}
