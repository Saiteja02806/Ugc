import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";

// Execute the actual import entry points, isolating only filesystem/cloud boundaries.
async function runImporter(kind, { failPreparation = false, dryRun = false } = {}) {
  const name = kind === "paired" ? "import-explore-paired-references.mjs" : "import-explore-recreate-assets.mjs";
  const root = process.cwd(), files = new Map(), remote = new Map(), events = [], published = [];
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  const video = Buffer.from("verified local test video bytes"), videoHash = hash(video);
  let manifest;
  if (kind === "paired") {
    const item = { id: "wall-new", format: "wall_text", width: 96, height: 160 };
    for (const [type, extension, bytes] of [["video", "mp4", video], ["audio", "mp3", Buffer.from("audio")], ["poster", "webp", Buffer.from("poster")]]) {
      item[`${type}Sha256`] = hash(bytes); item[`${type}StorageKey`] = `explore/paired-references/v1/${hash(bytes)}.${extension}`;
      files.set(path.join(root, ".tmp/explore-paired-references/media", `${hash(bytes)}.${extension}`), bytes);
    }
    manifest = { version: 1, mediaStatus: "staged", items: [item] };
  } else {
    manifest = { version: 1, mediaStatus: "staged", items: [{ id: "wall-new", format: "wall_text", videoFile: videoHash+".mp4", slides: [] }] };
    files.set(path.join(root, ".tmp/explore-catalog/media", videoHash+".mp4"), video);
  }
  const storage = {
    getMissingStorageEnvVars: () => [], getStorageProviderName: () => "gcp",
    headStorageObject: async ({ key }) => { const o = remote.get(key); if (!o) throw Object.assign(Error("missing"), { code: 404 }); return { ContentLength: o.buffer.length, ContentType: o.contentType }; },
    uploadBufferToStorage: async o => { remote.set(o.key, o); events.push("upload"); },
    getStorageObject: async ({ key }) => ({ Body: { transformToWebStream: () => new Blob([remote.get(key).buffer]).stream() } }),
  };
  const fakeFs = { ...fs,
    existsSync: () => true, statSync: file => ({ isFile: () => true, size: files.get(file)?.length ?? 1 }),
    readFileSync: file => {
      if (file.endsWith(".env.local")) return "";
      if (file.endsWith(".json")) return JSON.stringify(manifest);
      assert(files.has(file), file); return files.get(file);
    },
    writeFileSync: (_file, contents) => { assert.equal(events.at(-1), "prepared"); published.push(JSON.parse(contents)); events.push("activated"); },
  };
  const prepare = async sources => {
    events.push("prepare"); assert.equal(sources.length, 1); assert.equal(sources[0].id, "wall-new"); assert.equal(sources[0].videoSha256, videoHash);
    assert.equal(sources[0].filePath, [...files.keys()].find(p => p.endsWith(".mp4")));
    if (failPreparation) throw Error("backend frame readback failed"); events.push("prepared");
  };
  const source = fs.readFileSync(new URL(name, import.meta.url), "utf8").replaceAll("import.meta.url", JSON.stringify(new URL(name, import.meta.url).href));
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const error = await vm.runInNewContext(`(async()=>{${code}\n})()`, { exports: {}, Buffer, Blob,
    console: { log() {} }, process: { cwd: () => root, env: {}, argv: ["node", name, ...(dryRun ? [] : ["--execute", "--yes"])], exit: () => { throw Error("dry-run exit"); } },
    require: id => id === "node:fs" ? fakeFs : id.includes("lib/storage/storage") ? storage : id.includes("prepare-published-source-frames") ? { preparePublishedSourceFrames: prepare } : id.startsWith("node:") ? importRequire(id) : assert.fail(id),
  }).then(() => null, e => e);
  return { error, events, published };
}
import { createRequire } from "node:module";
const importRequire = createRequire(import.meta.url);
for (const kind of ["paired", "recreate"]) {
  test(`${kind}: actual importer prepares opening before activation; failure leaves catalogue staged; dry run does not prepare`, async () => {
    const success = await runImporter(kind); assert.equal(success.error, null); assert.equal(success.published[0].mediaStatus, "published");
    const failure = await runImporter(kind, { failPreparation: true }); assert.match(failure.error.message, /readback failed/); assert.equal(failure.published.length, 0);
    const dry = await runImporter(kind, { dryRun: true }); assert.equal(dry.error.message, "dry-run exit"); assert.deepEqual(dry.events, []);
  });
}

