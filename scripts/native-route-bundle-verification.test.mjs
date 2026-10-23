import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyNativeRoute, verifyNoNativeMedia } from './native-route-bundle-verification.mjs';

async function fixture(run, { omit, resolver } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'ugc-native-fixture-'));
  try {
    const folder = join(root, 'node_modules/ffprobe-static');
    const binary = `bin/${process.platform}/${process.arch}/${process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'}`;
    await mkdir(join(folder, `bin/${process.platform}/${process.arch}`), { recursive: true });
    const entries = {
      'index.js': resolver ?? `exports.path=require('node:path').join(__dirname,${JSON.stringify(binary)});`,
      'package.json': JSON.stringify({ name: 'ffprobe-static', main: 'index.js' }),
      [binary]: 'Test fixture: execution is disabled',
    };
    for (const [name, contents] of Object.entries(entries)) await writeFile(join(folder, name), contents);
    const trace = join(root, 'route.js.nft.json');
    await writeFile(trace, JSON.stringify({ files: Object.keys(entries).filter(name => name !== omit).map(name => `node_modules/ffprobe-static/${name}`) }));
    await run(trace);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('isolated traced native package resolves its own binary', async () => {
  await fixture(trace => verifyNativeRoute(trace, ['ffprobe-static'], { probe: false }));
});
test('binary presence cannot hide missing native package entry module', async () => {
  await fixture(trace => assert.rejects(verifyNativeRoute(trace, ['ffprobe-static'], { probe: false }), /index\.js missing/), { omit: 'index.js' });
});
test('binary presence cannot hide missing native package metadata', async () => {
  await fixture(trace => assert.rejects(verifyNativeRoute(trace, ['ffprobe-static'], { probe: false }), /package\.json missing/), { omit: 'package.json' });
});
test('bundler-root or checkout-bound executable paths are rejected', async () => {
  await fixture(trace => assert.rejects(verifyNativeRoute(trace, ['ffprobe-static'], { probe: false }), /outside its traced deployment package/), { resolver: "exports.path='/ROOT/node_modules/ffprobe-static/bin/linux/x64/ffprobe';" });
});
test('native executable failure is detected independently of trace presence', async () => {
  await fixture(trace => assert.rejects(verifyNativeRoute(trace, ['ffprobe-static'])));
});
test('lightweight route cannot accidentally retain native media dependencies', async () => {
  await fixture(trace => assert.rejects(verifyNoNativeMedia(trace), /lightweight route contains native media/));
  await fixture(async trace => {
    await writeFile(trace, JSON.stringify({ files: ['../chunks/application.js', '../package.json'] }));
    await verifyNoNativeMedia(trace);
  });
});
test('foreign platform probe files are rejected even with a valid current package', async () => {
  await fixture(async trace => {
    const foreign = process.platform === 'win32' ? 'linux' : 'win32';
    await writeFile(trace, JSON.stringify({ files: [`node_modules/ffprobe-static/bin/${foreign}/x64/ffprobe`] }));
    await assert.rejects(verifyNativeRoute(trace, ['ffprobe-static'], { probe: false }), /foreign platform\/architecture/);
  });
});
