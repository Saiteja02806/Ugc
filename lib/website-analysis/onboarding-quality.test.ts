import assert from "node:assert/strict";
import test from "node:test";

import { getMissingUrlBusinessContext, getStoreListingName, hasRequiredUrlBusinessContext, requireUrlBusinessContext } from "./onboarding-quality.ts";

const appUrl = "https://apps.apple.com/in/app/example/id123456789";
const playUrl = "https://play.google.com/store/apps/details?id=com.example.app";
const websiteUrl = "https://example-product.com/";

const complete = {
  businessName: "Example Product",
  confidence: "medium" as const,
  productSummary: "Example Product helps teams plan their daily work.",
  targetAudience: ["Small teams"],
};

test("URL onboarding accepts supported names, summaries, and audiences", () => {
  assert.equal(hasRequiredUrlBusinessContext(complete, websiteUrl), true);
  assert.equal(hasRequiredUrlBusinessContext(complete, appUrl), true);
  assert.equal(hasRequiredUrlBusinessContext({ ...complete, confidence: "low" }, appUrl), true);
});

test("URL onboarding rejects missing facts and hostnames before they are saved", () => {
  for (const incomplete of [
    { ...complete, businessName: null },
    { ...complete, productSummary: null },
    { ...complete, productSummary: "Too little" },
    { ...complete, targetAudience: [] },
    { ...complete, businessName: "apps.apple.com" },
  ]) {
    assert.equal(hasRequiredUrlBusinessContext(incomplete, appUrl), false);
    assert.throws(() => requireUrlBusinessContext(incomplete, appUrl), /Try entering your product details manually/);
  }
  assert.equal(hasRequiredUrlBusinessContext({ ...complete, businessName: "play.google.com" }, playUrl), false);
  assert.equal(hasRequiredUrlBusinessContext({ ...complete, businessName: "example-product.com" }, websiteUrl), false);
  assert.deepEqual(getMissingUrlBusinessContext({ ...complete, businessName: null, targetAudience: [] }, websiteUrl), {
    businessName: true,
    productSummary: false,
    targetAudience: true,
  });
});

test("a store listing title supplies the app name when the model omits it", () => {
  assert.equal(getStoreListingName({ title: "‎Duolingo: Language & Chess App - App Store", markdown: "", url: appUrl }, appUrl), "Duolingo: Language & Chess");
  assert.equal(getStoreListingName({ title: "Cactus: Screen Limiter - Apps on Google Play", markdown: "", url: playUrl }, playUrl), "Cactus: Screen Limiter");
  assert.equal(getStoreListingName({ title: "Duolingo", markdown: "", url: websiteUrl }, websiteUrl), null);
  assert.equal(getStoreListingName({ title: "App Store", markdown: "", url: appUrl }, appUrl), null);
  assert.equal(getStoreListingName({ title: "App Store", markdown: "# A Useful App\nDetails", url: appUrl }, appUrl), "A Useful App");
  assert.equal(getStoreListingName({ title: "App Store", markdown: "# A Useful App\nDetails", url: appUrl }, appUrl.replace("apps.apple.com", "www.apps.apple.com")), "A Useful App");
});
