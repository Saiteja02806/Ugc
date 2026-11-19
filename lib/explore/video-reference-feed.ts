import { canonicalHookSource } from "../../worker/src/lib/explore-instagram-source.ts";
import type { RecreateReference } from "./recreate-types.ts";

export const FREE_VIDEO_REFERENCE_LIMIT = 10;
export type ReferenceViewSort = "highest" | "lowest";
export type ReferenceViewFilter = "all" | "available" | "unavailable";

/** Missing metrics are never zero; only a source post can have source-post views. */
export function referenceViewCount(item: Pick<RecreateReference, "sourceUrl" | "instagramUrl" | "viewCount">): number | undefined {
  if (!canonicalHookSource(item.sourceUrl ?? item.instagramUrl)) return undefined;
  return Number.isSafeInteger(item.viewCount) && item.viewCount! >= 0 ? item.viewCount : undefined;
}

export function sortReferenceViews<T extends RecreateReference>(items: readonly T[], sort: ReferenceViewSort = "highest"): T[] {
  return [...items].sort((a, b) => {
    const left = referenceViewCount(a), right = referenceViewCount(b);
    if (left === undefined) return right === undefined ? 0 : 1;
    if (right === undefined) return -1;
    return sort === "lowest" ? left - right : right - left;
  });
}

/** Choose the free preview before filters/sort, so controls cannot rotate through the entire feed. */
export function videoReferencePreview<T extends RecreateReference>(items: readonly T[], unlimited: boolean): T[] {
  const active = items.filter(item => !item.archived);
  return unlimited ? active : sortReferenceViews(active).slice(0, FREE_VIDEO_REFERENCE_LIMIT);
}

export function filterReferenceViews<T extends RecreateReference>(items: readonly T[], filter: ReferenceViewFilter): T[] {
  return items.filter(item => filter === "all" || (referenceViewCount(item) !== undefined) === (filter === "available"));
}

export function formatReferenceViews(count: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}
