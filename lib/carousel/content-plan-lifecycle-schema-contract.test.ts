import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260824151000_add_carousel_content_plan_lifecycle.sql",
    import.meta.url,
  ),
  "utf8",
);
const provenanceMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260824153000_link_carousel_generations_to_content_plan.sql",
    import.meta.url,
  ),
  "utf8",
);

test("activates only complete 30-day plans", () => {
  assert.match(migration, /create or replace function public\.activate_carousel_content_plan/i);
  assert.match(migration, /v_item_count < v_plan\.target_item_count/i);
  assert.match(migration, /count\(distinct item\.day_number\)[\s\S]*<> 30/i);
  assert.match(migration, /coalesce\(v_minimum_day_count, 0\) < 5/i);
  assert.match(migration, /business_profile_version_changed/i);
});

test("reserves arbitrary counts atomically without filtering by day", () => {
  assert.match(migration, /create table if not exists public\.carousel_content_plan_reservations/i);
  assert.match(migration, /unique \(user_id, reservation_key\)/i);
  assert.match(migration, /p_requested_count not between 1 and 150/i);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /carousel_content_plan_reservation_idempotency_conflict/i);

  const reservationFunction = migration.slice(
    migration.indexOf("public.reserve_carousel_content_plan_items"),
    migration.indexOf("public.attach_carousel_content_plan_items_to_job"),
  );
  assert.doesNotMatch(reservationFunction, /where[^;]*day_number/i);
});

test("supports five-item writer job partitions and safe release", () => {
  assert.match(
    migration,
    /array_length\(p_plan_item_ids, 1\), 0\) not between 1 and 5/i,
  );
  assert.match(
    migration,
    /job\.job_type = 'generate_carousel'/i,
  );
  assert.match(
    migration,
    /create or replace function public\.release_carousel_content_plan_reservation/i,
  );
  assert.match(
    migration,
    /status = 'available'[\s\S]*reservation_token = null[\s\S]*reserved_by_job_id = null/i,
  );
});

test("consumes a seed only for a completed matching carousel", () => {
  assert.match(
    migration,
    /generation\.business_profile_id = plan\.business_profile_id/i,
  );
  assert.match(
    migration,
    /generation\.business_profile_version = plan\.business_profile_version/i,
  );
  assert.match(migration, /generation\.content_plan_id = v_item\.plan_id/i);
  assert.match(migration, /generation\.content_plan_item_id = v_item\.id/i);
  assert.match(
    migration,
    /generation\.content_plan_reservation_id = p_reservation_token/i,
  );
  assert.match(migration, /generation\.status = 'completed'/i);
  assert.match(
    migration,
    /carousel_content_plan_items_consumed_generation_uidx|consumed_by_carousel_generation_id/i,
  );
  assert.doesNotMatch(
    migration,
    /^\s*(?:delete\s+from|truncate(?:\s+table)?|drop\s+table)\b/im,
  );
});

test("binds generation provenance to one owner, plan, item, and reservation", () => {
  assert.match(
    provenanceMigration,
    /foreign key \(content_plan_id, user_id\)[\s\S]*references public\.carousel_content_plans \(id, user_id\)/i,
  );
  assert.match(
    provenanceMigration,
    /foreign key \(content_plan_item_id, content_plan_id, user_id\)[\s\S]*references public\.carousel_content_plan_items \(id, plan_id, user_id\)/i,
  );
  assert.match(
    provenanceMigration,
    /foreign key \(content_plan_reservation_id, content_plan_id, user_id\)[\s\S]*references public\.carousel_content_plan_reservations \(id, plan_id, user_id\)/i,
  );
  assert.match(
    provenanceMigration,
    /generation_source = 'auto_generated'/i,
  );
  assert.doesNotMatch(
    provenanceMigration,
    /references public\.carousel_content_(?:plans|plan_items|plan_reservations)[^;]*on delete set null/i,
  );
});

test("keeps the reservation table and lifecycle functions service-only", () => {
  assert.match(
    migration,
    /alter table public\.carousel_content_plan_reservations enable row level security/i,
  );
  assert.match(
    migration,
    /grant select, insert, update on table public\.carousel_content_plan_reservations\s+to service_role/i,
  );

  for (const functionName of [
    "activate_carousel_content_plan",
    "reserve_carousel_content_plan_items",
    "attach_carousel_content_plan_items_to_job",
    "release_carousel_content_plan_reservation",
    "consume_carousel_content_plan_item",
  ]) {
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${functionName}`, "i"),
    );
  }
});
