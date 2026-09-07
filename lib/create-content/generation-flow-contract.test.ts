import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const generation = await readFile(
  new URL("./generation.ts", import.meta.url),
  "utf8",
);
const route = await readFile(
  new URL("../../app/api/create-content/generate/route.ts", import.meta.url),
  "utf8",
);

test("Create Content generation reads the existing business profile and selected asset", () => {
  assert.match(route, /getBusinessProfileForUser/);
  assert.match(route, /getMediaAssetForOwner/);
  assert.match(route, /isCreateContentVideo/);
  assert.match(generation, /Use this existing onboarding Business Profile exactly/);
  assert.match(generation, /selectedVideoDurationSeconds/);
});

test("Create Content generation remains separate from Trending plan generation", () => {
  assert.doesNotMatch(generation, /generateBusinessTrendingWallTextIdeas/);
  assert.doesNotMatch(generation, /enqueueTrendingWallTextJob/);
  assert.doesNotMatch(route, /\/api\/trending|enqueueTrending/);
});
