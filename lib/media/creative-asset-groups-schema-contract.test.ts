import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migration_archive/pre_baseline_20260829/canonical_history/20260729183950_create_creative_asset_groups.sql",
    import.meta.url,
  ),
  "utf8",
);
const storage = readFileSync(
  new URL("./creative-asset-groups.ts", import.meta.url),
  "utf8",
);

test("creates separate video and image groups without a description field", () => {
  assert.match(
    migration,
    /create table if not exists public\.creative_asset_groups/i,
  );
  assert.match(migration, /media_type in \('video', 'image'\)/i);
  assert.match(migration, /name text not null/i);
  assert.doesNotMatch(migration, /\bdescription\b/i);
  assert.doesNotMatch(storage, /\bdescription\b/i);
});

test("allows many assets in a group and the same asset in multiple groups", () => {
  assert.match(
    migration,
    /create table if not exists public\.creative_asset_group_items/i,
  );
  assert.match(migration, /primary key \(group_id, media_asset_id\)/i);
  assert.doesNotMatch(
    migration,
    /unique\s*\(\s*media_asset_id\s*\)/i,
  );
});

test("deleting a group removes memberships without deleting media assets", () => {
  assert.match(
    migration,
    /group_id uuid not null[\s\S]*references public\.creative_asset_groups\(id\) on delete cascade/i,
  );
  assert.doesNotMatch(migration, /delete from public\.media_assets/i);
  assert.match(
    storage,
    /\.from\(CREATIVE_ASSET_GROUPS_TABLE\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\("id", input\.groupId\)/,
  );
});

test("database validation rejects cross-owner, unavailable, and wrong-type assets", () => {
  const validationFunction = getSection(
    migration,
    "create or replace function public.validate_creative_asset_group_item()",
    "create trigger validate_creative_asset_group_item_row",
  );

  assert.match(
    validationFunction,
    /group_user_id is distinct from new\.user_id/i,
  );
  assert.match(
    validationFunction,
    /asset_user_id is distinct from new\.user_id/i,
  );
  assert.match(
    validationFunction,
    /asset_status <> 'ready' or asset_deleted_at is not null/i,
  );
  assert.match(
    validationFunction,
    /group_media_type = 'image'[\s\S]*asset_collection <> 'image'/i,
  );
  assert.match(
    validationFunction,
    /group_media_type = 'video'[\s\S]*asset_collection not in \('video', 'influencer'\)/i,
  );
});

test("group scope cannot be reassigned after creation", () => {
  const preparationFunction = getSection(
    migration,
    "create or replace function public.prepare_creative_asset_group()",
    "create trigger prepare_creative_asset_group_row",
  );

  assert.match(
    preparationFunction,
    /new\.user_id is distinct from old\.user_id/i,
  );
  assert.match(
    preparationFunction,
    /new\.media_type is distinct from old\.media_type/i,
  );
});

test("group tables are service-only with row-level security enabled", () => {
  for (const table of [
    "creative_asset_groups",
    "creative_asset_group_items",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table}[\\s\\S]*?from anon, authenticated`,
        "i",
      ),
    );
  }

  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.creative_asset_groups[\s\S]*to service_role/i,
  );
  assert.match(
    migration,
    /grant select, insert, delete on table public\.creative_asset_group_items[\s\S]*to service_role/i,
  );
  assert.doesNotMatch(migration, /security definer/i);
});

test("server storage supports the complete first-step group lifecycle", () => {
  for (const operation of [
    "createCreativeAssetGroup",
    "listCreativeAssetGroups",
    "getCreativeAssetGroupForOwner",
    "renameCreativeAssetGroup",
    "deleteCreativeAssetGroup",
    "addMediaAssetToGroup",
    "removeMediaAssetFromGroup",
    "listCreativeAssetGroupItems",
    "listCreativeAssetGroupAssets",
  ]) {
    assert.match(storage, new RegExp(`export async function ${operation}`));
  }

  assert.match(
    storage,
    /ignoreDuplicates: true[\s\S]*onConflict: "group_id,media_asset_id"/,
  );
  assert.match(storage, /\.eq\("user_id", requireUserId\(input\.userId\)\)/);
});

function getSection(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  assert.ok(startIndex >= 0, `Missing contract start: ${start}`);
  assert.ok(endIndex > startIndex, `Missing contract end: ${end}`);
  return source.slice(startIndex, endIndex);
}
