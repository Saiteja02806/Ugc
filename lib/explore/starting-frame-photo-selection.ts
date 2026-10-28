/** Browser-only identities, never signed URLs or ownership proof. Empty is an
 * explicit removal; missing means reuse the image preparation's selection. */
export type StartingFramePhotoScope = { ownerId: string; jobId: string; assetId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function startingFramePhotoKey(scope: StartingFramePhotoScope) {
  return `ugc-explore:animation-photos:v1:${encodeURIComponent(scope.ownerId)}:${scope.jobId}:${scope.assetId}`;
}
export function readStartingFramePhotos(raw: string | null, scope: StartingFramePhotoScope): string[] | null {
  if (raw === null) return null;
  if (raw.length > 2000) throw new Error("Your saved face photos could not be verified. Choose them again before generating.");
  const value = JSON.parse(raw);
  if (value?.version !== 1 || value.ownerId !== scope.ownerId || value.jobId !== scope.jobId || value.assetId !== scope.assetId ||
    !Array.isArray(value.ids) || value.ids.length > 5 || value.ids.some((id: unknown) => typeof id !== "string" || !uuid.test(id) || id === scope.assetId) ||
    new Set(value.ids.map((id: string) => id.toLowerCase())).size !== value.ids.length) {
    throw new Error("Your saved face photos could not be verified. Choose them again before generating.");
  }
  return [...value.ids];
}
export function serializeStartingFramePhotos(ids: string[], scope: StartingFramePhotoScope) {
  const raw = JSON.stringify({ version: 1, ...scope, ids });
  readStartingFramePhotos(raw, scope);
  return raw;
}
