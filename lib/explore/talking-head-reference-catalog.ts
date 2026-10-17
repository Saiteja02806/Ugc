import "server-only";
import catalog from "./talking-head-reference-catalog.json";
import type { TalkingHeadReference } from "./talking-head-reference";

/** Separate catalogue: these examples never enter Hook Video or Saved demos. */
export function getTalkingHeadReferences(): TalkingHeadReference[] {
  const items = catalog.items as Array<Pick<TalkingHeadReference, "id" | "title" | "videoUrl" | "posterUrl" | "durationSeconds" | "generationPrompt" | "sourceUrl">>;
  return items.map(item => ({ ...item, format: "hook", category: null, categoryLabel: null, sourcePlatform: "tiktok", slides: [] }));
}
