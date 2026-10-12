import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const retirementMigration = read("supabase/migrations/20261011081756_guard_retired_carousel_reservation_replays.sql");
const originalMigration = read("supabase/migration_archive/pre_baseline_20260829/canonical_history/20260820054247_add_carousel_related_static_reservation_v2.sql");
const originalFunction = originalMigration.match(/create or replace function public\.reserve_carousel_role_assets_v2\([\s\S]*?\n\$\$;/i)?.[0];
assert.ok(originalFunction, "the canonical original allocator function must exist");
const profileId = "10000000-0000-4000-8000-000000000001";
const carouselId = "20000000-0000-4000-8000-000000000001";
const assetIds = [1, 2, 3, 4, 5, 6].map((number) => `30000000-0000-4000-8000-${String(number).padStart(12, "0")}`);
const roles = ["hook", "human", "static", "human", "static", "static"];
const plan = roles.map((asset_role, index) => ({
  asset_role,
  category_slug: "productivity",
  relevance_level: "none",
  relevance_reason: null,
  selection_type: "primary",
  slide_number: index + 1,
}));
const signature = "public.reserve_carousel_role_assets_v2(uuid,uuid,text,jsonb,boolean)";
let db;
let functionBefore;
let metadataBefore;
let originalReservations;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.carousel_generations (id uuid primary key, user_id text, business_profile_id uuid);
    create table public.category_image_assets (
      id uuid primary key, category_slug text, asset_role text,
      owner_business_profile_id uuid, library_asset_id text, is_active boolean,
      status text, subject_review_status text, runtime_exclusion_reason text,
      source_file_sha256 text, base_s3_key text, base_url text,
      created_at timestamptz default now(), updated_at timestamptz default now(),
      usage_count integer default 0
    );
    create table public.carousel_image_usage (
      id uuid primary key default gen_random_uuid(), user_id text,
      business_profile_id uuid, asset_id uuid, duplicate_family_id text,
      carousel_id uuid, category_slug text, requested_category_slug text,
      primary_category_slug text, asset_role text, selection_type text,
      relevance_level text, relevance_reason text, cycle_number integer,
      slide_number integer, usage_type text, reuse_reason text
    );
    create table public.carousel_image_rotation_pools (
      business_profile_id uuid, category_slug text, asset_role text,
      cycle_number integer default 1, last_asset_id uuid,
      updated_at timestamptz default now(),
      primary key (business_profile_id, category_slug, asset_role)
    );
  `);
  await db.exec(originalFunction);
  for (const path of [
    "supabase/migrations/20260830190513_prioritize_fresh_carousel_images_before_reuse.sql",
    "supabase/migrations/20260905044832_expand_carousel_role_asset_reservation_to_six_slides.sql",
    "supabase/migrations/20260906091416_fix_carousel_six_slide_reservation_initialization.sql",
  ]) {
    const migration = read(path);
    // The six-slide migration also changes a slide-table check that is unrelated
    // to this isolated allocator fixture; execute its actual function patch.
    await db.exec(migration.match(/do \$migration\$[\s\S]*?\$migration\$;/i)?.[0] ?? migration);
  }
  await db.exec(`
    revoke all on function ${signature} from public, anon, authenticated;
    grant execute on function ${signature} to postgres, service_role;
  `);
  functionBefore = await definition();
  metadataBefore = await metadata();
  await db.query("insert into public.carousel_generations values ($1, 'fixture-user', $2)", [carouselId, profileId]);
  for (let index = 0; index < assetIds.length; index++) {
    await db.query(`
      insert into public.category_image_assets (
        id, category_slug, asset_role, library_asset_id, is_active,
        status, subject_review_status, source_file_sha256, base_s3_key, base_url
      ) values ($1, 'productivity', $2, $3, true, 'ready', 'approved', $4, $5, $6)
    `, [assetIds[index], roles[index], `fixture-${index}`, `fixture-hash-${index}`, `fixture/${index}`, `https://example.invalid/${index}`]);
  }
  originalReservations = await reserve();
  assert.equal(originalReservations.rows.length, 6);
  await db.exec(retirementMigration);
});

after(async () => { await db?.close(); });

test("active retry returns the original six reservations without advancing rotation or usage", async () => {
  const beforeState = await state();
  assert.deepEqual((await reserve()).rows, originalReservations.rows);
  assert.deepEqual(await state(), beforeState);
});

