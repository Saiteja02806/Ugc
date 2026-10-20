import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { EditDraftError, editDraftRevision, parseEditDraft } from "./draft-contract";
import type { EditableVideoDraftInput, EditableVideoRatio, EditableVideoSource, EditableVideoStatus } from "./video-library";

export type SavedEditDraftRow = {
  id: string; user_id: string; project_id: string; source_video_id: string; source: EditableVideoSource;
  title: string; ratio: EditableVideoRatio; status: EditableVideoStatus; draft_json: unknown; draft_revision: number;
  duration_seconds: number | null; created_at: string; updated_at: string; deleted_at: string | null;
  source_video_url: string | null; thumbnail_url: string | null; rendered_video_url: string | null; latest_render_id: string | null;
};
function db() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new EditDraftError("DRAFTS_UNAVAILABLE", "Saved Edit drafts are temporarily unavailable.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function getSavedEditDraftForOwner(userId: string, draftId: string): Promise<SavedEditDraftRow> {
  const { data, error } = await db().from("editable_videos").select("*").eq("user_id", userId).eq("id", draftId).is("deleted_at", null).maybeSingle();
  if (error) throw new EditDraftError("DRAFTS_UNAVAILABLE", "Could not load the saved Edit draft.", 503);
  if (!data) throw new EditDraftError("NOT_FOUND", "The saved Edit draft was not found.", 404);
  return data as SavedEditDraftRow;
}
export async function listSavedEditDraftsForOwner(params: { userId: string; projectId?: string; limit: number; after?: { createdAt: string; id: string } }): Promise<SavedEditDraftRow[]> {
  let query = db().from("editable_videos").select("*").eq("user_id", params.userId).is("deleted_at", null)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(params.limit + 1);
  if (params.projectId) query = query.eq("project_id", params.projectId);
  if (params.after) query = query.or(`created_at.lt.${params.after.createdAt},and(created_at.eq.${params.after.createdAt},id.lt.${params.after.id})`);
  const { data, error } = await query;
  if (error) throw new EditDraftError("DRAFTS_UNAVAILABLE", "Could not load your saved Edit drafts.", 503);
  return data as SavedEditDraftRow[];
}
export async function updateSavedEditDraftForOwner(params: { userId: string; draftId: string; requestId: string; expectedRevision: number; draft: unknown }) {
  if (!z.uuid().safeParse(params.draftId).success || !z.uuid().safeParse(params.requestId).success || !editDraftRevision.safeParse(params.expectedRevision).success)
    throw new EditDraftError("DRAFT_PRECONDITION_REQUIRED", "Reload the saved draft before editing it.", 428);
  // Parsing is deterministic; replay sends the same canonical payload, including blank draft text.
  const draft = parseEditDraft(params.draft);
  const { data, error } = await db().rpc("edit_save_draft", { p_user_id: params.userId, p_draft_id: params.draftId,
    p_request_id: params.requestId, p_expected_revision: params.expectedRevision, p_draft: draft });
  if (error) {
    const known: Record<string, [string, string, number]> = {
      edit_draft_not_found: ["NOT_FOUND", "The saved Edit draft or its source is no longer available.", 404],
      edit_draft_changed: ["DRAFT_CHANGED", "This draft changed in another session. Your local edits are kept; reload the saved draft before trying again.", 409],
      edit_draft_request_conflict: ["DRAFT_REQUEST_CONFLICT", "This save request was already used with different edits.", 409],
      edit_draft_invalid: ["INVALID_DRAFT", "Review the draft and keep the trim range inside the source video.", 400],
    };
    const match = Object.entries(known).find(([key]) => error.message.includes(key));
    if (match) throw new EditDraftError(...match[1]);
    throw new EditDraftError("DRAFTS_UNAVAILABLE", "Could not save the Edit draft. Retry with the same request and edits.", 503);
  }
  const receipt = data as { video: SavedEditDraftRow; replayed: boolean };
  if (!receipt?.video || receipt.video.user_id !== params.userId || receipt.video.id !== params.draftId ||
      !editDraftRevision.safeParse(receipt.video.draft_revision).success || typeof receipt.replayed !== "boolean")
    throw new EditDraftError("DRAFTS_UNAVAILABLE", "Could not verify the saved Edit draft.", 503);
  return receipt;
}
export type SavedDraftContent = EditableVideoDraftInput;

/** Internal only: initial content is derived from the owned source's metadata. */
export async function openSavedEditDraftRecord(userId: string, assetId: string, initialDraft: EditableVideoDraftInput | null) {
  const { data, error } = await db().rpc("edit_open_draft", { p_user_id: userId, p_asset_id: assetId, p_initial_draft: initialDraft });
  if (error) {
    const known: Record<string, [string,string,number]> = {
      edit_open_not_found: ["NOT_FOUND", "The source video was not found.",404],
      edit_open_unsupported: ["UNSUPPORTED_SOURCE", "Only raw Creative Assets videos can be edited.",400],
      edit_open_not_ready: ["SOURCE_NOT_READY", "This source video is not ready for editing.",409],
      edit_open_removed: ["DRAFT_REMOVED", "This Edit project was removed and cannot be reopened.",409],
      edit_open_invalid: ["INVALID_ASSET", "The source video cannot be opened for editing.",400],
    };
    const match = Object.entries(known).find(([key]) => error.message.includes(key));
    if (match) throw new EditDraftError(...match[1]);
    throw new EditDraftError("DRAFTS_UNAVAILABLE", "Could not open the Edit draft. Retry using the same source asset.",503);
  }
  const receipt = data as { video: SavedEditDraftRow; reused: boolean };
  if (!receipt?.video || receipt.video.user_id !== userId || receipt.video.source_video_id !== assetId ||
      receipt.video.deleted_at !== null || !z.uuid().safeParse(receipt.video.id).success ||
      !editDraftRevision.safeParse(receipt.video.draft_revision).success || typeof receipt.reused !== "boolean")
    throw new EditDraftError("DRAFTS_UNAVAILABLE", "Could not verify the opened Edit draft. Retry using the same source asset.",503);
  return receipt;
}
