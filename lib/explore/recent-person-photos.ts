/** Account-scoped browser preference. Store IDs only; resolve ownership afresh
 * before showing a remembered selection. A saved draft always takes priority. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Only untouched, empty preparations may inherit a browser preference. */
export function canRestoreRecentPersonPhotos(draft: { imageAssetIds: readonly string[]; generatedImage: unknown; approval: unknown } | null, hasSavedRequest: boolean, hasExplicitChoice: boolean) {
  return !hasSavedRequest && !hasExplicitChoice && !draft?.imageAssetIds.length && !draft?.generatedImage && !draft?.approval;
}
export function recentPersonPhotosKey(ownerId: string) {
  return `explore:recent-person-photos:v1:${encodeURIComponent(ownerId)}`;
}
export function readRecentPersonPhotos(raw: string | null, ownerId: string): string[] {
  if (!raw || raw.length > 2048) return [];
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || value.ownerId !== ownerId || !Array.isArray(value.assetIds) || value.assetIds.length > 5 ||
      value.assetIds.some((id: unknown) => typeof id !== "string" || !UUID.test(id)) || new Set(value.assetIds).size !== value.assetIds.length) return [];
    return value.assetIds;
  } catch { return []; }
}
export function serializeRecentPersonPhotos(ownerId: string, assetIds: string[]) {
  const raw = JSON.stringify({ version: 1, ownerId, assetIds });
  if (readRecentPersonPhotos(raw, ownerId).length !== assetIds.length) throw new Error("These photos could not be remembered.");
  return raw;
}
