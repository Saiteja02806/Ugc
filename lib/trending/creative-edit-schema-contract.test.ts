import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260802220000_create_trending_creative_edits.sql",
    import.meta.url,
  ),
  "utf8",
);
const editRoute = readFileSync(
  new URL(
    "../../app/api/trending/creatives/[format]/[creativeId]/edit/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const editor = readFileSync(
  new URL(
    "../../components/trending/trending-creative-editor.tsx",
    import.meta.url,
  ),
  "utf8",
);
const editService = readFileSync(
  new URL("./creative-edit-service.ts", import.meta.url),
  "utf8",
);
const carouselEditRenderJob = readFileSync(
  new URL(
    "../../worker/src/jobs/render-trending-carousel-edit.ts",
    import.meta.url,
  ),
  "utf8",
);

test("creative edits are owner scoped and revision fenced", () => {
  assert.match(migration, /create table if not exists public\.trending_creative_edits/);
  assert.match(migration, /unique \(\s*user_id,\s*format,\s*creative_id\s*\)/);
  assert.match(migration, /trending_creative_edit_source_unavailable/);
  assert.match(migration, /render_trending_carousel_edit/);
});

test("wall claims and Library refreshes are edit aware", () => {
  assert.match(migration, /p_edit_revision integer default null/);
  assert.match(
    migration,
    /claimed\.render_edit_revision is not distinct from p_edit_revision/,
  );
  assert.match(
    migration,
    /delete from public\.library_carousel_slides\s+where library_item_id = v_item_id/,
  );
});

test("manual Hook and Wall saves use their publishing limits", () => {
  assert.match(editRoute, /HOOK_TEXT_MAXIMUM_CHARACTERS/);
  assert.match(editRoute, /HOOK_TEXT_MAXIMUM_WORDS/);
  assert.match(editRoute, /\.max\(600\)/);
  assert.match(editRoute, /MIN_SHORT_WALL_TEXT_WORDS/);
  assert.match(editRoute, /MAX_CURRENT_WALL_TEXT_WORDS/);
  assert.match(editRoute, /TEXT_COLOR_SCHEMA/);
  assert.match(editRoute, /textColor: data\.textColor/);
  assert.match(editor, /TextColorPicker/);
  assert.match(editor, /textColor: content\.textColor/);
  assert.match(editor, /<textarea\s+id="trending-hook-text"/);
  assert.match(editor, /HOOK_TEXT_MAXIMUM_LINES/);
  assert.doesNotMatch(editor, /final two-line layout/);
});

test("Carousel headings remain optional in the editor and render job", () => {
  assert.match(editRoute, /headline:\s*z\.string\(\)\.trim\(\)\.max\(180\)/);
  assert.doesNotMatch(editRoute, /headline:\s*z\.string\(\)\.trim\(\)\.min\(1\)/);
  assert.doesNotMatch(editor, /Every Carousel slide needs a headline\./);
  assert.match(
    carouselEditRenderJob,
    /headline:\s*getOptionalString\(slide\.headline, 180\)/,
  );
});

test("Hook and Wall edits support an entire library or one exact video", () => {
  const openGroupFlow = editor.slice(
    editor.indexOf("async function openGroup"),
    editor.indexOf("function openCreativeAssets"),
  );

  assert.match(editor, /Choose a video folder/);
  assert.match(editor, /name="Creative Assets"/);
  assert.match(editor, /groups\.map\(\(group\)/);
  assert.match(editor, /Back to folders/);
  assert.match(editor, /Use entire group/);
  assert.match(editor, /Use this video/);
  assert.match(editor, /CreativeAssetDeck/);
  assert.match(editor, /StaticCreativeTextOverlay/);
  assert.match(editor, /Swipe to audition/);
  assert.doesNotMatch(editor, />\s*All videos\s*</);
  assert.doesNotMatch(openGroupFlow, /setSourceChoice/);
  assert.match(editService, /allowGroupFallback/);
  assert.match(editService, /chooseLibraryAsset/);
  assert.match(
    migration,
    /source_selection_kind = 'group'[\s\S]*source_group_id is not null/,
  );
  assert.match(
    migration,
    /source_selection_kind = 'asset'[\s\S]*source_media_asset_id is not null/,
  );
});
