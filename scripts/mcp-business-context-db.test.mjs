import assert from "node:assert/strict";
import test from "node:test";
import {fixture,id,context,input,applyInput,hash} from "./mcp-business-context-fixture.mjs";
import {applyPrimaryGoals} from "../lib/business-profiles/schema.ts";

test('pure missing-profile reads never initialize business setup',async()=>{
 const h=await fixture();try{assert.deepEqual(await h.read('missing'),{profile:null});for(const table of ['business_profiles','business_onboarding_drafts','mcp_business_context_requests'])assert.equal(Number((await h.db.query(`select count(*) n from public.${table}`)).rows[0].n),0);}finally{await h.db.close();}
});
test('shared draft save preserves active context/version and rejects website/foreign revision conflicts',async()=>{
 const h=await fixture();try{
  await h.seed();await h.seed('owner-b');const before=await h.read('owner-a'),other=await h.read('owner-b');
  const draft={...context,businessName:'Reviewed name'},saved=await h.mutate('owner-a',id(1),'save_draft',input(before,draft,'Source text'));
  const after=await h.read('owner-a');assert.equal(after.profile.active_profile_version,before.profile.active_profile_version);assert.deepEqual(after.profile.active_context,before.profile.active_context);assert.equal(after.profile.draft.context.businessName,'Reviewed name');assert.equal(after.profile.draft.base_profile_version,1);assert.equal(after.profile.draft.source,'Source text');assert.notEqual(after.profile.context_revision,before.profile.context_revision);assert.deepEqual(saved.receipt.state,after);assert.deepEqual(await h.read('owner-b'),other);
  await assert.rejects(h.mutate('owner-a',id(2),'save_draft',input(before,draft)),/revision_conflict/);
  await assert.rejects(h.mutate('owner-a',id(2),'save_draft',input(other,draft)),/revision_conflict/);
 }finally{await h.db.close();}
});
test('direct apply reuses atomic website promotion and onboarding guard without replacing pinned content',async()=>{
 const h=await fixture();try{
  await h.seed();await h.db.query("insert into public.business_onboarding_drafts values($1,'owner-a')",[id(90)]);
  await h.db.exec("create table public.fixture_pinned_content(profile_version integer,context_json jsonb);insert into public.fixture_pinned_content select profile_version,context_json from public.business_profiles");
  const before=await h.read('owner-a'),next={...context,businessName:'Approved new name'};
  const saved=await h.mutate('owner-a',id(1),'save_draft',input(before,next));
  const current=saved.receipt.state,accepted=await h.mutate('owner-a',id(2),'apply',applyInput(current,next));
  assert.equal(accepted.receipt.state.profile.active_profile_version,2);assert.equal(accepted.receipt.state.profile.active_context.businessName,'Approved new name');assert.equal(accepted.receipt.state.profile.draft,null);assert.equal(accepted.receipt.future_content_only,true);
  const row=(await h.db.query("select content_hash,primary_goals,onboarding_status from public.business_profiles where user_id='owner-a'")).rows[0];assert.equal(row.content_hash,hash(applyPrimaryGoals(next,['increase_signups'])));assert.deepEqual(row.primary_goals,['increase_signups']);assert.equal(row.onboarding_status,'completed');
  const pinned=(await h.db.query('select * from public.fixture_pinned_content')).rows[0];assert.equal(pinned.profile_version,1);assert.deepEqual(pinned.context_json,before.profile.active_context);
 }finally{await h.db.close();}
});
test('immutable replay never reapplies accepted context over later website changes',async()=>{
 const h=await fixture();try{
  await h.seed();const raw=applyInput(await h.read('owner-a'),{...context,businessName:'First'}),first=await h.mutate('owner-a',id(1),'apply',raw);
  const secondRaw=applyInput(await h.read('owner-a'),{...context,businessName:'Second'});await h.mutate('owner-a',id(2),'apply',secondRaw);
  const latest=await h.read('owner-a'),replay=await h.mutate('owner-a',id(1),'apply',raw);assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,first.receipt);assert.deepEqual(await h.read('owner-a'),latest);
  await assert.rejects(h.mutate('owner-a',id(1),'save_draft',{...raw,source:null}),/request_conflict/);
  await assert.rejects(h.mutate('owner-a',id(1),'apply',{...raw,context:context}),/request_conflict/);
  assert.equal(Number((await h.db.query('select count(*) n from public.mcp_business_context_requests')).rows[0].n),2);
 }finally{await h.db.close();}
});
test('invalid input and stale draft rollback settings and receipt together',async()=>{
 const h=await fixture();try{
  await h.seed();const before=await h.read('owner-a'),raw=input(before);
  await assert.rejects(h.mutate('owner-a',id(1),'save_draft',{...raw,user_id:'other'}),/invalid/);
  await assert.rejects(h.mutate('owner-a',id(1),'save_draft',{...raw,expected_revision:'bad'}),/invalid/);
  await assert.rejects(h.mutate('owner-a',id(1),'save_draft',raw,{...context,businessName:'Unbound execution'}),/invalid/);
  await h.db.query("update public.business_profiles set business_context_draft_json=$1::jsonb,business_context_draft_base_version=99,business_context_draft_updated_at=clock_timestamp() where user_id='owner-a'",[JSON.stringify(context)]);
  const stale=await h.read('owner-a');await assert.rejects(h.mutate('owner-a',id(1),'apply',applyInput(stale,context)),/draft_conflict/);assert.deepEqual(await h.read('owner-a'),stale);assert.equal(Number((await h.db.query('select count(*) n from public.mcp_business_context_requests')).rows[0].n),0);
 }finally{await h.db.close();}
});
test('receipt/RPC permissions defeat default grants and remain append-only service access',async()=>{
 const h=await fixture();try{
  await h.seed();for(const role of ['anon','authenticated','service_role'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal((await h.db.query("select has_table_privilege($1,'public.mcp_business_context_requests',$2) allowed",[role,privilege])).rows[0].allowed,role==='service_role'&&['SELECT','INSERT'].includes(privilege));
  const functions=(await h.db.query("select proname,prosecdef,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated,has_function_privilege('service_role',oid,'EXECUTE') service from pg_proc where proname in ('mcp_business_context_snapshot','mcp_read_business_context','mcp_mutate_business_context')")).rows;assert.equal(functions.length,3);assert.ok(functions.every(f=>!f.prosecdef&&!f.anon&&!f.authenticated&&f.service));
  assert.equal((await h.db.query("select relrowsecurity from pg_class where oid='public.mcp_business_context_requests'::regclass")).rows[0].relrowsecurity,true);
  const before=await h.read('owner-a');await h.db.exec('set role service_role');await h.mutate('owner-a',id(1),'save_draft',input(before));for(const sql of ["update public.mcp_business_context_requests set input_json='{}'",'delete from public.mcp_business_context_requests','truncate public.mcp_business_context_requests'])await assert.rejects(h.db.exec(sql),/permission denied/);
 }finally{await h.db.close();}
});
