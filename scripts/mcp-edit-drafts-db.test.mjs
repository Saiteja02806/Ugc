import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const baseline = readFileSync(new URL('../supabase/migrations/20260829093001_production_baseline_v1.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261012035734_edit_draft_revision_safety.sql', import.meta.url), 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const draft = text => ({ trimStartSeconds: 0, trimEndSeconds: null, textOverlays: [{id:'title', position:'top',style:'clean',text}] });
async function setup() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for (const table of ['media_assets','editable_videos','video_render_jobs','demo_videos']) {
    const start = baseline.indexOf(`CREATE TABLE "public"."${table}" (`);
    assert.ok(start >= 0);
    await db.exec(baseline.slice(start, baseline.indexOf('\n);',start)+3));
    await db.exec(`alter table public.${table} enable row level security; grant select,insert,update on public.${table} to service_role;`);
  }
  const start = baseline.lastIndexOf('CREATE OR REPLACE FUNCTION public.finalize_edit_render (');
  assert.ok(start >= 0);
  await db.exec(baseline.slice(start,baseline.indexOf('\n$function$;',start)+13));
  await db.exec(migration);
  await db.query(`insert into media_assets(id,user_id,collection,source_type,title,file_name,storage_key,url,mime_type,status,duration_seconds)
    values($1,'owner-a','video','upload','Source','source.mp4','private-key','https://example.test/private','video/mp4','ready',10)`,[id(1)]);
  await db.query(`insert into editable_videos(id,user_id,project_id,source_video_id,source,title,source_video_url,duration_seconds,draft_json)
    values($1,'owner-a','project-a',$2,'hook','Hook','https://example.test/private',10,$3)`,[id(2),id(1),draft('original')]);
  return db;
}
const save = async(db, text='IDE', expected=0, request=randomUUID(), owner='owner-a', target=id(2)) =>
  (await db.query('select edit_save_draft($1,$2,$3,$4,$5) result',[owner,target,request,expected,draft(text)])).rows[0].result;
const row = async db => (await db.query('select * from editable_videos where id=$1',[id(2)])).rows[0];
test('website and IDE edits share the baseline draft; two stale editors cannot overwrite each other', async()=>{
  const db=await setup();try {
    const responses=await Promise.allSettled([save(db,'website'),save(db,'IDE')]);
    assert.equal(responses.filter(x=>x.status==='fulfilled').length,1);
    assert.match(responses.find(x=>x.status==='rejected').reason.message,/edit_draft_changed/);
    assert.equal(Number((await row(db)).draft_revision),1);
    const next=await save(db,'reconciled',1);assert.equal(next.video.draft_revision,2);
  }finally{await db.close();}
});
test('lost-save replay returns the accepted snapshot and never rolls back later website edits',async()=>{
  const db=await setup();try {
    const request=randomUUID(), original=await save(db,'first',0,request);
    await save(db,'newer',1);
    const replay=await save(db,'first',0,request);
    assert.equal(replay.replayed,true);assert.deepEqual(replay.video,original.video);
    assert.equal((await row(db)).draft_json.textOverlays[0].text,'newer');
    await assert.rejects(save(db,'altered',0,request),/edit_draft_request_conflict/);
    await assert.rejects(save(db,'first',1,request),/edit_draft_request_conflict/);
    assert.equal((await db.query('select count(*)::int n from edit_draft_save_requests')).rows[0].n,2);
  }finally{await db.close();}
});
test('owner/deletion/source guards, invalid ranges and unchanged content leave no destructive write',async()=>{
  const db=await setup();try {
    await assert.rejects(save(db,'foreign',0,randomUUID(),'owner-b'),/edit_draft_not_found/);
    const same=await save(db,'original');assert.equal(same.video.draft_revision,0);
    const invalid={...draft('bad'),trimEndSeconds:11};
    await assert.rejects(db.query('select edit_save_draft($1,$2,$3,0,$4)',['owner-a',id(2),randomUUID(),invalid]),/edit_draft_invalid/);
    await db.query("update media_assets set status='uploading' where id=$1",[id(1)]);
    await assert.rejects(save(db),/edit_draft_not_found/);
    await db.query('update editable_videos set deleted_at=now() where id=$1',[id(2)]);
    await assert.rejects(save(db),/edit_draft_not_found/);
    assert.equal((await row(db)).draft_json.textOverlays[0].text,'original');
  }finally{await db.close();}
});
test('render queue uses an immutable snapshot, survives later draft edits and rolls back failed insertion',async()=>{
  const db=await setup();try {
    await save(db,'newer');
    await db.query('select edit_queue_render_snapshot($1,$2,$3,$4)',['owner-a',id(2),id(3),draft('original')]);
    assert.equal((await row(db)).draft_json.textOverlays[0].text,'newer');
    assert.equal(Number((await row(db)).draft_revision),1);
    assert.equal((await db.query('select draft_json from video_render_jobs')).rows[0].draft_json.textOverlays[0].text,'original');
    await save(db,'during render',1);
    assert.equal((await row(db)).status,'rendering');
    await db.query(`select finalize_edit_render($2,'owner-a','project-a',$1,'completed','private/output','https://example.test/output',null)`,[id(1),id(3)]);
    assert.equal((await row(db)).status,'draft');assert.equal((await row(db)).draft_json.textOverlays[0].text,'during render');
    const before=await row(db);
    await assert.rejects(db.query('select edit_queue_render_snapshot($1,$2,$3,$4)',['owner-a',id(2),id(3),draft('older')]));
    assert.deepEqual(await row(db),before);
  }finally{await db.close();}
});
test('legacy draft updates increment the revision; status-only updates do not; all new access is service-only',async()=>{
  const db=await setup();try {
    await db.query("update editable_videos set status='rendering',draft_revision=999 where id=$1",[id(2)]);
    assert.equal(Number((await row(db)).draft_revision),0);
    await db.query('update editable_videos set draft_json=$2 where id=$1',[id(2),draft('legacy')]);
    assert.equal(Number((await row(db)).draft_revision),1);
    const flags=(await db.query(`select prosecdef,
      has_function_privilege('anon',oid,'execute') anon, has_function_privilege('authenticated',oid,'execute') authenticated,
      has_function_privilege('service_role',oid,'execute') service from pg_proc where proname='edit_save_draft'`)).rows[0];
    assert.deepEqual(flags,{prosecdef:false,anon:false,authenticated:false,service:true});
    assert.equal((await db.query("select relrowsecurity rls from pg_class where oid='edit_draft_save_requests'::regclass")).rows[0].rls,true);
    await db.exec('set role service_role');
    assert.equal((await save(db,'service',1)).video.draft_revision,2);
  }finally{await db.close();}
});
