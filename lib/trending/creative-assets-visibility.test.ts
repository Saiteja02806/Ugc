import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isMediaAssetVisibleInCreativeLibrary } from "../media/media-library-visibility.ts";

test("keeps generated source videos available but hides final published renders", () => {
  assert.equal(
    isMediaAssetVisibleInCreativeLibrary({
      metadata: {},
      sourceType: "generated_video",
    }),
    true,
  );
  assert.equal(
    isMediaAssetVisibleInCreativeLibrary({
      metadata: {},
      sourceType: "combined_render",
    }),
    false,
  );
  assert.equal(
    isMediaAssetVisibleInCreativeLibrary({
      metadata: {},
      sourceType: "wall_text_render",
    }),
    false,
  );
});

test("marks Wall-of-text content saved only through the explicit Save endpoint", () => {
  const draftsRoute = readProjectFile("app/api/trending/wall-text/drafts/route.ts");
  const scheduleRoute = readProjectFile(
    "app/api/trending/wall-text/schedules/route.ts",
  );
  const wallTextDb = readProjectFile("lib/trending/wall-text-db.ts");

  assert.match(draftsRoute, /markWallTextDraftSaved\(/);
  assert.match(scheduleRoute, /getSelectedWallTextDraft\(/);
  assert.match(
    wallTextDb,
    /listSavedWallTextDrafts[\s\S]*not\("library_saved_at", "is", null\)/,
  );
  assert.match(
    wallTextDb,
    /getSavedWallTextDraft[\s\S]*not\("library_saved_at", "is", null\)/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
