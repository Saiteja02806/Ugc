import viewsRegistry from "./hook-reference-views.json" with { type: "json" };

export type HookReferenceViewEntry = {
  viewCount: number;
  formattedViews: string;
  verifiedLive?: boolean;
  sourceUrl?: string;
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
export function getHookReferenceViews(referenceId: string): HookReferenceViewEntry | undefined {
  return viewsByReferenceId[referenceId];
}

/**
 * Returns all view records for Hook references.
 */
export function getAllHookReferenceViews(): HookReferenceFullEntry[] {
  return viewsRegistry.items as HookReferenceFullEntry[];
}
