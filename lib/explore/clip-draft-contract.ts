import { isExploreUuid, parseDemoFraming, type DemoFraming } from "../../worker/src/lib/explore-finishing-contract.ts";
import type { ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";
import { readFormatEditDraft } from "./format-edit-draft.ts";

export type ExploreClipDraftContent = {
  version: 1; sourceAssetId: string; editing: ExploreFormatEdit;
  backgroundAssetId: string | null; backgroundPlayback: "once" | "repeat";
  framing?: DemoFraming | null;
  workflowMusic?: { enabled: boolean; assetId: string | null; playback: "once" | "repeat" };
};
export type ExploreClipDraft = {
  id: string; scope: string; revision: number; content: ExploreClipDraftContent; updatedAt: string;
};
export type ExploreClipDraftSaveRequest = {
  requestId: string; scope: string; expectedRevision: number; content: ExploreClipDraftContent;
};
export class ExploreClipDraftError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "clip_draft_invalid") { super(message); }
}
export function clipDraftScope(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(value))
    throw new ExploreClipDraftError("Choose a valid clip editor.");
  return value;
}
export function parseClipDraftContent(value: unknown): ExploreClipDraftContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ExploreClipDraftError("Review your clip edits.");
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !["version", "sourceAssetId", "editing", "backgroundAssetId", "backgroundPlayback", "framing", "workflowMusic"].includes(key)) ||
      raw.version !== 1 || !isExploreUuid(raw.sourceAssetId) ||
      raw.backgroundAssetId !== null && !isExploreUuid(raw.backgroundAssetId) ||
      raw.backgroundPlayback !== "once" && raw.backgroundPlayback !== "repeat" ||
      raw.backgroundAssetId === null && raw.backgroundPlayback !== "once") throw new ExploreClipDraftError("Choose a saved clip and audio before saving edits.");
  let editing: ExploreFormatEdit;
  try { editing = readFormatEditDraft(raw.editing); }
  catch (error) { throw new ExploreClipDraftError(error instanceof Error ? error.message : "Review your clip edits."); }
  let framing: DemoFraming | null | undefined, workflowMusic: ExploreClipDraftContent["workflowMusic"];
  try { framing = raw.framing === undefined ? undefined : raw.framing === null ? null : parseDemoFraming(raw.framing); }
  catch { throw new ExploreClipDraftError("Review your demo crop and pan."); }
  if (raw.workflowMusic !== undefined) {
    const music = raw.workflowMusic as Record<string, unknown>;
    if (!music || typeof music !== "object" || Array.isArray(music) || Object.keys(music).some(key => !["enabled", "assetId", "playback"].includes(key)) ||
        typeof music.enabled !== "boolean" || music.assetId !== null && !isExploreUuid(music.assetId) || music.playback !== "once" && music.playback !== "repeat")
      throw new ExploreClipDraftError("Review the video's background music.");
    workflowMusic = { enabled: music.enabled, assetId: typeof music.assetId === "string" ? music.assetId.toLowerCase() : null, playback: music.playback };
  }
  return { version: 1, sourceAssetId: raw.sourceAssetId.toLowerCase(), editing,
    backgroundAssetId: typeof raw.backgroundAssetId === "string" ? raw.backgroundAssetId.toLowerCase() : null,
    backgroundPlayback: raw.backgroundPlayback, ...(framing === undefined ? {} : { framing }), ...(workflowMusic ? { workflowMusic } : {}) };
}
export function parseClipDraftSave(value: unknown): ExploreClipDraftSaveRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ExploreClipDraftError("Review the save request.");
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !["requestId", "scope", "expectedRevision", "content"].includes(key)) || !isExploreUuid(raw.requestId) ||
      !Number.isSafeInteger(raw.expectedRevision) || (raw.expectedRevision as number) < 0)
    throw new ExploreClipDraftError("Reload your saved draft before saving these changes.", 428, "clip_draft_precondition_required");
  return { requestId: raw.requestId.toLowerCase(), scope: clipDraftScope(raw.scope), expectedRevision: raw.expectedRevision as number, content: parseClipDraftContent(raw.content) };
}
export function parseClipDraftReceipt(value: unknown, sourceAssetId: string, scope: string): ExploreClipDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ExploreClipDraftError("Could not verify the saved clip edits.", 503);
  const raw = value as Record<string, unknown>, content = parseClipDraftContent(raw.content);
  if (!isExploreUuid(raw.id) || raw.scope !== scope || content.sourceAssetId !== sourceAssetId || !Number.isSafeInteger(raw.revision) ||
      (raw.revision as number) < 1 || typeof raw.updatedAt !== "string" || !Number.isFinite(Date.parse(raw.updatedAt)))
    throw new ExploreClipDraftError("Could not verify the saved clip edits.", 503);
  return { id: raw.id, scope, revision: raw.revision as number, content, updatedAt: raw.updatedAt };
}
