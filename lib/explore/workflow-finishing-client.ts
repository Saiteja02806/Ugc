import { isExploreUuid, parseExploreFinishDraft, type ExploreFinishDraft } from "../../worker/src/lib/explore-finishing-contract.ts";
import { validateTranscript, type SubtitleTranscript } from "../../worker/src/subtitles/contracts.ts";
import { withReadDeadline } from "../http/read-deadline.ts";

export type FinishStatus = { requestKey: string; jobId: string | null; outcome: "pending" | "completed" | "captions_ready" | "failed" | "cancelled" | "uncertain" | "unconfirmed"; mediaAssetId: string | null; message: string; captionTranscript?: SubtitleTranscript; terminal?: boolean };
export type SavedFinish = { version: 1; ownerId: string; kind: "hook" | "phone"; requestKey: string; draft: ExploreFinishDraft };
export const FINISH_REQUEST_TIMEOUT_MS = 30_000;
export const finishStorageKey = (owner: string, kind: "hook" | "phone") => `ugc-explore:finish:v1:${encodeURIComponent(owner)}:${kind}`;
export const finishRecoveryStorageKey = (key: string) => `${key}:unconfirmed`;
export function readFinishRecovery(raw: string | null, owner: string, kind: "hook" | "phone"): SavedFinish[] {
  if (!raw) return [];
  if (raw.length > 2 * 1024 * 1024) throw new Error("The saved recovery history could not be verified.");
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error("The saved recovery history could not be verified.");
  return entries.map(entry => readSavedFinish(JSON.stringify(entry), owner, kind)!);
}
/** Only leave a terminal uncertainty for an independent source or a speech-free edit. */
export function canLeaveUncertainFinish(status: FinishStatus | null, saved: SavedFinish | null, sourceId: string | undefined, subtitles: boolean) {
  return Boolean(status?.outcome === "uncertain" && status.terminal && saved && status.requestKey === saved.requestKey && sourceId &&
    (sourceId !== saved.draft.sourceAssetId || !subtitles && saved.draft.subtitles));
}
export function readSavedFinish(raw: string | null, owner: string, kind: "hook" | "phone"): SavedFinish | null {
  if (!raw) return null;
  if (raw.length > 65536) throw new Error("The saved edit could not be verified.");
  const value = JSON.parse(raw) as SavedFinish;
  if (value?.version !== 1 || value.ownerId !== owner || value.kind !== kind || !isExploreUuid(value.requestKey)) throw new Error("The saved edit belongs to another workflow.");
  const draft = parseExploreFinishDraft(value.draft);
  if (draft.kind !== kind) throw new Error("The saved edit belongs to another workflow.");
  return { version: 1, ownerId: owner, kind, requestKey: value.requestKey, draft };
}
export function parseFinishStatus(value: unknown, key: string): FinishStatus {
  const v = value as Record<string, unknown> | null;
  if (!v || v.ok !== true || v.receiptVersion !== 1 || v.requestKey !== key || !["pending", "completed", "captions_ready", "failed", "cancelled", "uncertain", "unconfirmed"].includes(String(v.outcome)) ||
      (v.mediaAssetId !== null && !isExploreUuid(v.mediaAssetId)) || (v.outcome === "completed" && !isExploreUuid(v.mediaAssetId))) throw new Error("Could not confirm the saved edit. Check its status before starting another.");
  if (v.jobId != null && !isExploreUuid(v.jobId)) throw new Error("Could not verify the finishing job.");
  const transcript = v.captionTranscript == null ? undefined : validateTranscript(v.captionTranscript, Number((v.captionTranscript as SubtitleTranscript).durationMs));
  if (transcript && (transcript.durationMs > 60000 || transcript.provider !== "elevenlabs" || transcript.model !== "scribe_v2" || transcript.language !== "en") ||
      v.outcome === "captions_ready" && (!transcript || v.mediaAssetId !== null)) throw new Error("Could not verify your generated captions.");
  return { requestKey: key, jobId: typeof v.jobId === "string" ? v.jobId : null, outcome: v.outcome as FinishStatus["outcome"], mediaAssetId: v.mediaAssetId as string | null, message: typeof v.message === "string" ? v.message.slice(0, 512) : "Checking your saved edit…",
    terminal: v.status === "failed" || v.status === "cancelled" || v.status === "completed",
    ...(transcript ? { captionTranscript: transcript } : {}) };
}
export async function requestFinish(deps: { token: () => Promise<string | null>; fetch: typeof fetch; assertActive: () => void }, saved: SavedFinish, submit = false): Promise<FinishStatus> {
  deps.assertActive();
  const token = await withReadDeadline(() => deps.token(), undefined, FINISH_REQUEST_TIMEOUT_MS); deps.assertActive();
  if (!token) throw new Error("Sign in before applying edits.");
  const signal = AbortSignal.timeout(FINISH_REQUEST_TIMEOUT_MS);
  const { fetch: send } = deps;
  try {
    const response = await send(submit ? "/api/explore/finishes" : `/api/explore/finishes?requestKey=${encodeURIComponent(saved.requestKey)}`, {
      method: submit ? "POST" : "GET", cache: "no-store", signal, headers: { Authorization: `Bearer ${token}`, ...(submit ? { "Content-Type": "application/json", "Idempotency-Key": saved.requestKey } : {}) },
      ...(submit ? { body: JSON.stringify({ requestKey: saved.requestKey, draft: saved.draft }) } : {}),
    });
    const value = await response.json().catch(() => null); deps.assertActive();
    if (!response.ok) throw new Error(typeof value?.error === "string" ? value.error : "Could not confirm finishing. Keep this request and refresh its status.");
    return parseFinishStatus(value, saved.requestKey);
  } catch (error) {
    if (signal.aborted || error instanceof Error && error.name === "TimeoutError") throw new Error("Checking your saved video took too long. Its request is preserved; checking again will not create another render.");
    throw error;
  }
}
