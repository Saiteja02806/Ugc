import type { RecreateFormat, RecreateReference } from "./recreate-types.ts";

export type RemixTextSource = { format: RecreateFormat; referenceId: string | null; sourceUrl: string | null };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 4096 ? value : null;

/** Only the primary source used by the generation job supplies remix copy. */
export function remixSourceFromJob(input: unknown): RemixTextSource | null {
  if (!record(input)) return null;
  const format = input.exploreFormat ?? input.referenceType;
  if (format === "slideshow") {
    // New deck outputs retain the selected slide's source, not always slide 1.
    const roles = record(input.slideshowReferenceContract) ? input.slideshowReferenceContract.styleReferenceIndices : null;
    const primary = record(input.slideshowGeneration) && Array.isArray(roles) && Number.isInteger(roles[0]) && Array.isArray(input.referenceImageUrls) ? input.referenceImageUrls[Number(roles[0]) - 1] : input.referenceImageUrl;
    const sourceUrl = text(primary);
    return sourceUrl ? { format, referenceId: null, sourceUrl } : null;
  }
  if ((format === "hook" || format === "wall_text") && input.referenceType === format) {
    const referenceId = text(input.referenceId);
    return referenceId ? { format, referenceId, sourceUrl: text(input.referenceUrl) } : null;
  }
  return null;
}

export function readRemixSource(value: unknown): RemixTextSource | null {
  if (!record(value) || !["hook", "wall_text", "slideshow"].includes(String(value.format))) return null;
  return { format: value.format as RecreateFormat, referenceId: text(value.referenceId), sourceUrl: text(value.sourceUrl) };
}

/** Never substitute a newly selected post or a slide's current display index. */
export function resolveRemixSource(source: RemixTextSource | null | undefined, references: readonly RecreateReference[], format: RecreateFormat) {
  const empty = { reference: null, slideId: null };
  if (!source || source.format !== format) return empty;
  for (const reference of references) {
    if (reference.format !== format || reference.id.startsWith("uploaded:")) continue;
    if (format === "slideshow") {
      const slide = reference.slides.find(slide => slide.url === source.sourceUrl);
      if (slide) return { reference, slideId: slide.id };
    } else if (reference.id === source.referenceId && (!source.sourceUrl || reference.videoUrl === source.sourceUrl)) return { reference, slideId: null };
  }
  return empty;
}
