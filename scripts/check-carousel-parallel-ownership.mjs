import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Explicit production canary: synthetic owners only; no Cloud Tasks/provider calls.
if (!process.argv.includes('--execute')) {
  console.log('Use --execute to test duplicate and independent ownership/claims using an isolated pre-seeded fixture; cancel its jobs and require management cleanup before scaling.');
  process.exit(0);
}
process.loadEnvFile('.env.local');
const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const user = process.argv[process.argv.indexOf('--fixture-user') + 1];
assert.match(user || '', /^carousel-capacity-canary-[a-f0-9-]{36}$/);
async function checked(query) { const { data, error } = await query; if (error) throw new Error(error.message); return data; }
const profiles = await checked(db.from('business_profiles').select('id,project_id').eq('user_id', user));
assert.equal(profiles.length, 1);
const profileId = profiles[0].id, project = profiles[0].project_id;
const batchRows = await checked(db.from('carousel_experiment_batches').select('id,batch_sequence,planner_job_id').eq('business_profile_id', profileId).order('batch_sequence'));
const generationRows = await checked(db.from('carousel_generations').select('id,content_plan_item_id,carousel_experiment_batch_id,candidate_index').eq('user_id', user).order('candidate_index'));
assert.equal(batchRows.length, 11);
assert.equal(generationRows.length, 55);
assert.ok(batchRows.every(b => b.planner_job_id === null));
const batches = batchRows.map((b, index) => ({ id: b.id, index, generations: generationRows.filter(g => g.carousel_experiment_batch_id === b.id).map(g => ({id:g.id,item:g.content_plan_item_id})) }));
assert.ok(batches.every(b => b.generations.length === 5));
const expires = new Date(Date.now() + 3600000).toISOString();
async function own(batch) {
  const rows = await checked(db.rpc('create_or_get_carousel_experiment_batch_job', {
    p_user_id: user, p_project_id: project, p_experiment_batch_id: batch.id,
    p_carousel_ids: batch.generations.map(g => g.id), p_text_style: 'plain',
  }));
  assert.equal(rows.length, 1);
  return rows[0];
}
let report;
try {
  const duplicates = await Promise.all(Array.from({ length: 10 }, () => own(batches[0])));
  assert.equal(new Set(duplicates.map(r => r.job_id)).size, 1);
  assert.equal(duplicates.filter(r => r.created).length, 1);
  const independent = await Promise.all(batches.slice(1).map(own));
  assert.equal(new Set(independent.map(r => r.job_id)).size, 10);
  assert.ok(independent.every(r => r.created));
  const jobs = [duplicates[0], ...independent];
  // Keep synthetic jobs out of normal recovery while verifying their rows.
  await checked(db.from('background_jobs').update({ next_attempt_at: expires }).eq('user_id', user));
  const rows = await checked(db.from('carousel_generations').select('id,trigger_run_id,carousel_experiment_batch_id,content_plan_item_id').eq('user_id', user));
  const items = await checked(db.from('carousel_content_plan_items').select('id,reserved_by_job_id').eq('user_id', user));
  for (const batch of batches) {
    const job = jobs[batch.index].job_id;
    assert.equal(rows.filter(r => r.carousel_experiment_batch_id === batch.id).length, 5);
    for (const generation of batch.generations) {
      assert.equal(rows.find(r => r.id === generation.id)?.trigger_run_id, job);
      assert.equal(items.find(r => r.id === generation.item)?.reserved_by_job_id, job);
    }
  }
  await checked(db.from('background_jobs').update({ next_attempt_at: null }).eq('id', jobs[0].job_id).eq('user_id', user));
  const claims = await Promise.all(Array.from({ length: 10 }, (_, i) => checked(db.rpc('claim_background_job', {
    p_job_id: jobs[0].job_id, p_worker_id: `capacity-canary-${i}`, p_claim_token: randomUUID(), p_stale_after_seconds: 900,
  }))));
  assert.equal(claims.filter(r => r.length === 1).length, 1);
  assert.equal(claims.reduce((n, r) => n + r.length, 0), 1);
  report = { result: 'passed', checkedAt: new Date().toISOString(), duplicateCalls: 10, duplicateJobsCreated: 1,
    independentBatches: 10, independentJobsCreated: 10, generationsCorrectlyOwned: 55, claimCalls: 10, successfulClaims: 1,
    providerCalls: 0, taskDeliveries: 0 };
} finally {
  // Exact synthetic scope; never remove rows belonging to a real account.
  assert.ok(user.startsWith('carousel-capacity-canary-'));
  await checked(db.from('background_jobs').update({ status: 'cancelled', stage: 'cancelled', completed_at: new Date().toISOString(),
    error_code: 'CANARY_CANCELLED', error_message: 'Synthetic capacity canary; never dispatched.' }).eq('user_id', user));
  // Production table DELETE is intentionally unavailable to service_role.
  // The operator removes this exact synthetic fixture through the database
  // management connection and verifies zero remaining rows before scaling.
  writeFileSync('.codex-audits/carousel-parallel-fixture-cleanup.json', JSON.stringify({user,profileId,cleanupRequired:true}));
}
report.fixtureUser = user;
report.cleanupVerified = false;
writeFileSync('.codex-audits/carousel-parallel-ownership-canary.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
