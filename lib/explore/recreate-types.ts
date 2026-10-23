export const RECREATE_FORMATS = ["slideshow", "wall_text", "hook"] as const;
export type RecreateFormat = (typeof RECREATE_FORMATS)[number];

export const RECREATE_FORMAT_LABELS: Record<RecreateFormat, string> = {
  wall_text: "Wall of Text",
  hook: "Hook videos",
  slideshow: "Slideshows",
};

export type ReferenceSlide = {
  id: string;
  url: string;
  width: number;
  height: number;
};

export type RecreateReference = {
  id: string;
  format: RecreateFormat;
  title: string;
  category: string | null;
  categoryLabel: string | null;
  posterUrl: string;
  videoUrl?: string;
  /** Canonical server-provided digest for packaged references without hashed URLs. */
  sourceSha256?: string;
  /** Visible, editable suggestion; never appended secretly by the server. */
  generationPrompt?: string;
  durationSeconds?: number;
  instagramUrl?: string;
  sourceUrl?: string;
  sourcePlatform?: "instagram" | "tiktok";
  sourceKind?: "post" | "profile";
  previewVideoUrl?: string;
  /** Addressable for saved work, excluded from new-reference browsing. */
  archived?: true;
  /** Published upload batch metadata. New is scoped to the latest batch per workflow. */
  uploadBatchId?: string;
  uploadBatchSequence?: number;
  isNew?: true;
  pairedAudio?: { title: string; url: string; durationSeconds: number };
  slides: ReferenceSlide[];
};

/** Run after filtering/category mixing so the newest uploads stay at the top. */
export function prioritizeRecentReferences(items: readonly RecreateReference[]): RecreateReference[] {
  return [...items].sort((a, b) => (b.uploadBatchSequence ?? 0) - (a.uploadBatchSequence ?? 0));
}

/** Stable ordering: video platforms alternate; each platform keeps newer uploads first. */
export function orderReferenceGallery(items: readonly RecreateReference[], format: RecreateFormat): RecreateReference[] {
  if (format === "slideshow") return prioritizeRecentReferences(interleaveReferenceCategories(items));
  const platforms = new Map<ReturnType<typeof referencePlatform>, RecreateReference[]>();
  for (const item of prioritizeRecentReferences(items)) {
    const platform = referencePlatform(item);
    const bucket = platforms.get(platform);
    if (bucket) bucket.push(item);
    else platforms.set(platform, [item]);
  }
  const mixed: RecreateReference[] = [];
  for (let index = 0; mixed.length < items.length; index++) {
    for (const bucket of platforms.values()) {
      if (index < bucket.length) mixed.push(bucket[index]);
    }
  }
  return mixed;
}

export type ImportedReference = Omit<RecreateReference, "posterUrl" | "videoUrl" | "slides"> & {
  posterFile: string;
  videoFile?: string;
  slides: Array<Omit<ReferenceSlide, "url"> & { file: string }>;
};

export function isRecreateFormat(value: unknown): value is RecreateFormat {
  return RECREATE_FORMATS.includes(value as RecreateFormat);
}

/** Also suppress retired cards supplied by an older response or preview cache. */
export function isRemovedWallTextReference(id: string) {
  return id === "explore-wall-text-01" || id === "explore-wall-text-08" || id === "explore-wall-text-09";
}

export function filterReferences(
  items: readonly RecreateReference[],
  format: RecreateFormat,
  categories: readonly string[],
) {
  return items.filter((item) => !isRemovedWallTextReference(item.id) && !item.archived && item.format === format &&
    (categories.length === 0 || categories.includes(referencePlatform(item) ?? "") || (item.category !== null && categories.includes(item.category))));
}

export function referencePlatform(item: RecreateReference): "instagram" | "tiktok" | null {
  if (item.sourcePlatform) return item.sourcePlatform;
  try {
    const host = new URL(item.sourceUrl ?? item.instagramUrl ?? "").hostname.toLowerCase();
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  } catch { /* A reference without provenance is not assigned a platform. */ }
  return null;
}

/** Mix gallery cards by category, without changing any reference or its slides. */
export function interleaveReferenceCategories(items: readonly RecreateReference[]): RecreateReference[] {
  const categories = new Map<string | null, RecreateReference[]>();
  for (const item of items) {
    const bucket = categories.get(item.category);
    if (bucket) bucket.push(item);
    else categories.set(item.category, [item]);
  }

  const mixed: RecreateReference[] = [];
  for (let index = 0; mixed.length < items.length; index++) {
    for (const bucket of categories.values()) {
      if (index < bucket.length) mixed.push(bucket[index]);
    }
  }
  return mixed;
}

export function referenceCategories(items: readonly RecreateReference[], format: RecreateFormat) {
  if (format === "hook") return (["instagram", "tiktok"] as const).map(id => ({ id, label: id === "instagram" ? "Instagram" : "TikTok", count: items.filter(item => !item.archived && item.format === format && referencePlatform(item) === id).length }));
  const categories = new Map<string, { id: string; label: string; count: number }>();
  for (const item of items) {
    if (isRemovedWallTextReference(item.id) || item.archived || item.format !== format || !item.category || !item.categoryLabel) continue;
    const previous = categories.get(item.category);
    categories.set(item.category, {
      id: item.category, label: item.categoryLabel, count: (previous?.count ?? 0) + 1,
    });
  }
  return [...categories.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Replace only explicitly edited positions; original slides remain immutable. */
export function assembleSlideshow(
  slides: readonly ReferenceSlide[],
  replacements: Readonly<Record<string, string>>,
): ReferenceSlide[] {
  return slides.map((slide) => replacements[slide.id] ? { ...slide, url: replacements[slide.id] } : { ...slide });
}
