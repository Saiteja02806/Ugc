import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { buildGeneratedCarouselLibraryPayload } from "../library/db.ts";

const baseline = readFileSync(new URL("../../supabase/migrations/20260829093001_production_baseline_v1.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20261026141500_trending_slideshow_automation.sql", import.meta.url), "utf8");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const table = (name) => {
  const start = baseline.indexOf(`CREATE TABLE "public"."${name}" (`);
  assert.ok(start >= 0);
  return baseline.slice(start, baseline.indexOf("\n);", start) + 3);
};

test("actual Library RPC isolates automation output and replay from the original source", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role service_role bypassrls; create table carousel_generations(id uuid primary key); create table carousel_slides(id uuid primary key);");
    await db.exec(table("library_items")); await db.exec(table("library_carousel_slides"));
    const start = baseline.indexOf("CREATE OR REPLACE FUNCTION public.save_generated_carousel_library_item (");
    await db.exec(baseline.slice(start, baseline.indexOf("$function$;", start) + "$function$;".length));
    await db.query("insert into carousel_generations(id) values($1)", [id(1)]);
    await db.query("insert into carousel_slides(id) values($1)", [id(2)]);
    const source = { generation: { id: id(1), projectId: "project" }, userId: "owner", title: "Original",
      slides: [{ id: id(2), carouselGenerationId: id(1), slideNumber: 1, headline: "Keep copy", subtext: "Keep body", renderedUrl: "https://original.test/slide.webp" }] };
    const save = async (input) => {
      const p = buildGeneratedCarouselLibraryPayload(input);
      const result = await db.query("select * from save_generated_carousel_library_item($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)",
        [p.p_user_id, p.p_project_id, p.p_source_id, p.p_title, p.p_cover_url, p.p_thumbnail_url, JSON.stringify(p.p_metadata), JSON.stringify(p.p_slides)]);
      return result.rows[0];
    };
    const original = await save(source);
    const derived = { ...source, sourceId: "automation:slot-one", slides: source.slides.map((slide) => ({ ...slide, renderedUrl: "https://derived.test/exact-style.webp" })) };
    const automated = await save(derived);
    assert.notEqual(automated.item_id, original.item_id);
    const replay = await save(derived);
    assert.equal(replay.item_id, automated.item_id); assert.equal(replay.created, false);
    const rows = (await db.query("select i.source_id,s.rendered_url,s.carousel_generation_id,s.headline,s.subtext from library_items i join library_carousel_slides s on s.library_item_id=i.id order by i.source_id")).rows;
    assert.equal(rows.length, 2);
    assert.equal(rows.find((row) => row.source_id === id(1)).rendered_url, "https://original.test/slide.webp");
    assert.equal(rows.find((row) => row.source_id === derived.sourceId).rendered_url, "https://derived.test/exact-style.webp");
    assert.ok(rows.every((row) => row.carousel_generation_id === id(1) && row.headline === "Keep copy" && row.subtext === "Keep body"));
  } finally { await db.close(); }
});

test("actual automation schema preserves slot snapshots and rejects duplicate slots and public writes", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;");
    await db.exec(migration);
    await db.query("insert into trending_slideshow_automations(user_id,config) values ('owner',$1::jsonb)", [JSON.stringify({ version: 1 })]);
    const snapshot = { backgroundAssetIds: [id(8)], visualStyle: { color: "#ffdd00" }, textPosition: { x: .45, y: .55 }, configRevision: 1 };
    const insert = "insert into trending_slideshow_automation_slots(user_id,local_date,slot_time,slot_index,format,timezone,scheduled_for,idempotency_key,snapshot) values ('owner','2030-01-02','21:30',1,'educational_tips','Asia/Kolkata','2030-01-02T16:00:00Z','automation:owner:2030-01-02:21:30',$1::jsonb)";
    await db.query(insert, [JSON.stringify(snapshot)]);
    await assert.rejects(db.query(insert, [JSON.stringify(snapshot)]), /unique constraint/);
    await db.query("update trending_slideshow_automations set config='{}',revision=2 where user_id='owner'");
    assert.deepEqual((await db.query("select snapshot from trending_slideshow_automation_slots")).rows[0].snapshot, snapshot);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from trending_slideshow_automation_slots"), /permission denied/);
      await assert.rejects(db.query("update trending_slideshow_automations set status='active'"), /permission denied/);
      await db.exec("reset role");
    }
  } finally { await db.close(); }
});

test("actual cancellation RPC atomically stops targets/jobs and refuses foreign or already publishing posts", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table scheduled_posts(id uuid primary key,user_id text,status text,cancelled_at timestamptz,last_error_code text,updated_at timestamptz);
      create table scheduled_post_targets(id uuid primary key,scheduled_post_id uuid,user_id text,status text,publish_job_id uuid,cancelled_at timestamptz,next_retry_at timestamptz,updated_at timestamptz);
      create table social_publish_operations(scheduled_post_target_id uuid,active_claim_token uuid,status text);
      create table background_jobs(id uuid primary key,status text,claim_token uuid,completed_at timestamptz,next_attempt_at timestamptz,updated_at timestamptz);`);
    const start = baseline.indexOf("CREATE OR REPLACE FUNCTION public.cancel_scheduled_post (");
    await db.exec(baseline.slice(start, baseline.indexOf("$function$;", start) + "$function$;".length));
    await db.query("insert into scheduled_posts(id,user_id,status) values ($1,'owner','scheduled')", [id(1)]);
    await db.query("insert into scheduled_post_targets(id,scheduled_post_id,user_id,status,publish_job_id) values ($1,$2,'owner','scheduled',$3)", [id(2), id(1), id(3)]);
    await db.query("insert into background_jobs(id,status) values ($1,'queued')", [id(3)]);
    const cancel = async (owner) => (await db.query("select cancel_scheduled_post($1,$2) as outcome", [id(1), owner])).rows[0].outcome;
    assert.equal(await cancel("foreign-owner"), "not_found");
    await db.query("insert into social_publish_operations values ($1,$2,'processing')", [id(2), id(4)]);
    assert.equal(await cancel("owner"), "too_late");
    assert.equal((await db.query("select status from scheduled_posts")).rows[0].status, "scheduled");
    await db.exec("delete from social_publish_operations");
    assert.equal(await cancel("owner"), "cancelled");
    for (const name of ["scheduled_posts", "scheduled_post_targets", "background_jobs"]) {
      assert.equal((await db.query(`select status from ${name}`)).rows[0].status, "cancelled");
    }
    assert.equal(await cancel("owner"), "cancelled", "cancellation replay is safe");
    await db.exec("update scheduled_post_targets set status='published'");
    assert.equal(await cancel("owner"), "too_late");
  } finally { await db.close(); }
});
