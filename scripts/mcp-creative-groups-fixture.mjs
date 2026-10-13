import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const baseline=await readFile(new URL("../supabase/migrations/20260829093001_production_baseline_v1.sql",import.meta.url),"utf8");
function section(name){const marker=`-- source: public/${name}.sql`;const start=baseline.indexOf(marker);assert.ok(start>=0,name);const end=baseline.indexOf("-- source:",start+marker.length);return baseline.slice(start,end<0?undefined:end);}
const migration=await readFile(new URL("../supabase/migrations/20261013072941_mcp_creative_asset_groups.sql",import.meta.url),"utf8");
export async function fixture(){
 const db=new PGlite();
 await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;");
 // Only media columns involved in metadata validation are isolated fixture data.
 // Actual group tables, constraints, owner/type triggers and grants are canonical production SQL.
 await db.exec("create table public.media_assets(id uuid primary key,user_id text not null,collection text not null,status text not null,deleted_at timestamptz,source_type text not null,metadata jsonb not null default '{}'); grant select,insert,update,delete,references on public.media_assets to service_role;");
 for(const name of ["functions/prepare_creative_asset_group","functions/validate_creative_asset_group_item","tables/creative_asset_groups","tables/creative_asset_group_items"])await db.exec(section(name));
 await db.exec(migration);await db.exec("set role service_role");
 await db.query("insert into public.media_assets(id,user_id,collection,status,source_type,metadata) values($1,'owner-a','image','ready','upload','{}'),($2,'owner-a','image','ready','generated_image','{}'),($3,'owner-b','image','ready','upload','{}'),($4,'owner-a','video','ready','upload','{}'),($5,'owner-a','image','processing','upload','{}'),($6,'owner-a','image','ready','upload','{\"libraryVisibility\":\"hook_videos_only\"}')",[id(100),id(101),id(102),id(103),id(104),id(105)]);
 const snapshot=async(owner,g)=>(await db.query("select public.mcp_read_creative_asset_group($1,$2) as result",[owner,g])).rows[0].result;
 const mutate=async(owner,key,operation,input)=>(await db.query("select public.mcp_mutate_creative_asset_group($1,$2,$3,$4) as result",[owner,key,operation,input])).rows[0].result;
 const create=async(owner="owner-a",key=id(1),name="My group",type="image")=>mutate(owner,key,"create",{name,media_type:type});
 const intent=async(g,extra={},owner="owner-a")=>({group_id:g,expected_revision:(await snapshot(owner,g)).revision,...extra});
 return{db,snapshot,mutate,create,intent};
}
