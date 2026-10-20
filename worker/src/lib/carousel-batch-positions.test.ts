import assert from "node:assert/strict";
import test from "node:test";
import { CAROUSEL_BATCH_POSITION_KEYS, readCarouselBatchPositions } from "./carousel-batch-positions.js";

const item = (brief: string) => ({ status: "ready", plan: { brief }, notApplicableReason: null });

test("fixed keys map to backend positions regardless of JSON property order", () => {
  const items = Object.fromEntries([...CAROUSEL_BATCH_POSITION_KEYS].reverse().map(key => [key, item(key)]));
  const mapped = readCarouselBatchPositions({ items });
  assert.deepEqual([...mapped.keys()], [0, 1, 2, 3, 4]);
  for (const [slot, value] of mapped) assert.equal((value.plan as { brief: string }).brief, CAROUSEL_BATCH_POSITION_KEYS[slot]);
});

test("a missing or malformed position preserves valid siblings for isolated repair", () => {
  const items: Record<string, unknown> = Object.fromEntries(CAROUSEL_BATCH_POSITION_KEYS.map(key => [key, item(key)]));
  delete items.second; items.fourth = { ...item("fourth"), slotIndex: 0 };
  const snapshot = structuredClone(items), mapped = readCarouselBatchPositions({ items });
  assert.equal(mapped.get(1)?.status, "invalid"); assert.equal(mapped.get(3)?.status, "invalid");
  for (const slot of [0, 2, 4]) assert.equal(mapped.get(slot), items[CAROUSEL_BATCH_POSITION_KEYS[slot]!]);
  assert.deepEqual(items, snapshot);
});

test("arrays with duplicated AI indexes, foreign keys and ambiguous envelopes are rejected", () => {
  const items = Object.fromEntries(CAROUSEL_BATCH_POSITION_KEYS.map(key => [key, item(key)]));
  for (const value of [null, { items: [0, 0, 1, 2, 3].map(slotIndex => ({ ...item("bad"), slotIndex })) },
    { items: { ...items, sixth: item("foreign") } }, { items, extra: true }]) assert.throws(() => readCarouselBatchPositions(value));
});
