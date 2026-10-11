import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const release = fileURLToPath(new URL('../', import.meta.url));
const baseline = readFileSync(`${release}/supabase/migrations/20260829093001_production_baseline_v1.sql`, 'utf8');
const quota = readFileSync(`${release}/supabase/migrations/20260928151747_mcp_upload_quota.sql`, 'utf8');
const candidate = readFileSync(new URL('../supabase/migrations/20261011150832_mcp_upload_recovery.sql', import.meta.url), 'utf8');
async function setup() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const start = baseline.indexOf('CREATE TABLE "public"."media_assets" (');
  assert.ok(start >= 0);
  await db.exec(baseline.slice(start, baseline.indexOf('\n);', start) + 3));
  await db.exec('alter table media_assets enable row level security; grant all on media_assets to service_role;');
  await db.exec(quota);
  await db.exec(candidate);
  return db;
}
const reserve = (db, owner, request, fingerprint = 'a'.repeat(64), asset = randomUUID()) => db.query(
  'select mcp_reserve_upload($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) as asset',
  [owner, request, fingerprint, asset, 'video', 'upload', 'tour.mp4', 1024, 'video/mp4',
    `media/${owner}/video/${asset}.mp4`, 'Tour', `https://example.test/${asset}`]);
test('lost-response replay preserves the media identity and consumes one quota slot', async () => {
  const db = await setup();
  try {
    await db.exec('set role service_role');
    const request = randomUUID();
    const first = (await reserve(db, 'owner-a', request)).rows[0].asset;
    const replay = (await reserve(db, 'owner-a', request)).rows[0].asset;
    assert.equal(first.id, replay.id); assert.equal(first.storage_key, replay.storage_key);
    assert.equal((await db.query('select count(*)::int as n from media_assets')).rows[0].n, 1);
    for (let i = 0; i < 4; i++) await reserve(db, 'owner-a', randomUUID());
    assert.equal((await reserve(db, 'owner-a', request)).rows[0].asset.id, first.id);
    await assert.rejects(reserve(db, 'owner-a', randomUUID()), /mcp_upload_quota_exceeded/);
  } finally { await db.close(); }
});
test('request IDs are owner-bound and changed inputs or deletion cannot resurrect a reservation', async () => {
  const db = await setup();
  try {
    const request = randomUUID(), first = (await reserve(db, 'owner-a', request)).rows[0].asset;
    assert.notEqual((await reserve(db, 'owner-b', request)).rows[0].asset.id, first.id);
    await assert.rejects(reserve(db, 'owner-a', request, 'b'.repeat(64)), /mcp_upload_request_conflict/);
    await db.query('update media_assets set deleted_at=now() where id=$1', [first.id]);
    await assert.rejects(reserve(db, 'owner-a', request), /mcp_upload_deleted/);
    assert.equal((await db.query('select count(*)::int as n from media_assets')).rows[0].n, 2);
  } finally { await db.close(); }
});
test('URL renewal retains identity and rejects foreign, deleted and ready assets', async () => {
  const db = await setup();
  try {
    const first = (await reserve(db, 'owner-a', randomUUID())).rows[0].asset;
    const lease = () => db.query('select mcp_lease_upload_url($1,$2) as asset', ['owner-a', first.id]);
    const renewed = (await lease()).rows[0].asset;
    assert.equal(renewed.id, first.id); assert.equal(renewed.storage_key, first.storage_key);
    assert.ok(Date.parse(renewed.metadata.mcpUploadUrlExpiresAt) > Date.now());
    await assert.rejects(db.query('select mcp_lease_upload_url($1,$2)', ['owner-b', first.id]), /mcp_upload_not_found/);
    await db.query("update media_assets set status='ready' where id=$1", [first.id]);
    await assert.rejects(lease(), /mcp_upload_already_confirmed/);
    await db.query("update media_assets set status='uploading',deleted_at=now() where id=$1", [first.id]);
    await assert.rejects(lease(), /mcp_upload_not_found/);
  } finally { await db.close(); }
});
test('new RPCs are invoker-only and public roles have no execute privilege', async () => {
  const db = await setup();
  try {
    const names = ['mcp_reserve_upload', 'mcp_lease_upload_url'];
    const rows = (await db.query(`select proname,prosecdef,
      has_function_privilege('anon',oid,'EXECUTE') as anon,
      has_function_privilege('authenticated',oid,'EXECUTE') as authenticated,
      has_function_privilege('service_role',oid,'EXECUTE') as service
      from pg_proc where proname=any($1) order by proname`, [names])).rows;
    assert.equal(rows.length, 2);
    for (const row of rows) assert.deepEqual([row.prosecdef,row.anon,row.authenticated,row.service], [false,false,false,true]);
  } finally { await db.close(); }
});
test('deleted-upload cleanup cannot remove a key while its renewable lease remains valid', async () => {
  const db = await setup();
  try {
    const asset = (await reserve(db, 'owner-a', randomUUID())).rows[0].asset;
    await db.query('select mcp_lease_upload_url($1,$2)', ['owner-a',asset.id]);
    await db.query("update media_assets set deleted_at=now()-interval '12 minutes' where id=$1", [asset.id]);
    const claim = () => db.query("select id from mcp_claim_deleted_upload_cleanup($1,$2,now()-interval '11 minutes',5)", ['owner-a',randomUUID()]);
    assert.equal((await claim()).rows.length,0);
    await db.query("update media_assets set metadata=metadata || jsonb_build_object('mcpUploadUrlExpiresAt',now()-interval '2 minutes') where id=$1", [asset.id]);
    assert.equal((await claim()).rows[0].id,asset.id);
  } finally { await db.close(); }
});
