import assert from "node:assert/strict";
import test from "node:test";

import type { TrendingFeedProviderResult } from "./feed-items.ts";
import {
  filterWallTextProvidersForRuntime,
  isWallTextEnabled,
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

test("enables Wall-of-text when multi-format Trending is active", () => {
  assert.equal(isWallTextEnabled(), true);
});

test("retains Wall-of-text providers without mutating saved provider data", () => {
  assert.deepEqual(
    filterWallTextProvidersForRuntime(providers).map((provider) => provider.format),
    ["carousel", "wall_text"],
  );
  assert.equal(providers.length, 2);
});
