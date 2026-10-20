import assert from "node:assert/strict";
import test from "node:test";
import {fixture,id} from "./mcp-library-content-fixture.mjs";
test("canonical Library saves bind owner/source/destination and retain immutable replay after website replacement",async()=>{
 const h=await fixture();try{
 const args=await h.intent(),payload=h.payload(),accepted=await h.mutate('owner-a',id(1),'save_carousel',args,payload),key=accepted.receipt.item_id;
 assert.equal(accepted.replayed,false);assert.equal(accepted.receipt.created,true);assert.equal(accepted.receipt.state.item.slides.length,2);
 assert.equal(await h.state('owner-b',key),null);assert.equal(await h.source('owner-b',id(100)),null);
 const next={...payload,p_title:'Website later',p_slides:payload.p_slides.map(s=>({...s,headline:'Newer saved edit'}))};
 await h.db.query("select * from public.save_generated_carousel_library_item($1,$2,$3,$4,$5,$6,$7,$8)",[next.p_user_id,next.p_project_id,next.p_source_id,next.p_title,next.p_cover_url,next.p_thumbnail_url,next.p_metadata,next.p_slides]);
 const replay=await h.mutate('owner-a',id(1),'save_carousel',args,payload);assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,accepted.receipt);
 assert.equal((await h.state('owner-a',key)).item.title,'Website later');assert.equal((await h.state('owner-a',key)).item.slides[0].headline,'Newer saved edit');
 await assert.rejects(h.mutate('owner-a',id(1),'save_carousel',{...args,allow_recreate_removed:true},payload),/library_request_conflict/);
 await assert.rejects(h.mutate('owner-a',id(2),'save_carousel',args,payload),/library_revision_conflict/);
 }finally{await h.db.close();}
});
test("source revision includes slide output and latest edit status/revision, rejecting old approvals",async()=>{
 const h=await fixture();try{
 let args=await h.intent();await h.db.query("update public.carousel_slides set rendered_url='https://trusted.test/changed' where id=$1",[id(101)]);
 await assert.rejects(h.mutate('owner-a',id(1),'save_carousel',args,h.payload()),/library_source_conflict/);
 args=await h.intent();await h.db.query("insert into public.trending_creative_edits values($1,'owner-a',$2,'carousel',1,'queued',null)",[id(400),id(100)]);
 await assert.rejects(h.mutate('owner-a',id(2),'save_carousel',args,h.payload()),/library_source_conflict/);
 args=await h.intent();await h.db.query("update public.trending_creative_edits set revision=2,render_status='ready',render_output_json='{}'");
 await assert.rejects(h.mutate('owner-a',id(3),'save_carousel',args,h.payload()),/library_source_conflict/);
 assert.equal(Number((await h.db.query('select count(*) from public.library_items')).rows[0].count),0);
 }finally{await h.db.close();}
});
test("removal matches canonical metadata archive, preserves files/source, and blocks silent resurrection",async()=>{
 const h=await fixture();try{
 const save=await h.mutate('owner-a',id(1),'save_carousel',await h.intent(),h.payload()),key=save.receipt.item_id;
 const args={item_id:key,expected_revision:save.receipt.state.revision};
 await assert.rejects(h.mutate('owner-b',id(2),'remove',args,{}),/library_not_found/);
 await h.db.query("update public.library_carousel_slides set headline='Website edit' where library_item_id=$1",[key]);
 await assert.rejects(h.mutate('owner-a',id(2),'remove',args,{}),/library_revision_conflict/);
 const removed=await h.mutate('owner-a',id(2),'remove',{...args,expected_revision:(await h.state('owner-a',key)).revision},{});
 assert.equal(removed.receipt.state.status,'archived');assert.ok(removed.receipt.state.deleted_at);assert.equal(removed.receipt.state.item.slides.length,2);
 assert.equal(Number((await h.db.query('select count(*) from public.carousel_slides')).rows[0].count),4);
 await assert.rejects(h.mutate('owner-a',id(1),'save_carousel',await h.intent(),h.payload()),/library_request_conflict/);
 const current=await h.intent();await assert.rejects(h.mutate('owner-a',id(3),'save_carousel',current,h.payload()),/library_removed/);
 const recreated=await h.mutate('owner-a',id(3),'save_carousel',{...current,allow_recreate_removed:true},h.payload());assert.notEqual(recreated.receipt.item_id,key);
 assert.equal((await h.state('owner-a',key)).status,'archived');
 }finally{await h.db.close();}
});
test("slideshow adapter invokes actual idempotent owner/order transaction and cannot restore a removed save",async()=>{
 const h=await fixture();try{
 const input={version:2,requestKey:id(1),referenceId:null,slides:[301,302].map(n=>({referenceSlideId:String(n),mediaAssetId:id(n)}))};
 const payload={p_user_id:'owner-a',p_request_key:id(1),p_fingerprint:'a'.repeat(64),p_title:'My slideshow',p_metadata:{slideshowDraftVersion:2},p_slides:[301,302].map((n,index)=>({slideNumber:index+1,mediaAssetId:id(n),renderedUrl:`https://trusted.test/${id(n)}.png`}))};
 const save=await h.mutate('owner-a',id(1),'save_slideshow',input,payload);assert.equal(save.receipt.state.item.kind,'slideshow');assert.ok(save.receipt.state.item.slides.every(s=>s.carousel_generation_id===null));
 await h.db.query("update public.library_items set deleted_at=now(),status='archived' where id=$1",[save.receipt.item_id]);
 assert.equal((await h.mutate('owner-a',id(1),'save_slideshow',input,payload)).replayed,true);assert.ok((await h.state('owner-a',save.receipt.item_id)).deleted_at);
 await assert.rejects(h.mutate('owner-a',id(2),'save_slideshow',{...input,requestKey:id(2)},{...payload,p_request_key:id(2),p_slides:[payload.p_slides[0],{...payload.p_slides[1],mediaAssetId:id(303),renderedUrl:`https://trusted.test/${id(303)}.png`}]}),/explore_slideshow_asset_unavailable/);
 assert.equal(Number((await h.db.query('select count(*) from public.library_items')).rows[0].count),1);
 // A request previously accepted by the website is recovered as existing, not a new creation.
 const webPayload={...payload,p_request_key:id(2)};
 await h.db.query('select public.explore_save_slideshow($1,$2,$3,$4,$5,$6)',[webPayload.p_user_id,webPayload.p_request_key,webPayload.p_fingerprint,webPayload.p_title,webPayload.p_slides,webPayload.p_metadata]);
 const recovered=await h.mutate('owner-a',id(2),'save_slideshow',{...input,requestKey:id(2)},webPayload);assert.equal(recovered.receipt.created,false);

 }finally{await h.db.close();}
});
test("receipt insertion failure rolls back replacement/removal, concurrent fixture calls accept once",async()=>{
 const h=await fixture();try{
 const args=await h.intent();await h.db.exec("reset role;create function public.fixture_fail() returns trigger language plpgsql as $$begin raise exception 'fixture_failure';end;$$;create trigger fixture_fail before insert on public.mcp_library_requests for each row execute function public.fixture_fail();set role service_role;");
 await assert.rejects(h.mutate('owner-a',id(1),'save_carousel',args,h.payload()),/fixture_failure/);assert.equal(Number((await h.db.query('select count(*) from public.library_items')).rows[0].count),0);
 await h.db.exec('reset role;drop trigger fixture_fail on public.mcp_library_requests;set role service_role;');
 const results=await Promise.all([h.mutate('owner-a',id(1),'save_carousel',args,h.payload()),h.mutate('owner-a',id(1),'save_carousel',args,h.payload())]);assert.equal(results.filter(r=>r.replayed).length,1);
 }finally{await h.db.close();}
});
test("new Library functions/receipts remain service-only, invoker, RLS and empty-search-path",async()=>{
 const h=await fixture();try{
 await h.db.exec('reset role');
 const originals=(await h.db.query("select proname,md5(replace(pg_get_functiondef(oid),chr(13),'')) body_md5 from pg_proc where proname in ('save_generated_carousel_library_item','explore_save_slideshow') order by proname")).rows;
 assert.deepEqual(originals,[{proname:'explore_save_slideshow',body_md5:'93837afff509fe553d0b9eda030873e2'},{proname:'save_generated_carousel_library_item',body_md5:'d19bea6257ba42b62d429bc96df264fc'}]);
 const functions=(await h.db.query("select prosecdef,proconfig from pg_proc where proname in ('mcp_read_library_item','mcp_library_destination','mcp_library_source_revision','mcp_mutate_library')")).rows;
 assert.equal(functions.length,4);assert.ok(functions.every(f=>!f.prosecdef&&f.proconfig.includes('search_path=\"\"')));
 assert.equal((await h.db.query("select relrowsecurity from pg_class where oid='public.mcp_library_requests'::regclass")).rows[0].relrowsecurity,true);
 for(const role of ['anon','authenticated']){await h.db.exec(`set role ${role}`);await assert.rejects(h.state('owner-a',id(1)),/permission denied/);await assert.rejects(h.db.exec('select * from public.mcp_library_requests'),/permission denied/);await h.db.exec('reset role');}
 await h.db.exec('set role service_role');await assert.rejects(h.db.exec("update public.mcp_library_requests set operation='remove'"),/permission denied/);
 }finally{await h.db.close();}
});
