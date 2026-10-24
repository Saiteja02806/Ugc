import { canonicalHookSource } from "../../worker/src/lib/explore-instagram-source.ts";
import type { RecreateReference } from "./recreate-types.ts";

export type SlideshowSource = { url: string; platform: "tiktok"; kind: "post" | "profile" };

/** Slideshow sources may be photo posts or explicitly supplied creator profiles. */
export function canonicalSlideshowSource(value: unknown): SlideshowSource | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.port || url.username || url.password ||
      !["tiktok.com", "www.tiktok.com"].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/@([A-Za-z0-9._-]+)(?:\/(photo|video)\/(\d+))?\/?$/);
    if (!match) return null;
    return { url: `https://www.tiktok.com/@${match[1]}${match[2] ? `/${match[2]}/${match[3]}` : ""}`, platform: "tiktok", kind: match[2] ? "post" : "profile" };
  } catch { return null; }
}

export function getReferenceSource(reference: Pick<RecreateReference, "format" | "sourceUrl" | "instagramUrl">) {
  if (reference.format === "slideshow") return canonicalSlideshowSource(reference.sourceUrl);
  if (reference.format === "hook") {
    const source = canonicalHookSource(reference.sourceUrl ?? reference.instagramUrl);
    return source ? { ...source, kind: "post" as const } : null;
  }
  return null;
}

export function referenceSourceLabel(source: { platform: "instagram" | "tiktok"; kind?: "post" | "profile" }) {
  return `View ${source.kind === "profile" ? "creator" : "original"} on ${source.platform === "tiktok" ? "TikTok" : "Instagram"}`;
}
