import { AudioError } from "./audio-contract.ts";
import { AUDIO_UPGRADE_MESSAGE, hasAudioGenerationSubscription } from "./audio-access-policy.ts";
import { audioDb } from "./audio-store.ts";
import { RetryableJobError } from "../retryable-job-error.ts";

// Recheck application entitlements before a queued job starts a new provider
// operation. Saved output finalization and owner playback do not spend allowance.
export async function assertAudioGenerationSubscription(userId: string) {
  let allowed: boolean;
  try {
    const [subscriptions, grant] = await Promise.all([
      audioDb().from("billing_subscriptions").select("plan_key").eq("user_id", userId).eq("status", "active").order("last_event_at", { ascending: false }).limit(10),
      audioDb().from("complimentary_plan_grants").select("plan_key").eq("user_id", userId).is("revoked_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("granted_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (subscriptions.error || grant.error) throw new Error("Billing lookup unavailable");
    allowed = (subscriptions.data ?? []).some(row => hasAudioGenerationSubscription({ isActive: true, planKey: normalizeBillingPlan(row.plan_key) })) ||
      hasAudioGenerationSubscription({ isActive: true, planKey: grant.data?.plan_key ?? "free" });
  } catch {
    throw new RetryableJobError("Your audio plan could not be checked yet. No audio has been generated.", { code: "audio_entitlements_unavailable", retryAfterSeconds: 30 });
  }
  if (!allowed) throw new AudioError(AUDIO_UPGRADE_MESSAGE, 403);
}

function normalizeBillingPlan(plan: string | null | undefined) {
  const value = plan?.trim().toLowerCase() ?? "free";
  if (value === "pro") return "starter";
  if (value === "creator" || value === "ultra_pro") return "growth";
  return value;
}
