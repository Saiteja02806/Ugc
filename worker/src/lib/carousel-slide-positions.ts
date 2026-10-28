/** Decode keyed provider slides into the existing persisted array contract.
 * Legacy arrays stay strict: never renumber or reorder a malformed old plan. */
export function decodeCarouselSlidePositions(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const plan = value as Record<string, unknown>;
  if (!plan.slides || typeof plan.slides !== "object" || Array.isArray(plan.slides)) return value;
  const slides = plan.slides as Record<string, unknown>;
  const keys = Array.from({ length: 6 }, (_, i) => `slide${i + 1}`);
  if (Object.keys(slides).length !== 6 || keys.some((key) => !Object.hasOwn(slides, key))) {
    throw new Error("Carousel plan requires exactly slide1 through slide6.");
  }
  const ordered = keys.map((key, i) => {
    const slide = slides[key];
    if (!slide || typeof slide !== "object" || Array.isArray(slide) ||
        (slide as Record<string, unknown>).slideNumber !== i + 1) {
      throw new Error(`Carousel ${key} has an invalid slide number.`);
    }
    return slide;
  });
  return { ...plan, slides: ordered };
}
