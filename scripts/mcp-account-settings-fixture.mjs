import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function fixture() {
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;
      alter default privileges in schema public grant all on tables to service_role;
      create table public.business_profiles(user_id text,trending_timezone text,updated_at timestamptz);`);
    for(const file of ['20261003122024_account_timezone_preferences.sql','20261009204135_account_publishing_preferences.sql','20261012135300_expanded_account_publishing_defaults.sql','20261013090422_mcp_account_settings.sql'])
      await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    return {db,read:async owner=>(await db.query('select public.mcp_read_account_settings($1) result',[owner])).rows[0].result,
      mutate:async(owner,key,op,input)=>(await db.query('select public.mcp_mutate_account_settings($1,$2,$3,$4::jsonb) result',[owner,key,op,JSON.stringify(input)])).rows[0].result};
  }catch(error){await db.close();throw error;}
}
