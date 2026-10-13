import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {buildManualBusinessAnalysis,applyPrimaryGoals} from "../lib/business-profiles/schema.ts";
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
export const context=buildManualBusinessAnalysis({businessName:"Fixture product",category:"writing",mainProblem:"Slow manual planning",productSummary:"Organizes selected ideas into editable plans.",targetAudience:"Small business owners",valueProps:"Save a reusable content plan"});
export const hash=(analysis,intakeType="manual")=>createHash("sha256").update(JSON.stringify({analysis,intakeType})).digest("hex");
export function input(state,next=context,source=null){return {expected_revision:state.profile.context_revision,expected_profile_version:state.profile.active_profile_version,expected_draft_updated_at:state.profile.draft?.updated_at??null,context:next,...(source===undefined?{}:{source})};}
export function applyInput(state,next=context){const {source,...intent}=input(state,next);return intent;}
export async function fixture(){
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;alter default privileges in schema public grant all on tables to service_role;create table public.website_analyses(id uuid primary key);create table public.business_onboarding_drafts(id uuid primary key,user_id text unique);");
  const baseline=await readFile(new URL('../supabase/migrations/20260829093001_production_baseline_v1.sql',import.meta.url),'utf8');
  const table=baseline.match(/CREATE TABLE "public"\."business_profiles" \([\s\S]*?\n\);/);if(!table)throw Error('Canonical profile table absent');await db.exec(table[0]);
  for(const file of ['20260914123000_add_business_context_settings_drafts.sql','20260915160000_apply_business_context_directly.sql','20261013112752_mcp_business_context.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const onboarding=await readFile(new URL('../supabase/migrations/20260909165333_add_background_business_onboarding.sql',import.meta.url),'utf8');
  const trigger=onboarding.match(/create trigger guard_background_onboarding_profile[\s\S]*?;/);if(!trigger)throw Error('Canonical onboarding guard absent');await db.exec(trigger[0]);
  return {db,read:async owner=>(await db.query('select public.mcp_read_business_context($1) result',[owner])).rows[0].result,
   seed:async(owner='owner-a')=>{const normalized=applyPrimaryGoals(context,['increase_signups']);await db.query("insert into public.business_profiles(user_id,intake_type,context_json,content_hash,onboarding_status,onboarding_version,onboarding_completed_at,onboarding_step,primary_goals) values($1,'manual',$2::jsonb,$3,'completed',3,now(),3,array['increase_signups'])",[owner,JSON.stringify(normalized),hash(normalized)]);},
   mutate:async(owner,key,operation,raw,execution=applyPrimaryGoals(raw.context,['increase_signups']))=>(await db.query('select public.mcp_mutate_business_context($1,$2,$3,$4::jsonb,$5::jsonb,$6) result',[owner,key,operation,JSON.stringify(raw),JSON.stringify(execution),hash(execution)])).rows[0].result};
 }catch(error){await db.close();throw error;}
}
