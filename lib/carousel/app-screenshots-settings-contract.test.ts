import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settingsWorkspace = readProjectFile(
  "components/settings/settings-workspace.tsx",
);
const settingsComponent = readProjectFile(
  "components/settings/app-screenshots-settings.tsx",
);
const settingsRoute = readProjectFile(
  "app/api/settings/app-screenshots/route.ts",
);
const trendingRoute = readProjectFile(
  "app/api/trending/carousel-product-assets/route.ts",
);
const productAssetService = readProjectFile(
  "lib/carousel/product-asset-service.ts",
);
const carouselDb = readProjectFile("lib/carousel/db.ts");

test("adds a dedicated Settings section without changing the Business Profile UI", () => {
  assert.match(settingsWorkspace, /id="app-screenshots"/);
  assert.match(settingsWorkspace, /title="App screenshots"/);
  assert.match(settingsWorkspace, /<AppScreenshotsSettings \/>/);
  assert.doesNotMatch(settingsComponent, /Business Profile/);
  assert.doesNotMatch(settingsWorkspace, /app screenshots[\s\S]*business-profile/i);
});

test("Settings manages the existing app screenshot records through one shared service", () => {
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.match(
      settingsRoute,
      new RegExp(`export async function ${method}[\\s\\S]*requireFirebaseUser`),
    );
  }
  assert.match(settingsRoute, /getCarouselProductAssetScopeForSettings/);
  assert.match(trendingRoute, /getCarouselProductAssetScopeForCarousel/);
  assert.match(settingsRoute, /prepareCarouselProductAssetUpload/);
  assert.match(trendingRoute, /prepareCarouselProductAssetUpload/);
  assert.match(productAssetService, /getBusinessProfileForUser/);
  assert.match(productAssetService, /listCarouselProductAssets/);
  assert.doesNotMatch(productAssetService, /saveBusinessProfile|updateBusinessProfile/);
});

test("loading the screenshot library cannot initialize image processing", () => {
  assert.doesNotMatch(productAssetService, /^import sharp from "sharp";/m);
  assert.match(
    productAssetService,
    /const \{ default: sharp \} = await import\("sharp"\)/,
  );
  assert.match(settingsComponent, /getAppScreenshotsLoadError/);
  assert.match(
    settingsComponent,
    /We couldn't reach App Screenshots\. Check your connection or disable any request-blocking browser extension/,
  );
});

test("Settings upload is reusable, validated, and does not create a second image library", () => {
  assert.match(settingsComponent, /\/api\/settings\/app-screenshots/);
  assert.match(settingsComponent, /image\/jpeg,image\/png,image\/webp/);
  assert.match(settingsComponent, /MAX_UPLOAD_BYTES = 25 \* 1024 \* 1024/);
  assert.match(settingsComponent, /ready for Structure 2/);
  assert.match(settingsComponent, /Existing[\s\S]*rendered slides remain unchanged/);
  assert.match(carouselDb, /asset_role: "product_asset"/);
  assert.match(carouselDb, /source_folder: "carousel-product-assets"/);
  assert.doesNotMatch(settingsRoute, /media_assets|creative_asset_groups/);
});

test("the Settings library can exist before a Carousel and keeps generation selection intact", () => {
  assert.doesNotMatch(settingsRoute, /carouselId/);
  assert.match(productAssetService, /resolveCarouselImageLibraryCategory/);
  assert.match(productAssetService, /owner|scope|businessProfileId/);
  assert.match(settingsComponent, /before the next Structure 2 carousel/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
