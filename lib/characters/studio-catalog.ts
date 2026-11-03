import fingerprints from "./studio-image-fingerprints.json" with { type: "json" };

export const STUDIO_CATALOG_ORIGIN = "https://storage.googleapis.com/ugcsaas-media/catalog/character-studio/v1/";

/** Logical catalog paths remain stable IDs; only manifest entries can resolve to backend objects. */
export function studioCatalogUrl(path: string): string {
  const digest = (fingerprints as Record<string, string>)[path];
  const extension = path.match(/\.(png|jpe?g|webp)$/i)?.[0];
  if (!Object.hasOwn(fingerprints, path) || !digest || !extension) throw new Error("Unknown character catalog image.");
  return `${STUDIO_CATALOG_ORIGIN}${digest}${extension}`;
}

/** Uploaded custom photos retain their existing browser URL and upload lifecycle. */
export function studioTraitImageUrl(trait: { imagePath?: string; isCustomUpload?: boolean }) {
  if (!trait.imagePath) return undefined;
  return trait.isCustomUpload ? trait.imagePath : studioCatalogUrl(trait.imagePath);
}
