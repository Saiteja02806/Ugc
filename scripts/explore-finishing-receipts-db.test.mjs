import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { SUBTITLE_STYLES } from "../worker/dist/subtitles/styles.js";

const migration = readFileSync(new URL("../supabase/migrations/20261004053418_explore_video_finishing.sql", import.meta.url), "utf8");
const stylesMigration = readFileSync(new URL("../supabase/migrations/20261007103000_explore_subtitle_styles.sql", import.meta.url), "utf8");
const serifBoxMigration = readFileSync(new URL("../supabase/migrations/20261007193641_explore_serif_box_subtitles.sql", import.meta.url), "utf8");
const sourcesMigration = readFileSync(new URL("../supabase/migrations/20261007132823_explore_existing_video_sources.sql", import.meta.url), "utf8");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fingerprint = "a".repeat(64), hash = "b".repeat(64), policy = "elevenlabs:scribe_v2:auto:en:word:v1";
const draft = (owner = "owner-a", subtitles = true) => ({ version: 1, kind: "hook", sourceAssetId: id(owner === "owner-a" ? 1 : 2),
  demoAssetId: null, demoAudioAssetId: null, demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once",
  subtitles: subtitles ? { language: "en", style: "clean", placement: "bottom" } : null });
const transcript = { schemaVersion: 1, provider: "elevenlabs", model: "scribe_v2", language: "en", durationMs: 1000,
  words: [{ text: "Hello", startMs: 100, endMs: 500 }] };
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table background_jobs(id uuid primary key default gen_random_uuid(),user_id text,job_type text,project_id text,
      idempotency_key text,input_json jsonb,status text default 'queued',claim_token uuid,unique(user_id,job_type,idempotency_key));
    create table media_assets(id uuid primary key,user_id text,collection text,status text,deleted_at timestamptz,
      source_type text,source_record_id text,parent_asset_id uuid references media_assets(id),project_id text,title text,mime_type text,
      storage_key text,url text,ratio text,duration_seconds numeric,file_size_bytes bigint,width integer,height integer,metadata jsonb);
    insert into media_assets(id,user_id,collection,status,mime_type) values('${id(1)}','owner-a','video','ready','video/mp4'),('${id(2)}','owner-b','video','ready','video/mp4');
    create function create_or_get_background_job_v1(p_key text,p_input jsonb,p_reference text,p_type text,p_attempts int,p_project text,p_queue text,p_user text) returns jsonb language plpgsql as $$
      declare j public.background_jobs;
      begin
        select * into j from public.background_jobs where user_id=p_user and job_type=p_type and idempotency_key=p_key;
        if found then return jsonb_build_object('created',false,'job',to_jsonb(j)); end if;
        insert into public.background_jobs(user_id,job_type,project_id,idempotency_key,input_json) values(p_user,p_type,p_project,p_key,p_input) returning * into j;
        return jsonb_build_object('created',true,'job',to_jsonb(j));
      end;
    $$;
    create function claim_video_render_execution_slot(uuid,uuid,integer) returns boolean language plpgsql security definer as $$
      begin
        -- Newer-main behavior sentinel: preserve final_render and this body.
        return exists(select 1 from public.background_jobs where job_type in ('render_edit_video','final_render'));
      end;
    $$;
    revoke all on function claim_video_render_execution_slot(uuid,uuid,integer) from public;
    grant execute on function claim_video_render_execution_slot(uuid,uuid,integer) to service_role;
    grant select,insert,update on media_assets,background_jobs to service_role;
    grant execute on function create_or_get_background_job_v1(text,jsonb,text,text,int,text,text,text) to service_role;
  `);
  await db.exec(migration);
  await db.exec(stylesMigration);
  await db.exec(serifBoxMigration);
  await db.exec(sourcesMigration);
  await db.exec("set role service_role");
  return db;
}
const start = async (db, key = id(10), owner = "owner-a", options = draft(owner), fp = fingerprint) =>
  (await db.query("select explore_create_video_finish($1,$2,$3,$4::jsonb) result", [owner,key,fp,JSON.stringify(options)])).rows[0].result;
async function lease(db, receipt, token = id(20)) {
  await db.query("update background_jobs set status='processing',claim_token=$1 where id=$2",[token,receipt.job_id]); return token;
}
const claim = async (db,r,token,h = hash,duration = 1000,p = policy) =>
  (await db.query("select explore_claim_transcription($1,$2,$3,$4,$5,$6,$7) result",[r.user_id,r.request_key,r.job_id,token,h,duration,p])).rows[0].result;
const save = async (db,r,value = transcript,h = hash,duration = 1000,p = policy) =>
  (await db.query("select explore_save_transcription($1,$2,$3,$4,$5,$6::jsonb,$7) result",[r.user_id,r.request_key,r.job_id,h,duration,JSON.stringify(value),p])).rows[0].result;
const output = r => ({ storageKey:`explore/finishes/${r.output_asset_id}/video.mp4`,url:`https://storage.example/${r.output_asset_id}.mp4`,
  ratio:"9:16",durationSeconds:1,fileSizeBytes:1000,width:256,height:384,metadata:{subtitleStyle:"clean"} });
