// One-time release bookkeeping. Never executes SQL or changes the remote ledger.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const root = process.cwd(), migrationRoot = path.resolve(root, 'supabase/migrations');
const plan = JSON.parse(readFileSync('.tmp/release-2026-10-12/history-alignment-plan.json', 'utf8'));
const normalize = s => s.replace(/--[^\n]*/g, '').replace(/\s+/g, '');
const md5 = s => createHash('md5').update(s).digest('hex');
const swaps = [], decisions = [];
for (const row of plan) {
  assert.equal(row.matches.length, 1);
  assert.match(row.target, /^\d{14}_[a-z0-9_]+\.sql$/);
  const source = path.resolve(root, row.path), destination = path.resolve(migrationRoot, row.target);
  for (const file of [source, destination]) assert.equal(path.dirname(file), migrationRoot, 'Migration path escapes the intended directory');
  assert.equal(lstatSync(source).isFile(), true);
  const sql = readFileSync(source, 'utf8').replaceAll('\r\n', '\n');
  if (!row.normalizedSqlMatches) {
    // The reviewed production execution added timeouts to this same SQL body.
    assert.equal(row.name, 'allow_wall_text_v13_50px_typography');
    assert.equal(md5(normalize("set local lock_timeout = '5s';\nset local statement_timeout = '60s';\n" + sql)), row.productionNormalizedMd5);
  }
  let action;
  if (existsSync(destination)) {
    assert.equal(lstatSync(destination).isFile(), true);
    assert.equal(normalize(readFileSync(destination, 'utf8')), normalize(sql), 'Duplicate migration SQL differs');
    unlinkSync(source); action = 'remove duplicate; retain applied-version source';
  } else { renameSync(source, destination); action = 'rename to authoritative applied version'; }
  swaps.push([path.basename(source), path.basename(destination)]);
  decisions.push({ source: row.path, target: `supabase/migrations/${row.target}`, action, sqlBodyChanged: false,
    storedExecutionTimeoutPrefix: !row.normalizedSqlMatches });
}
// Retarget executable test/script references. Historical immutable evidence stays intact.
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
for (const file of ['scripts', 'lib', 'worker/src', 'app', '.github'].flatMap(files).filter(f => /\.(?:mjs|cjs|ts|tsx|py|yml|yaml)$/.test(f))) {
  let text = readFileSync(file, 'utf8'), updated = text;
  for (const [before, after] of swaps) updated = updated.replaceAll(before, after);
  if (updated !== text) writeFileSync(file, updated);
}
writeFileSync('docs/production-migration-filename-alignment-2026-10-12.json', JSON.stringify(decisions, null, 2) + '\n');
console.log(JSON.stringify({ aligned: decisions.length, renamed: decisions.filter(x => x.action.startsWith('rename')).length,
  duplicateFilesRemoved: decisions.filter(x => x.action.startsWith('remove')).length, productionSqlExecuted: false }, null, 2));
