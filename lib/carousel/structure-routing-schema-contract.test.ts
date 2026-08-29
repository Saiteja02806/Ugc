import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routingMigration = read(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260817183000_route_carousel_structures_by_batch.sql",
);
const roleLibraryMigration = read(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260817123000_add_carousel_role_image_library_v1.sql",
);
const preparation = read("lib/carousel/prepare-business-profile.ts");
const appGeneration = read("lib/carousel/generate-carousel.ts");
const appStore = read("lib/carousel/db.ts");
const performanceStore = read("lib/carousel/performance.ts");
const workerGeneration = read("worker/src/lib/carousel-generate.ts");
const workerStore = read("worker/src/lib/supabase.ts");

test("reserves one persisted structure for every complete five-carousel batch", () => {
  assert.match(
    routingMigration,
    /select settings\.structure_mode[\s\S]*from public\.carousel_global_settings/i,
  );
  assert.match(routingMigration, /pg_advisory_xact_lock/i);
  assert.match(
    routingMigration,
    /when v_structure_rotation_sequence % 2 = 0 then 'structure_1'[\s\S]*else 'structure_2'/i,
  );
  assert.match(
    routingMigration,
    /v_structure_selection_mode := 'rotation'/i,
  );
  assert.match(
    routingMigration,
    /when v_structure_mode = 'structure_2_only' then 'structure_2'[\s\S]*else 'structure_1'/i,
  );
  assert.match(
    routingMigration,
    /v_structure_selection_mode := 'global_override'/i,
  );
});

test("global overrides do not consume the strict rotation sequence", () => {
  const rotationBranch = routingMigration.match(
    /if v_structure_mode = 'rotate' then[\s\S]*?end if;/i,
  )?.[0];

  assert.ok(rotationBranch);
  assert.match(
    rotationBranch,
    /v_next_rotation_sequence := v_next_rotation_sequence \+ 1/i,
  );
  assert.match(
    rotationBranch,
    /else[\s\S]*v_structure_rotation_sequence := null/i,
  );
});

test("format rotation and content history are scoped to structure", () => {
  assert.match(
    routingMigration,
    /where batch\.business_profile_id = p_business_profile_id[\s\S]*batch\.structure_id = v_structure_id/i,
  );
  assert.match(
    preparation,
    /batchSequence: experimentBatch\.structureBatchSequence/i,
  );
  assert.match(preparation, /structure1History/);
  assert.match(preparation, /structure2History/);
  assert.match(preparation, /structure1Performance/);
  assert.match(preparation, /structure2Performance/);

  for (const store of [appStore, workerStore]) {
    assert.match(
      store,
      /eq\("structure_id", params\.structureId\)/,
    );
  }
});

test("performance observations and learning never cross structure namespaces", () => {
  assert.match(
    routingMigration,
    /generation\.structure_id,[\s\S]*generation\.structure_version/i,
  );
  assert.match(
    routingMigration,
    /insert into public\.carousel_performance_observations[\s\S]*structure_id,[\s\S]*structure_version/i,
  );
  assert.match(
    routingMigration,
    /observation\.structure_id = p_structure_id/i,
  );
  assert.match(performanceStore, /p_structure_id: params\.structureId/);
});

test("Structure 2 cannot accidentally enter the Structure 1 prompt", () => {
  assert.match(
    preparation,
    /assertCarouselStructureRuntimeReady\(experimentBatch\.structureId\)/,
  );
  assert.match(
    appGeneration,
    /assertCarouselStructureRuntimeReady\(generation\.structureId\)/,
  );
  assert.match(
    workerGeneration,
    /assertCarouselStructureRuntimeReady\(first\.structure_id\)/,
  );
  assert.match(
    workerGeneration,
    /generation\.structure_id !== first\.structure_id/,
  );
});

test("the shared 1:2:2 image allocator serves both structures", () => {
  assert.match(
    roleLibraryMigration,
    /array\['hook', 'human', 'static', 'human', 'static'\]/i,
  );
  assert.match(
    roleLibraryMigration,
    /array\['hook', 'static', 'human', 'static', 'human'\]/i,
  );
  assert.doesNotMatch(
    roleLibraryMigration,
    /p_structure_id|structure_1|structure_2/i,
  );
  assert.match(appGeneration, /reserveCarouselRoleAssets\(/);
  assert.match(workerGeneration, /reserveCarouselRoleAssets\(/);
});

test("the routing migration is additive and does not delete data", () => {
  assert.doesNotMatch(
    routingMigration,
    /^\s*(?:delete\s+from|truncate(?:\s+table)?|drop\s+table)\b/im,
  );
  assert.match(routingMigration, /select pg_notify\('pgrst', 'reload schema'\)/i);
});

function read(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
