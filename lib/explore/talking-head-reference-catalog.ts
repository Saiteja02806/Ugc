import "server-only";
import catalog from "./talking-head-reference-catalog.json" with { type: "json" };
import sources from "./talking-head-source-manifest.json" with { type: "json" };
import type { TalkingHeadReference } from "./talking-head-reference";

/** Separate catalogue: these examples never enter Hook Video or Saved demos. */
export function getTalkingHeadReferences(): TalkingHeadReference[] {
  const items = catalog.items as Array<Pick<TalkingHeadReference, "id" | "title" | "videoUrl" | "posterUrl" | "durationSeconds" | "generationPrompt" | "sourceUrl">>;
  return items.map(item => ({ ...item, sourceSha256: sources.items.find(source => source.id === item.id)?.sourceSha256,
    format: "hook", category: null, categoryLabel: null, sourcePlatform: item.sourceUrl?.startsWith("https://www.instagram.com/") ? "instagram" : "tiktok", slides: [] }));
}
