import { subtitlePlacementGeometry, type SubtitlePlacement, type TimedWord } from "./contracts.ts";
import type { MeasureText, SubtitleLayout } from "./captions.ts";
import { groupNaturalSubtitleWords } from "./phrases.ts";

/** Shared by the export renderer and interactive preview. */
export const SERIF_BOX_FAMILY = "Instrument Serif";
export const serifBoxAnchor = (placement: SubtitlePlacement) => placement === "bottom" ? .75 : subtitlePlacementGeometry(placement).anchor;
export function groupSerifBoxPhrases(words: TimedWord[], layout: SubtitleLayout, measure: MeasureText) {
  return groupNaturalSubtitleWords(words, layout, measure, { maxWords: 6, preferredWords: 5, maxDurationMs: 2800, maxLines: 1 });
}
