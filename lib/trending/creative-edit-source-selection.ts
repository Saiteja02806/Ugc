export type CreativeEditSourceChoice =
  | {
      mediaAssetId: string;
      selectionKind: "asset";
    }
  | {
      groupId: string;
      resolvedAssetId: string;
      selectionKind: "group";
    };

export function selectEntireLibrary(
  groupId: string,
  resolvedAssetId: string,
): CreativeEditSourceChoice {
  return {
    groupId,
    resolvedAssetId,
    selectionKind: "group",
  };
}

export function selectExactVideo(
  mediaAssetId: string,
): CreativeEditSourceChoice {
  return { mediaAssetId, selectionKind: "asset" };
}

export function updateSourceChoiceForPreview(
  current: CreativeEditSourceChoice | null | undefined,
  activeGroupId: string | null,
  assetId: string,
) {
  if (
    activeGroupId &&
    current?.selectionKind === "group" &&
    current.groupId === activeGroupId
  ) {
    return selectEntireLibrary(activeGroupId, assetId);
  }

  return activeGroupId ? current : selectExactVideo(assetId);
}

export function chooseLibraryAsset<T>(
  assets: T[],
  creativeId: string,
): T | null {
  if (assets.length === 0) {
    return null;
  }

  let hash = 0;
  for (const character of creativeId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return assets[hash % assets.length] ?? assets[0] ?? null;
}
