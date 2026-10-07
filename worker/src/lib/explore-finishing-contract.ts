/** Shared, serializable contract. Clients submit owned asset IDs, never URLs or storage keys. */
export const EXPLORE_FINISH_VERSION = 1;
export const EXPLORE_RENDER_VERSION = "explore-finish-v2";
export const DEMO_FRAMING_RENDER_VERSION = "explore-finish-pan-v2";
export const MAX_DEMO_FRAMING_POINTS = 512;
/** Fixed-size viewport; timestamps are relative to the DEMO, not the opening. */
export type DemoFramingPoint = [timeMs: number, x: number, y: number];
export type DemoFraming = { version: 1; width: number; height: number; points: DemoFramingPoint[] };
import { SUBTITLE_STYLES } from "../subtitles/styles.ts";
export const EXPLORE_FINISH_STYLES = SUBTITLE_STYLES;
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
  demoFraming?: DemoFraming;
  subtitles: { language: "en"; style: ExploreFinishStyle; placement?: "bottom" | "middle" | "top" } | null;
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
  const fields = ["version", "kind", "sourceAssetId", "demoAssetId", "demoAudioAssetId", "demoAudioPlayback", "backgroundAssetId", "backgroundPlayback", "subtitles", "demoFraming"];
  if (Object.keys(raw).some(key => !fields.includes(key)) || raw.version !== 1 || (raw.kind !== "hook" && raw.kind !== "phone")) throw new ExploreFinishError("This finishing draft uses an unsupported format.");
  const sourceAssetId = asset(raw.sourceAssetId, false)!;
  const demoAssetId = asset(raw.demoAssetId);
  const demoAudioAssetId = asset(raw.demoAudioAssetId);
  const backgroundAssetId = asset(raw.backgroundAssetId);
  const demoAudioPlayback = playback(raw.demoAudioPlayback), backgroundPlayback = playback(raw.backgroundPlayback);
  if (demoAudioAssetId && !demoAssetId) throw new ExploreFinishError("Add a demo before selecting demo audio.");
  const demoFraming = raw.demoFraming === undefined ? undefined : parseDemoFraming(raw.demoFraming);
  if (demoFraming && !demoAssetId) throw new ExploreFinishError("Add a demo before recording its framing.");
  if ((!demoAudioAssetId && demoAudioPlayback !== "once") || (!backgroundAssetId && backgroundPlayback !== "once")) throw new ExploreFinishError("Select audio before choosing Repeat music.");
  let subtitles: ExploreFinishDraft["subtitles"] = null;
  if (raw.subtitles !== null) {
    const sub = object(raw.subtitles);
    if (Object.keys(sub).some(key => !["language", "style", "placement"].includes(key)) || sub.language !== "en" ||
        !EXPLORE_FINISH_STYLES.includes(sub.style as ExploreFinishStyle) || (sub.placement !== undefined && sub.placement !== "top" && sub.placement !== "middle" && sub.placement !== "bottom")) throw new ExploreFinishError("Choose an English subtitle style and placement.");
    // Missing placement means Bottom at render time. Keep it omitted here so
    // durable legacy request fingerprints do not change during recovery.
    subtitles = { language: "en", style: sub.style as ExploreFinishStyle,
      ...(sub.placement === undefined ? {} : { placement: sub.placement as "bottom" | "middle" | "top" }) };
  }
  // Omit the new option entirely on legacy drafts: existing fingerprints and
  // interrupted finishing requests must remain byte-for-byte compatible.
  return { version: 1, kind: raw.kind, sourceAssetId, demoAssetId, demoAudioAssetId, demoAudioPlayback, backgroundAssetId, backgroundPlayback, subtitles,
    ...(demoFraming ? { demoFraming } : {}) };
}