test("retired or missing sources block the first replay branch without deleting usage proof", async () => {
  for (const mutation of retiredSourceMutations()) {
    const beforeState = await state();
    await db.exec("begin");
    try {
      await db.query(mutation, [originalReservations.rows[0].asset_id]);
      await assert.rejects(reserve(), /carousel_image_reserved_source_retired/);
    } finally {
      await db.exec("rollback");
    }
    assert.deepEqual(await state(), beforeState);
  }
});

test("the post-lock replay branch also blocks a retired source", async () => {
  await db.exec("begin");
  try {
    // Force only the second existing-reservation branch in this local fixture.
    // Production keeps both branches, ownership checks and pool locks intact.
    const definitionWithFirstReplaySkipped = (await definition()).replace(
      "if v_existing_count > 0 then",
      "if false then",
    );
    await db.exec(definitionWithFirstReplaySkipped);
    await db.query("update public.category_image_assets set is_active = false where id = $1", [originalReservations.rows[0].asset_id]);
    await assert.rejects(reserve(), /carousel_image_reserved_source_retired/);
  } finally {
    await db.exec("rollback");
  }
});

test("migration changes only both replay guards and preserves owner, ACL, signature and search path", async () => {
  const guard = retirementMigration.match(/v_replay_guard text := \$guard\$([\s\S]*?)\$guard\$;/)?.[1];
  assert.ok(guard);
  const patched = await definition();
  assert.equal(patched.split("carousel_reserved_source_retirement_guard:20261011075309").length - 1, 2);
  assert.equal(patched.split(guard).join(""), functionBefore);
  assert.deepEqual(await metadata(), metadataBefore);
  assert.ok(patched.indexOf("carousel_image_reservation_owner_mismatch") < patched.indexOf("carousel_image_reserved_source_retired"));
  assert.ok(patched.indexOf("carousel_image_reservation_is_partial") < patched.indexOf("carousel_image_reserved_source_retired"));
});

test("migration is idempotent and rejects an unknown or partially patched baseline", async () => {
  const patched = await definition();
  await db.exec(retirementMigration);
  assert.equal(await definition(), patched);
  for (const malformed of [
    functionBefore.replace("carousel_fresh_first:20260830214000", "unknown_fresh_selector"),
    patched.replace("carousel_reserved_source_retirement_guard:20261011075309", "incomplete_guard"),
  ]) {
    await db.exec("begin");
    try {
      await db.exec(malformed);
      await assert.rejects(db.exec(retirementMigration), /carousel_reserved_source_retirement_(baseline_not_found|guard_is_partial)/);
    } finally {
      await db.exec("rollback");
    }
  }
});

async function reserve() {
  return db.query(`select * from public.reserve_carousel_role_assets_v2($1::uuid, $2::uuid, 'productivity', $3::jsonb, false)`, [profileId, carouselId, JSON.stringify(plan)]);
}

async function definition() {
  return (await db.query("select pg_get_functiondef($1::regprocedure) as definition", [signature])).rows[0].definition;
}

async function metadata() {
  return (await db.query(`select pg_get_userbyid(proowner) as owner, proacl::text as acl, proconfig, prosecdef, oid::regprocedure::text as signature from pg_proc where oid = $1::regprocedure`, [signature])).rows[0];
}

async function state() {
  return {
    usage: (await db.query("select * from public.carousel_image_usage order by slide_number")).rows,
    rotations: (await db.query("select * from public.carousel_image_rotation_pools order by asset_role")).rows,
    counters: (await db.query("select id, usage_count from public.category_image_assets order by id")).rows,
  };
}

function retiredSourceMutations() {
  return [
    "delete from public.category_image_assets where id = $1",
    "update public.category_image_assets set is_active = false where id = $1",
    "update public.category_image_assets set is_active = null where id = $1",
    "update public.category_image_assets set status = 'archived' where id = $1",
    "update public.category_image_assets set status = null where id = $1",
    "update public.category_image_assets set subject_review_status = 'rejected' where id = $1",
    "update public.category_image_assets set subject_review_status = null where id = $1",
    "update public.category_image_assets set runtime_exclusion_reason = 'user_requested_retirement' where id = $1",
    "update public.category_image_assets set library_asset_id = null where id = $1",
  ];
}

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}
