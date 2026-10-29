import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Linux builds are the production target. A Windows trace cannot prove the
// presence or loadability of Linux native binaries.
export function assertLinuxSharpTrace(files, route) {
  const paths = files.map(value => value.replaceAll("\\", "/"));
  assert.ok(paths.some(path => /\/node_modules\/@img\/sharp-linux-x64\/.*\.node$/.test(path)), `${route}: Linux sharp binding missing`);
  assert.ok(paths.some(path => /\/node_modules\/@img\/sharp-libvips-linux-x64\/.*\.so(?:\.|$)/.test(path)), `${route}: Linux libvips missing`);
}

export async function checkAutomationSharpTraces() {
  if (process.platform !== "linux" || process.arch !== "x64") return;
  for (const route of ["api/trending/slideshow-automation", "api/trending/slideshow-automation/activate", "api/internal/carousels/replenish", "api/internal/trending/reconcile", "api/internal/jobs/recover"]) {
    const trace = `.next/server/app/${route}/route.js.nft.json`;
    const { files } = JSON.parse(await readFile(trace, "utf8"));
    assertLinuxSharpTrace(files, route);
  }
  const { default: sharp } = await import("sharp");
  await sharp({ create: { width: 1, height: 1, channels: 3, background: "#ffffff" } }).png().toBuffer();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await checkAutomationSharpTraces();
