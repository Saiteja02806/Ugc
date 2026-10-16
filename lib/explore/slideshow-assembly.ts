/** Insert originals in source order without changing the order of existing edits. */
export function insertReferenceSlides<T>(current: readonly T[], additions: readonly T[], sourcePosition: (slide: T) => number | null): T[] {
  const next = [...current];
  for (const addition of [...additions].sort((a, b) => (sourcePosition(a) ?? Infinity) - (sourcePosition(b) ?? Infinity))) {
    const position = sourcePosition(addition);
    if (position === null) { next.push(addition); continue; }
    const later = next.findIndex(slide => { const index = sourcePosition(slide); return index !== null && index > position; });
    if (later >= 0) next.splice(later, 0, addition);
    else {
      const last = next.findLastIndex(slide => sourcePosition(slide) !== null);
      next.splice(last >= 0 ? last + 1 : next.length, 0, addition);
    }
  }
  return next;
}
