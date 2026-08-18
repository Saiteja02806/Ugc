import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CAROUSEL_STRUCTURE_IDS,
  CAROUSEL_STRUCTURE_MODES,
  SAFE_CAROUSEL_STRUCTURE_FOUNDATION_DEFAULT,
  SAFE_CAROUSEL_STRUCTURE_MODE_FOUNDATION_DEFAULT,
  isCarouselStructureId,
  isCarouselStructureMode,
  isCarouselStructureSelectionMode,
} from "./structure.ts";

const migration = read(
  "supabase/migrations/20260817180000_add_carousel_structure_source_of_truth.sql",
);
const appStore = read("lib/carousel/db.ts");
const workerTypes = read("worker/src/types.ts");

test("defines two isolated structure namespaces with a safe inactive default", () => {
  assert.deepEqual(CAROUSEL_STRUCTURE_IDS, ["structure_1", "structure_2"]);
  assert.deepEqual(CAROUSEL_STRUCTURE_MODES, [
    "rotate",
    "structure_1_only",
    "structure_2_only",
  ]);
  assert.equal(SAFE_CAROUSEL_STRUCTURE_FOUNDATION_DEFAULT, "structure_1");
  assert.equal(
    SAFE_CAROUSEL_STRUCTURE_MODE_FOUNDATION_DEFAULT,
    "structure_1_only",
  );
  assert.equal(isCarouselStructureId("structure_2"), true);
  assert.equal(isCarouselStructureId("format_8"), false);
  assert.equal(isCarouselStructureMode("rotate"), true);
  assert.equal(isCarouselStructureMode("50_50"), false);
  assert.equal(isCarouselStructureSelectionMode("global_override"), true);
  assert.equal(isCarouselStructureSelectionMode("performance_weighted"), false);

  assert.match(
    migration,
    /insert into public\.carousel_global_settings[\s\S]*values \(true, 'structure_1_only', 1\)/i,
  );
  assert.match(
    migration,
    /structure_mode text not null default 'structure_1_only'/i,
  );
});

test("keeps the global structure switch service-only", () => {
  assert.match(
    migration,
    /create table if not exists public\.carousel_global_settings/i,
  );
  assert.match(migration, /singleton boolean primary key default true check \(singleton\)/i);
  assert.match(
    migration,
    /alter table public\.carousel_global_settings enable row level security/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.carousel_global_settings\s+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select, update on table public\.carousel_global_settings\s+to service_role/i,
  );
});

test("persists and backfills structure identity across the full evidence chain", () => {
  for (const table of [
    "carousel_experiment_batches",
    "carousel_experiment_assignments",
    "carousel_generations",
    "carousel_performance_observations",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `alter table public\\.${table}[\\s\\S]*?add column if not exists structure_id text not null default 'structure_1'[\\s\\S]*?add column if not exists structure_version integer not null default 1`,
        "i",
      ),
    );
  }

  assert.match(
    migration,
    /update public\.carousel_experiment_assignments[\s\S]*structure_id = batch\.structure_id[\s\S]*structure_version = batch\.structure_version/i,
  );
  assert.match(
    migration,
    /update public\.carousel_generations[\s\S]*structure_id = batch\.structure_id[\s\S]*structure_version = batch\.structure_version/i,
  );
  assert.match(
    migration,
    /update public\.carousel_performance_observations[\s\S]*structure_id = generation\.structure_id[\s\S]*structure_version = generation\.structure_version/i,
  );

  assert.match(
    migration,
    /foreign key \(experiment_batch_id, structure_id\)[\s\S]*references public\.carousel_experiment_batches \(id, structure_id\)/i,
  );
  assert.match(
    migration,
    /foreign key \(carousel_experiment_batch_id, structure_id\)[\s\S]*references public\.carousel_experiment_batches \(id, structure_id\)/i,
  );
  assert.match(
    migration,
    /foreign key \(carousel_generation_id, structure_id\)[\s\S]*references public\.carousel_generations \(id, structure_id\)/i,
  );
});

test("stores independent format rotation and global rotation provenance", () => {
  assert.match(
    migration,
    /partition by batch\.business_profile_id, batch\.structure_id/i,
  );
  assert.match(
    migration,
    /carousel_experiment_batches_profile_structure_sequence_uidx[\s\S]*business_profile_id,[\s\S]*structure_id,[\s\S]*structure_batch_sequence/i,
  );
  assert.match(
    migration,
    /structure_selection_mode = 'rotation'[\s\S]*structure_rotation_sequence is not null/i,
  );
  assert.match(
    migration,
    /carousel_experiment_batches_profile_rotation_sequence_uidx[\s\S]*where structure_rotation_sequence is not null/i,
  );
  assert.match(
    migration,
    /cycle_number drop not null[\s\S]*cycle_batch_position drop not null/i,
  );
});

test("makes persisted structure assignments immutable", () => {
  assert.match(
    migration,
    /create or replace function public\.prevent_carousel_structure_identity_change\(\)/i,
  );
  assert.match(
    migration,
    /new\.structure_id is distinct from old\.structure_id[\s\S]*new\.structure_version is distinct from old\.structure_version/i,
  );

  for (const trigger of [
    "carousel_experiment_batches_structure_immutable",
    "carousel_experiment_assignments_structure_immutable",
    "carousel_generations_structure_immutable",
    "carousel_performance_observations_structure_immutable",
  ]) {
    assert.match(migration, new RegExp(`create trigger ${trigger}`, "i"));
  }
});

test("foundation migration keeps reservation Structure 1 only before routing", () => {
  assert.match(
    migration,
    /create or replace function public\.reserve_carousel_experiment_batches[\s\S]*pg_advisory_xact_lock/i,
  );
  assert.match(
    migration,
    /where batch\.business_profile_id = p_business_profile_id[\s\S]*batch\.structure_id = 'structure_1'/i,
  );
  assert.match(
    migration,
    /'structure_1',\s*1,\s*'legacy_default',\s*'structure_1_only'/i,
  );
  assert.doesNotMatch(
    migration,
    /^\s*(?:delete\s+from|truncate(?:\s+table)?|drop\s+table)\b/im,
  );
});

test("app and worker storage contracts expose the same structure metadata", () => {
  for (const source of [appStore, workerTypes]) {
    for (const field of [
      "structure_id",
      "structure_version",
      "structure_batch_sequence",
      "structure_rotation_sequence",
      "structure_selection_mode",
      "structure_mode_snapshot",
    ]) {
      assert.match(source, new RegExp(`\\b${field}\\b`));
    }

    assert.match(source, /carousel_global_settings/);
  }
});

function read(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
