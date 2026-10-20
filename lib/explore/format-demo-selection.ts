import { isExploreUuid } from "../../worker/src/lib/explore-finishing-contract.ts";

export type FormatDemoSelection = { version: 1; ownerId: string; sourceAssetId: string; demoAssetId: string | null; editedDemoAssetId: string | null; dirty: boolean };
export function readFormatDemoSelection(raw: string | null, ownerId: string, sourceAssetId: string): FormatDemoSelection | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || value.ownerId !== ownerId || value.sourceAssetId !== sourceAssetId ||
        !isExploreUuid(sourceAssetId) || value.demoAssetId !== null && !isExploreUuid(value.demoAssetId) ||
        value.editedDemoAssetId !== null && !isExploreUuid(value.editedDemoAssetId) || typeof value.dirty !== "boolean" ||
        value.editedDemoAssetId && !value.demoAssetId) return null;
    return { version: 1, ownerId, sourceAssetId, demoAssetId: value.demoAssetId, editedDemoAssetId: value.editedDemoAssetId, dirty: value.dirty };
  } catch { return null; }
}
