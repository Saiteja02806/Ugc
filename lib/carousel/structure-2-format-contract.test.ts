import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(
  read("worker/src/lib/carousel-config/structure-2-formats.json"),
) as { formats: Array<{ id: string }>; version: string };
const preparation = read("lib/carousel/prepare-business-profile.ts");
const selector = read("lib/carousel/structure-2-selector.ts");
const structureBoundary = read("worker/src/lib/carousel-structure.ts");
const structure1Formats = JSON.parse(
  read("worker/src/lib/carousel-config/formats.json"),
) as { formats: Array<{ id: string }> };

test("Structure 2 owns exactly eight global format ids", () => {
  assert.equal(config.version, "carousel-structure-2-formats-v1");
  assert.deepEqual(
    config.formats.map((format) => format.id),
    [
      "wrong_belief",
      "perfect_plan_breaks",
      "stopped_behavior",
      "terrible_at",
      "result_without_sacrifice",
      "identity_transformation",
      "new_rule",
      "wrong_villain",
    ],
  );
  assert.equal(new Set(config.formats.map((format) => format.id)).size, 8);
});

test("Structure 2 never borrows a Structure 1 format id", () => {
  const structure1Ids = new Set(
    structure1Formats.formats.map((format) => format.id),
  );

  assert.equal(
    config.formats.some((format) => structure1Ids.has(format.id)),
    false,
  );
  assert.doesNotMatch(selector, /CAROUSEL_CONTENT_GRAMMAR|formats\.json/);
});

test("the eight-format selector is active only through the Structure 2 runtime", () => {
  assert.match(preparation, /selectCarouselStructure2ExperimentBatch/);
  assert.match(
    structureBoundary,
    /CAROUSEL_RUNTIME_READY_STRUCTURE_IDS = \[[\s\S]*"structure_1"[\s\S]*"structure_2"/,
  );
  assert.match(
    preparation,
    /assertCarouselStructureRuntimeReady\(experimentBatch\.structureId\)/,
  );
});

function read(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
