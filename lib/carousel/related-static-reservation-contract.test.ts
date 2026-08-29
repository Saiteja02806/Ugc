import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = read(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260820054247_add_carousel_related_static_reservation_v2.sql",
);
const v1Migration = read(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260817123000_add_carousel_role_image_library_v1.sql",
);
const appStore = read("lib/carousel/db.ts");
const appGeneration = read("lib/carousel/generate-carousel.ts");
const workerStore = read("worker/src/lib/supabase.ts");
const workerStructure1 = read("worker/src/lib/carousel-generate.ts");
const workerStructure2 = read("worker/src/lib/carousel-structure-2-generate.ts");
const relevance = read("lib/carousel/image-library-relevance.ts");

test("keeps reservation v1 intact and adds a separate rollback-safe v2", () => {
  assert.match(v1Migration, /reserve_carousel_role_assets_v1/i);
  assert.doesNotMatch(migration, /drop function[\s\S]*reserve_carousel_role_assets_v1/i);
  assert.match(migration, /reserve_carousel_role_assets_v2/i);

  for (const store of [appStore, workerStore]) {
    assert.match(store, /reserve_carousel_role_assets_v2/);
    assert.match(store, /p_slide_plan/);
    assert.match(store, /p_primary_category_slug/);
  }
});

test("database validates related-static boundaries and the 1:2:2 role ratio", () => {
  assert.match(
    migration,
    /v_requested_roles = array\['hook', 'human', 'static', 'human', 'static'\]/i,
  );
  assert.match(
    migration,
    /v_requested_roles = array\['hook', 'static', 'human', 'static', 'human'\]/i,
  );
  assert.match(
    migration,
    /p_primary_category_slug = 'gym'[\s\S]*v_requested_categories\[v_index\] = 'food'/i,
  );
  assert.match(
    migration,
    /p_primary_category_slug = 'food'[\s\S]*v_requested_categories\[v_index\] = 'gym'/i,
  );
  assert.match(
    migration,
    /p_primary_category_slug = 'travel'[\s\S]*v_requested_categories\[v_index\] = 'food'/i,
  );
  assert.match(migration, /v_requested_roles\[v_index\] <> 'static'/i);
  assert.match(migration, /v_related_count > 2/i);
});

test("reservation is idempotent, locks rotations consistently, and falls back safely", () => {
  assert.match(
    migration,
    /order by rotation_pool\.category_slug, rotation_pool\.asset_role[\s\S]*for update/i,
  );
  assert.match(
    migration,
    /select count\(\*\)::integer[\s\S]*v_existing_count[\s\S]*for update[\s\S]*select count\(\*\)::integer/i,
  );
  assert.match(migration, /v_actual_selection_types\[v_index\] := 'related_fallback'/i);
  assert.match(
    migration,
    /v_category := p_primary_category_slug[\s\S]*related_fallback/i,
  );
  assert.match(
    migration,
    /image_usage\.cycle_number = v_cycle[\s\S]*v_cycle := v_cycle \+ 1/i,
  );
  assert.match(
    migration,
    /order by md5\([\s\S]*p_business_profile_id::text[\s\S]*v_category[\s\S]*v_role[\s\S]*v_cycle::text/i,
  );
  assert.match(migration, /not \(image_asset\.id = any\(v_selected_asset_ids\)\)/i);
});

test("tracking records requested and actual categories without image tags", () => {
  assert.match(migration, /requested_category_slug text/i);
  assert.match(migration, /primary_category_slug text/i);
  assert.match(migration, /selection_type text/i);
  assert.match(migration, /relevance_level text/i);
  assert.match(migration, /relevance_reason text/i);
  assert.match(migration, /carousel_image_usage_selection_metadata_chk/i);
  assert.doesNotMatch(relevance, /content_tags|object_tags|visual_keywords/i);
  assert.doesNotMatch(relevance, /25\s*%|0\.25|random/i);
});

test("product screenshots replace only a static slot and keep related selection bounded", () => {
  assert.match(
    migration,
    /if v_actual_roles\[v_index\] = 'static'[\s\S]*v_product_index := v_index/i,
  );
  assert.match(
    migration,
    /v_actual_roles\[v_product_index\] := 'product_asset'/i,
  );
  assert.match(
    migration,
    /v_actual_selection_types\[v_product_index\] := 'product'/i,
  );
});

test("the additive migration never deletes Carousel or source data", () => {
  assert.doesNotMatch(
    migration,
    /^\s*(?:delete\s+from|truncate(?:\s+table)?|drop\s+(?:table|function))\b/im,
  );
});

test("both structures build the shared slide plan before reserving assets", () => {
  for (const generation of [appGeneration, workerStructure1, workerStructure2]) {
    assert.match(generation, /buildCarouselSlideImagePlan\(/);
    assert.match(generation, /primaryCategorySlug:/);
    assert.match(generation, /slidePlan:/);
  }
});

test("v2 function is restricted to the service role", () => {
  assert.match(
    migration,
    /revoke all on function public\.reserve_carousel_role_assets_v2[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.reserve_carousel_role_assets_v2[\s\S]*to service_role/i,
  );
});

function read(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
