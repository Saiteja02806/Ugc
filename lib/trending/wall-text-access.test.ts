import assert from "node:assert/strict";
import test from "node:test";

import type { TrendingFeedProviderResult } from "./feed-items.ts";
import {
  filterWallTextProvidersForRuntime,
  isWallTextLocalDevelopmentEnabled,
} from "./wall-text-access.ts";

const providers = [
  {
    format: "carousel",
    items: [],
    state: "ready",
  },
  {
    format: "wall_text",
    items: [],
    state: "ready",
  },
] satisfies TrendingFeedProviderResult[];

test("enables Wall-of-text only in local development", () => {
  assert.equal(isWallTextLocalDevelopmentEnabled("development"), true);
  assert.equal(isWallTextLocalDevelopmentEnabled("production"), false);
  assert.equal(isWallTextLocalDevelopmentEnabled("test"), false);
});

test("keeps Wall-of-text providers in local development", () => {
  assert.deepEqual(
    filterWallTextProvidersForRuntime(providers, "development").map(
      (provider) => provider.format,
    ),
    ["carousel", "wall_text"],
  );
});

test("removes Wall-of-text providers outside local development", () => {
  assert.deepEqual(
    filterWallTextProvidersForRuntime(providers, "production").map(
      (provider) => provider.format,
    ),
    ["carousel"],
  );
  assert.deepEqual(
    filterWallTextProvidersForRuntime(providers, "test").map(
      (provider) => provider.format,
    ),
    ["carousel"],
  );
});
