import assert from "node:assert/strict";
import { copyFile, link, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Linux builds are the production target. A Windows trace cannot prove the
// presence or loadability of Linux native binaries.
export function assertLinuxSharpTrace(files, route) {
  const paths = files.map(value => value.replaceAll("\\", "/"));
  assert.ok(paths.some(path => /\/node_modules\/@img\/sharp-linux-x64\/.*\.node$/.test(path)), `${route}: Linux sharp binding missing`);
  assert.ok(paths.some(path => /\/node_modules\/@img\/sharp-libvips-linux-x64\/.*\.so(?:\.|$)/.test(path)), `${route}: Linux libvips missing`);
}

/** A checkout smoke test can hide missing traced dependencies. Resolve only
 * files shipped by this route, outside the checkout's node_modules ancestry. */
export async function verifyIsolatedSharpTrace(trace, projectRoot = process.cwd()) {
  const { files } = JSON.parse(await readFile(trace, "utf8"));
  const temporaryBase = resolve(tmpdir());
  const root = await mkdtemp(join(temporaryBase, "ugc-sharp-trace-"));
  try {
    for (const entry of files) {
      const source = resolve(dirname(trace), entry);
      const path = relative(projectRoot, source);
      if (path.startsWith("..") || isAbsolute(path) || !path.replaceAll("\\", "/").includes("node_modules/")) continue;
      const destination = join(root, path);
      await mkdir(dirname(destination), { recursive: true });
      await link(source, destination).catch(async error => {
        if (!["EPERM", "EXDEV", "EACCES"].includes(error.code)) throw error;
        await copyFile(source, destination);
      });
    }
    const result = spawnSync(process.execPath, ["--input-type=commonjs", "-e", `
      const { createRequire } = require('node:module');
      const { resolve, relative, isAbsolute } = require('node:path');
      const root = process.cwd();
      const localRequire = createRequire(resolve(root, 'package.json'));
      const entry = relative(root, localRequire.resolve('sharp'));
      if (entry.startsWith('..') || isAbsolute(entry)) throw Error('Sharp resolved outside traced package');
      const sharp = localRequire('sharp');
      sharp({create:{width:2,height:2,channels:3,background:'#12ab34'}})
        .composite([{input:Buffer.from('<svg width="2" height="2"><rect width="1" height="1" fill="red"/></svg>')}])
        .webp().toBuffer().then(buffer => { if (!buffer.length) process.exitCode=1; })
        .catch(error => { console.error(error); process.exitCode=1; });
    `], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 30000,
      env: { ...process.env, NODE_PATH: "", NODE_OPTIONS: "" } });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${trace}: isolated Sharp runtime failed: ${result.stderr}`);
  } finally {
    const path = relative(temporaryBase, root);
    assert.ok(path.startsWith("ugc-sharp-trace-") && !path.includes("/") && !path.includes("\\"));
    await rm(root, { recursive: true, force: true });
  }
}

export async function checkAutomationSharpTraces() {
  if (process.platform !== "linux" || process.arch !== "x64") return;
  for (const route of ["api/trending/slideshow-automation", "api/trending/slideshow-automation/activate", "api/internal/carousels/replenish", "api/internal/trending/reconcile", "api/internal/jobs/recover"]) {
    const trace = `.next/server/app/${route}/route.js.nft.json`;
    const { files } = JSON.parse(await readFile(trace, "utf8"));
    assertLinuxSharpTrace(files, route);
    await verifyIsolatedSharpTrace(resolve(trace));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await checkAutomationSharpTraces();
