import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, URL, URLSearchParams, Response, Uint8Array, crypto: webcrypto, ...globals,
    require(name) { if (name in imports) return imports[name]; throw Error(`Unexpected import ${name}`); } });
  return exports;
}

const sourceSha256 = "a".repeat(64);
const pixels = Buffer.from("decoded frame zero pixels");
const frameSha256 = createHash("sha256").update(pixels).digest("hex");
const scope = { ownerId: "local", draftId: "draft", referenceId: "keyboard-hook", sourceSha256 };

test("anonymous preview reads the selected canonical extraction receipt and never substitutes its poster", async () => {
  const calls = [];
  const client = load("lib/explore/hook-starting-frame-client.ts", {
    "../../worker/src/lib/hook-curated-frames.ts": { getCuratedHookFrame: () => undefined },
    "../firebase/auth": { getCurrentUserIdToken: () => assert.fail("Anonymous extraction does not authenticate") },
    "../http/read-deadline": {},
  });
  const preview = load("lib/explore/local-hook-starting-frame-preview.ts", { "./hook-starting-frame-client": client }, {
    fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(pixels, { headers: { "Content-Type": "image/png", "X-Hook-Reference-Id": scope.referenceId,
        "X-Hook-Source-Sha256": sourceSha256, "X-Hook-Frame-Sha256": frameSha256, "X-Hook-Frame-Index": "0",
        "X-Hook-Frame-Time": "0", "X-Hook-Frame-Width": "720", "X-Hook-Frame-Height": "1280" } });
    },
  }).createLocalHookStartingFramePreviewRuntime();
  const result = await preview.loadSource({ scope, reference: { posterUrl: "https://wrong-scene.test/poster.png" }, signal: new AbortController().signal });
  assert.equal(calls.length, 1); assert.equal(calls[0].url, "/e2e/hook-keyframe-preview/source?referenceId=keyboard-hook");
  assert.equal(result.referenceId, scope.referenceId); assert.equal(result.sourceSha256, sourceSha256);
  assert.equal(result.frame.sha256, frameSha256); assert.equal(Buffer.from(await result.blob.arrayBuffer()).compare(pixels), 0);
  assert.match(preview.generationDisabledReason, /no generation has been submitted/);
  for (const action of [() => preview.submit({}), () => preview.read("?cost=1"), () => preview.loadInfluencers(null, new AbortController().signal)]) {
    await assert.rejects(action(), /Sign in/);
  }
  assert.equal(calls.length, 1, "No provider, history or billing request can be made from this preview");
});

test("local extraction route is closed in production and on non-loopback hosts", async () => {
  let reads = 0;
  const env = { NODE_ENV: "production" };
  const route = load("app/e2e/hook-keyframe-preview/source/route.ts", {
    "@/lib/explore/hook-source-frame": { HookSourceFrameError: class extends Error {}, getHookSourceFrame: () => { reads++; assert.fail("Must be rejected first"); } },
  }, { process: { env } });
  assert.equal((await route.GET(new Request("http://127.0.0.1/e2e/hook-keyframe-preview/source?referenceId=keyboard-hook"))).status, 404);
  env.NODE_ENV = "development";
  assert.equal((await route.GET(new Request("https://www.getugcpilot.com/e2e/hook-keyframe-preview/source?referenceId=keyboard-hook"))).status, 404);
  assert.equal((await route.GET(new Request("http://127.0.0.1/e2e/hook-keyframe-preview/source?referenceId=keyboard-hook&url=foreign"))).status, 400);
  assert.equal(reads, 0);
});

test("local extraction delegates only catalogue identity and returns the real decoder provenance", async () => {
  const reads = [];
  const route = load("app/e2e/hook-keyframe-preview/source/route.ts", {
    "@/lib/explore/hook-source-frame": { HookSourceFrameError: class extends Error {}, getHookSourceFrame: async referenceId => {
      reads.push(referenceId); return { referenceId, sourceSha256, frameSha256, png: pixels, width: 720, height: 1280 };
    } },
  }, { process: { env: { NODE_ENV: "development" } } });
  const result = await route.GET(new Request("http://127.0.0.1/e2e/hook-keyframe-preview/source?referenceId=keyboard-hook"));
  assert.deepEqual(reads, ["keyboard-hook"]); assert.equal(result.status, 200);
  assert.equal(result.headers.get("X-Hook-Frame-Sha256"), frameSha256); assert.equal(result.headers.get("X-Hook-Frame-Time"), "0");
  assert.equal(Buffer.from(await result.arrayBuffer()).compare(pixels), 0);
});
