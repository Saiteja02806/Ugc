import "server-only";
import catalog from "./talking-head-reference-catalog.json" with { type: "json" };
import sources from "./talking-head-source-manifest.json" with { type: "json" };
import uploadBatches from "./reference-upload-batches.json" with { type: "json" };
import { applyReferenceUploadBatches, type ReferenceUploadBatch } from "./reference-upload-batches.ts";
import type { TalkingHeadReference } from "./talking-head-reference";

/** Separate catalogue: these examples never enter Hook Video or Saved demos. */
export function getTalkingHeadReferences(): TalkingHeadReference[] {
  const items = catalog.items as Array<Pick<TalkingHeadReference, "id" | "title" | "videoUrl" | "posterUrl" | "durationSeconds" | "generationPrompt" | "sourceUrl">>;
  const built = items.map(item => ({ ...item, sourceSha256: sources.items.find(source => source.id === item.id)?.sourceSha256,
    format: "hook" as const, category: null, categoryLabel: null, sourcePlatform: item.sourceUrl?.startsWith("https://www.instagram.com/") ? "instagram" as const : "tiktok" as const, slides: [] }));
  const marked = applyReferenceUploadBatches(built.map(item => ({ ...item, format: "talking_head" as const })), uploadBatches.batches as ReferenceUploadBatch[]);
  return marked.map(item => ({ ...item, format: "hook" as const })).sort((a, b) => (b.uploadBatchSequence ?? 0) - (a.uploadBatchSequence ?? 0));
}
