export type CarouselHookChoice = {
  id: string; name: string; url: string; width: number; height: number;
  sha256?: string | null;
};

export function mergeCarouselHookChoices(
  categoryHooks: readonly CarouselHookChoice[],
  packagedHooks: readonly CarouselHookChoice[],
) {
  const ids = new Set<string>();
  const hashes = new Set<string>();
  return [...categoryHooks, ...packagedHooks].flatMap(asset => {
    if (ids.has(asset.id) || (asset.sha256 && hashes.has(asset.sha256))) return [];
    ids.add(asset.id);
    if (asset.sha256) hashes.add(asset.sha256);
    return [{ id: asset.id, name: asset.name, url: asset.url, width: asset.width, height: asset.height }];
  });
}