const finalize = async (db,r,token,value = output(r)) =>
  (await db.query("select explore_finalize_video_finish($1,$2,$3,$4,$5::jsonb) result",[r.user_id,r.request_key,r.job_id,token,JSON.stringify(value)])).rows[0].result;

test("both workflows accept owned legacy footage while rejecting images, pending, deleted and foreign assets", async () => {
  const db = await fixture();
  try {
    await db.query("update media_assets set collection='influencer' where id=$1", [id(1)]);
    for (const [index, kind] of ["hook", "phone"].entries()) {
      const r = await start(db, id(400 + index), "owner-a", { ...draft(), kind });
      assert.equal(r.draft.sourceAssetId, id(1));
      await db.query("update background_jobs set status='completed' where id=$1", [r.job_id]);
    }
    for (const patch of ["mime_type='image/png'", "collection='audio'", "status='uploading'", "deleted_at=now()", "user_id='owner-b'"]) {
      await db.query("update media_assets set collection='influencer',mime_type='video/mp4',status='ready',deleted_at=null,user_id='owner-a' where id=$1", [id(1)]);
      await db.query(`update media_assets set ${patch} where id=$1`, [id(1)]);
      await assert.rejects(start(db, id(410)), /explore_finish_asset_unavailable/);
    }
    assert.equal((await db.query("select count(*)::int n from background_jobs")).rows[0].n, 2);
    assert.equal((await db.query("select has_function_privilege('authenticated','explore_create_video_finish(text,uuid,text,jsonb)','execute') allowed")).rows[0].allowed, false);
  } finally { await db.close(); }
});

test("database styles match the shared registry and invalid subtitle records roll back their jobs", async () => {
  const db = await fixture();
  try {
    let index = 300;
    for (const style of SUBTITLE_STYLES) {
      const options = { ...draft(), subtitles: { language: "en", style } };
      const receipt = await start(db, id(index++), "owner-a", options);
      assert.equal(receipt.draft.subtitles.style, style);
      await db.query("update background_jobs set status='completed' where id=$1", [receipt.job_id]);
    }
    const before = (await db.query("select count(*)::int n from background_jobs")).rows[0].n;
    for (const subtitles of [{language:"en",style:"unknown"}, {language:"en"}, {language:"en",style:null}, {style:"clean"}, {language:"fr",style:"clean"}, {language:"en",style:"clean",placement:null}]) {
      await assert.rejects(start(db, id(index++), "owner-a", {...draft(),subtitles}), /explore_finish_subtitle_style_check/);
    }
    assert.equal((await db.query("select count(*)::int n from background_jobs")).rows[0].n, before);
    assert.equal((await db.query("select count(*)::int n from explore_video_finishes")).rows[0].n, before);
  } finally { await db.close(); }
});

