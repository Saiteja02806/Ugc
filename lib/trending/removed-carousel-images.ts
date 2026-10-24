import policy from "./removed-carousel-images.json" with { type: "json" };

/** Reject cached image URLs too: storage deletion cannot evict a browser's immutable image cache. */
export function usesRemovedCarouselImage(value: unknown): boolean {
  const seen = new WeakSet<object>();
  function contains(entry: unknown): boolean {
    if (typeof entry === "string") return policy.assetIds.includes(entry) || policy.storageKeys.some(key => entry.includes(key));
    if (entry === null || typeof entry !== "object" || seen.has(entry)) return false;
    seen.add(entry);
    return Object.values(entry).some(contains);
  }
  return contains(value);
}
