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

test("hides Wall-of-text while Trending generates only slideshows", () => {
  assert.equal(isWallTextEnabled(), false);
});

test("excludes Wall-of-text providers without mutating saved provider data", () => {
  assert.deepEqual(
    filterWallTextProvidersForRuntime(providers).map((provider) => provider.format),
    ["carousel"],
  );
  assert.equal(providers.length, 2);
});
