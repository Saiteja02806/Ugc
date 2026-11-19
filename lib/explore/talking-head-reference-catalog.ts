import "server-only";
import catalog from "./talking-head-reference-catalog.json" with { type: "json" };
import sources from "./talking-head-source-manifest.json" with { type: "json" };
import uploadBatches from "./reference-upload-batches.json" with { type: "json" };
import { applyReferenceUploadBatches, type ReferenceUploadBatch } from "./reference-upload-batches.ts";
import type { TalkingHeadReference } from "./talking-head-reference";
import { getVideoReferenceViews } from "./hook-reference-views.ts";

/** Separate catalogue: these examples never enter Hook Video or Saved demos. */
export function getTalkingHeadReferences(): TalkingHeadReference[] {
  const items = catalog.items as Array<Pick<TalkingHeadReference, "id" | "title" | "videoUrl" | "previewVideoUrl" | "hookPreviewVideoUrl" | "posterUrl" | "durationSeconds" | "generationPrompt" | "sourceUrl">>;
  const built = items.map(item => { const views = getVideoReferenceViews(item.sourceUrl); return ({ ...item,
    ...(views ? { viewCount: views.viewCount, formattedViews: views.formattedViews, viewsRetrievedAt: views.retrievedAt,
      ...(views.verificationMethod === "user-provided-workbook" ? { viewsSource: "user-reported" as const, viewsApproximate: views.approximate === true } : {}),
    } : {}),
    sourceSha256: sources.items.find(source => source.id === item.id)?.sourceSha256,
    format: "hook" as const, category: null, categoryLabel: null, sourcePlatform: item.sourceUrl?.startsWith("https://www.instagram.com/") ? "instagram" as const : "tiktok" as const, slides: [] }); });
  const marked = applyReferenceUploadBatches(built.map(item => ({ ...item, format: "talking_head" as const })), uploadBatches.batches as ReferenceUploadBatch[]);
  return marked.map(item => ({ ...item, format: "hook" as const })).sort((a, b) => (b.uploadBatchSequence ?? 0) - (a.uploadBatchSequence ?? 0));
}
