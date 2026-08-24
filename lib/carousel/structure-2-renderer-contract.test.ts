import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Structure 2 renderer metadata is additive and the isolated runtime is active", async () => {
  const [migration, runtimeStructure, generator, packageJson] = await Promise.all([
    read("supabase/migrations/20260817190000_add_carousel_structure_2_render_metadata.sql"),
    read("worker/src/lib/carousel-structure.ts"),
    read("worker/src/lib/carousel-generate.ts"),
    read("package.json"),
  ]);

  assert.match(migration, /add column if not exists story_format_id text/i);
  assert.match(migration, /structure_id = 'structure_2'/i);
  assert.match(migration, /story_format_id in \([\s\S]*'wrong_belief'[\s\S]*'wrong_villain'/i);
  assert.match(migration, /visual_role <> 'product_asset'/i);
  assert.doesNotMatch(migration, /\b(?:delete|truncate)\s+(?:from\s+)?public\.carousel_slides/i);
  assert.match(runtimeStructure, /"structure_1"[\s\S]*"structure_2"/);
  assert.match(generator, /generateCarouselStructure2Batch/);
  assert.match(packageJson, /carousel:structure-2-renderer:test/);
});

test("Structure 2 owns a dedicated renderer and persistence adapter", async () => {
  const [renderer, persistence, renderSpec] = await Promise.all([
    read("worker/src/lib/carousel-structure-2-render-slide.ts"),
    read("worker/src/lib/carousel-structure-2-persistence.ts"),
    read("worker/src/lib/carousel-structure-2-render-spec.ts"),
  ]);

  assert.match(renderer, /story-native-renderer-v2-line-bubbles/);
  assert.match(renderer, /story_product_reveal/);
  assert.match(
    renderer,
    /const textFill = isPill \? "#141518" : "#ffffff"/,
  );
  assert.match(renderer, /params\.layout\.lines\s*\.map/);
  assert.match(persistence, /structure_id: "structure_2"/);
  assert.match(persistence, /story_format_id: spec\.storyFormatId/);
  assert.match(renderSpec, /assertCarouselStructure2VisualRatio/);
  assert.doesNotMatch(renderer, /PlannedCarouselSlide|carousel-slide-plan/);
});

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}
