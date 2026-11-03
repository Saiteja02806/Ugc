import { isPaidBillingPlan, type BillingPlanKey, type PaidBillingPlanKey } from "./policy.ts";

export type { PaidBillingPlanKey };
export type BillingAccessSource = "complimentary" | "dodo" | "free";

export type BillingAccess = {
  accessSource: BillingAccessSource;
  planKey: BillingPlanKey;
};

const PLAN_RANK: Record<PaidBillingPlanKey, number> = {
  starter: 1,
  growth: 2,
  startup: 3,
};

/** Rows arrive newest first; keep that order when active tiers are equal. */
export function selectActiveDodoSubscription<T extends { plan_key: string; status: string }>(rows: readonly T[]): T | null {
  return rows.reduce<T | null>((selected, row) => {
    if (row.status !== "active" || !isPaidBillingPlan(row.plan_key)) return selected;
    return !selected || PLAN_RANK[row.plan_key] > PLAN_RANK[selected.plan_key as PaidBillingPlanKey]
      ? row : selected;
  }, null);
}

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

  if (PLAN_RANK[params.complimentaryPlanKey] > PLAN_RANK[params.dodoPlanKey]) {
    return {
      accessSource: "complimentary",
      planKey: params.complimentaryPlanKey,
    };
  }

  return { accessSource: "dodo", planKey: params.dodoPlanKey };
}
