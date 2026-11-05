import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { checkHookPublicTraces } from "./check-hook-public-traces.mjs";

test("emitted Hook guard retains all recovered frame assets and rejects unrelated public/Remotion files", async () => {
  const root = await mkdtemp(join(tmpdir(), "ugc-hook-traces-"));
  const talking = "public/explore/talking-head-frames/v1/talking-fixture.png";
  const curated = `public/explore/curated-hook-frames/v1/${"a".repeat(64)}.png`;
  const video = "public/explore/talking-head-references/v1/talking-fixture.mp4";
  async function save(file, bytes) { await mkdir(dirname(join(root,file)),{recursive:true}); await writeFile(join(root,file),bytes); }
  async function traces(extra = [], omit = false) {
    for (const route of ["api/explore/hook-keyframe", "api/explore/hook-starting-frame", "e2e/hook-keyframe-preview/source"]) {
      const file = `.next/server/app/${route}/route.js.nft.json`;
      const entries = [talking,video,...(omit ? [] : [curated]),...extra];
      await save(file,JSON.stringify({files:entries.map(asset=>relative(dirname(join(root,file)),join(root,asset)))}));
    }
  }
  try {
    await save("lib/explore/talking-head-frames.json",JSON.stringify({items:[{path:talking.slice(6)}]}));
    await save("worker/src/lib/hook-curated-frames.json",JSON.stringify({frames:[{publicPath:curated.slice(6)}]}));
    await save("lib/explore/talking-head-source-manifest.json",JSON.stringify({items:[{file:video.slice(6)}]}));
    await save(video,"local video fixture");
    await save(talking,"png fixture"); await save(curated,"historical fixture");
    await traces(); await checkHookPublicTraces(root);
    for (const asset of ["public/marketing/hero.mp4","public/explore/covers/promo.mp4","public/explore/influencer-studio/face.png","remotion/public/explore/covers/sources/source.mp4"]) {
      await traces([asset]); await assert.rejects(checkHookPublicTraces(root),/unrelated/);
    }
    await traces([],true); await assert.rejects(checkHookPublicTraces(root),/required recovery frame missing/);
    await traces(); await save(curated,""); await assert.rejects(checkHookPublicTraces(root),/empty frame/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test("source-frame filesystem reads use narrow roots and retain catalogue path checks", async () => {
  const source=await readFile("lib/explore/hook-source-frame.ts","utf8");
  assert.doesNotMatch(source,/join\(process\.cwd\(\), "public",/);
  for (const directory of ["talking-head-frames","curated-hook-frames","talking-head-references"]) assert.ok(source.includes(`public/explore/${directory}/v1`));
  assert.ok(source.includes('selected.publicPath !== `/explore/curated-hook-frames/v1/${selected.sha256}.png`'));
  assert.ok(source.includes('source.localFile !== `/explore/talking-head-references/v1/${source.id}.mp4`'));
  const config=await readFile("next.config.ts","utf8");
  for (const route of ["/api/explore/hook-keyframe","/api/explore/hook-starting-frame","/e2e/hook-keyframe-preview/source"]) assert.ok(config.includes(`"${route}": ["./remotion/**/*", "./public/explore/covers/**/*"]`));
});