test("owned request creation is atomic, replay retains IDs even after source removal, changed edits conflict", async () => {
  const db = await fixture();
  try {
    const first = await start(db); assert.deepEqual(await start(db),first);
    await db.query("update media_assets set deleted_at=now() where id=$1",[id(1)]);
    assert.deepEqual(await start(db),first);
    await assert.rejects(start(db,id(10),"owner-a",draft(),"c".repeat(64)),/explore_finish_conflict/);
    assert.equal((await db.query("select count(*)::int n from background_jobs")).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int n from explore_video_finishes")).rows[0].n,1);
  } finally { await db.close(); }
});

test("cannot use another owner's sources, deleted sources, demo audio without demo, or overlapping active finishes", async () => {
  const db = await fixture();
  try {
    await assert.rejects(start(db,id(10),"owner-a",draft("owner-b")),/asset_unavailable/);
    await assert.rejects(start(db,id(10),"owner-a",{...draft(),demoAudioAssetId:id(1)}),/asset_unavailable/);
    await start(db); await assert.rejects(start(db,id(11)),/explore_finish_busy/);
    assert.equal((await db.query("select count(*)::int n from background_jobs")).rows[0].n,1);
  } finally { await db.close(); }
});

test("atomic receipts keep each workflow position unchanged; new positioning edits reuse owned speech", async () => {
  const db = await fixture();
  try {
    let index = 100;
    for (const kind of ["hook", "phone"]) for (const placement of [undefined, "bottom", "middle", "top"]) {
      const options = { ...draft(), kind, subtitles: { language: "en", style: "editorial", ...(placement ? { placement } : {}) } };
      const r = await start(db, id(index++), "owner-a", options), token = await lease(db, r);
      assert.deepEqual(r.draft, options);
      assert.deepEqual(await start(db, r.request_key, "owner-a", options), r);
      const speechClaim = await claim(db, r, token);
      if (index === 101) { assert.equal(speechClaim.state, "submit"); await save(db, r); }
      else assert.equal(speechClaim.state, "ready");
      const result = output(r); result.metadata.subtitlePlacement = placement ?? "bottom";
      await finalize(db, r, token, result);
      const asset = (await db.query("select metadata from media_assets where id=$1", [r.output_asset_id])).rows[0];
      assert.equal(asset.metadata.render.subtitlePlacement, placement ?? "bottom");
      await db.query("update background_jobs set status='completed' where id=$1", [r.job_id]);
    }
  } finally { await db.close(); }
});

test("only a current, active owner-matched worker lease can claim transcription or finalize", async () => {
  const db = await fixture();
  try {
    const r = await start(db), token = await lease(db,r);
    await assert.rejects(claim(db,r,id(21)),/lease_lost/);
    await assert.rejects(claim(db,{...r,user_id:"owner-b"},token),/lease_lost/);
    for (const status of ["cancel_requested","cancelled","failed","completed"]) {
      await db.query("update background_jobs set status=$1 where id=$2",[status,r.job_id]);
      await assert.rejects(claim(db,r,token),/lease_lost/);
      await assert.rejects(finalize(db,r,token),/lease_lost/);
    }
  } finally { await db.close(); }
});

test("a second claim for an unresolved submission returns uncertain, never submit", async () => {
  const db = await fixture();
  try {
    const r = await start(db), token = await lease(db,r);
    assert.equal((await claim(db,r,token)).state,"submit");
    assert.equal((await claim(db,r,token)).state,"uncertain");
    assert.equal((await claim(db,r,token)).state,"uncertain");
    await assert.rejects(finalize(db,r,token),/not_ready/);
  } finally { await db.close(); }
});

test("new edits cannot bypass an earlier uncertain paid claim; late result repairs both through cache", async () => {
  const db = await fixture();
  try {
    const first = await start(db), token = await lease(db,first);
    assert.equal((await claim(db,first,token)).state,"submit");
    await db.query("update background_jobs set status='failed' where id=$1",[first.job_id]);
    const second = await start(db,id(11)), nextToken = await lease(db,second,id(21));
    assert.equal((await claim(db,second,nextToken)).state,"uncertain");
    assert.equal(await save(db,first),true);
    assert.deepEqual(await claim(db,second,nextToken),{state:"ready",transcript});
    assert.equal((await db.query("select count(*)::int n from explore_video_finishes where transcription_started_at is not null")).rows[0].n,1);
  } finally { await db.close(); }
});

test("transcription cache is owner-scoped and binds speech hash, duration, approved model and policy", async () => {
  const db = await fixture();
  try {
    const a = await start(db), at = await lease(db,a);
    await claim(db,a,at); assert.equal(await save(db,a),true);
    assert.deepEqual(await claim(db,a,at),{state:"ready",transcript});
    const b = await start(db,id(10),"owner-b"), bt = await lease(db,b,id(21));
    assert.equal((await claim(db,b,bt)).state,"submit");
    await assert.rejects(claim(db,a,at,"c".repeat(64)),/source_changed/);
    await assert.rejects(claim(db,a,at,hash,1001),/source_changed/);
    await assert.rejects(claim(db,a,at,hash,1000,"openai:whisper-1"),/invalid/);
  } finally { await db.close(); }
});

test("no result can save without an exact prior paid claim, and fixtures/OpenAI/non-English results are rejected", async () => {
  const db = await fixture();
  try {
    const r = await start(db), token = await lease(db,r);
    assert.equal(await save(db,r),false); await claim(db,r,token);
    for (const change of [{provider:"fixture"},{provider:"openai"},{model:"scribe_v1"},{language:"hi"},{words:[]},{durationMs:2000}]) {
      await assert.rejects(save(db,r,{...transcript,...change}),/invalid/);
    }
    assert.equal(await save(db,r,transcript,"c".repeat(64)),false);
    assert.equal(await save(db,r),true);
  } finally { await db.close(); }
});

test("finished media is saved atomically, stays owner-matched, preserves parent identity, and replays once", async () => {
  const db = await fixture();
  try {
    const r = await start(db), token = await lease(db,r); await claim(db,r,token);
    await assert.rejects(finalize(db,r,token),/not_ready/); await save(db,r);
    for (const change of [{storageKey:"another/video.mp4"},{url:"http://example.com"},{width:0},{fileSizeBytes:0}]) {
      await assert.rejects(finalize(db,r,token,{...output(r),...change}),/invalid/);
    }
    assert.equal(await finalize(db,r,token),r.output_asset_id);
    assert.equal(await finalize(db,r,token),r.output_asset_id);
    const asset = (await db.query("select * from media_assets where id=$1",[r.output_asset_id])).rows[0];
    assert.equal(asset.user_id,"owner-a"); assert.equal(asset.source_record_id,r.job_id); assert.equal(asset.parent_asset_id,id(1));
    assert.equal(asset.status,"ready"); assert.equal(asset.metadata.exploreFinish,true);
    assert.equal((await db.query("select status from explore_video_finishes where request_key=$1",[r.request_key])).rows[0].status,"completed");
  } finally { await db.close(); }
});

test("subtitles off never claims speech and can finalize without a transcript", async () => {
  const db = await fixture();
  try {
    const r = await start(db,id(10),"owner-a",draft("owner-a",false)), token = await lease(db,r);
    await assert.rejects(claim(db,r,token),/invalid/);
    assert.equal(await finalize(db,r,token),r.output_asset_id);
  } finally { await db.close(); }
});

test("anonymous/authenticated database roles cannot read receipts or call any privileged finishing RPC", async () => {
  const db = await fixture();
  try {
    const r = await start(db), token = await lease(db,r);
    for (const role of ["anon","authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from explore_video_finishes"),/permission denied/);
      for (const operation of [()=>start(db),()=>claim(db,r,token),()=>save(db,r),()=>finalize(db,r,token)]) await assert.rejects(operation(),/permission denied/);
    }
    await db.exec("reset role");
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='explore_video_finishes'::regclass")).rows[0].relrowsecurity,true);
    const functions = (await db.query("select proname,prosecdef from pg_proc where proname like 'explore_%'")).rows;
    assert.equal(functions.length,4); assert.ok(functions.every(f => !f.prosecdef));
  } finally { await db.close(); }
});

test("the additive renderer lease patch retains current main predicates and privileges", async () => {
  const db = await fixture();
  try {
    const sql = (await db.query("select pg_get_functiondef('claim_video_render_execution_slot(uuid,uuid,integer)'::regprocedure) definition")).rows[0].definition;
    for (const existing of ["render_demo_video","render_edit_video","final_render","Newer-main behavior sentinel"]) assert.ok(sql.includes(existing));
    assert.equal((await db.query("select has_function_privilege('anon','claim_video_render_execution_slot(uuid,uuid,integer)','execute') allowed")).rows[0].allowed,false);
  } finally { await db.close(); }
});
