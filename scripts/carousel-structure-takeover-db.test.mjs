import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test, before, after } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
before(async () => {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;');
  const root = new URL('../supabase/migrations/', import.meta.url);
  const applied = new Set();
  for (const file of (await readdir(root)).filter(file => file.endsWith('.sql')).sort()) {
    const sql = (await readFile(new URL(file, root), 'utf8')).replace(/\r\n/g, '\n');
    if (applied.has(sql)) continue;
    applied.add(sql);
    try { await db.exec(sql); } catch (error) { throw new Error(`Migration ${file}: ${error.message}`); }
  }
}, { timeout: 120000 });
after(() => db.close());
async function one(sql, params = []) { return (await db.query(sql, params)).rows[0]; }
async function fixture() {
  const user = 'takeover-' + randomUUID();
  const profile = await one("insert into business_profiles(user_id,intake_type,context_json,content_hash) values($1,'manual','{}','test') returning *", [user]);
  const batch = await one(`insert into carousel_experiment_batches(business_profile_id,business_profile_version,generation_batch_id,
    batch_sequence,structure_id,structure_batch_sequence,cycle_number,cycle_batch_position)
    values($1,1,$2,0,'structure_1',0,1,0) returning *`, [profile.id, randomUUID()]);
  for (let slot = 0; slot < 5; slot++) {
    const assignment = await one(`insert into carousel_experiment_assignments(experiment_batch_id,slot_index,assigned_format_id,
      rotation_candidate_format_id,hook_family_id,hook_selection_mode,hook_selection_multiplier,format_version)
      values($1,$2,'pain_reframe','pain_reframe','pain_reframe','controlled_rotation',1,1) returning *`, [batch.id, slot]);
    const generation = await one(`insert into carousel_generations(user_id,project_id,business_profile_id,business_profile_version,
      generation_batch_id,candidate_index,candidate_count,carousel_experiment_batch_id,carousel_experiment_assignment_id)
      values($1,'default-project',$2,1,$3,$4,5,$5,$6) returning *`, [user, profile.id, batch.generation_batch_id, slot, batch.id, assignment.id]);
    await db.query('update carousel_experiment_assignments set carousel_generation_id=$1 where id=$2', [generation.id, assignment.id]);
  }
  return batch;
}
const takeover = (id, attempts = 2) => one('select * from take_over_carousel_experiment_batch_with_structure_2($1,$2,$3)', [id, 'planning validation failed', attempts]);

test('takeover changes all five pairs atomically, preserves IDs and requested structure, and is retry-stable', async () => {
  const batch = await fixture();
  const ids = (await db.query('select id from carousel_generations where carousel_experiment_batch_id=$1 order by id', [batch.id])).rows;
  const result = await takeover(batch.id);
  assert.equal(result.structure_id, 'structure_2');
  assert.equal(result.requested_structure_id, 'structure_1');
  assert.equal(result.structure_resolution_mode, 'planning_fallback');
  const pairs = (await db.query(`select a.structure_id as assignment_structure,g.structure_id as generation_structure,
    a.actual_format_id,g.content_format_id from carousel_experiment_assignments a
    join carousel_generations g on g.id=a.carousel_generation_id where a.experiment_batch_id=$1`, [batch.id])).rows;
  assert.equal(pairs.length, 5);
  assert(pairs.every(pair => pair.assignment_structure === 'structure_2' && pair.generation_structure === 'structure_2' && pair.actual_format_id === pair.content_format_id));
  assert.deepEqual((await db.query('select id from carousel_generations where carousel_experiment_batch_id=$1 order by id', [batch.id])).rows, ids);
  assert.deepEqual(await takeover(batch.id), result);
});

test('fallback refuses existing output and invalid attempts without rewriting any assignment', async () => {
  const batch = await fixture();
  await assert.rejects(takeover(batch.id, 1), /input_invalid/);
  await db.query("update carousel_generations set content_plan_normalized='{}' where carousel_experiment_batch_id=$1 and candidate_index=0", [batch.id]);
  await assert.rejects(takeover(batch.id), /has_generation_output/);
  const assignments = (await db.query('select structure_id from carousel_experiment_assignments where experiment_batch_id=$1', [batch.id])).rows;
  assert(assignments.every(row => row.structure_id === 'structure_1'));
});

test('replacement RPCs retain their security mode and service-only permissions', async () => {
  for (const signature of ['take_over_carousel_experiment_batch_with_structure_2(uuid,text,integer)',
    'reserve_carousel_role_assets_v2(uuid,uuid,text,jsonb,boolean)', 'carousel_role_asset_matches_category(category_image_assets,text)']) {
    for (const role of ['anon', 'authenticated']) assert.equal((await one('select has_function_privilege($1,$2,\'EXECUTE\') allowed', [role, signature])).allowed, false, signature + ':' + role);
    assert.equal((await one('select has_function_privilege(\'service_role\',$1,\'EXECUTE\') allowed', [signature])).allowed, true);
    assert.equal((await one('select prosecdef from pg_proc where oid=$1::regprocedure', [signature])).prosecdef, signature.startsWith('reserve_carousel_role_assets_v2'));
  }
});
