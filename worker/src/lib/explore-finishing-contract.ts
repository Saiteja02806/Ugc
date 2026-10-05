/** Shared, serializable contract. Clients submit owned asset IDs, never URLs or storage keys. */
export const EXPLORE_FINISH_VERSION = 1;
export const EXPLORE_RENDER_VERSION = "explore-finish-v1";
export const EXPLORE_FINISH_STYLES = ["clean", "bold-box", "active-word", "editorial"] as const;
export type ExploreFinishStyle = (typeof EXPLORE_FINISH_STYLES)[number];
export type ExploreFinishDraft = {
  version: 1;
  kind: "hook" | "phone";
  sourceAssetId: string;
  demoAssetId: string | null;
  demoAudioAssetId: string | null;
  demoAudioPlayback: "once" | "repeat";
  backgroundAssetId: string | null;
  backgroundPlayback: "once" | "repeat";
  subtitles: { language: "en"; style: ExploreFinishStyle; placement: "bottom" | "top" } | null;
};
export type ExploreFinishReceipt = {
  user_id: string; request_key: string; fingerprint: string; draft: ExploreFinishDraft;
  job_id: string; output_asset_id: string; status: "queued" | "completed" | "uncertain";
};
export class ExploreFinishError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "explore_finish_invalid") { super(message); }
}
export const isExploreUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ExploreFinishError("Choose a valid video finishing draft.");
  return value as Record<string, unknown>;
}
function asset(value: unknown, optional = true) {
  if (optional && value === null) return null;
  if (!isExploreUuid(value)) throw new ExploreFinishError("Select a saved media asset before applying edits.");
  return value.toLowerCase();
}
function playback(value: unknown) {
  if (value !== "once" && value !== "repeat") throw new ExploreFinishError("Choose Play once or Repeat music.");
  return value;
}
export function parseExploreFinishDraft(value: unknown): ExploreFinishDraft {
  const raw = object(value);
  const fields = ["version", "kind", "sourceAssetId", "demoAssetId", "demoAudioAssetId", "demoAudioPlayback", "backgroundAssetId", "backgroundPlayback", "subtitles"];
  if (Object.keys(raw).some(key => !fields.includes(key)) || raw.version !== 1 || (raw.kind !== "hook" && raw.kind !== "phone")) throw new ExploreFinishError("This finishing draft uses an unsupported format.");
  const sourceAssetId = asset(raw.sourceAssetId, false)!;
  const demoAssetId = asset(raw.demoAssetId);
  const demoAudioAssetId = asset(raw.demoAudioAssetId);
  const backgroundAssetId = asset(raw.backgroundAssetId);
  const demoAudioPlayback = playback(raw.demoAudioPlayback), backgroundPlayback = playback(raw.backgroundPlayback);
  if (demoAudioAssetId && !demoAssetId) throw new ExploreFinishError("Add a demo before selecting demo audio.");
  if ((!demoAudioAssetId && demoAudioPlayback !== "once") || (!backgroundAssetId && backgroundPlayback !== "once")) throw new ExploreFinishError("Select audio before choosing Repeat music.");
  let subtitles: ExploreFinishDraft["subtitles"] = null;
  if (raw.subtitles !== null) {
    const sub = object(raw.subtitles);
    if (Object.keys(sub).some(key => !["language", "style", "placement"].includes(key)) || sub.language !== "en" ||
        !EXPLORE_FINISH_STYLES.includes(sub.style as ExploreFinishStyle) || (sub.placement !== "top" && sub.placement !== "bottom")) throw new ExploreFinishError("Choose an English subtitle style and placement.");
    subtitles = { language: "en", style: sub.style as ExploreFinishStyle, placement: sub.placement };
  }
  return { version: 1, kind: raw.kind, sourceAssetId, demoAssetId, demoAudioAssetId, demoAudioPlayback, backgroundAssetId, backgroundPlayback, subtitles };
}
export function exploreFinishOutputKey(assetId: string) {
  if (!isExploreUuid(assetId)) throw new ExploreFinishError("Invalid finished-video identity.");
  return `explore/finishes/${assetId.toLowerCase()}/video.mp4`;
}

/** Pure shared validation; both runtimes verify the same owner-bound receipt. */
export function parseExploreFinishReceipt(raw: unknown, ownerId: string, requestKey: string): ExploreFinishReceipt {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ExploreFinishError("Could not verify the saved finishing request.", 503);
  const r = raw as Record<string, unknown>;
  if (r.user_id !== ownerId || r.request_key !== requestKey || !isExploreUuid(r.job_id) || !isExploreUuid(r.output_asset_id) ||
      typeof r.fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(r.fingerprint) || !["queued","completed","uncertain"].includes(String(r.status))) throw new ExploreFinishError("Could not verify the saved finishing request.", 409);
  return { user_id: ownerId, request_key: requestKey, fingerprint: r.fingerprint, draft: parseExploreFinishDraft(r.draft),
    job_id: r.job_id, output_asset_id: r.output_asset_id, status: r.status as ExploreFinishReceipt["status"] };
}
