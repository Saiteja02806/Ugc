import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
const migration = readFileSync(new URL("../supabase/migrations/20261008001500_explore_format_workflows.sql", import.meta.url), "utf8");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function database(t) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table background_jobs(id uuid primary key,user_id text,input_json jsonb);
    create table media_assets(id uuid primary key,user_id text,collection text,source_type text,source_record_id text,status text,deleted_at timestamptz,url text,metadata jsonb);
    create table library_items(id uuid primary key default gen_random_uuid(),user_id text,project_id text,source_type text,source_id text,media_type text,title text,cover_url text,thumbnail_url text,metadata jsonb,deleted_at timestamptz,unique(user_id,source_type,source_id));
    create table library_carousel_slides(id uuid default gen_random_uuid(),library_item_id uuid references library_items(id),carousel_generation_id uuid not null,carousel_slide_id uuid,slide_number integer,slide_type text,rendered_url text,rendered_s3_key text,metadata jsonb);
    grant select,insert on library_items,library_carousel_slides,media_assets to service_role;
    grant select on background_jobs to service_role;
    insert into background_jobs values('${id(1)}','owner-a','{"exploreFormat":"hook"}'),('${id(2)}','owner-a','{"exploreFormat":"slideshow"}');`);
  await db.exec(migration); return db;
}
test("history tags come from an owned, matching server job and leave ordinary Studio media intact", async t => {
  const db = await database(t);
  await db.exec(`insert into media_assets values('${id(3)}','owner-a','video','generated_video','${id(1)}','ready',null,'https://media.test/hook','{}'),('${id(4)}','owner-b','video','generated_video','${id(1)}','ready',null,'https://media.test/other','{}'),('${id(5)}','owner-a','image','generated_image','${id(2)}','ready',null,'https://media.test/slide','{}');`);
  const rows = (await db.query("select metadata from media_assets order by id")).rows;
  assert.equal(rows[0].metadata.exploreFormat, "hook"); assert.deepEqual(rows[1].metadata, {}); assert.equal(rows[2].metadata.exploreFormat, "slideshow");
});
test("slideshow saves preserve ordered images, are idempotent, reject wrong owners and changed request content", async t => {
  const db = await database(t);
  await db.exec(`insert into media_assets values('${id(5)}','owner-a','image','upload',null,'ready',null,'https://media.test/slide','{}');set role service_role;`);
  const slides = [{ slideNumber: 1, referenceSlideId: "first", mediaAssetId: id(5), renderedUrl: "https://media.test/slide" }, { slideNumber: 2, referenceSlideId: "second", mediaAssetId: null, renderedUrl: "https://media.test/reference" }];
  const save = (owner, key, fp, sequence) => db.query("select public.explore_save_slideshow($1,$2,$3,$4,$5,$6) id", [owner, key, fp, "My slideshow", JSON.stringify(sequence), "{}"]);
  const first = (await save("owner-a", id(10), "a".repeat(64), slides)).rows[0].id;
  assert.equal((await save("owner-a", id(10), "a".repeat(64), slides)).rows[0].id, first);
  assert.equal((await db.query("select count(*)::int n from library_items")).rows[0].n, 1);
  const saved = (await db.query("select slide_number,rendered_url,carousel_generation_id from library_carousel_slides order by slide_number")).rows;
  assert.deepEqual(saved.map(s => s.rendered_url), slides.map(s => s.renderedUrl)); assert.ok(saved.every(s => s.carousel_generation_id === null));
  await assert.rejects(save("owner-b", id(11), "b".repeat(64), slides), /asset_unavailable/);
  await assert.rejects(save("owner-a", id(10), "c".repeat(64), slides), /conflict/);
  await assert.rejects(save("owner-a", id(12), "b".repeat(64), [...slides].reverse()), /invalid/);
});
