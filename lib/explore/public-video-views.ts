import { canonicalHookSource } from "../../worker/src/lib/explore-instagram-source.ts";

/** Read the metric on the matching post object, never a recommendation or a like count. */
export function readPublicVideoViews(html: string, sourceUrl: string): number | undefined {
  const source = canonicalHookSource(sourceUrl);
  if (!source) return undefined;
  const postId = source.platform === "tiktok" ? source.url.split("/").at(-1) : source.url.split("/").at(-2);
  function metric(value: unknown): number | undefined {
    if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }
  function visit(value: unknown, depth = 0): number | undefined {
    if (!value || typeof value !== "object" || depth > 80) return undefined;
    const record = value as Record<string, unknown>;
    if (source!.platform === "tiktok" && (record.id === postId || record.aweme_id === postId)) {
      const stats = (record.stats ?? record.statistics) as Record<string, unknown> | undefined;
      const count = metric(stats?.playCount ?? stats?.play_count);
      if (count !== undefined) return count;
    }
    if (source!.platform === "instagram" && (record.shortcode === postId || record.code === postId)) {
      const count = metric(record.video_view_count ?? record.play_count ?? record.video_play_count);
      if (count !== undefined) return count;
    }
    for (const child of Object.values(record)) {
      const count = visit(child, depth + 1);
      if (count !== undefined) return count;
    }
    return undefined;
  }
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const count = visit(JSON.parse(match[1]));
      if (count !== undefined) return count;
    } catch { /* Login/challenge and non-JSON scripts do not establish a view count. */ }
  }
  return undefined;
}
