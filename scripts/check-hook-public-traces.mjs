import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

export async function checkHookPublicTraces(root = process.cwd()) {
  const talking = JSON.parse(await readFile(resolve(root, "lib/explore/talking-head-frames.json"), "utf8"));
  const curated = JSON.parse(await readFile(resolve(root, "worker/src/lib/hook-curated-frames.json"), "utf8"));
  const sources = JSON.parse(await readFile(resolve(root, "lib/explore/talking-head-source-manifest.json"), "utf8"));
  const required = [...talking.items.map(row => `public${row.path}`), ...curated.frames.map(row => `public${row.publicPath}`), ...sources.items.map(row => `public${row.file}`)];
  const routes = ["api/explore/hook-keyframe", "api/explore/hook-starting-frame"];
  const qaSource = "e2e/hook-keyframe-preview/source";
  if (!existsSync(resolve(root, "app/e2e"))) {
    const appPaths = JSON.parse(await readFile(resolve(root, ".next/server/app-paths-manifest.json"), "utf8"));
    const qaPaths = Object.keys(appPaths).filter(path => path.startsWith("/e2e/"));
    assert.deepEqual(qaPaths, [], "Development-only /e2e routes found in the packaged website");
  } else {
    routes.push(qaSource);
  }
  for (const route of routes) {
    const file = resolve(root, `.next/server/app/${route}/route.js.nft.json`);
    const trace = JSON.parse(await readFile(file, "utf8"));
    const files = new Set(trace.files.map(value => relative(root, resolve(dirname(file), value)).replaceAll("\\", "/")));
    for (const value of files) {
      assert.ok(!value.startsWith("remotion/"), `${route}: unrelated Remotion asset ${value}`);
      if (value.startsWith("public/")) assert.match(value, /^public\/explore\/(?:talking-head-frames\/v1\/[A-Za-z0-9_-]+\.png|curated-hook-frames\/v1\/[a-f0-9]{64}\.png|talking-head-references\/v1\/(?:previews\/)?[A-Za-z0-9_-]+\.mp4)$/, `${route}: unrelated public asset ${value}`);
    }
    for (const value of required) {
      assert.ok(files.has(value), `${route}: required recovery frame missing ${value}`);
      assert.ok((await stat(resolve(root, value))).size > 0, `${route}: empty frame ${value}`);
    }
  }
  console.log("Hook traces exclude unrelated public/Remotion assets and retain every prepared/historical curated frame.");
}
