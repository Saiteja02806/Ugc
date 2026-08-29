import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260817200000_add_carousel_product_asset_editor.sql",
);
const productAssetRoute = readProjectFile(
  "app/api/trending/carousel-product-assets/route.ts",
);
const productAssetService = readProjectFile(
  "lib/carousel/product-asset-service.ts",
);
const editRoute = readProjectFile(
  "app/api/trending/creatives/[format]/[creativeId]/edit/route.ts",
);
const editor = readProjectFile(
  "components/trending/trending-creative-editor.tsx",
);
const carouselDb = readProjectFile("lib/carousel/db.ts");
const editWorker = readProjectFile(
  "worker/src/jobs/render-trending-carousel-edit.ts",
);

test("adds owner-scoped screenshot deduplication without deleting Carousel rows", () => {
  assert.match(
    migration,
    /category_image_assets_product_owner_hash_uidx[\s\S]*owner_business_profile_id,[\s\S]*category_slug,[\s\S]*source_file_sha256/,
  );
  assert.match(migration, /asset_role = 'product_asset'[\s\S]*and is_active/);
  assert.doesNotMatch(migration, /delete\s+from|truncate\s+table|drop\s+table/iu);
});

test("keeps screenshot management authenticated, business scoped, and soft removable", () => {
  assert.match(productAssetRoute, /export async function GET[\s\S]*requireFirebaseUser/);
  assert.match(productAssetRoute, /export async function POST[\s\S]*requireFirebaseUser/);
  assert.match(productAssetRoute, /export async function PATCH[\s\S]*requireFirebaseUser/);
  assert.match(productAssetRoute, /export async function DELETE[\s\S]*requireFirebaseUser/);
  assert.match(productAssetService, /generation\.userId !== input\.userId/);
  assert.match(productAssetService, /generation\.businessProfileId/);
  assert.match(productAssetService, /getCarouselProductAssetUpload/);
  assert.match(productAssetService, /findCarouselProductAssetByHash/);
  const archiveFunction = carouselDb.slice(
    carouselDb.indexOf("export async function archiveCarouselProductAsset"),
    carouselDb.indexOf("function mapCarouselProductAssetUpload"),
  );
  assert.match(archiveFunction, /is_active: false/);
  assert.match(archiveFunction, /status: "archived"/);
  assert.doesNotMatch(archiveFunction, /\.delete\(/);
});

test("keeps App Screenshots in the Carousel editor and saves the asset id", () => {
  assert.match(editor, /function AppScreenshotsSection/);
  assert.match(editor, /content\.format === "carousel" \? \(/);
  assert.match(editor, /Product reveal lane/);
  assert.match(editor, /backgroundAssetId: slide\.backgroundAssetId/);
  assert.match(editRoute, /backgroundAssetId: z\.string\(\)\.uuid\(\)\.nullable\(\)/);
});

test("routes edited Structure 2 slides through the story-native renderer", () => {
  assert.match(editWorker, /generation\.structure_id === "structure_2"/);
  assert.match(editWorker, /renderCarouselStructure2Slide/);
  assert.match(editWorker, /createStructure2EditRenderSpec/);
  assert.match(editWorker, /story_product_reveal/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
