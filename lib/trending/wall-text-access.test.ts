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

test("enables Wall-of-text in every runtime", () => {
  assert.equal(isWallTextEnabled(), true);
});

test("keeps Wall-of-text providers in development, test, and production", () => {
  assert.deepEqual(
    filterWallTextProvidersForRuntime(providers).map((provider) => provider.format),
    ["carousel", "wall_text"],
  );
});
