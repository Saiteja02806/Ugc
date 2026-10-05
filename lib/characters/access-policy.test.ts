import assert from "node:assert/strict";
import test from "node:test";
import { characterAccessFromCredits, characterRequestCount } from "./access-policy";

const request = { mode: "assisted", model: "gpt_image", idempotencyKey: "quantity" } as const;

test("two free credits allow either two single images or one two-image batch", () => {
  for (const [remaining, affordable] of [[2, 2], [1, 1], [0, 0]]) {
    const access = characterAccessFromCredits(false, remaining, 1);
    assert.equal(access.affordableImageCount, affordable);
    assert.equal(access.canGenerate, affordable > 0);
    for (const imageCount of [1, 2, 3] as const) {
      assert.equal(characterRequestCount(access, { ...request, imageCount }), imageCount <= remaining ? imageCount : null);
    }
  }
});

test("paid batches use selected quantity and configured image cost, until the shared balance runs out", () => {
  const access = characterAccessFromCredits(true, 6, 2);
  for (const imageCount of [1, 2, 3] as const) {
    assert.equal(characterRequestCount(access, { ...request, imageCount }), imageCount);
  }
  const afterOtherExploreGeneration = characterAccessFromCredits(true, 1, 2);
  assert.equal(afterOtherExploreGeneration.canGenerate, false);
  assert.equal(characterRequestCount(afterOtherExploreGeneration, { ...request, imageCount: 1 }), null);
  assert.equal(characterRequestCount(characterAccessFromCredits(true, 2, 2), { ...request, imageCount: 1 }), 1);
  assert.equal(characterRequestCount(characterAccessFromCredits(false, 2, 2), { ...request, imageCount: 2 }), null);
});

test("omitted quantities preserve old-client defaults while explicit counts do not force three", () => {
  assert.equal(characterRequestCount(characterAccessFromCredits(false, 2, 1), request), 1);
  assert.equal(characterRequestCount(characterAccessFromCredits(true, 3, 1), request), 3);
  assert.equal(characterRequestCount(characterAccessFromCredits(true, 1, 1), request), null);
  for (const [balance, cost] of [[-1, 1], [2, 0], [NaN, 1], [2, 1.5]]) {
    assert.throws(() => characterAccessFromCredits(false, balance, cost));
  }
});
