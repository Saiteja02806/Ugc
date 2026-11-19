import viewsRegistry from "./hook-reference-views.json" with { type: "json" };
import videoViews from "./video-reference-views.json" with { type: "json" };
import { canonicalHookSource } from "../../worker/src/lib/explore-instagram-source.ts";

export type HookReferenceViewEntry = {
  viewCount: number;
  formattedViews: string;
  verifiedLive?: boolean;
  sourceUrl?: string;
  retrievedAt?: string;
  verificationMethod?: "user-provided-workbook";
  approximate?: boolean;
};

export type HookReferenceFullEntry = {
  id: string;
  title: string;
  platform: "instagram" | "tiktok";
  sourceUrl: string;
  viewCount: number;
  formattedViews: string;
  status: string;
};

const viewsByReferenceId = viewsRegistry.viewsByReferenceId as Record<string, HookReferenceViewEntry>;

/**
 * Returns the view count entry for a given Hook reference ID.
 */
export function getHookReferenceViews(referenceId: string, sourceUrl?: string): HookReferenceViewEntry | undefined {
  if (arguments.length > 1) return getVideoReferenceViews(sourceUrl);
  return viewsByReferenceId[referenceId];
}

/** Match the exact source post, never an ID whose media/provenance may have changed. */
export function getVideoReferenceViews(sourceUrl: string | undefined): HookReferenceViewEntry | undefined {
  const source = canonicalHookSource(sourceUrl);
  if (!source) return undefined;
  const supplemental = (videoViews.items as Array<HookReferenceViewEntry>).find(item =>
    (item.verifiedLive === true || item.verificationMethod === "user-provided-workbook") && canonicalHookSource(item.sourceUrl)?.url === source.url &&
    Number.isSafeInteger(item.viewCount) && item.viewCount >= 0);
  if (supplemental) return supplemental;
  const stored = Object.values(viewsByReferenceId).find(item => item.verifiedLive === true &&
    canonicalHookSource(item.sourceUrl)?.url === source.url && Number.isSafeInteger(item.viewCount) && item.viewCount >= 0);
  return stored ? { ...stored, retrievedAt: viewsRegistry.updatedAt } : undefined;
}

/**
 * Returns all view records for Hook references.
 */
export function getAllHookReferenceViews(): HookReferenceFullEntry[] {
  return viewsRegistry.items as HookReferenceFullEntry[];
}
