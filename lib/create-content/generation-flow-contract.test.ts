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

test("Create Content generation uses the final visual constraints before options reach chat", () => {
  assert.match(generation, /normalizeAndValidateGeneratedCreateContentText/);
  assert.match(generation, /Use 4 to 8 purposeful lines/);
  assert.match(generation, /2 to 12 words, 8 to 78 characters, and fit within 3 readable lines/);
});
