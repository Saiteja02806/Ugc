import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {PGlite} from "@electric-sql/pglite";
import {fixture} from "./mcp-creative-groups-fixture.mjs";
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
test("canonical group creation/replay preserves membership/media and binds exact owner intent",async()=>{
 const{db,snapshot,mutate,create}=await fixture();try{
 const a=await create();assert.equal(a.replayed,false);assert.equal(a.receipt.state.group.name,"My group");assert.equal(a.receipt.state.member_count,0);assert.match(a.receipt.state.revision,/^[a-f0-9]{64}$/);
 assert.equal((await create()).replayed,true);await assert.rejects(create("owner-a",id(1),"Changed"),/group_request_conflict/);
 assert.equal(await snapshot("owner-b",id(1)),null);await assert.rejects(create("owner-b",id(1)),/group_id_conflict/);
 assert.equal(await snapshot("owner-a",null),null);
 const receiptCount=(await db.query("select count(*) from public.mcp_creative_group_requests")).rows[0].count;assert.equal(Number(receiptCount),1);
 assert.equal(Number((await db.query("select count(*) from public.media_assets")).rows[0].count),6);
 await assert.rejects(mutate("",id(2),"create",{name:"x",media_type:"image"}),/invalid_group_request/);
 }finally{await db.close();}
});
test("revision tracks website rename AND membership changes; stale writes cannot replace them",async()=>{
 const{db,snapshot,mutate,create,intent}=await fixture();try{
 await create();const old=await intent(id(1),{name:"Agent rename"});
 await db.query("update public.creative_asset_groups set name='Website rename' where id=$1",[id(1)]);
 await assert.rejects(mutate("owner-a",id(2),"rename",old),/group_revision_conflict/);
 const before=await snapshot("owner-a",id(1));await db.query("insert into public.creative_asset_group_items(user_id,group_id,media_asset_id) values('owner-a',$1,$2)",[id(1),id(100)]);
 const after=await snapshot("owner-a",id(1));assert.notEqual(before.revision,after.revision);assert.equal(after.member_count,1);
 await assert.rejects(mutate("owner-a",id(3),"add",{group_id:id(1),expected_revision:before.revision,asset_ids:[id(101)]}),/group_revision_conflict/);
 await db.query("delete from public.creative_asset_group_items where group_id=$1",[id(1)]);assert.notEqual((await snapshot("owner-a",id(1))).revision,after.revision);
 assert.equal(Number((await db.query("select count(*) from public.mcp_creative_group_requests")).rows[0].count),1);
 }finally{await db.close();}
});
test("whole membership batches reject foreign, wrong-type, hidden, missing and unready assets atomically",async()=>{
 const{db,snapshot,mutate,create,intent}=await fixture();try{
 await create();for(const bad of [102,103,104,105,999]){
 await assert.rejects(mutate("owner-a",id(10+bad),"add",await intent(id(1),{asset_ids:[id(100),id(bad)]})),/group_asset_unavailable/);
 assert.equal((await snapshot("owner-a",id(1))).member_count,0);
 }
 await db.query("update public.media_assets set deleted_at=now() where id=$1",[id(101)]);
 await assert.rejects(mutate("owner-a",id(9),"add",await intent(id(1),{asset_ids:[id(101)]})),/group_asset_unavailable/);
 await assert.rejects(mutate("owner-a",id(8),"add",await intent(id(1),{asset_ids:[id(100),id(100)]})),/invalid_group_request/);
 await assert.rejects(mutate("owner-a",id(7),"rename",{...(await intent(id(1))),name:"Valid",user_id:"owner-b"}),/invalid_group_request/);
 assert.equal(Number((await db.query("select count(*) from public.mcp_creative_group_requests")).rows[0].count),1);
 }finally{await db.close();}
});
test("accepted membership intent replays after later website changes without reapplying or deleting media",async()=>{
 const{db,snapshot,mutate,create,intent}=await fixture();try{
 await create();const args=await intent(id(1),{asset_ids:[id(100),id(101)]});
 const added=await mutate("owner-a",id(2),"add",args);assert.equal(added.receipt.changed_count,2);
 const reversed=await mutate("owner-a",id(2),"add",{...args,asset_ids:[id(101),id(100)]});assert.equal(reversed.replayed,true);assert.deepEqual(reversed.receipt,added.receipt);
 await db.query("delete from public.creative_asset_group_items where group_id=$1 and media_asset_id=$2",[id(1),id(100)]);
 assert.equal((await mutate("owner-a",id(2),"add",args)).replayed,true);assert.equal((await snapshot("owner-a",id(1))).member_count,1);
 const removed=await mutate("owner-a",id(3),"remove",await intent(id(1),{asset_ids:[id(101)]}));assert.equal(removed.receipt.changed_count,1);
 const deleted=await mutate("owner-a",id(4),"delete",await intent(id(1)));assert.equal(deleted.receipt.group_exists,false);assert.equal(deleted.receipt.state,null);
 assert.equal(await snapshot("owner-a",id(1)),null);assert.equal((await mutate("owner-a",id(4),"delete",{group_id:id(1),expected_revision:removed.receipt.state.revision})).replayed,true);
 assert.equal(Number((await db.query("select count(*) from public.media_assets")).rows[0].count),6);
 }finally{await db.close();}
});
test("failed receipt persistence rolls back group mutations; matching overlapping requests create once",async()=>{
 const{db,create}=await fixture();try{
 await db.exec("reset role; create function public.fixture_receipt_failure() returns trigger language plpgsql as $$begin raise exception 'fixture_receipt_failure'; end;$$; create trigger fixture_receipt_failure before insert on public.mcp_creative_group_requests for each row execute function public.fixture_receipt_failure(); set role service_role;");
 await assert.rejects(create(),/fixture_receipt_failure/);assert.equal(Number((await db.query("select count(*) from public.creative_asset_groups")).rows[0].count),0);
 await db.exec("reset role; drop trigger fixture_receipt_failure on public.mcp_creative_group_requests; set role service_role");
 const results=await Promise.all([create(),create()]);assert.equal(results.filter(r=>r.replayed).length,1);assert.equal(Number((await db.query("select count(*) from public.creative_asset_groups")).rows[0].count),1);
 }finally{await db.close();}
});
test("new receipt/snapshot/mutation surface remains service-only invoker with empty search paths",async()=>{
 const{db,create,snapshot}=await fixture();try{
 await create();await db.exec("reset role");
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.mcp_creative_group_requests'::regclass")).rows[0].relrowsecurity,true);
 const functions=(await db.query("select prosecdef,proconfig from pg_proc where proname in ('mcp_read_creative_asset_group','mcp_mutate_creative_asset_group')")).rows;
 assert.equal(functions.length,2);assert.ok(functions.every(f=>!f.prosecdef&&f.proconfig.includes('search_path=\"\"')));
 for(const role of ["anon","authenticated"]){await db.exec(`set role ${role}`);await assert.rejects(snapshot("owner-a",id(1)),/permission denied/);await assert.rejects(create(),/permission denied/);await assert.rejects(db.query("select * from public.mcp_creative_group_requests"),/permission denied/);await db.exec("reset role");}
 await db.exec("set role service_role");await assert.rejects(db.exec("update public.mcp_creative_group_requests set operation='delete'"),/permission denied/);
 }finally{await db.close();}
});
