import {readFile,readdir} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function promotionalPreferenceMigration(){
 const files=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(file=>/^\d+_tiktok_promotional_content_preference\.sql$/.test(file));
 if(files.length!==1)throw new Error('Expected one TikTok promotional preference migration.');
 return new URL('../supabase/migrations/'+files[0],import.meta.url);
}
export async function fixture({ promotionalPreference = true } = {}) {
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;
      alter default privileges in schema public grant all on tables to service_role;
      create table public.business_profiles(user_id text,trending_timezone text,updated_at timestamptz);`);
    // Production assigns the authoritative timestamp when applying a migration.
    // Resolve this contract by its unique name rather than an obsolete draft date.
    const promotionalFile=await promotionalPreferenceMigration();
    for(const file of ['20261003122024_account_timezone_preferences.sql','20261009204135_account_publishing_preferences.sql','20261012135300_expanded_account_publishing_defaults.sql','20261013090422_mcp_account_settings.sql',promotionalFile.pathname.split('/').at(-1)])
      if (promotionalPreference || !file.endsWith('_tiktok_promotional_content_preference.sql'))
        await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    return {db,read:async owner=>(await db.query('select public.mcp_read_account_settings($1) result',[owner])).rows[0].result,
      mutate:async(owner,key,op,input)=>(await db.query('select public.mcp_mutate_account_settings($1,$2,$3,$4::jsonb) result',[owner,key,op,JSON.stringify(input)])).rows[0].result};
  }catch(error){await db.close();throw error;}
}
