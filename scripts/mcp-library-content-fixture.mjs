import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const baseline=await readFile(new URL("../supabase/migrations/20260829093001_production_baseline_v1.sql",import.meta.url),"utf8");
function section(name){const marker=`-- source: public/${name}.sql`,a=baseline.indexOf(marker),b=baseline.indexOf("-- source:",a+marker.length);assert.ok(a>=0);return baseline.slice(a,b<0?undefined:b);}
const explore=await readFile(new URL("../supabase/migrations/20261008071155_explore_format_workflows.sql",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20261013072958_mcp_library_content.sql",import.meta.url),"utf8");
export async function fixture(){
 const db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;");
 // Isolate upstream fixture rows only. Library tables/FKs/RLS and both existing save RPCs are canonical production SQL.
 await db.exec("create table public.carousel_generations(id uuid primary key,user_id text,project_id text,status text,slide_count integer,updated_at timestamptz default now());create table public.carousel_slides(id uuid primary key,carousel_generation_id uuid references public.carousel_generations(id),slide_number int,status text,rendered_url text,headline text,updated_at timestamptz default now());create table public.trending_creative_edits(id uuid primary key,user_id text,creative_id uuid,format text,revision int,render_status text,render_output_json jsonb);create table public.media_assets(id uuid primary key,user_id text,collection text,status text,deleted_at timestamptz,url text);grant select,insert,update,delete on public.carousel_generations,public.carousel_slides,public.trending_creative_edits,public.media_assets to service_role;");
 await db.exec(section("tables/library_items"));await db.exec(section("tables/library_carousel_slides"));
 await db.exec(section("functions/save_generated_carousel_library_item"));
 await db.exec("alter table public.library_carousel_slides alter column carousel_generation_id drop not null;");
 await db.exec(explore.slice(explore.indexOf("create function public.explore_save_slideshow")));
 await db.exec(migration);await db.exec("set role service_role");
 await db.query("insert into public.carousel_generations(id,user_id,project_id,status,slide_count) values($1,'owner-a','project-a','completed',2),($2,'owner-b','project-b','completed',2)",[id(100),id(200)]);
 for(const n of [101,102,201,202])await db.query("insert into public.carousel_slides(id,carousel_generation_id,slide_number,status,rendered_url,headline) values($1,$2,$3,'ready',$4,'Original heading')",[id(n),id(n<200?100:200),n%100,`https://trusted.test/${id(n)}.png`]);
 for(const n of [301,302,303])await db.query("insert into public.media_assets(id,user_id,collection,status,url) values($1,$2,'image','ready',$3)",[id(n),n===303?'owner-b':'owner-a',`https://trusted.test/${id(n)}.png`]);
 const state=async(owner,key)=>(await db.query("select public.mcp_read_library_item($1,$2) value",[owner,key])).rows[0].value;
 const source=async(owner,key)=>(await db.query("select public.mcp_library_source_revision($1,$2) value",[owner,key])).rows[0].value;
 const destination=async(owner,key)=>(await db.query("select public.mcp_library_destination($1,$2) value",[owner,key])).rows[0].value;
 const mutate=async(owner,key,op,input,payload)=>(await db.query("select public.mcp_mutate_library($1,$2,$3,$4,$5) value",[owner,key,op,input,payload])).rows[0].value;
 const payload=()=>({p_user_id:'owner-a',p_source_id:id(100),p_project_id:'project-a',p_title:'My carousel',p_cover_url:`https://trusted.test/${id(101)}.png`,p_thumbnail_url:null,p_metadata:{},p_slides:[101,102].map((n,index)=>({carouselGenerationId:id(100),carouselSlideId:id(n),slideNumber:index+1,headline:'Original heading',renderedUrl:`https://trusted.test/${id(n)}.png`}))});
 const intent=async()=>({carousel_id:id(100),source_revision:await source('owner-a',id(100)),destination_revision:(await destination('owner-a',id(100))).revision,allow_recreate_removed:false});
 return {db,state,source,destination,mutate,payload,intent};
}
