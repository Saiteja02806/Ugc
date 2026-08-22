export const SCHEDULING_CATALOG_FRESH_TIME_MS = 15 * 1_000;
export const SCHEDULING_CATALOG_GC_TIME_MS = 30 * 60 * 1_000;

export function getSchedulingMediaCatalogQueryKey(accountId: string) {
  return ["scheduling-workspace", accountId, "media-catalog"] as const;
}
