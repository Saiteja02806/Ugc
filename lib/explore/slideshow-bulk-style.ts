import { EMPTY_SLIDE_TEXT, parseSlideText, type SlideTextDesign } from "./slideshow-text.ts";

const fields = ["font", "size", "color", "align", "position", "background", "backgroundColor", "opacity"] as const;
type Appearance = Pick<SlideTextDesign, typeof fields[number]>;
export type SlideStyleUndo = Record<string, { before: Appearance; applied: Appearance }>;
function appearance(design: SlideTextDesign): Appearance {
  return Object.fromEntries(fields.map(field => [field, design[field]])) as Appearance;
}
export function applySlideshowAppearance(text: Record<string, SlideTextDesign>, ids: string[], source: SlideTextDesign) {
  const applied = appearance(parseSlideText(source)), next = { ...text }, undo: SlideStyleUndo = {};
  for (const id of new Set(ids)) {
    const current = text[id] ?? EMPTY_SLIDE_TEXT;
    undo[id] = { before: appearance(current), applied };
    next[id] = parseSlideText({ ...current, ...applied });
  }
  return { next, undo };
}
/** Undo only our appearance changes. Preserve words and any subsequent manual
 * style changes, and never resurrect slides removed from the sequence. */
export function undoSlideshowAppearance(text: Record<string, SlideTextDesign>, ids: string[], undo: SlideStyleUndo) {
  const next = { ...text };
  for (const id of ids) {
    const entry = undo[id], current = text[id];
    if (!entry || !current) continue;
    const patch = Object.fromEntries(fields.filter(field => current[field] === entry.applied[field]).map(field => [field, entry.before[field]]));
    next[id] = parseSlideText({ ...current, ...patch });
  }
  return next;
}
