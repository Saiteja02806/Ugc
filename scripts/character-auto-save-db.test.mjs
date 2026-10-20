import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261013143246_character_auto_save_influencer_images.sql", import.meta.url), "utf8");
const baseline = readFileSync(new URL("../supabase/migrations/20260829093001_production_baseline_v1.sql", import.meta.url), "utf8");
const start = baseline.indexOf("CREATE OR REPLACE FUNCTION public.complete_background_job (");
const completeSql = baseline.slice(start, baseline.indexOf("$function$;", start) + "$function$;".length);
const owner = "builder-owner";

async function fixture({ applyMigration = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.background_jobs(
      id uuid primary key,user_id text,job_type text,status text,project_id text,input_json jsonb,
      output_json jsonb,output_reference text,claim_token uuid,completed_at timestamptz,
      stage text,progress int,error_code text,error_message text,next_attempt_at timestamptz,
      failed_at timestamptz,locked_at timestamptz,worker_id text,worker_execution_id text,
      created_at timestamptz default now(),updated_at timestamptz default now()
    );
    create table public.media_assets(
      id uuid primary key,user_id text,project_id text,collection text,source_type text,source_record_id text,
      parent_asset_id uuid,title text,storage_key text,url text,thumbnail_url text,mime_type text,
      file_name text,file_size_bytes bigint,duration_seconds numeric,width int,height int,ratio text,
      status text,metadata jsonb,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz
    );
    create function public.append_background_job_event(uuid,text,jsonb) returns void
      language plpgsql as $$ begin return; end; $$;
    grant select,update on public.background_jobs,public.media_assets to service_role;
  `);
  await db.exec(completeSql);
  if (applyMigration) await db.exec(migration);
  return db;
}

async function admit(db, changes = {}) {
  const job = { id: randomUUID(), claim: randomUUID(), generationId: randomUUID(), model: "gpt_image", ...changes };
  job.input = { characterSource: "ugc-pilot-characters", characterVersion: 2, candidateIndex: 1,
    generationId: job.generationId, model: job.model, prompt: "An adult presenter in a bright studio",
    mode: "custom", promptSource: "user", businessProfileId: null, businessProfileVersion: null,
    ...changes.input };
  job.output = { generationId: job.generationId, model: job.model, provider: "openai",
    key: `images/generated/${owner}/${job.generationId}.png`,
    url: `https://media.example.test/${job.generationId}.png`, width: 720, height: 1280, ratio: "9:16" };
  await db.query("insert into public.background_jobs(id,user_id,job_type,status,project_id,input_json,claim_token) values($1,$2,'generate_image','processing','ai-studio',$3,$4)",
    [job.id, owner, job.input, job.claim]);
  return job;
}
const complete = (db, job, token = job.claim) => db.query("select * from public.complete_background_job($1,$2,$3)", [job.id, token, job.output]);
const assets = async (db) => (await db.query("select * from public.media_assets order by created_at,id")).rows;

test("durable completion saves every successful image and variation from a partial batch without browser selection", async () => {
  const db = await fixture();
  try {
    const jobs = [];
    for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2", "seedream_5_pro", "gpt_image_2_5"]) {
      const first = await admit(db, { model }); jobs.push(first);
      await complete(db, first);
      const variation = await admit(db, { model, input: { candidateIndex: 2, referenceCharacterId: (await assets(db))[0].id } });
      jobs.push(variation); await complete(db, variation);
    }
    const failed = await admit(db, { input: { candidateIndex: 3 } });
    await db.query("update public.background_jobs set status='failed' where id=$1", [failed.id]);
    const images = await assets(db);
    assert.equal(images.length, 10);
    for (const image of images) {
      assert.equal(image.collection, "influencer"); assert.equal(image.title, "My AI influencer");
      assert.deepEqual(Object.keys(image.metadata).sort(), ["backgroundJobId", "characterIdentity", "jobType", "provider"]);
      assert.equal(image.metadata.characterIdentity.source, "ugc-pilot-characters");
      assert.equal(image.metadata.characterIdentity.jobId, image.source_record_id);
      assert.equal(image.metadata.characterIdentity.automatic, true);
      assert.ok(Number.isFinite(Date.parse(image.metadata.characterIdentity.selectedAt)));
    }
    const before = structuredClone(images);
    assert.equal((await complete(db, jobs[0])).rows.length, 0);
    await db.query("update public.background_jobs set output_json=output_json where id=$1", [jobs[0].id]);
    assert.deepEqual(await assets(db), before);
  } finally { await db.close(); }
});

