import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260809114446_create_wall_audio_library.sql",
    import.meta.url,
  ),
  "utf8",
);
const generationV7Migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260814141455_add_wall_text_generation_v7_architecture.sql",
    import.meta.url,
  ),
  "utf8",
);
const matcherSource = readFileSync(
  new URL("./wall-audio-matcher.ts", import.meta.url),
  "utf8",
);
const databaseSource = readFileSync(
  new URL("./wall-audio-db.ts", import.meta.url),
  "utf8",
);
const wallTextDatabaseSource = readFileSync(
  new URL("./wall-text-db.ts", import.meta.url),
  "utf8",
);
const feedSource = readFileSync(
  new URL("./trending-wall-text-feed.ts", import.meta.url),
  "utf8",
);
const renderRouteSource = readFileSync(
  new URL(
    "../../app/api/trending/wall-text/drafts/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const workerRenderSource = readFileSync(
  new URL("../../worker/src/lib/render-engine.ts", import.meta.url),
  "utf8",
);
const frontendAudioSource = readFileSync(
  new URL(
    "../../components/trending/wall-text-audio-preview.tsx",
    import.meta.url,
  ),
  "utf8",
);
const trendingWorkspaceSource = readFileSync(
  new URL(
    "../../components/trending/trending-workspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const wallTextDetailSource = readFileSync(
  new URL(
    "../../components/trending/wall-text-detail-view.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("stores reviewed audio separately from per-creative selections", () => {
  assert.match(
    migration,
    /create table if not exists public\.wall_audio_assets/i,
  );
  assert.match(
    migration,
    /create table if not exists public\.wall_text_audio_selections/i,
  );
  assert.match(
    migration,
    /wall_text_creative_id uuid not null[\s\S]+references public\.wall_text_creatives\(id\)/i,
  );
  assert.match(
    migration,
    /creative_edit_id uuid[\s\S]+references public\.trending_creative_edits\(id\)/i,
  );
});

test("requires human-approved tags before an audio asset can become active", () => {
  assert.match(
    migration,
    /wall_audio_assets_active_review_check[\s\S]+status <> 'active'[\s\S]+review_status = 'approved'[\s\S]+reviewed_at is not null[\s\S]+cardinality\(moods\) between 1 and 3[\s\S]+cardinality\(message_types\) between 1 and 4[\s\S]+energy is not null[\s\S]+loopable is not null/i,
  );
  assert.match(
    databaseSource,
    /\.eq\("status", "active"\)[\s\S]+\.eq\("review_status", "approved"\)/,
  );
});

test("enforces exact, trim, loop, and rejection duration rules in the database", () => {
  assert.match(
    migration,
    /new\.fit_mode = 'exact'[\s\S]+abs\(playable_duration - new\.video_duration_seconds\) > 0\.08/i,
  );
  assert.match(
    migration,
    /new\.fit_mode = 'trim'[\s\S]+playable_duration <= new\.video_duration_seconds \+ 0\.08/i,
  );
  assert.match(
    migration,
    /new\.fit_mode = 'loop'[\s\S]+not selected_asset\.loopable[\s\S]+playable_duration \+ 0\.08 >= new\.video_duration_seconds/i,
  );
  assert.match(
    matcherSource,
    /return asset\.loopable \? "loop" : null/,
  );
});

test("locks Instagram Reel audio to its paired template and never loops it", () => {
  assert.match(
    generationV7Migration,
    /selection_scope = 'instagram_reel_locked'[\s\S]+loopable = false/i,
  );
  assert.match(
    generationV7Migration,
    /selected_asset\.id <> expected_locked_audio_id[\s\S]+new\.fit_mode = 'loop'[\s\S]+wall_text_instagram_locked_audio_mismatch/i,
  );
  assert.match(databaseSource, /selectLockedWallAudio/);
  assert.match(databaseSource, /\.eq\("selection_scope", "instagram_reel_locked"\)/);
  assert.match(databaseSource, /\.eq\("selection_scope", "matcher_pool"\)/);
  assert.match(
    renderRouteSource,
    /creativeEdit\?\.source[\s\S]+generationAttribution\?\.lockedAudioAssetId[\s\S]+lockedAudioAssetId,/,
  );
});

test("keeps one stable audio selection per base creative or exact edit revision", () => {
  assert.match(
    migration,
    /wall_text_audio_selections_base_uidx[\s\S]+\(user_id, wall_text_creative_id\)[\s\S]+where creative_edit_id is null/i,
  );
  assert.match(
    migration,
    /wall_text_audio_selections_edit_uidx[\s\S]+user_id,[\s\S]+creative_edit_id,[\s\S]+creative_edit_revision[\s\S]+where creative_edit_id is not null/i,
  );
  assert.match(
    migration,
    /save_wall_text_audio_selection[\s\S]+on conflict \(user_id, wall_text_creative_id\)[\s\S]+on conflict \(user_id, creative_edit_id, creative_edit_revision\)/i,
  );
});

test("validates ownership, edit scope, and approved asset availability", () => {
  assert.match(
    migration,
    /creative\.id = new\.wall_text_creative_id[\s\S]+creative\.user_id = new\.user_id[\s\S]+creative\.status = 'preview_ready'/i,
  );
  assert.match(
    migration,
    /edit\.id = new\.creative_edit_id[\s\S]+edit\.user_id = new\.user_id[\s\S]+edit\.creative_id = new\.wall_text_creative_id[\s\S]+edit\.revision = new\.creative_edit_revision/i,
  );
  assert.match(
    migration,
    /asset\.id = new\.audio_asset_id[\s\S]+asset\.status = 'active'[\s\S]+asset\.review_status = 'approved'/i,
  );
});

test("keeps the audio library server-only behind RLS and explicit service grants", () => {
  assert.match(
    migration,
    /alter table public\.wall_audio_assets enable row level security[\s\S]+alter table public\.wall_text_audio_selections enable row level security/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.wall_audio_assets[\s\S]+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.wall_text_audio_selections[\s\S]+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select, insert, update on table public\.wall_audio_assets[\s\S]+to service_role/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.save_wall_text_audio_selection[\s\S]+to service_role/i,
  );
  assert.match(databaseSource, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("uses the approved semantic weights and recent-use avoidance", () => {
  assert.match(
    matcherSource,
    /moodScore \* 0\.45 \+ messageScore \* 0\.4 \+ energyScore \* 0\.15/,
  );
  assert.match(matcherSource, /recentAssetIds/);
  assert.match(matcherSource, /preferredAssetId/);
});

test("requires a saved base selection before a Wall creative enters the feed", () => {
  assert.match(
    wallTextDatabaseSource,
    /ensureTrendingWallTextAssignments[\s\S]+ensureBaseWallTextAudioSelections/,
  );
  assert.match(
    wallTextDatabaseSource,
    /listBaseWallTextAudioSelections[\s\S]+!audio[\s\S]+return \[\]/,
  );
  assert.match(feedSource, /assetDurationSeconds: idea\.audio\.audioAssetDurationSeconds/);
});

test("resolves exact edit audio before claiming and queuing a render", () => {
  assert.match(
    renderRouteSource,
    /isRenderableWallTextDuration\(durationSeconds\)[\s\S]+resolveWallTextAudioSelection/,
  );
  assert.match(
    renderRouteSource,
    /resolveWallTextAudioSelection\([\s\S]+editId: creativeEdit\?\.id[\s\S]+editRevision: creativeEdit\?\.revision[\s\S]+videoDurationSeconds: durationSeconds/,
  );
  assert.match(
    renderRouteSource,
    /isTrustedStorageUrl\(audio\.audioUrl\)[\s\S]+claimWallTextRender/,
  );
  assert.match(
    renderRouteSource,
    /input: \{[\s\S]+audio: \{[\s\S]+selectionId: audio\.selectionId/,
  );
});

test("final rendering maps selected Wall audio and never source-video audio", () => {
  assert.match(workerRenderSource, /downloadAudioToBuffer\(payload\.audio\.audioUrl/);
  assert.match(workerRenderSource, /buildWallTextAudioFilter\(payload\)/);
  assert.match(workerRenderSource, /volume=\$\{TRENDING_LIBRARY_AUDIO_RENDER_GAIN\}/);
  assert.match(workerRenderSource, /"\[wall_audio\]"/);
  assert.doesNotMatch(
    workerRenderSource.slice(
      workerRenderSource.indexOf("export function buildWallTextVideoArgs"),
      workerRenderSource.indexOf("async function runFfmpeg", workerRenderSource.indexOf("export function buildWallTextVideoArgs")),
    ),
    /0:a:0|hasAudio|anullsrc/,
  );
  assert.match(
    workerRenderSource,
    /validateRenderedVideoFile\(outputPath, payload\.renderId, \{[\s\S]+expectedAudioCodecName: "aac"[\s\S]+expectedDurationSeconds: payload\.durationSeconds[\s\S]+requireAudio: true/,
  );
});

test("frontend preview remains muted until the user plays synchronized Wall audio", () => {
  assert.match(frontendAudioSource, /Play Wall audio/);
  assert.match(frontendAudioSource, /video\.currentTime % playableDuration/);
  assert.match(frontendAudioSource, /audio\.fitMode === "loop"/);
  assert.match(frontendAudioSource, /await audioElement\.play\(\)/);
  assert.match(frontendAudioSource, /remainingVideoSeconds \/ audio\.fadeOutSeconds/);
  assert.match(frontendAudioSource, /TRENDING_LIBRARY_AUDIO_PLAYBACK_VOLUME \* fadeMultiplier/);
  assert.match(frontendAudioSource, /size-9/);
});

test("removes Wall replay controls so the media controls stay quiet", () => {
  assert.doesNotMatch(trendingWorkspaceSource, /Replay Wall-text preview/);
  assert.doesNotMatch(wallTextDetailSource, /\bReplay\b/);
});

test("does not preview stale base audio after a Wall creative is edited", () => {
  assert.match(trendingWorkspaceSource, /audioPreviewEnabled=\{!wallTextEdit\}/);
  assert.match(
    trendingWorkspaceSource,
    /\{!edit \? \([\s\S]+<WallTextAudioPreview/,
  );
  assert.match(
    wallTextDetailSource,
    /audioPreviewEnabled && !previewUrl[\s\S]+<WallTextAudioPreview/,
  );
});
