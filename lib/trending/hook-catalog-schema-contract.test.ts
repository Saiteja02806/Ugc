import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260729055156_add_hook_catalog_safety_fields.sql",
    import.meta.url,
  ),
  "utf8",
);
const avatarTypes = readFileSync(
  new URL("../avatars/types.ts", import.meta.url),
  "utf8",
);
const avatarStorage = readFileSync(
  new URL("../avatars/avatar-storage.ts", import.meta.url),
  "utf8",
);
const placementMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260819132229_add_per_hook_video_text_placement.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Hook catalog migration adds the five reviewed selection fields", () => {
  for (const column of [
    "source_file_sha256",
    "source_batch",
    "influencer_key",
    "visual_group",
    "has_audio",
  ]) {
    assert.match(
      migration,
      new RegExp(`add column if not exists ${column}`),
    );
  }
});

test("ready Hook assets require complete catalog metadata", () => {
  assert.match(
    migration,
    /avatar_assets_ready_catalog_metadata_chk[\s\S]+status <> 'ready'[\s\S]+source_file_sha256 is not null[\s\S]+source_batch is not null[\s\S]+influencer_key is not null[\s\S]+visual_group is not null/i,
  );
});

test("Hook catalog prevents duplicate source hashes and indexes selection", () => {
  assert.match(
    migration,
    /create unique index if not exists avatar_assets_source_file_sha256_idx[\s\S]+source_file_sha256/i,
  );
  assert.match(
    migration,
    /create index if not exists avatar_assets_ready_selection_idx[\s\S]+has_audio[\s\S]+visual_group[\s\S]+influencer_key[\s\S]+where status = 'ready'/i,
  );
});

test("application storage writes and returns Hook catalog fields", () => {
  for (const field of [
    "has_audio",
    "influencer_key",
    "source_batch",
    "source_file_sha256",
    "visual_group",
  ]) {
    assert.match(avatarTypes, new RegExp(`${field}:`));
    assert.match(avatarStorage, new RegExp(`${field}:`));
  }
});

test("reviewed Hook placements are SHA-keyed and required before ready", () => {
  assert.match(
    placementMigration,
    /add column if not exists hook_text_placement jsonb/u,
  );
  assert.equal(
    [...placementMigration.matchAll(/\('[0-9a-f]{64}', '\{"preset":"(?:above_head|below_face)"/gu)].length,
    107,
  );
  assert.match(
    placementMigration,
    /avatar_assets_ready_hook_text_placement_chk[\s\S]+source_batch not like 'hook-silent-%'[\s\S]+hook_text_placement is not null/u,
  );
  assert.match(avatarTypes, /hook_text_placement: Json \| null/u);
  assert.match(avatarStorage, /hook_text_placement: input\.hookTextPlacement \?\? null/u);
});
