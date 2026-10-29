import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mock, test } from 'node:test';
// Only the external storage URL host is substituted; gallery and source routing
// are the actual application modules. No remote reads or writes.
mock.module('@/lib/storage/storage', { namedExports: { buildPublicStorageUrl: key => `https://storage.fixture.test/${key}` } });
const { getRecreateReferences } = await import('../lib/explore/recreate-catalog.ts');
const { getReferenceText } = await import('../lib/explore/reference-text-store.ts');
const { wallTextProfile } = await import('../worker/src/lib/wall-initial-text-layout.ts');
test('every selectable Wall reference routes to its exact reviewed text and measured layout', () => {
  const inventory = JSON.parse(fs.readFileSync('outputs/wall-layout-batch-20261028/all-source-review-inventory.json'));
  const rows = getRecreateReferences().filter(row => row.format === 'wall_text');
  assert.equal(rows.length, 97);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  for (const row of rows) {
    const text = getReferenceText(row.id, null, 'wall_text');
    assert.ok(text && text.status === 'ready', row.id);
    assert.ok(wallTextProfile(row.id, text.sourceSha256), row.id);
    assert.equal(inventory.find(item => item.id === row.id)?.sha256, text.sourceSha256);
  }
  for (const number of ['06', '08', '09', '21', '28', '59']) assert.ok(!rows.some(row => row.id === `explore-wall-text-${number}`));
});
