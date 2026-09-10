import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  resolveBillingAccess,
  type PaidBillingPlanKey,
} from "./complimentary-plan-policy";

export {
  resolveBillingAccess,
  type BillingAccess,
  type BillingAccessSource,
  type PaidBillingPlanKey,
} from "./complimentary-plan-policy";

export type ActiveComplimentaryPlanGrant = {
  creditLimit: number;
  expiresAt: string | null;
  grantedAt: string;
  grantedByUserId: string;
  id: string;
  planKey: PaidBillingPlanKey;
  reason: string;
  updatedAt: string;
};

let client: SupabaseClient | null = null;

export async function getActiveComplimentaryPlanGrant(
  userId: string,
): Promise<ActiveComplimentaryPlanGrant | null> {
  if (!userId.trim()) {
    return null;
  }

  const { data, error } = await getClient()
    .from("complimentary_plan_grants")
    .select(
      "credit_limit,expires_at,granted_at,granted_by_user_id,id,plan_key,reason,updated_at",
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("granted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not load complimentary plan access: ${error.message}`,
    );
  }

  if (!data || (data.plan_key !== "starter" && data.plan_key !== "growth")) {
    return null;
  }

  return {
    creditLimit: positiveInteger(data.credit_limit),
    expiresAt: data.expires_at ?? null,
    grantedAt: data.granted_at,
    grantedByUserId: data.granted_by_user_id,
    id: data.id,
    planKey: data.plan_key,
    reason: data.reason,
    updatedAt: data.updated_at,
  };
}

function getClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Supabase is not configured for complimentary plan access.");
  }

  client ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 0;
}
