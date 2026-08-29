import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260824150000_create_carousel_content_plan_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

function tableDefinition(tableName: string) {
  const tableStart = migration.indexOf(tableName);
  assert.notEqual(tableStart, -1);

  const tableTail = migration.slice(tableStart);
  const tableEnd = tableTail.match(/\r?\n\);\r?\n/);
  assert.ok(tableEnd?.index !== undefined);

  return tableTail.slice(0, tableEnd.index + tableEnd[0].length);
}

test("creates an owner- and profile-version-scoped 30-day content plan", () => {
  assert.match(
    migration,
    /create table if not exists public\.carousel_content_plans/i,
  );
  assert.match(migration, /business_profile_version integer not null/i);
  assert.match(
    migration,
    /foreign key \(business_profile_id, user_id, project_id\)[\s\S]*references public\.business_profiles \(id, user_id, project_id\)/i,
  );
  assert.match(
    migration,
    /check \(period_end_date = period_start_date \+ 29\)/i,
  );
  assert.match(
    migration,
    /target_item_count integer not null default 150[\s\S]*check \(target_item_count between 150 and 10000\)/i,
  );
  assert.match(migration, /planner_model text not null default 'gpt-4o-mini'/i);
});

test("keeps each creative item limited to one seed and one emotion", () => {
  const itemTable = tableDefinition("public.carousel_content_plan_items");

  assert.match(itemTable, /creative_seed text not null/i);
  assert.match(itemTable, /emotion text not null/i);
  assert.doesNotMatch(
    itemTable,
    /\b(situation|problem|story|product_mechanism|content_purpose|desired_change|hook|cta)\b/i,
  );
  assert.match(itemTable, /day_number smallint not null[\s\S]*between 1 and 30/i);
  assert.match(
    migration,
    /day_number is[\s\S]*organizational 1-30 grouping only[\s\S]*does not impose a daily consumption limit/i,
  );
});

test("records safe reservation and one-time consumption lifecycle state", () => {
  for (const column of [
    "reservation_token",
    "reservation_key",
    "reserved_at",
    "reservation_expires_at",
    "consumed_by_carousel_generation_id",
    "consumed_at",
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`, "i"));
  }

  assert.match(
    migration,
    /status in \('planned', 'available', 'reserved', 'consumed', 'retired'\)/i,
  );
  assert.match(
    migration,
    /create unique index if not exists carousel_content_plan_items_consumed_generation_uidx/i,
  );
  assert.match(
    migration,
    /unique \(plan_id, seed_fingerprint\)/i,
  );
});

test("keeps the new planning tables service-only and additive", () => {
  for (const table of [
    "carousel_content_plans",
    "carousel_content_plan_items",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
    assert.match(
      migration,
      new RegExp(
        `grant select, insert, update on table public\\.${table}\\s+to service_role`,
        "i",
      ),
    );
  }

  assert.doesNotMatch(
    migration,
    /^\s*(?:delete\s+from|truncate(?:\s+table)?|drop\s+table)\b/im,
  );
});
