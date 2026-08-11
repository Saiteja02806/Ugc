import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260809183716_add_per_video_hook_audio_locks.sql",
    import.meta.url,
  ),
  "utf8",
);
const databaseAccess = readFileSync(
  new URL("../lib/trending/hook-audio-db.ts", import.meta.url),
  "utf8",
);
const command = readFileSync(
  new URL("./configure-hook-video-audio-lock.mjs", import.meta.url),
  "utf8",
);
const scheduleRoute = readFileSync(
  new URL("../app/api/schedules/[scheduleId]/render/route.ts", import.meta.url),
  "utf8",
);
const scheduleDraftRoute = readFileSync(
  new URL(
    "../app/api/trending/hook-videos/drafts/schedule/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const workerRender = readFileSync(
  new URL("../worker/src/lib/render-engine.ts", import.meta.url),
  "utf8",
);

test("stores Locked audio at the individual Hook-video level", () => {
  assert.match(migration, /create table public\.hook_video_audio_locks/u);
  assert.match(migration, /hook_video_id uuid primary key/u);
  assert.match(
    migration,
    /hook_video_id uuid primary key[\s\S]+?references public\.avatar_assets\(id\) on delete cascade/u,
  );
  assert.match(
    migration,
    /audio_asset_id text not null[\s\S]+?references public\.hook_audio_assets\(id\) on delete restrict/u,
  );
  assert.match(migration, /hook_video_audio_locks_audio_asset_idx/u);
  assert.doesNotMatch(migration, /unique\s*\(\s*audio_asset_id\s*\)/iu);
});

test("removes unsafe format-wide locking", () => {
  assert.match(migration, /drop column if exists locked_audio_asset_id/u);
  assert.match(migration, /drop index if exists public\.hook_formats_locked_audio_asset_idx/u);
  assert.match(migration, /audio_mode in \('dynamic', 'preferred'\)/u);
  assert.doesNotMatch(migration, /audio_mode in \('dynamic', 'preferred', 'locked'\)/u);
});

test("records Locked selections without an invented match score", () => {
  assert.match(
    migration,
    /selection_source in \('video_locked', 'format_preferred', 'dynamic'\)/u,
  );
  assert.match(
    migration,
    /selection_source = 'video_locked'[\s\S]+?match_score is null/u,
  );
  assert.match(migration, /alter column match_score drop not null/u);
});

test("rejects unavailable video and audio mappings in the database", () => {
  for (const requirement of [
    /video_row\.status <> 'ready'/u,
    /video_row\.has_audio is distinct from false/u,
    /video_row\.hook_format_id is null/u,
    /audio_row\.status <> 'active'/u,
    /audio_row\.review_status <> 'approved'/u,
    /audio_row\.duration_seconds < video_row\.duration_seconds/u,
  ]) {
    assert.match(migration, requirement);
  }
});

test("keeps lock data server-only", () => {
  assert.match(
    migration,
    /alter table public\.hook_video_audio_locks enable row level security/u,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.hook_video_audio_locks[\s\S]+?from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.hook_video_audio_locks[\s\S]+?to service_role/u,
  );
  assert.match(databaseAccess, /^import "server-only";/u);
});

test("seeds EWW by stable source identity, not a generated video UUID", () => {
  assert.match(migration, /hook_audio_029/u);
  assert.match(migration, /EWW\.mp3/u);
  assert.match(
    migration,
    /7851a78d9eac288c787792907f7ec29749e08b4cb83aaacaaa7084739956d702/u,
  );
  assert.doesNotMatch(
    migration,
    /f8493ecd-9ce1-4918-9c36-94d740382321/u,
  );
});

test("provides guarded lookup and dry-run-first configuration", () => {
  assert.match(databaseAccess, /getLockedHookAudioForVideo/u);
  assert.match(databaseAccess, /configureHookVideoAudioLock/u);
  assert.match(databaseAccess, /onConflict: "hook_video_id"/u);
  assert.match(command, /Dry run complete\. No Hook audio lock was changed\./u);
  assert.match(command, /execute && !args\.yes/u);
  assert.match(command, /assertRemoteAssetAvailable/u);
});

test("carries per-video Locked audio into the Hook render only", () => {
  assert.match(scheduleDraftRoute, /hookCatalogVideoId/u);
  assert.match(scheduleRoute, /getLockedHookAudioForVideo/u);
  assert.match(scheduleRoute, /hookAudioAssetId: hookAudio\?\.audioAssetId/u);
  assert.match(workerRender, /downloadAudioToBuffer\(payload\.hookAudio\.audioUrl/u);
  assert.match(workerRender, /useLockedHookAudio/u);
  assert.match(workerRender, /segmentLabel === "hook"/u);
});
