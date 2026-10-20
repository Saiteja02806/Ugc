import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('refreshing a canonical source retains explicit reviewed extra categories without restoring old rendition metadata', () => {
  const source = readFileSync(new URL('./reconcile-carousel-role-library.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function buildPlan(params) {');
  const end = source.indexOf('async function loadRemoteRoleAssets()', start);
  const buildPlan = new Function('isPreservedCarouselRoleAssetRetirement', 'getRemoteSourcePath', 'matchesAnyPrefix', 'assertRemoteIdentity',
    `${source.slice(start, end)}; return buildPlan;`)(() => false, row => row.source_metadata.sourceRelativePath,
    (path, prefixes) => prefixes.some(prefix => path.startsWith(prefix)), () => undefined);
  const plan = buildPlan({
    desiredAssets: [{ libraryAssetId: 'canonical', source: { relativePath: 'gym/source.jpg' },
      dbRow: { source_file_sha256: 'hash', source_metadata: { rendition: 'new' } } }],
    remoteAssets: [{ id: 'id', library_asset_id: 'canonical', source_file_sha256: 'hash',
      source_metadata: { sourceRelativePath: 'gym/source.jpg', rendition: 'old', reviewedRoleCategories: ['gym', 'productivity'] } }],
    reconcilePrefixes: ['gym/'], refreshPrefixes: ['gym/'],
  });
  assert.equal(plan.stale.length, 0);
  assert.deepEqual(plan.refreshes[0].dbRow.source_metadata, { rendition: 'new', reviewedRoleCategories: ['gym', 'productivity'] });
});
