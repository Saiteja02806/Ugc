export type HookSourcePlatform = "instagram" | "tiktok";

export type CanonicalHookSource = {
  platform: HookSourcePlatform;
  url: string;
};

/**
 * Source-post URLs are distinct from the stored video URLs used for generation.
 * Only the post forms that we can render as an explicit, safe outbound link are
 * accepted. Query strings and fragments are intentionally discarded.
 */
export function canonicalHookSource(value: unknown): CanonicalHookSource | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
    if (["instagram.com", "www.instagram.com"].includes(url.hostname)) {
      const match = url.pathname.match(/^\/(reel|p)\/([A-Za-z0-9_-]+)\/?$/);
      return match ? { platform: "instagram", url: `https://www.instagram.com/${match[1]}/${match[2]}/` } : null;
    }
    if (["tiktok.com", "www.tiktok.com"].includes(url.hostname)) {
      const match = url.pathname.match(/^\/@([A-Za-z0-9._-]+)\/video\/(\d+)\/?$/);
      return match ? { platform: "tiktok", url: `https://www.tiktok.com/@${match[1]}/video/${match[2]}` } : null;
    }
    return null;
  } catch { return null; }
}

/** Backwards-compatible validator for the first, Instagram-only Hook release. */
export function canonicalInstagramSource(value: unknown): string | null {
  const source = canonicalHookSource(value);
  return source?.platform === "instagram" ? source.url : null;
}
