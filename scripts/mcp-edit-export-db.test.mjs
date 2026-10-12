import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
const baseline=readFileSync(new URL('../supabase/migrations/20260829093001_production_baseline_v1.sql',import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const draft=text=>({trimStartSeconds:1,trimEndSeconds:8,textOverlays:[{id:'title',position:'top',style:'clean',text}]});
async function setup(){
  const db=new PGlite();await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const table of ['media_assets','editable_videos','video_render_jobs','demo_videos','background_jobs']){
    const start=baseline.indexOf(`CREATE TABLE "public"."${table}" (`);assert.ok(start>=0);
    await db.exec(baseline.slice(start,baseline.indexOf('\n);',start)+3));
    await db.exec(`alter table public.${table} enable row level security; grant select,insert,update on public.${table} to service_role;`);
  }
  await db.exec('create unique index job_request on background_jobs(user_id,idempotency_key) where idempotency_key is not null;');
  const start=baseline.lastIndexOf('CREATE OR REPLACE FUNCTION public.finalize_edit_render (');
  await db.exec(baseline.slice(start,baseline.indexOf('\n$function$;',start)+13));
  for(const file of ['20261012035734_edit_draft_revision_safety.sql','20261012092903_edit_export_requests.sql'])
    await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.query(`insert into media_assets(id,user_id,collection,source_type,title,storage_key,url,mime_type,status,duration_seconds)
    values($1,'owner-a','video','upload','Source','owned-source','https://example.test/source','video/mp4','ready',10)`,[id(1)]);
  await db.query(`insert into editable_videos(id,user_id,project_id,source_video_id,source,title,source_video_url,duration_seconds,draft_json)
    values($1,'owner-a','project-a',$2,'hook','Original','https://example.test/source',10,$3)`,[id(2),id(1),draft('saved text')]);
  return db;
}
const start=async(db,key=randomUUID(),overrides={})=>{
  const p={owner:'owner-a',key,target:id(2),revision:0,stored:draft('saved text'),render:draft('saved text'),url:'https://example.test/source',...overrides};
  return (await db.query('select edit_start_export($1,$2,$3,$4,$5,$6,$7) r',[p.owner,p.key,p.target,p.revision,p.stored,p.render,p.url])).rows[0].r;
};
const row=async db=>(await db.query('select * from editable_videos where id=$1',[id(2)])).rows[0];
const complete=async(db,r)=>db.query(`select finalize_edit_render($1,'owner-a','project-a',$2,'completed',$3,'https://example.test/output',null)`,[r.render_id,id(1),'owned-output/'+r.render_id]);
test('one immutable saved revision, job and receipt survive concurrent/lost export responses and newer website edits',async()=>{
  const db=await setup();try{
    const key=randomUUID(),results=await Promise.all([start(db,key),start(db,key)]);
    assert.deepEqual(results.map(r=>r.replayed).sort(),[false,true]);assert.deepEqual(results[0].receipt,results[1].receipt);
    const r=results[0].receipt;
    for(const t of ['background_jobs','video_render_jobs','edit_export_requests'])assert.equal((await db.query(`select count(*)::int n from ${t}`)).rows[0].n,1);
    await db.query('select edit_save_draft($1,$2,$3,0,$4)',['owner-a',id(2),randomUUID(),draft('new website text')]);
    const replay=await start(db,key);assert.deepEqual(replay.receipt,r);assert.equal(replay.replayed,true);
    assert.equal((await row(db)).draft_json.textOverlays[0].text,'new website text');
    const job=(await db.query('select * from background_jobs')).rows[0];assert.deepEqual(job.input_json,r.render_payload);
    assert.equal(job.job_type,'render_edit_video');assert.equal(job.queue_name,'video-render');assert.equal(job.status,'queued');
    await assert.rejects(start(db,key,{revision:1}),/edit_export_request_conflict/);
    await assert.rejects(start(db,key,{target:id(4)}),/edit_export_request_conflict/);
    await complete(db,r);
    assert.equal((await row(db)).status,'draft');assert.equal((await row(db)).draft_json.textOverlays[0].text,'new website text');
    const asset=(await db.query('select * from media_assets where id=$1',[r.output_asset_id])).rows[0];
    assert.equal(asset.source_type,'edit_export');assert.equal(asset.source_record_id,r.render_id);assert.equal(asset.parent_asset_id,id(1));
    assert.equal(Number(asset.duration_seconds),7);assert.equal(asset.width,1080);assert.equal(asset.height,1920);
    assert.equal(asset.metadata.editDraftRevision,0);
    await complete(db,r);assert.equal((await db.query('select count(*)::int n from media_assets')).rows[0].n,2);
  }finally{await db.close();}
});
test('owner, source removal/readiness, revision, source URL and duration checks leave zero partial exports',async()=>{
  const db=await setup();try{
    for(const [overrides,pattern]of [[{owner:'owner-b'},/edit_export_not_found/],[{revision:1},/edit_export_changed/],
      [{stored:draft('stale')},/edit_export_changed/],[{url:'https://foreign.test'},/edit_export_source_changed/],
      [{render:{...draft('invalid'),trimEndSeconds:11}},/edit_export_invalid/]])await assert.rejects(start(db,randomUUID(),overrides),pattern);
    await db.query("update media_assets set status='uploading' where id=$1",[id(1)]);await assert.rejects(start(db),/edit_export_not_found/);
    await db.query("update media_assets set status='ready',deleted_at=now() where id=$1",[id(1)]);await assert.rejects(start(db),/edit_export_not_found/);
    for(const t of ['background_jobs','video_render_jobs','edit_export_requests'])assert.equal((await db.query(`select count(*)::int n from ${t}`)).rows[0].n,0);
    assert.equal((await row(db)).status,'ready');assert.equal(Number((await row(db)).draft_revision),0);
  }finally{await db.close();}
});
test('a failed job insertion rolls back snapshot/status/receipt and a clean retry is safe',async()=>{
  const db=await setup();try{
    await db.exec(`create function reject_export_job() returns trigger language plpgsql as $$begin raise exception 'fixture dispatch storage unavailable'; end;$$;
      create trigger fixture_reject before insert on background_jobs for each row execute function reject_export_job();`);
    const before=await row(db),key=randomUUID();await assert.rejects(start(db,key),/fixture dispatch storage unavailable/);
    assert.deepEqual(await row(db),before);assert.equal((await db.query('select count(*)::int n from video_render_jobs')).rows[0].n,0);
    await db.exec('drop trigger fixture_reject on background_jobs');assert.equal((await start(db,key)).replayed,false);
  }finally{await db.close();}
});
test('removed outputs/projects/sources are never resurrected and non-MCP website completion is unaffected',async()=>{
  const db=await setup();try{
    const first=(await start(db)).receipt;await complete(db,first);
    await db.query('update media_assets set deleted_at=now() where id=$1',[first.output_asset_id]);await complete(db,first);
    assert.ok((await db.query('select deleted_at from media_assets where id=$1',[first.output_asset_id])).rows[0].deleted_at);
    const second=(await start(db)).receipt;await db.query('update editable_videos set deleted_at=now() where id=$1',[id(2)]);
    await complete(db,second);assert.equal((await db.query('select count(*)::int n from media_assets where id=$1',[second.output_asset_id])).rows[0].n,0);
    await db.query('update editable_videos set deleted_at=null where id=$1',[id(2)]);
    const third=(await start(db)).receipt;await db.query('update media_assets set deleted_at=now() where id=$1',[id(1)]);
    await complete(db,third);assert.equal((await db.query('select count(*)::int n from media_assets where id=$1',[third.output_asset_id])).rows[0].n,0);
    const legacy=id(91);await db.query('select edit_queue_render_snapshot($1,$2,$3,$4)',['owner-a',id(2),legacy,draft('legacy website')]);
    await complete(db,{render_id:legacy});assert.equal((await db.query("select count(*)::int n from media_assets where source_record_id=$1",[legacy])).rows[0].n,0);
  }finally{await db.close();}
});
test('unmodified sources and all ratios use the existing renderer dimensions; new persistence is service-only',async()=>{
  const db=await setup();try{
    const dimensions={'9:16':[1080,1920],'1:1':[1080,1080],'4:5':[1080,1350],'16:9':[1920,1080]};
    await db.query('update editable_videos set draft_json=null where id=$1',[id(2)]);
    for(const [ratio,[width,height]]of Object.entries(dimensions)){
      await db.query('update editable_videos set ratio=$2 where id=$1',[id(2),ratio]);
      const r=(await start(db,randomUUID(),{revision:1,stored:null,render:{trimStartSeconds:0,trimEndSeconds:null,textOverlays:[]}})).receipt;
      await complete(db,r);const a=(await db.query('select * from media_assets where id=$1',[r.output_asset_id])).rows[0];
      assert.equal(a.width,width);assert.equal(a.height,height);assert.equal(Number(a.duration_seconds),10);
      assert.equal((await row(db)).draft_json,null);assert.equal(Number((await row(db)).draft_revision),1);
    }
    for(const name of ['edit_start_export','edit_export_register_output']){
      const p=(await db.query(`select prosecdef,has_function_privilege('anon',oid,'execute') anon,
        has_function_privilege('authenticated',oid,'execute') authenticated,has_function_privilege('service_role',oid,'execute') service from pg_proc where proname=$1`,[name])).rows[0];
      assert.deepEqual(p,{prosecdef:false,anon:false,authenticated:false,service:true});
    }
    assert.equal((await db.query("select relrowsecurity rls from pg_class where oid='edit_export_requests'::regclass")).rows[0].rls,true);
    await db.exec('set role service_role');assert.equal((await start(db,randomUUID(),{revision:1,stored:null,render:{trimStartSeconds:0,trimEndSeconds:null,textOverlays:[]}})).replayed,false);
  }finally{await db.close();}
});