for (const name of ["import-wall-text-video-assets.mjs", "import-silent-hook-video-assets.mjs"]) {
  test(`${name}: actual activation loop blocks on frame failure, repairs resumed imports and leaves disabled sources alone`, async () => {
    const source = fs.readFileSync(new URL(name, import.meta.url), "utf8");
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    const topTry = ast.statements.find(n => ts.isTryStatement(n) && n.tryBlock.statements.some(ts.isForOfStatement));
    const loop = topTry.tryBlock.statements.find(ts.isForOfStatement).getText(ast);
    const helper = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "prepareStartingFrame").getText(ast);
    const code = ts.transpileModule(helper+"\n"+loop, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const hook = name.includes("silent-hook");
    for (const state of ["new", "inactive", "ready", "failure", ...(hook ? ["disabled"] : [])]) {
      const calls = [], row = { id: "asset-id", status: state === "ready" ? hook ? "ready" : "active" : state };
      const item = { asset: { catalogName: "new-video", sha256: "a".repeat(64) }, filePath: "local.mp4", metadata: { width: 96, height: 160 } };
      const result = { createdRows: [], skippedExisting: [], resumed: [], imported: [] };
      const builder = { update: () => { calls.push("activate"); return builder; }, eq: () => builder, select: () => builder, single: async () => ({ data: row }) };
      const error = await vm.runInNewContext(`(async()=>{${code}})()`, {
        Buffer, console: { log() {} }, plan: { items: [item] }, result, CACHE_CONTROL: "immutable", existingByHash: new Map(state === "new" || state === "failure" ? [] : [[item.asset.sha256, row]]),
        assertExistingRowMatches() {}, verifyStoredObjects: async () => calls.push("verify media"),
        createProcessingAssetRow: async () => row.id, createPendingAssetRow: async () => row.id,
        createThumbnail: () => Buffer.from("thumbnail"), readFileSync: () => Buffer.from("video"), uploadBufferToStorage: async () => {},
        supabase: { from: () => builder },
        require: id => { assert.match(id, /prepare-published-source-frames/); return { preparePublishedSourceFrames: async sources => {
          assert.equal(sources[0].filePath, item.filePath); assert.equal(sources[0].videoSha256, item.asset.sha256); calls.push("prepare frame");
          if (state === "failure") throw Error("frame failed");
        } }; },
      }).then(() => null, e => e);
      if (state === "disabled") { assert.match(error.message, /disabled/); assert.deepEqual(calls, []); }
      else if (state === "failure") { assert.match(error.message, /frame failed/); assert(!calls.includes("activate")); }
      else { assert.equal(error, null); assert(calls.includes("prepare frame")); if (state !== "ready") assert(calls.indexOf("prepare frame") < calls.indexOf("activate")); }
    }
  });
}

test("remaining public publication entry points gate activation on opening preparation", () => {
  for (const [name, activation] of [
    ["import-wall-money-references.mjs", 'batch.status = "published"'],
    ["publish-explore-reference-batch-20261023.mjs", "for(const f of manifest.files)"],
    ["import-wall-instagram-reel-templates.mjs", "const overlayId = await ensureOverlayAsset"],
  ]) {
    const code = fs.readFileSync(new URL(name, import.meta.url), "utf8");
    const prepare = code.indexOf(".preparePublishedSourceFrames(");
    assert(prepare > 0 && prepare < code.indexOf(activation), name);
  }
});
