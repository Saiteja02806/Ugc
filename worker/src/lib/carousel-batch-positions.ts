export const CAROUSEL_BATCH_POSITION_KEYS = ["first", "second", "third", "fourth", "fifth"] as const;

/** Only the backend maps an output key to its already reserved brief/slot. */
export function readCarouselBatchPositions(value: unknown) {
  const root = record(value);
  const items = record(root?.items);
  if (!root || Object.keys(root).length !== 1 || !items ||
    Object.keys(items).some(key => !CAROUSEL_BATCH_POSITION_KEYS.includes(key as typeof CAROUSEL_BATCH_POSITION_KEYS[number]))) {
    throw new Error("Carousel batch response requires the five assigned position keys.");
  }
  return new Map(CAROUSEL_BATCH_POSITION_KEYS.map((key, slotIndex) => {
    const item = record(items[key]);
    const valid = item && Object.keys(item).length === 3 &&
      ["notApplicableReason", "plan", "status"].every(field => Object.hasOwn(item, field));
    // A missing/malformed item enters the existing isolated repair path. Its
    // valid siblings retain their original assigned positions and content.
    return [slotIndex, valid ? item : { status: "invalid", plan: null,
      notApplicableReason: `The assigned ${key} item is missing or malformed.` }] as const;
  }));
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
