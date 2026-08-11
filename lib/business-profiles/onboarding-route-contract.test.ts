import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("primary Trending entry routes enforce the shared onboarding gate", () => {
  for (const path of [
    "app/api/trending/feed/route.ts",
    "app/api/trending/hook-videos/feed/prepare/route.ts",
    "app/api/trending/wall-text/feed/prepare/route.ts",
  ]) {
    const source = readFileSync(path, "utf8");

    assert.match(source, /getBusinessProfileOnboardingGate/);
    assert.match(source, /onboarding_required/);
    assert.match(source, /409/);
  }
});
