import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import test, { before, after } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
before(async () => {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;');
  const root = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(root)).filter(f => f.endsWith('.sql')).sort()) {
    try { await db.exec((await readFile(new URL(file, root), 'utf8')).replace(/\r\n/g, '\n')); }
    catch (error) { throw new Error(`Migration ${file}: ${error.message}`); }
  }
}, { timeout: 120000 });
after(() => db.close());
async function one(sql, params = []) { return (await db.query(sql, params)).rows[0]; }
async function fixture(mode = 'enabled', fallback = false) {
  const user = `hooks-test-${randomUUID()}`;
  const profile = await one("insert into business_profiles(user_id,intake_type,context_json,content_hash) values($1,'manual','{}','test') returning *", [user]);
  const batch = await one(`insert into carousel_experiment_batches(business_profile_id,business_profile_version,generation_batch_id,
    batch_sequence,structure_id,structure_batch_sequence,requested_structure_id,requested_structure_version,requested_structure_batch_sequence,
    structure_resolution_mode,structure_planning_attempt_count,structure_fallback_reason,structure_resolved_at)
    values($1,1,$2,0,'structure_2',0,$3,1,0,$4,$5,$6,$7) returning *`, [profile.id, randomUUID(),
      fallback ? 'structure_1' : 'structure_2', fallback ? 'planning_fallback' : 'requested', fallback ? 2 : 0,
      fallback ? 'test_planning_failure' : null, fallback ? new Date().toISOString() : null]);
  if (mode !== null) await one('select snapshot_carousel_hook_template_mode($1,$2)', [batch.id, mode]);
  const choices = [];
  for (let slot = 0; slot < 5; slot++) {
    const assignment = await one(`insert into carousel_experiment_assignments(experiment_batch_id,slot_index,assigned_format_id,actual_format_id,
      rotation_candidate_format_id,format_version,structure_id,hook_selection_mode,hook_selection_multiplier)
      values($1,$2,'wrong_belief','wrong_belief','wrong_belief',1,'structure_2',null,null) returning *`, [batch.id, slot]);
    const generation = await one(`insert into carousel_generations(user_id,project_id,business_profile_id,business_profile_version,generation_batch_id,
      candidate_index,candidate_count,carousel_experiment_batch_id,carousel_experiment_assignment_id,structure_id,content_format_id,content_assigned_format_id,
      content_grammar_version,content_selector_version) values($1,'default-project',$2,1,$3,$4,5,$5,$6,'structure_2','wrong_belief','wrong_belief','test','test') returning *`,
      [user,profile.id,batch.generation_batch_id,slot,batch.id,assignment.id]);
    await db.query('update carousel_experiment_assignments set carousel_generation_id=$1 where id=$2', [generation.id, assignment.id]);
    choices.push({ slot_index: slot, story_format_id: 'wrong_belief', hook_template_id: mode === 'enabled' ? 'the_real_reason' : null,
      hook_template_version: mode === 'enabled' ? 1 : null, proposed_template_id: mode === 'shadow' ? 'the_real_reason' : null });
  }
  return { batch, profile, choices };
}
async function resolve(f, mode = 'enabled', choices = f.choices) {
  return one('select resolve_carousel_structure_2_hooks($1,$2,$3) result', [f.batch.id, mode, choices]);
}
async function pairs(f) {
  return (await db.query(`select a.hook_template_id aid,g.hook_template_id gid,a.hook_template_version av,g.hook_template_version gv
    from carousel_experiment_assignments a join carousel_generations g on g.id=a.carousel_generation_id
    where a.experiment_batch_id=$1 order by a.slot_index`, [f.batch.id])).rows;
}

test('enabled hooks commit five matching pairs and retries cannot reroll them', async () => {
  const f = await fixture();
  await db.exec('set role service_role');
  try { await resolve(f); } finally { await db.exec('reset role'); }
  assert.equal((await pairs(f)).length, 5);
  assert.ok((await pairs(f)).every(p => p.aid === 'the_real_reason' && p.gid === p.aid && p.av === 1 && p.gv === 1));
  const changed = f.choices.map(c => ({ ...c, hook_template_id: 'advice_to_ignore' }));
  assert.deepEqual((await resolve(f, 'enabled', changed)).result, f.choices);
  assert.ok((await pairs(f)).every(p => p.aid === 'the_real_reason'));
});
test('off, shadow and legacy resolutions retain null effective templates', async () => {
  for (const mode of ['off','shadow',null]) {
    const f = await fixture(mode);
    await resolve(f, mode ?? 'off');
    assert.ok((await pairs(f)).every(p => p.aid === null && p.gid === null && p.av === null && p.gv === null));
  }
});
test('bad slot, format, mode and output identities fail atomically', async () => {
  const f = await fixture();
  await assert.rejects(resolve(f,'shadow'), /hook_mode_mismatch/);
  await assert.rejects(resolve(f,'enabled',f.choices.slice(1)), /five_slots/);
  await assert.rejects(resolve(f,'enabled',f.choices.map(c => ({ ...c, slot_index: 0 }))), /duplicate_hook_slots/);
  await assert.rejects(resolve(f,'enabled',f.choices.map(c => ({ ...c, story_format_id: 'wrong_villain' }))), /identity_or_output/);
  await db.query("update carousel_generations set content_plan_normalized='{}' where carousel_experiment_batch_id=$1 and candidate_index=4", [f.batch.id]);
  await assert.rejects(resolve(f), /identity_or_output/);
  assert.ok((await pairs(f)).every(p => p.aid === null && p.gid === null));
  assert.equal((await one('select structure_2_hook_templates_resolved_at marker from carousel_experiment_batches where id=$1',[f.batch.id])).marker,null);
});
test('mode snapshot is retry-stable and dispatched legacy batches stay off', async () => {
  const f = await fixture();
  assert.equal((await one("select snapshot_carousel_hook_template_mode($1,'off') mode",[f.batch.id])).mode,'enabled');
  const legacy = await fixture(null);
  await db.query("update carousel_experiment_batches set status='queued' where id=$1",[legacy.batch.id]);
  assert.equal((await one("select snapshot_carousel_hook_template_mode($1,'enabled') mode",[legacy.batch.id])).mode,'off');
});
test('resolved takeover batches receive Structure 2 choices and stale profiles are rejected', async () => {
  const f = await fixture('enabled', true);
  await resolve(f);
  assert.ok((await pairs(f)).every(p => p.aid === 'the_real_reason'));
  const stale = await fixture();
  await db.query('update business_profiles set profile_version=2 where id=$1',[stale.profile.id]);
  await assert.rejects(resolve(stale), /identity_or_output/);
  assert.ok((await pairs(stale)).every(p => p.aid === null && p.gid === null));
});
test('RPCs are invoker-only and unavailable to browser roles', async () => {
  for (const signature of ['snapshot_carousel_hook_template_mode(uuid,text)','resolve_carousel_structure_2_hooks(uuid,text,jsonb)']) {
    for (const role of ['anon','authenticated']) {
      assert.equal((await one('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,signature])).allowed,false);
    }
    assert.equal((await one('select has_function_privilege(\'service_role\',$1,\'EXECUTE\') allowed',[signature])).allowed,true);
    assert.equal((await one('select prosecdef from pg_proc where oid=$1::regprocedure',[signature])).prosecdef,false);
  }
});
