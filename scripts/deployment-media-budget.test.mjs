import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { nativeMediaTracing } from "../lib/build/native-media-tracing.ts";
import { checkLightweightCatalogueTraces } from "./check-lightweight-catalogue-traces.mjs";
const require = createRequire(import.meta.url);
const ignore = require("ignore");
const picomatch = require("next/dist/compiled/picomatch");
const { normalizeAppPath } = require("next/dist/shared/lib/router/utils/app-paths");
const ignored = ignore().add(readFileSync(".vercelignore", "utf8"));
function files(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? files(file) : entry.isFile() ? [file.replaceAll("\\", "/")] : [];
  });
}
function config() {
  const exported = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("next.config.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: exported, process, require(name) {
      if (name.endsWith("native-media-tracing.ts")) return { nativeMediaTracing };
      if (name.endsWith("landing-preview-assets.json")) return { default: JSON.parse(readFileSync("lib/marketing/landing-preview-assets.json", "utf8")) };
      throw new Error(name);
    } });
  return exported.default;
}
test("deployment excludes cover authoring inputs while retaining every published cover and poster", () => {
  const excluded = files("public/explore/covers").filter(file => file.includes("/sources/") || /contact-sheet\.png$/.test(file) || file.endsWith("/preview.html"));
  assert.ok(excluded.length > 0);
  for (const file of excluded) assert.equal(ignored.ignores(file), true, file);
  for (const file of files("public/explore/covers").filter(file => !excluded.includes(file))) assert.equal(ignored.ignores(file), false, file);
  for (const file of files("remotion/public/explore/covers/sources")) assert.ok(statSync(file).size > 0, file);
  assert.match(readFileSync("remotion.config.ts", "utf8"), /setPublicDir\("remotion\/public"\)/);
});
test("application sources never request excluded cover authoring URLs", () => {
  for (const folder of ["app", "components", "lib", "worker/src"]) {
    for (const file of files(folder).filter(file => /\.(?:ts|tsx|js|json|css)$/.test(file) && !file.includes(".test."))) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /(?:\/|["'`])explore\/covers\/(?:sources\/|[^"'`\s]*contact-sheet\.png|preview\.html)/, file);
    }
  }
});
test("lightweight MCP endpoints omit encrypted catalogues while real consumers retain required assets", () => {
  const c = config();
  const excluded = (route, file) => Object.entries(c.outputFileTracingExcludes).some(([pattern, patterns]) =>
    picomatch(pattern, { contains: true, dot: true })(route) && picomatch(patterns, { contains: true, dot: true })(file));
  const catalogue = "./lib/explore/creator-accounts.json.enc";
  const included = route => Object.entries(c.outputFileTracingIncludes).some(([pattern, patterns]) =>
    picomatch(pattern, { contains: true, dot: true })(route) && picomatch(patterns, { contains: true, dot: true })(catalogue));
  for (const route of ["/mcp/health", "/.well-known/oauth-protected-resource/mcp", "/mcp/", "/mcp-other", "/x/mcp", "/mcp2", "/MCP"]) assert.equal(included(route), false, route);
  // Exercise the installed collector's actual entry-name normalization, not
  // only the public route paths shown in the configuration documentation.
  assert.equal(included(normalizeAppPath("app/mcp/route")), true);
  for (const entry of ["app/mcp/health/route", "app/.well-known/oauth-protected-resource/mcp/route", "app/example/mcp/route"]) assert.equal(included(normalizeAppPath(entry)), false, entry);
  for (const route of ["/mcp", "/api/explore/hook-keyframe", "/api/explore/creator-media/example", "/api/explore/creator-slide-media/example/slide"]) {
    assert.equal(excluded(route, catalogue), false, route);
    assert.ok(Object.entries(c.outputFileTracingIncludes).some(([pattern, patterns]) => picomatch(pattern, { contains: true })(route) && picomatch(patterns, { contains: true })(catalogue)), route);
  }
});
test("emitted trace guard detects leaked catalogues and missing real-consumer files", async () => {
  const previous = process.cwd(), folder = mkdtempSync(path.join(tmpdir(), "ugc-catalogue-traces-"));
  const names = ["creator-accounts", "creator-account-reviews", "creator-middle-frame-prompts", "creator-slideshows", "creator-slide-text"];
  function trace(route, files) {
    const directory = path.join(folder, ".next/server/app", route); mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, "route.js.nft.json"), JSON.stringify({ files }));
  }
  try {
    process.chdir(folder);
    trace("mcp", names.map(name => `../../lib/explore/${name}.json.enc`));
    trace("mcp/health", []); trace(".well-known/oauth-protected-resource/mcp", []);
    await checkLightweightCatalogueTraces();
    trace("mcp/health", ["..\\lib\\explore\\creator-accounts.json.enc"]);
    await assert.rejects(checkLightweightCatalogueTraces(), /unused encrypted catalogue/);
    trace("mcp/health", []); trace("mcp", []);
    await assert.rejects(checkLightweightCatalogueTraces(), /catalogue missing/);
  } finally { process.chdir(previous); rmSync(folder, { recursive: true, force: true }); }
});
