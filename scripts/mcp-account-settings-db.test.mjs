import assert from 'node:assert/strict';
import test from 'node:test';
import {fixture,id,promotionalPreferenceMigration} from './mcp-account-settings-fixture.mjs';
import {DEFAULT_PUBLISHING_PREFERENCES} from '../lib/scheduling/publishing-preferences.ts';
import {readFile} from 'node:fs/promises';
const patch=(state,preferences)=>({expected_revision:state.publishing_revision,preferences});

test('promotional disclosure defaults off for existing and new accounts and changes independently',async()=>{
 const h=await fixture({promotionalPreference:false});try{
   await h.db.query("insert into public.user_publishing_preferences(user_id,contains_synthetic_media,tiktok_allow_comments) values('existing-owner',false,false)");
   const legacy=await h.read('existing-owner');
   const input=patch(legacy,{youtubeMadeForKids:true});
   const receipt=await h.mutate('existing-owner',id(99),'publishing_preferences',input);
   await h.db.exec(await readFile(await promotionalPreferenceMigration(),'utf8'));
   assert.deepEqual((await h.db.query("select tiktok_brand_organic,contains_synthetic_media,tiktok_allow_comments from public.user_publishing_preferences where user_id='existing-owner'")).rows,[{tiktok_brand_organic:false,contains_synthetic_media:false,tiktok_allow_comments:false}]);
   assert.equal((await h.read('new-owner')).publishing_preferences.tiktokBrandOrganic,false);
   const state=await h.read('existing-owner');
   await h.mutate('existing-owner',id(1),'publishing_preferences',patch(state,{tiktokBrandOrganic:true}));
   const enabled=await h.read('existing-owner');
   assert.equal(enabled.publishing_preferences.tiktokBrandOrganic,true);
   assert.equal(enabled.publishing_preferences.containsSyntheticMedia,false);
   assert.equal((await h.read('new-owner')).publishing_preferences.tiktokBrandOrganic,false);
   await h.mutate('existing-owner',id(2),'publishing_preferences',patch(enabled,{containsSyntheticMedia:true}));
   const after=await h.read('existing-owner');assert.equal(after.publishing_preferences.tiktokBrandOrganic,true);
   await h.mutate('existing-owner',id(3),'publishing_preferences',patch(after,{tiktokBrandOrganic:false}));
   assert.equal((await h.read('existing-owner')).publishing_preferences.tiktokBrandOrganic,false);
   assert.deepEqual((await h.mutate('existing-owner',id(99),'publishing_preferences',input)).receipt,receipt.receipt,'historical receipts are not rewritten by the migration');
 }finally{await h.db.close();}
});

test('empty account reads are pure and use the application defaults without inserting rows',async()=>{
 const h=await fixture();try{
   const a=await h.read('owner-a'),b=await h.read('owner-b');assert.equal(a.timezone,null);assert.equal(a.timezone_initialized,false);assert.equal(a.publishing_preferences_saved,false);
   assert.deepEqual(a.publishing_preferences,DEFAULT_PUBLISHING_PREFERENCES);
   assert.notEqual(a.publishing_revision,b.publishing_revision);assert.notEqual(a.timezone_revision,b.timezone_revision);
   for(const table of ['user_timezone_preferences','user_publishing_preferences','mcp_account_settings_requests'])assert.equal(Number((await h.db.query(`select count(*) n from public.${table}`)).rows[0].n),0);
 }finally{await h.db.close();}
});

test('partial settings writes preserve all omitted website values and never mutate another owner',async()=>{
 const h=await fixture();try{
   await h.db.query("insert into public.user_publishing_preferences(user_id,tiktok_privacy_level,youtube_privacy_status,youtube_made_for_kids) values('owner-a','SELF_ONLY','private',true),('owner-b','MUTUAL_FOLLOW_FRIENDS','unlisted',false)");
   const before=await h.read('owner-a'),other=await h.read('owner-b');
   const receipt=await h.mutate('owner-a',id(1),'publishing_preferences',patch(before,{containsSyntheticMedia:false,tiktokAllowComments:false}));
   const after=await h.read('owner-a');assert.deepEqual(after.publishing_preferences,{...before.publishing_preferences,containsSyntheticMedia:false,tiktokAllowComments:false});
   assert.notEqual(after.publishing_revision,before.publishing_revision);assert.equal(after.timezone_revision,before.timezone_revision);assert.deepEqual(receipt.receipt.state,after);assert.equal(receipt.replayed,false);assert.deepEqual(await h.read('owner-b'),other);
 }finally{await h.db.close();}
});

