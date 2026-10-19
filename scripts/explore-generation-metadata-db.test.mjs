import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('new generated sound/operation metadata is owned and persistent; legacy provenance and unrelated assets remain unchanged', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create table background_jobs(id text,user_id text,input_json jsonb);
      create table media_assets(id text,user_id text,source_type text,source_record_id text,metadata jsonb);`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261019173229_explore_generation_operation_sound.sql', import.meta.url),'utf8'));
    await db.exec(`create trigger tag before insert or update on media_assets for each row execute function explore_tag_generated_media();
      insert into background_jobs values ('new','owner','{"exploreFormat":"hook","exploreGeneration":{"version":1,"operation":"source_edit","sound":"off"}}'),
        ('old','owner','{"exploreFormat":"hook"}');
      insert into media_assets values ('a','owner','generated_video','new','{"kept":true}'),('b','other','generated_video','new','{}'),('c','owner','generated_video','old','{}'),('d','owner','upload','new','{}');`);
    const rows = (await db.query('select * from media_assets order by id')).rows;
    assert.deepEqual(rows[0].metadata, { kept:true, exploreFormat:'hook', exploreGeneration:{version:1,operation:'source_edit',sound:'off'} });
    assert.deepEqual(rows[1].metadata, {}); assert.deepEqual(rows[2].metadata, {exploreFormat:'hook'}); assert.deepEqual(rows[3].metadata, {});
    await db.exec(`update media_assets set metadata=metadata||'{"openedAgain":true}' where id='a';`);
    assert.equal((await db.query("select metadata from media_assets where id='a'")).rows[0].metadata.exploreGeneration.sound,'off');
  } finally { await db.close(); }
});
