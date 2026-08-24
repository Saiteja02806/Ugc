import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const importerSource = readFileSync(
  new URL("./import-wall-instagram-reel-templates.mjs", import.meta.url),
  "utf8",
);
const migrationSource = readFileSync(
  new URL(
    "../supabase/migrations/20260814141455_add_wall_text_generation_v7_architecture.sql",
    import.meta.url,
  ),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(
    new URL(
      "./data/wall-instagram-reel-templates-2026-08-14.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("pins fifteen complete Instagram Reel Wall bundles", () => {
  assert.equal(manifest.schemaVersion, "wall-instagram-reel-template-manifest-v1");
  assert.equal(manifest.sourceVideoAudioPolicy, "required-and-stripped-before-upload");
  assert.equal(manifest.templates.length, 15);
  assert.equal(new Set(manifest.templates.map((item) => item.folder)).size, 15);
  assert.equal(new Set(manifest.templates.map((item) => item.templateKey)).size, 15);
  assert.equal(new Set(manifest.templates.map((item) => item.audioAssetId)).size, 15);
  assert.equal(new Set(manifest.templates.map((item) => item.videoSha256)).size, 15);
  assert.equal(new Set(manifest.templates.map((item) => item.audioSha256)).size, 15);
  assert.equal(
    manifest.templates.filter((item) => item.audioFitMode === "exact").length,
    8,
  );
  assert.equal(
    manifest.templates.filter((item) => item.audioFitMode === "trim").length,
    7,
  );
  assert.equal(
    manifest.templates.every(
      (item) =>
        [item.videoFile, item.audioFile, item.referenceFile, item.linkFile].every(
          (file) => typeof file === "string" && file.length > 0,
        ) &&
        /^[a-f0-9]{64}$/u.test(item.referenceTextHash) &&
        ["exact", "trim"].includes(item.audioFitMode),
    ),
    true,
  );
});

test("normalizes audio once and never loops a locked soundtrack", () => {
  assert.deepEqual(manifest.audioNormalization, {
    bitrate: "192k",
    channels: 2,
    integratedLufs: -14,
    maximumIntegratedLufsError: 1,
    maximumMeasuredTruePeakDb: -1.5,
    sampleRateHz: 48000,
    truePeakDb: -2.2,
  });
  assert.match(importerSource, /-map", "0:v:0", "-c:v", "copy", "-an"/);
  assert.match(importerSource, /selection_scope: "instagram_reel_locked"/);
  assert.match(importerSource, /loopable: false/);
  assert.match(importerSource, /getDirectFitMode/);
  assert.doesNotMatch(importerSource, /audioFitMode:\s*"loop"/);
});

test("rejects Instagram Wall source videos shorter than six seconds", () => {
  assert.match(importerSource, /video\.durationSeconds < 6/);
});

test("is dry-run first, supports local preparation, and gates remote writes", () => {
  assert.match(importerSource, /const prepare = Boolean\(args\.prepare\)/);
  assert.match(importerSource, /if \(execute && !args\.yes\)/);
  assert.match(importerSource, /Dry run complete\. No GCP object or Supabase row was changed/);
  assert.match(importerSource, /No remote object or database row was changed/);
  assert.match(importerSource, /assertRemoteSchemaReady\(\)/);
  assert.match(importerSource, /verifyStoredObjects/);
  assert.match(importerSource, /verifyRemote/);
});

test("stores an immutable template snapshot on every reserved Instagram candidate", () => {
  assert.match(
    migrationSource,
    /instagram_reel_template_version integer[\s\S]+instagram_reference_text text[\s\S]+instagram_reference_text_hash text[\s\S]+instagram_locked_audio_asset_id text[\s\S]+instagram_audio_fit_mode text/i,
  );
  assert.match(
    migrationSource,
    /wall_text_instagram_active_template_immutable/i,
  );
  assert.match(
    migrationSource,
    /wall_text_instagram_reservation_mismatch/i,
  );
});

test("gives each active chunk one expiring ownership token", () => {
  assert.match(migrationSource, /claim_token uuid/i);
  assert.match(
    migrationSource,
    /returns uuid[\s\S]+locked_at > now\(\) - interval '15 minutes'[\s\S]+next_claim_token := gen_random_uuid\(\)/i,
  );
  assert.match(
    migrationSource,
    /wall_text_generation_candidate_stale_claim/i,
  );
  assert.match(
    migrationSource,
    /wall_text_generation_chunk_stale_claim/i,
  );
});
