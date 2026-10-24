import assert from 'node:assert/strict';
import { mkdtemp, mkdir, link, copyFile, readFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

export const nativeRoutePackages = {
  'api/explore/hook-starting-frame': ['ffmpeg-static'],
  'api/explore/hook-keyframe': ['ffmpeg-static'],
  'api/audio/transfer': ['ffmpeg-static', 'ffprobe-static'],
  mcp: ['ffmpeg-static', 'ffprobe-static'],
};

export async function verifyNoNativeMedia(trace) {
  const { files } = JSON.parse(await readFile(trace, 'utf8'));
  assert.ok(!files.some(file => /(?:^|\/)node_modules\/(?:ffmpeg-static|ffprobe-static)(?:\/|-)/.test(file.replaceAll('\\', '/'))), `${trace}: lightweight route contains native media package files`);
}

/** Resolve and execute only native package files actually included in a trace. */
export async function verifyNativeRoute(trace, packages, { probe = true } = {}) {
  const { files } = JSON.parse(await readFile(trace, 'utf8'));
  const platformProbe = `node_modules/ffprobe-static/bin/${process.platform}/${process.arch}/`;
  assert.ok(!files.some(file => {
    const normalized = file.replaceAll('\\', '/');
    return normalized.includes('node_modules/ffprobe-static/bin/') && !normalized.includes(platformProbe);
  }), `${trace}: foreign platform/architecture ffprobe binary is included`);
  // Keep links on the checkout filesystem: CI can mount /tmp separately.
  const temporaryBase = resolve(process.cwd(), '.tmp/build-native-verification');
  await mkdir(temporaryBase, { recursive: true });
  const root = await mkdtemp(join(temporaryBase, 'ugc-native-trace-'));
  try {
    for (const name of packages) {
      const binaryName = process.platform === 'win32' ? `${name === 'ffmpeg-static' ? 'ffmpeg' : 'ffprobe'}.exe` : name === 'ffmpeg-static' ? 'ffmpeg' : 'ffprobe';
      const binary = name === 'ffmpeg-static' ? binaryName : `bin/${process.platform}/${process.arch}/${binaryName}`;
      for (const file of ['index.js', 'package.json', binary]) {
        const suffix = `node_modules/${name}/${file}`;
        const entry = files.find(value => value.replaceAll('\\', '/').endsWith(suffix));
        assert.ok(entry, `${trace}: native ${suffix} missing from function trace`);
        const source = resolve(dirname(trace), entry);
        const details = await stat(source);
        assert.ok(details.isFile(), `${trace}: traced file missing: ${suffix}`);
        const destination = join(root, 'node_modules', name, file);
        await mkdir(dirname(destination), { recursive: true });
        // Hardlinks avoid copying the 200MB+ Windows executable per route.
        await link(source, destination).catch(async error => {
          // Small JS/metadata files may be copied when sandbox hardlinks are
          // unavailable. Large binaries require a normal build environment.
          if (!['EPERM', 'EXDEV', 'EACCES'].includes(error.code) || details.size > 1024 * 1024) throw error;
          await copyFile(source, destination);
        });
      }
      const require = createRequire(join(root, 'package.json'));
      const loaded = require(name);
      const executable = typeof loaded === 'string' ? loaded : loaded.path;
      const expected = join(root, 'node_modules', name, binary);
      assert.equal(resolve(executable), expected, `${trace}: ${name} resolves outside its traced deployment package`);
      if (probe) {
        const result = spawnSync(executable, ['-version'], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 });
        assert.ifError(result.error);
        assert.equal(result.status, 0, `${trace}: ${name} executable failed`);
        assert.ok(result.stdout.startsWith(name === 'ffmpeg-static' ? 'ffmpeg version ' : 'ffprobe version '));
      }
    }
  } finally {
    // Each isolated route gets fresh native resolution; do not retain temp
    // package objects after their hardlinks are removed.
    const require = createRequire(import.meta.url);
    for (const key of Object.keys(require.cache)) if (key.startsWith(root + sep)) delete require.cache[key];
    const scoped = relative(temporaryBase, root);
    assert.ok(scoped && !scoped.startsWith(`..${sep}`) && !scoped.startsWith(sep) && scoped.startsWith('ugc-native-trace-'));
    await rm(root, { recursive: true, force: true });
  }
}
