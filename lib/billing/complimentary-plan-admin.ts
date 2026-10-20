import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getActiveComplimentaryPlanGrant } from "./complimentary-plan-grants";
import { getUserSubscription } from "./subscription-db";
import {
  findFirebaseUserByEmail,
  type FirebaseAdminUser,
} from "@/lib/firebase/admin-user-lookup";

export class ComplimentaryPlanAdminError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "ComplimentaryPlanAdminError";
  }
}

export async function inspectComplimentaryPlanAccount(email: string) {
  const account = await findFirebaseUserByEmail(email);

  if (!account) {
    return { account: null, grant: null, subscription: null };
  }

  const [grant, subscription] = await Promise.all([
    getActiveComplimentaryPlanGrant(account.uid),
    getUserSubscription(account.uid),
  ]);

  return { account, grant, subscription };
}

export async function grantComplimentaryPlan(params: {
  account: FirebaseAdminUser;
  expiresAt: string | null;
  grantedByUserId: string;
  planKey: "starter" | "growth";
  reason: string;
}) {
  if (!params.account.emailVerified) {
    throw new ComplimentaryPlanAdminError(
      "Verify this account's email before granting product access.",
      409,
    );
  }

  const { error } = await getClient().rpc("grant_complimentary_plan", {
    p_expires_at: params.expiresAt,
    p_granted_by_user_id: params.grantedByUserId,
    p_plan_key: params.planKey,
    p_reason: params.reason,
    p_user_id: params.account.uid,
  });

  if (error) {
    throw new ComplimentaryPlanAdminError(
      `Could not grant complimentary access: ${error.message}`,
    );
  }

  return inspectComplimentaryPlanAccount(params.account.email);
}

export async function revokeComplimentaryPlan(params: {
  email: string;
  revokedByUserId: string;
  reason: string;
}) {
  const account = await findFirebaseUserByEmail(params.email);

  if (!account) {
    return { account: null, grant: null, subscription: null };
  }

  const { error } = await getClient().rpc("revoke_complimentary_plan", {
    p_reason: params.reason,
    p_revoked_by_user_id: params.revokedByUserId,
    p_user_id: account.uid,
  });

  if (error) {
    throw new ComplimentaryPlanAdminError(
      `Could not revoke complimentary access: ${error.message}`,
    );
  }

  return inspectComplimentaryPlanAccount(account.email);
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new ComplimentaryPlanAdminError(
      "Supabase is not configured for billing administration.",
      503,
    );
  }

  client ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}
