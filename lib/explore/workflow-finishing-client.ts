import { isExploreUuid, parseExploreFinishDraft, type ExploreFinishDraft } from "../../worker/src/lib/explore-finishing-contract.ts";

export type FinishStatus = { requestKey: string; jobId: string | null; outcome: "pending" | "completed" | "failed" | "cancelled" | "uncertain" | "unconfirmed"; mediaAssetId: string | null; message: string };
export type SavedFinish = { version: 1; ownerId: string; kind: "hook" | "phone"; requestKey: string; draft: ExploreFinishDraft };
export const finishStorageKey = (owner: string, kind: "hook" | "phone") => `ugc-explore:finish:v1:${encodeURIComponent(owner)}:${kind}`;
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
  if (!v || v.ok !== true || v.receiptVersion !== 1 || v.requestKey !== key || !["pending", "completed", "failed", "cancelled", "uncertain", "unconfirmed"].includes(String(v.outcome)) ||
      (v.mediaAssetId !== null && !isExploreUuid(v.mediaAssetId)) || (v.outcome === "completed" && !isExploreUuid(v.mediaAssetId))) throw new Error("Could not confirm the saved edit. Check its status before starting another.");
  if (v.jobId != null && !isExploreUuid(v.jobId)) throw new Error("Could not verify the finishing job.");
  return { requestKey: key, jobId: typeof v.jobId === "string" ? v.jobId : null, outcome: v.outcome as FinishStatus["outcome"], mediaAssetId: v.mediaAssetId as string | null, message: typeof v.message === "string" ? v.message.slice(0, 512) : "Checking your saved edit…" };
}
export async function requestFinish(deps: { token: () => Promise<string | null>; fetch: typeof fetch; assertActive: () => void }, saved: SavedFinish, submit = false): Promise<FinishStatus> {
  deps.assertActive();
  const token = await deps.token(); deps.assertActive();
  if (!token) throw new Error("Sign in before applying edits.");
  const response = await deps.fetch(submit ? "/api/explore/finishes" : `/api/explore/finishes?requestKey=${encodeURIComponent(saved.requestKey)}`, {
    method: submit ? "POST" : "GET", cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(submit ? { "Content-Type": "application/json", "Idempotency-Key": saved.requestKey } : {}) },
    ...(submit ? { body: JSON.stringify({ requestKey: saved.requestKey, draft: saved.draft }) } : {}),
  });
  const value = await response.json().catch(() => null); deps.assertActive();
  if (!response.ok) throw new Error(typeof value?.error === "string" ? value.error : "Could not confirm finishing. Keep this request and refresh its status.");
  return parseFinishStatus(value, saved.requestKey);
}
