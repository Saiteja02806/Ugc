import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260809165909_activate_hook_audio_and_store_generation_intent.sql",
    import.meta.url,
  ),
  "utf8",
);
const generator = readFileSync(
  new URL("../worker/src/lib/trending-hook-copy.ts", import.meta.url),
  "utf8",
);
const workerStore = readFileSync(
  new URL("../worker/src/lib/supabase.ts", import.meta.url),
  "utf8",
);

test("activates only the exact 52-asset reviewed Hook audio catalog", () => {
  assert.match(migration, /expected_count constant integer := 52/u);
  assert.match(migration, /generate_series\(1, expected_count\)/u);
  assert.match(migration, /review_status = 'approved'/u);
  assert.match(migration, /status = 'active'/u);
  assert.match(migration, /approved_count <> expected_count/u);
});

test("the Hook writer emits meaning-only audio intent from controlled values", () => {
  assert.match(generator, /HOOK_AUDIO_MOODS/u);
  assert.match(generator, /HOOK_AUDIO_TYPES/u);
  assert.match(generator, /HOOK_AUDIO_ENERGIES/u);
  assert.match(generator, /additionalProperties: false,[\s\S]+audioIntent/u);
  assert.match(generator, /never return an audio filename, asset ID, URL, storage key, or library choice/i);
  assert.match(generator, /"trending-hook-copy-v6"/u);
});

test("v6 persistence rejects filenames and stores only controlled intent", () => {
  assert.match(migration, /add column if not exists audio_intent jsonb/u);
  assert.match(
    migration,
    /audio_intent - array\['mood', 'hookType', 'energy'\] = '\{\}'::jsonb/u,
  );
  assert.match(migration, /hook_copy_v6_candidate_is_valid/u);
  assert.match(workerStore, /persist_trending_hook_copy_generation_v6/u);
  assert.match(
    workerStore,
    /persist_validated_hook_composition_generation_v6/u,
  );
});