test('lost acknowledgement replays the immutable historical result without reverting later website changes',async()=>{
 const h=await fixture();try{
   const before=await h.read('owner-a'),input=patch(before,{youtubePrivacyStatus:'private'});
   const original=await h.mutate('owner-a',id(1),'publishing_preferences',input);
   await h.db.query("update public.user_publishing_preferences set youtube_privacy_status='unlisted',updated_at=clock_timestamp() where user_id='owner-a'");
   const current=await h.read('owner-a'),replay=await h.mutate('owner-a',id(1),'publishing_preferences',input);
   assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,original.receipt);assert.deepEqual(await h.read('owner-a'),current);
   await assert.rejects(h.mutate('owner-a',id(1),'publishing_preferences',patch(before,{youtubePrivacyStatus:'public'})),/settings_request_conflict/);
   await assert.rejects(h.mutate('owner-a',id(2),'publishing_preferences',patch(before,{youtubePrivacyStatus:'public'})),/settings_revision_conflict/);
   assert.equal(Number((await h.db.query("select count(*) n from public.mcp_account_settings_requests where user_id='owner-a'")).rows[0].n),1);
 }finally{await h.db.close();}
});

test('invalid input and foreign/stale absent-row tokens rollback both settings and receipts',async()=>{
 const h=await fixture();try{
   const before=await h.read('owner-a'),foreign=await h.read('owner-b');
   for(const preferences of [{}, {containsSyntheticMedia:null},{containsSyntheticMedia:'false'},{youtubePrivacyStatus:'friends'},{tiktokPrivacyLevel:'public'},{unknown:true}])
     await assert.rejects(h.mutate('owner-a',id(1),'publishing_preferences',patch(before,preferences)),/invalid_settings_request/);
   await assert.rejects(h.mutate('owner-a',id(1),'publishing_preferences',patch(foreign,{youtubeMadeForKids:true})),/settings_revision_conflict/);
   await assert.rejects(h.mutate('owner-a',id(1),'initialize_timezone',{expected_revision:before.timezone_revision,timezone:'Mars/Nowhere'}),/invalid_settings_request/);
   await assert.rejects(h.mutate('owner-a',id(1),'publishing_preferences',{...patch(before,{youtubeMadeForKids:true}),user_id:'owner-b'}),/invalid_settings_request/);
   assert.deepEqual(await h.read('owner-a'),before);
   for(const table of ['user_publishing_preferences','user_timezone_preferences','mcp_account_settings_requests'])assert.equal(Number((await h.db.query(`select count(*) n from public.${table}`)).rows[0].n),0);
 }finally{await h.db.close();}
});

test('timezone initialization preserves the same initialize-once policy as the website',async()=>{
 const h=await fixture();try{
   const state=await h.read('owner-a');
   const first=await h.mutate('owner-a',id(1),'initialize_timezone',{expected_revision:state.timezone_revision,timezone:'Asia/Calcutta'});
   assert.equal(first.receipt.initialized,true);assert.equal(first.receipt.state.timezone,'Asia/Calcutta');assert.equal(first.receipt.state.publishing_revision,state.publishing_revision);
   const second=await h.mutate('owner-a',id(2),'initialize_timezone',{expected_revision:first.receipt.state.timezone_revision,timezone:'Europe/London'});
   assert.equal(second.receipt.initialized,false);assert.equal(second.receipt.state.timezone,'Asia/Calcutta');
   assert.equal((await h.db.query("select public.initialize_user_timezone('owner-a','UTC') value")).rows[0].value,'Asia/Calcutta');
   const fresh=await h.read('owner-b');await h.db.query("select public.initialize_user_timezone('owner-b','UTC')");
   await assert.rejects(h.mutate('owner-b',id(1),'initialize_timezone',{expected_revision:fresh.timezone_revision,timezone:'Europe/London'}),/settings_revision_conflict/);
 }finally{await h.db.close();}
});

test('receipts remain service-only append-only despite Supabase default ALL grants',async()=>{
 const h=await fixture();try{
   for(const role of ['anon','authenticated','service_role'])for(const permission of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
     assert.equal((await h.db.query("select has_table_privilege($1,'public.mcp_account_settings_requests',$2) allowed",[role,permission])).rows[0].allowed,role==='service_role'&&['SELECT','INSERT'].includes(permission));
   const funcs=(await h.db.query("select proname,prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated,has_function_privilege('service_role',oid,'EXECUTE') service from pg_proc where proname in ('mcp_account_settings_revision','mcp_read_account_settings','mcp_mutate_account_settings')")).rows;
   assert.equal(funcs.length,3);assert.ok(funcs.every(f=>!f.prosecdef&&f.proconfig.includes('search_path=""')&&!f.anon&&!f.authenticated&&f.service));
   assert.equal((await h.db.query("select relrowsecurity from pg_class where oid='public.mcp_account_settings_requests'::regclass")).rows[0].relrowsecurity,true);
   for(const role of ['anon','authenticated']){await h.db.exec(`set role ${role}`);await assert.rejects(h.read('owner-a'),/permission denied/);await h.db.exec('reset role');}
   const before=await h.read('owner-a');await h.db.exec('set role service_role');await h.mutate('owner-a',id(1),'publishing_preferences',patch(before,{youtubePrivacyStatus:'private'}));
   for(const sql of ["update public.mcp_account_settings_requests set result_json='{}'","delete from public.mcp_account_settings_requests","truncate public.mcp_account_settings_requests"])
     await assert.rejects(h.db.exec(sql),/permission denied/);
 }finally{await h.db.close();}
});
