import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260729192337_create_trending_video_source_selections.sql",
);
const route = readProjectFile(
  "app/api/trending/video-source-selection/route.ts",
);
const picker = readProjectFile(
  "components/trending/creative-assets-video-picker.tsx",
);
const workspace = readProjectFile(
  "components/trending/trending-workspace.tsx",
);
const editor = readProjectFile(
  "components/trending/trending-creative-editor.tsx",
);
const selectionStorage = readProjectFile(
  "lib/trending/video-source-selection.ts",
);
const hookFeed = readProjectFile(
  "lib/trending/trending-hook-feed.ts",
);
const hookJobs = readProjectFile(
  "lib/trending/trending-hook-copy-jobs.ts",
);
const wallTextFeed = readProjectFile(
  "lib/trending/trending-wall-text-feed.ts",
);
const wallTextStorage = readProjectFile(
  "lib/trending/wall-text-db.ts",
);

test("Hook and Wall-of-text sources are saved separately for each user", () => {
  assert.match(
    migration,
    /format in \('hook_video', 'wall_text'\)/,
  );
  assert.match(
    migration,
    /unique \(user_id, format\)/,
  );
  assert.match(route, /requireFirebaseUser\(request\)/);
  assert.match(route, /userId: user\.uid/);
});

test("a source is either an entire video group or one ready owned video", () => {
  assert.match(
    migration,
    /selection_kind in \('group', 'asset'\)/,
  );
  assert.match(
    migration,
    /selection_kind = 'group'[\s\S]*group_id is not null[\s\S]*media_asset_id is null/,
  );
  assert.match(
    migration,
    /selection_kind = 'asset'[\s\S]*group_id is null[\s\S]*media_asset_id is not null/,
  );
  assert.match(
    migration,
    /asset_group\.user_id = new\.user_id[\s\S]*asset_group\.media_type = 'video'/,
  );
  assert.match(
    migration,
    /asset\.user_id = new\.user_id[\s\S]*asset\.status = 'ready'[\s\S]*asset\.deleted_at is null[\s\S]*asset\.mime_type like 'video\/%'/,
  );
});

test("clearing a selection restores the existing default feed", () => {
  assert.match(route, /export async function DELETE/);
  assert.match(route, /clearTrendingVideoSourceSelection/);
  assert.match(picker, /Use default videos/);
  assert.match(
    selectionStorage,
    /return \{ assets: \[\], selection: null \}/,
  );
});

test("the picker supports whole groups, single videos, and the required empty state", () => {
  assert.match(picker, /Use entire group/);
  assert.match(picker, /Use selected video/);
  assert.match(
    picker,
    />\s*There is no content in Creative Assets\s*</,
  );
  assert.match(picker, /\/api\/media\/groups\?mediaType=video/);
  assert.match(picker, /\/api\/media\/groups\/\$\{encodeURIComponent\(groupId\)\}\/items/);
});

test("Trending cards use shared creative review actions", () => {
  assert.match(workspace, /CreativeDecisionActions/);
  assert.match(workspace, /CreativeEditAction/);
  assert.doesNotMatch(workspace, /CreativeAssetsVideoPicker/);
  assert.doesNotMatch(workspace, />\s*Choose\s*</);
  assert.match(workspace, /TrendingCreativeEditor/);
});

test("Trending Edit offers a swipeable library or one exact video", () => {
  assert.match(editor, /fetch\("\/api\/media"/);
  assert.match(editor, /\/api\/media\/groups\?mediaType=video/);
  assert.match(
    editor,
    /\/api\/media\/groups\/\$\{encodeURIComponent\(groupId\)\}\/items/,
  );
  assert.match(editor, /selectEntireLibrary/);
  assert.match(editor, /selectExactVideo/);
  assert.match(editor, /Use entire group/);
  assert.match(editor, /Use this video/);
  assert.match(editor, /CreativeAssetDeck/);
  assert.match(editor, /StaticCreativeTextOverlay/);
});

test("saved Hook selections limit candidate preparation and the visible feed", () => {
  assert.match(hookFeed, /resolveTrendingVideoSource/);
  assert.match(hookFeed, /mediaAssetIds: \[\.\.\.selectedAssetIds\]/);
  assert.match(
    hookFeed,
    /selectedAssetIds\.has\(idea\.influencerVideoId\)/,
  );
  assert.match(hookFeed, /createSourceSelectionKey/);
  assert.match(hookJobs, /sourceSelectionKey/);
});

test("saved Wall-of-text selections use owned Creative Assets videos", () => {
  assert.match(wallTextFeed, /ensureWallTextOverlayAssetsForMediaAssets/);
  assert.match(
    wallTextFeed,
    /selectedBackgroundAssetIds = selectedInventory\?\.map/,
  );
  assert.match(wallTextFeed, /backgroundAssetIds: selectedBackgroundAssetIds/);
  assert.match(
    wallTextStorage,
    /owner_user_id: params\.userId[\s\S]*source_media_asset_id: asset\.id/,
  );
  assert.match(
    migration,
    /overlay_media_assets_owner_source_media_uidx/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
