import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clipDraftScope, ExploreClipDraftError, parseClipDraftContent, parseClipDraftReceipt, parseClipDraftSave, type ExploreClipDraftSaveRequest } from "./clip-draft-contract";
import { parseHookSourceTimeline } from "../../worker/src/lib/hook-source-timeline.ts";
import { parseHookKeyframeGenerationReceipt } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";

function database() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new ExploreClipDraftError("Saved clip edits are temporarily unavailable.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
/** JSON-only persistence. This store never submits render jobs or marks media ready. */
export class ExploreClipDraftStore {
  constructor(private readonly db = database()) {}
  /** Initial suggestion only: never fabricate a persisted revision or overwrite
   * an explicit saved draft. All provenance comes from this owner's completed job. */
  async initialContent(owner: string, sourceAssetId: string, scope: string) {
    if (scope !== "hook" && scope !== "wall_text") return null;
    const asset = await this.db.from("media_assets").select("id,user_id,source_record_id,status,collection,deleted_at")
      .eq("user_id", owner).eq("id", sourceAssetId).maybeSingle();
    if (asset.error) throw new ExploreClipDraftError("Could not load the initial clip timing.", 503);
    if (!asset.data || asset.data.user_id !== owner || asset.data.id !== sourceAssetId || asset.data.status !== "ready" ||
      asset.data.collection !== "video" || asset.data.deleted_at !== null || !asset.data.source_record_id) return null;
    const job = await this.db.from("background_jobs").select("id,user_id,job_type,status,input_json,output_json")
      .eq("user_id", owner).eq("id", asset.data.source_record_id).maybeSingle();
    if (job.error) throw new ExploreClipDraftError("Could not load the initial clip timing.", 503);
    const row = job.data;
    if (!row || row.id !== asset.data.source_record_id || row.user_id !== owner || row.job_type !== "generate_hook_video" || row.status !== "completed" || row.input_json?.exploreFormat !== scope ||
      row.output_json?.mediaAssetId !== sourceAssetId) return null;
    if (scope === "wall_text") {
      const plan = row.input_json.automaticHookText, result = row.output_json.automaticHookText;
      const editing = result?.editing, durationMs = Math.floor(Number(row.output_json.durationSeconds) * 1000);
      if (plan?.version !== 1 || plan.source?.format !== "wall_text" || plan.source.referenceId !== row.input_json.referenceId ||
        plan.wallLayout?.version !== 1 || plan.wallLayout.referenceId !== plan.source.referenceId || plan.wallLayout.sourceSha256 !== plan.source.sourceSha256 ||
        result?.status !== "ready" || result.requestKey !== plan.requestKey || editing?.format !== "wall_text" ||
        editing.trimStartMs !== 0 || editing.trimEndMs !== durationMs || row.input_json.hookSourceTimeline) return null;
      return parseClipDraftContent({ version: 1, sourceAssetId, editing, backgroundAssetId: null, backgroundPlayback: "once" });
    }
    if (!row.input_json?.hookSourceTimeline) return null;
    const receipt = parseHookKeyframeGenerationReceipt(row.input_json.startingFrameReceipt);
    if (!receipt || receipt.ownerId !== owner || receipt.version !== 5) return null;
    const timeline = parseHookSourceTimeline(row.input_json.hookSourceTimeline, receipt, row.input_json.durationSeconds);
    const output = row.output_json;
    const editing = output.automaticHookText?.status === "ready" ? output.automaticHookText.editing : output.initialHookEdit;
    if (!editing || editing.trimStartMs !== 0 || editing.trimEndMs !== timeline.trimEndMs) return null;
    return parseClipDraftContent({ version: 1, sourceAssetId, editing, backgroundAssetId: null, backgroundPlayback: "once" });
  }
  async listContentDemoEdits(owner: string, sourceAssetIds: string[]) {
    const edits = new Map<string, { scope: "hook:demo"; revision: number; updatedAt: string }>();
    for (let offset = 0; offset < sourceAssetIds.length; offset += 100) {
      const ids = sourceAssetIds.slice(offset, offset + 100);
      const { data, error } = await this.db.from("explore_clip_drafts").select("user_id,scope,source_asset_id,revision,updated_at")
        .eq("user_id", owner).eq("scope", "hook:demo").in("source_asset_id", ids);
      if (error) throw new ExploreClipDraftError("Could not load saved demo edits.", 503);
      for (const row of data ?? []) {
        if (row.user_id !== owner || row.scope !== "hook:demo" || !ids.includes(row.source_asset_id) || !Number.isSafeInteger(row.revision) || row.revision < 1 || !Number.isFinite(Date.parse(row.updated_at)))
          throw new ExploreClipDraftError("Could not verify saved demo edits.", 503);
        edits.set(row.source_asset_id, { scope: "hook:demo", revision: row.revision, updatedAt: row.updated_at });
      }
    }
    return edits;
  }
  async read(owner: string, sourceAssetId: string, scope: string) {
    clipDraftScope(scope);
    const { data, error } = await this.db.from("explore_clip_drafts").select("id,user_id,scope,source_asset_id,revision,content,updated_at")
      .eq("user_id", owner).eq("source_asset_id", sourceAssetId).eq("scope", scope).maybeSingle();
    if (error) throw new ExploreClipDraftError("Could not load your saved clip edits.", 503);
    if (!data) return null;
    if (data.user_id !== owner || data.source_asset_id !== sourceAssetId) throw new ExploreClipDraftError("Could not verify your saved clip edits.", 503);
    return parseClipDraftReceipt({ ...data, updatedAt: data.updated_at }, sourceAssetId, scope);
  }
  async save(owner: string, input: ExploreClipDraftSaveRequest) {
    const request = parseClipDraftSave(input);
    const { data, error } = await this.db.rpc("explore_save_clip_draft", { p_user_id: owner, p_scope: request.scope,
      p_source_asset_id: request.content.sourceAssetId, p_request_id: request.requestId, p_expected_revision: request.expectedRevision, p_content: request.content });
    if (error) {
      const known: Record<string, [number, string]> = {
        clip_draft_changed: [409, "This clip changed in another session. Your local edits are kept; reload the saved draft before saving again."],
        clip_draft_request_conflict: [409, "This save request was already used for different edits."],
        clip_draft_asset_unavailable: [409, "The selected clip or audio is no longer available."],
        clip_draft_invalid: [400, "Review the trim range and clip edits."],
      };
      const code = Object.keys(known).find(code => error.message.includes(code));
      throw new ExploreClipDraftError(code ? known[code][1] : "Could not save your edits. Retry the same save request.", code ? known[code][0] : 503, code ?? "clip_draft_unavailable");
    }
    if (data?.user_id !== owner || data?.request_id !== request.requestId || typeof data?.replayed !== "boolean")
      throw new ExploreClipDraftError("Could not verify your saved clip edits. Retry this save.", 503);
    const draft = parseClipDraftReceipt(data.draft, request.content.sourceAssetId, request.scope);
    if (JSON.stringify(draft.content) !== JSON.stringify(request.content) || draft.revision < request.expectedRevision)
      throw new ExploreClipDraftError("The saved edits do not match this request.", 409, "clip_draft_request_conflict");
    return { draft, replayed: data.replayed as boolean, requestId: request.requestId };
  }
}
