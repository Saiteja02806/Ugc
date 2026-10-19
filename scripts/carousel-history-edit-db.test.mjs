import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('history revision migration permits existing owned carousel updates while preserving scope, revision and other formats', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table user_carousel_assignments(id text primary key,user_id text,carousel_id text,state text);
      create table user_hook_video_assignments(id text primary key,user_id text,hook_suggestion_id text,state text);
      create table user_wall_text_assignments(id text primary key,user_id text,wall_text_creative_id text,state text);
      create table media_assets(id text,user_id text,collection text,mime_type text,status text,deleted_at timestamptz);
      create table creative_asset_groups(id text,user_id text,media_type text);
      create table creative_asset_group_items(group_id text,user_id text,media_asset_id text);
      create table trending_creative_edits(id text primary key,user_id text,assignment_id text,creative_id text,format text,revision integer,updated_at timestamptz,source_selection_kind text,resolved_media_asset_id text,source_group_id text);
      insert into user_carousel_assignments values ('a','owner','c','pending'),('b','owner','new','completed_skipped');
      insert into user_hook_video_assignments values ('h','owner','h','active');
      insert into user_wall_text_assignments values ('w','owner','w','active');`);
    const baseline = readFileSync(new URL('../supabase/migrations/20260829093001_production_baseline_v1.sql', import.meta.url),'utf8').match(/CREATE OR REPLACE FUNCTION public\.validate_trending_creative_edit\(\)[\s\S]*?\$function\$;/)[0];
    await db.exec(baseline);
    await db.exec(`create trigger validate_edit before insert or update on trending_creative_edits for each row execute function validate_trending_creative_edit();
      insert into trending_creative_edits(id,user_id,assignment_id,creative_id,format,revision) values ('edit','owner','a','c','carousel',1),('hook','owner','h','h','hook_video',1),('wall','owner','w','w','wall_text',1);
      update user_carousel_assignments set state='completed_skipped' where id='a';`);
    await assert.rejects(db.exec("update trending_creative_edits set revision=2 where id='edit'"), /assignment_unavailable/);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261019061132_allow_existing_carousel_history_edits.sql', import.meta.url),'utf8'));
    for (const state of ['completed_skipped','completed_saved','completed_scheduled']) {
      await db.query("update user_carousel_assignments set state=$1 where id='a'",[state]);
      await db.exec("update trending_creative_edits set revision=revision+1 where id='edit'");
      assert.equal((await db.query("select state from user_carousel_assignments where id='a'")).rows[0].state,state);
    }
    for(const patch of ["user_id='foreign'","assignment_id='b'","creative_id='new'","format='hook_video'"]) await assert.rejects(db.exec(`update trending_creative_edits set ${patch} where id='edit'`),/scope_immutable/);
    await assert.rejects(db.exec("update trending_creative_edits set revision=1 where id='edit'"),/revision_regressed/);
    await assert.rejects(db.exec("insert into trending_creative_edits(id,user_id,assignment_id,creative_id,format,revision) values ('new','owner','b','new','carousel',1)"),/assignment_unavailable/);
    await db.exec("update user_carousel_assignments set state='superseded' where id='a'");
    await assert.rejects(db.exec("update trending_creative_edits set revision=revision+1 where id='edit'"),/assignment_unavailable/);
    for(const [table,id] of [['user_hook_video_assignments','hook'],['user_wall_text_assignments','wall']]) {
      await db.exec(`update ${table} set state='completed_skipped'`);
      await assert.rejects(db.exec(`update trending_creative_edits set revision=2 where id='${id}'`),/assignment_unavailable/);
    }
  } finally { await db.close(); }
});