export function parseDemoFraming(value: unknown): DemoFraming {
  const raw = object(value);
  const validFraction = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (Object.keys(raw).some(key => !["version", "width", "height", "points"].includes(key)) || raw.version !== 1 ||
      !validFraction(raw.width) || !validFraction(raw.height) || raw.width < .01 || raw.width > 1 || raw.height < .01 || raw.height > 1 ||
      !Array.isArray(raw.points) || raw.points.length < 1 || raw.points.length > MAX_DEMO_FRAMING_POINTS) {
    throw new ExploreFinishError("Choose a valid demo frame and a bounded recording.");
  }
  const width = raw.width, height = raw.height;
  let previous = -1;
  const points: DemoFramingPoint[] = raw.points.map((point, index) => {
    if (!Array.isArray(point) || point.length !== 3 || !point.every(validFraction)) throw new ExploreFinishError("The recorded framing contains an invalid position.");
    const [time, x, y] = point as number[];
    if (!Number.isInteger(time) || time < 0 || time > 120_000 || time <= previous || (index === 0 && time !== 0) ||
        x < 0 || y < 0 || x + width > 1 + 1e-6 || y + height > 1 + 1e-6) throw new ExploreFinishError("Keep recorded positions inside the demo and in playback order.");
    previous = time;
    return [time, Math.min(x, 1 - width), Math.min(y, 1 - height)];
  });
  return { version: 1, width, height, points };
}

/** Shared interpolation for preview and export: hold endpoints and show every
 * intermediate position, preserving the user's actual drag speed. */
export function demoFramingPosition(framing: DemoFraming, timeMs: number) {
  const points = framing.points;
  if (timeMs <= points[0][0]) return { x: points[0][1], y: points[0][2] };
  const last = points[points.length - 1];
  if (timeMs >= last[0]) return { x: last[1], y: last[2] };
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (points[mid][0] <= timeMs) lo = mid; else hi = mid; }
  const a = points[lo], b = points[hi], fraction = (timeMs - a[0]) / (b[0] - a[0]);
  return { x: a[1] + (b[1] - a[1]) * fraction, y: a[2] + (b[2] - a[2]) * fraction };
}

/** Remove only samples whose reconstructed motion differs by at most tolerance.
 * Time participates in the error, so long holds never turn into early pans. */
export function simplifyDemoFramingPoints(points: DemoFramingPoint[], tolerance = .0005): DemoFramingPoint[] {
  if (points.length <= 2) return points.map(point => [...point]);
  const keep = new Set([0, points.length - 1]);
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!, a = points[lo], b = points[hi];
    let maximum = tolerance, selected = -1;
    for (let i = lo + 1; i < hi; i++) {
      const fraction = (points[i][0] - a[0]) / (b[0] - a[0]);
      const error = Math.hypot(points[i][1] - a[1] - (b[1] - a[1]) * fraction, points[i][2] - a[2] - (b[2] - a[2]) * fraction);
      if (error > maximum) { maximum = error; selected = i; }
    }
    if (selected !== -1) { keep.add(selected); stack.push([lo, selected], [selected, hi]); }
  }
  return [...keep].sort((a, b) => a - b).map(index => [...points[index]]);
}

/** Numeric-only, balanced expression tree avoids both expression injection and
 * deep parser recursion. Source timestamps are reset before this is evaluated. */
export function demoFramingExpression(framing: DemoFraming, axis: 1 | 2, dimension: number) {
  const points = framing.points;
  const number = (value: number) => value.toFixed(6).replace(/\.?0+$/, "") || "0";
  const segment = (index: number) => {
    const a = points[index], b = points[index + 1];
    if (a[axis] === b[axis]) return number(a[axis] * dimension);
    return `${number(a[axis] * dimension)}+(${number((b[axis] - a[axis]) * dimension)})*clip((t-${number(a[0] / 1000)})/${number((b[0] - a[0]) / 1000)},0,1)`;
  };
  const tree = (lo: number, hi: number): string => {
    if (lo === hi) return segment(lo);
    const mid = (lo + hi) >>> 1;
    return `if(lt(t,${number(points[mid + 1][0] / 1000)}),${tree(lo, mid)},${tree(mid + 1, hi)})`;
  };
  return points.length === 1 ? number(points[0][axis] * dimension) : tree(0, points.length - 2);
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
