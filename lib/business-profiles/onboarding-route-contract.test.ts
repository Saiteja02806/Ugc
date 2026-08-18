import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const businessProfileRoute = readFileSync(
  "app/api/business-profile/route.ts",
  "utf8",
);
const onboardingPrebuild = readFileSync(
  "lib/trending/onboarding-prebuild.ts",
  "utf8",
);

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

test("onboarding schedules Trending content before redirecting to the dashboard", () => {
  assert.match(
    businessProfileRoute,
    /action: z\.literal\("complete"\)[\s\S]+timezone:[\s\S]+refine\(isValidTimezone\)[\s\S]+optional\(\)/,
  );
  assert.match(
    businessProfileRoute,
    /completeBusinessProfileOnboarding\([\s\S]+prebuildTrendingAfterOnboarding\(/,
  );
  assert.match(
    onboardingPrebuild,
    /ensureTrendingDailyFeed\(\{[\s\S]+markItemsShown: false/,
  );
  assert.match(onboardingPrebuild, /enqueueTrendingWallTextJob\(\{/);
  assert.match(
    onboardingPrebuild,
    /if \(params\.includeHookVideos\)[\s\S]+prepareTrendingHookIdeas/,
  );
  assert.match(onboardingPrebuild, /Promise\.allSettled/);
});
