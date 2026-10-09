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
  durationSeconds?: number;
  slides: ReferenceSlide[];
};

export type ImportedReference = Omit<RecreateReference, "posterUrl" | "videoUrl" | "slides"> & {
  posterFile: string;
  videoFile?: string;
  slides: Array<Omit<ReferenceSlide, "url"> & { file: string }>;
};

export function isRecreateFormat(value: unknown): value is RecreateFormat {
  return RECREATE_FORMATS.includes(value as RecreateFormat);
}

export function filterReferences(
  items: readonly RecreateReference[],
  format: RecreateFormat,
  categories: readonly string[],
) {
  return items.filter((item) => item.format === format &&
    (categories.length === 0 || (item.category !== null && categories.includes(item.category))));
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
  const categories = new Map<string, { id: string; label: string; count: number }>();
  for (const item of items) {
    if (item.format !== format || !item.category || !item.categoryLabel) continue;
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
