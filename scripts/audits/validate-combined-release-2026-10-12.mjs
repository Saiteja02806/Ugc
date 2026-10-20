import { spawn } from 'node:child_process';
import { createWriteStream, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const dir = '.tmp/release-2026-10-12';
const mode = process.argv[2];
const inventory = JSON.parse(readFileSync(`${dir}/worktree-inventory.json`, 'utf8'));
const flags = ['--import', './scripts/next-server-only-test-loader.mjs', '--experimental-test-module-mocks', '--experimental-transform-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--test', '--test-concurrency=2'];
function tree(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? tree(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
const selected = mode === 'worker'
  ? tree('worker/dist').filter(f => /\.test\.js$/.test(f))
  : [...new Set([...inventory.files.filter(f => /\.test\.(?:ts|mjs)$/.test(f.path) && !f.path.startsWith('worker/')).map(f => f.path),
    'scripts/check-supabase-migration-parity.test.mjs', 'scripts/migration-history-audit.test.mjs', 'scripts/reconciliation-audit.test.mjs',
    'lib/scheduling/platform-settings.test.ts', 'lib/auth/account-isolation-contract.test.ts',
    'lib/trending/carousel-slide-image-upload.test.mjs', 'lib/trending/carousel-edit-render-status.test.ts',
    'lib/explore/sequence-preview.test.ts'])];
if (!['worker', 'app'].includes(mode)) throw new Error('Select app or worker');
const args = mode === 'worker' ? ['--experimental-test-module-mocks', '--test', '--test-concurrency=2', ...selected] : [...flags, ...selected];
writeFileSync(`${dir}/${mode}-test-files.json`, JSON.stringify(selected, null, 2));
const log = createWriteStream(`${dir}/${mode}-tests.log`);
let tail = '';
const child = spawn(process.execPath, args, { env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { log.write(data); tail = (tail + data).slice(-10000); });
child.on('error', e => { console.error(e.message); process.exitCode = 1; });
child.on('close', code => {
  log.end();
  const summary = { mode, files: selected.length, exitCode: code, completedAt: new Date().toISOString(), tail };
  writeFileSync(`${dir}/${mode}-test-result.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ mode, files: selected.length, exitCode: code, log: `${dir}/${mode}-tests.log` }));
  console.log(tail.split(/\r?\n/).slice(-15).join('\n'));
  process.exitCode = code ?? 1;
});
console.log(JSON.stringify({ mode, files: selected.length, status: 'running', log: `${dir}/${mode}-tests.log` }));
