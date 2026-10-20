import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ExploreFinishError, isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import type { ExploreFinishDraft } from "@/worker/src/lib/explore-finishing-contract";

export type ExploreScheduleBinding = {
  user_id: string; request_key: string; request_hash: string; schedule_id: string;
  state: "pending" | "scheduled" | "failed" | "cancelled";
  deadline_at: string; lease_token: string | null; last_error_code: string | null; last_error_message: string | null;
};
function database() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new ExploreFinishError("Background scheduling storage is not configured.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function parseExploreScheduleBinding(value: unknown, owner: string, key: string): ExploreScheduleBinding {
  const r = value as ExploreScheduleBinding | null;
  if (!r || r.user_id !== owner || r.request_key !== key || !isExploreUuid(r.schedule_id) || !/^[0-9a-f]{64}$/.test(r.request_hash) ||
      !["pending", "scheduled", "failed", "cancelled"].includes(r.state) || !Number.isFinite(Date.parse(r.deadline_at))) {
    throw new ExploreFinishError("Could not verify the saved background schedule.", 409);
  }
  return r;
}
export class ExplorePendingScheduleStore {
  constructor(private readonly db = database()) {}
  async available() {
    const { error } = await this.db.from("explore_video_schedules").select("request_key", { head: true }).limit(1);
    return !error;
  }
  async read(owner: string, key: string) {
    const { data, error } = await this.db.from("explore_video_schedules").select("*").eq("user_id", owner).eq("request_key", key).maybeSingle();
    if (error) throw new ExploreFinishError("Could not read the saved background schedule.", 503);
    return data ? parseExploreScheduleBinding(data, owner, key) : null;
  }
  async reserve(params: { owner: string; key: string; requestHash: string; fingerprint: string; draft: ExploreFinishDraft; schedule: unknown }) {
    const { data, error } = await this.db.rpc("explore_reserve_video_schedule", {
      p_user_id: params.owner, p_request_key: params.key, p_request_hash: params.requestHash,
      p_fingerprint: params.fingerprint, p_draft: params.draft, p_schedule: params.schedule,
    });
    if (error) {
      const conflict = error.message.includes("explore_schedule_conflict") || error.message.includes("explore_finish_conflict");
      const busy = error.message.includes("explore_finish_busy");
      throw new ExploreFinishError(conflict ? "This schedule request was already used for different details." : busy ?
        "Another video is being prepared. Check that saved request before scheduling a new version." :
        "Could not save this background schedule. Keep the same request and check again.", conflict || busy ? 409 : 503,
        conflict ? "explore_schedule_conflict" : busy ? "explore_finish_busy" : "explore_schedule_storage_error");
    }
    return parseExploreScheduleBinding(data, params.owner, params.key);
  }
  async due(limit: number) {
    const { data, error } = await this.db.from("explore_video_schedules").select("*").eq("state", "pending")
      .lte("next_attempt_at", new Date().toISOString()).order("next_attempt_at").limit(Math.min(25, Math.max(1, limit)));
    // Legacy deployments can recover ordinary jobs before this additive table
    // exists. Other storage failures must remain visible/retryable.
    if (error && ["42P01", "PGRST205"].includes(error.code)) return [];
    if (error) throw new ExploreFinishError("Could not read background schedule recovery requests.", 503);
    return (data ?? []).map(row => parseExploreScheduleBinding(row, row.user_id, row.request_key));
  }
  async claim(owner: string, key: string, token: string) {
    const { data, error } = await this.db.rpc("explore_claim_video_schedule", { p_user_id: owner, p_request_key: key, p_lease_token: token });
    if (error) throw new ExploreFinishError("Could not claim background schedule recovery.", 503);
    return data ? parseExploreScheduleBinding(data, owner, key) : null;
  }
  async fail(binding: ExploreScheduleBinding, token: string, errorCode: string, message: string) {
    const { data, error } = await this.db.rpc("explore_fail_video_schedule", {
      p_user_id: binding.user_id, p_request_key: binding.request_key, p_lease_token: token,
      p_error_code: errorCode, p_message: message,
    });
    if (error || !data) throw new ExploreFinishError("Could not confirm video preparation failure.", 503);
    return parseExploreScheduleBinding(data, binding.user_id, binding.request_key);
  }
  async finish(binding: ExploreScheduleBinding, token: string, state: ExploreScheduleBinding["state"], errorCode: string | null = null, message: string | null = null) {
    const { data, error } = await this.db.from("explore_video_schedules").update({ state, lease_token: null, lease_until: null,
      next_attempt_at: new Date(Date.now() + 30_000).toISOString(), last_error_code: errorCode, last_error_message: message,
      updated_at: new Date().toISOString() }).eq("user_id", binding.user_id).eq("request_key", binding.request_key).eq("lease_token", token).select("request_key").maybeSingle();
    if (error || data?.request_key !== binding.request_key) throw new ExploreFinishError("Could not confirm background schedule recovery.", 503);
  }
}
