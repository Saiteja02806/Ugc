import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
const rows = git('status', '--porcelain=v1', '-uall').trimEnd().split(/\r?\n/).filter(Boolean).map(line => {
  const file = line.slice(3);
  const status = line.slice(0, 2);
  const deleted = status.includes('D');
  const data = deleted ? null : readFileSync(file);
  return { path: file, status, bytes: deleted ? 0 : statSync(file).size,
    sha256: data ? createHash('sha256').update(data).digest('hex') : null };
});
mkdirSync('.tmp/release-2026-10-12', { recursive: true });
writeFileSync('.tmp/release-2026-10-12/worktree-inventory.json', JSON.stringify({
  branch: git('branch', '--show-current').trim(), head: git('rev-parse', 'HEAD').trim(), inspectedAt: new Date().toISOString(), files: rows,
}, null, 2));
const categories = {};
for (const r of rows) categories[r.path.split('/')[0]] = (categories[r.path.split('/')[0]] ?? 0) + 1;
console.log(JSON.stringify({ files: rows.length, categories, largerThan2MB: rows.filter(r => r.bytes > 2e6),
  migrations: rows.filter(r => r.path.startsWith('supabase/')), rootFiles: rows.filter(r => !r.path.includes('/')),
  unusualPaths: rows.filter(r => /\.(?:pem|key|p12|tfstate|log|png|webp|zip|exe|mp4|wav|mp3)$|(?:^|\/)\.env/.test(r.path)).map(r => r.path),
}, null, 2));
