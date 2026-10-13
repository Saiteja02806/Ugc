import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clipDraftScope, ExploreClipDraftError, parseClipDraftReceipt, parseClipDraftSave, type ExploreClipDraftSaveRequest } from "./clip-draft-contract";

function database() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new ExploreClipDraftError("Saved clip edits are temporarily unavailable.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
/** JSON-only persistence. This store never submits render jobs or marks media ready. */
export class ExploreClipDraftStore {
  constructor(private readonly db = database()) {}
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