test("backfill recovers old unselected images while preserving selected names, dates and ordinary Studio images", async () => {
  const db = await fixture({ applyMigration: false });
  try {
    const unselected = await admit(db); await complete(db, unselected);
    const selected = await admit(db); await complete(db, selected);
    const marker = { source: "ugc-pilot-characters", version: 1, jobId: selected.id, selectedAt: "2026-10-01T12:00:00Z" };
    await db.query("update public.media_assets set collection='influencer',title='Maya',metadata=metadata || jsonb_build_object('characterIdentity',$2::jsonb) where source_record_id=$1", [selected.id, marker]);
    const studio = await admit(db, { input: { characterSource: "ai-studio" } }); await complete(db, studio);
    const deleted = await admit(db); await complete(db, deleted);
    await db.query("update public.media_assets set deleted_at=now() where source_record_id=$1", [deleted.id]);
    await db.exec(migration);
    const byJob = new Map((await assets(db)).map(image => [image.source_record_id, image]));
    assert.equal(byJob.get(unselected.id).collection, "influencer");
    assert.equal(byJob.get(selected.id).title, "Maya");
    assert.deepEqual(byJob.get(selected.id).metadata.characterIdentity, marker);
    assert.equal(byJob.get(studio.id).collection, "image");
    assert.equal(byJob.get(deleted.id).collection, "image");
    const before = await assets(db); await db.exec(migration);
    assert.deepEqual(await assets(db), before);
  } finally { await db.close(); }
});

test("backfill rejects foreign, mismatched, unfinished and invalid-provenance media", async () => {
  const db = await fixture({ applyMigration: false });
  try {
    const tamperings = [
      ["user_id", "foreign-owner"], ["url", "https://foreign.example.test/image.png"],
      ["storage_key", "different.png"], ["status", "uploading"], ["mime_type", "video/mp4"],
    ];
    for (const [column, value] of tamperings) {
      const job = await admit(db); await complete(db, job);
      await db.query(`update public.media_assets set ${column}=$2 where source_record_id=$1`, [job.id, value]);
    }
    const unfinished = await admit(db); await complete(db, unfinished);
    await db.query("update public.background_jobs set status='failed' where id=$1", [unfinished.id]);
    for (const input of [{ characterVersion: 3 }, { candidateIndex: 4 }, { promptSource: "business" }, { model: "unknown" }]) {
      const job = await admit(db, { input }); await complete(db, job);
    }
    const mismatch = await admit(db); await complete(db, mismatch);
    await db.query("update public.background_jobs set output_json=output_json || '{\"mediaAssetId\":\"wrong-asset\"}' where id=$1", [mismatch.id]);
    await db.exec(migration);
    assert.ok((await assets(db)).every(image => image.collection === "image"));
  } finally { await db.close(); }
});

test("automatic save and job completion commit atomically, retain claim fencing and grant no browser mutation access", async () => {
  const db = await fixture();
  try {
    const job = await admit(db);
    assert.equal((await complete(db, job, randomUUID())).rows.length, 0);
    await db.exec("alter table public.media_assets add constraint fail_save check(collection <> 'influencer')");
    await assert.rejects(complete(db, job), /fail_save/);
    assert.equal((await db.query("select status from public.background_jobs where id=$1", [job.id])).rows[0].status, "processing");
    assert.deepEqual(await assets(db), []);
    await db.exec("alter table public.media_assets drop constraint fail_save");
    assert.equal((await complete(db, job)).rows[0].status, "completed");
    assert.equal((await assets(db))[0].collection, "influencer");
    for (const role of ["anon", "authenticated"]) {
      for (const fn of ["public.save_character_generation_image(uuid)", "public.save_completed_character_generation_image()"]) {
        assert.equal((await db.query("select has_function_privilege($1,$2,'execute') allowed", [role, fn])).rows[0].allowed, false);
      }
    }
    assert.equal((await db.query("select prosecdef from pg_proc where oid='public.save_character_generation_image(uuid)'::regprocedure")).rows[0].prosecdef, false);
    assert.equal((await db.query("select has_function_privilege('service_role','public.save_character_generation_image(uuid)','execute') allowed")).rows[0].allowed, true);
  } finally { await db.close(); }
});
