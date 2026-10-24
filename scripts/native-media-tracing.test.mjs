import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { nativeMediaTracing } from "../lib/build/native-media-tracing.ts";

const require = createRequire(import.meta.url);
const picomatch = require("next/dist/compiled/picomatch");

for (const [platform, arch, executable] of [["linux", "x64", "ffprobe"], ["win32", "x64", "ffprobe.exe"], ["darwin", "arm64", "ffprobe"]]) {
  test(`${platform}/${arch} retains its probe package and excludes only other binary targets`, () => {
    const config = nativeMediaTracing(platform, arch);
    const matches = picomatch(config.otherProbeBinaries, { contains: true, dot: true });
    for (const file of config.mediaFiles) assert.equal(matches(file), false, file);
    assert.ok(config.mediaFiles.includes(`./node_modules/ffprobe-static/bin/${platform}/${arch}/${executable}`));
    assert.ok(config.mediaFiles.includes("./node_modules/ffprobe-static/index.js"));
    assert.ok(config.mediaFiles.includes("./node_modules/ffprobe-static/package.json"));
    for (const target of ["linux", "win32", "darwin"]) {
      for (const cpu of ["x64", "arm64", "ia32"]) {
        const file = `./node_modules/ffprobe-static/bin/${target}/${cpu}/${target === "win32" ? "ffprobe.exe" : "ffprobe"}`;
        assert.equal(matches(file), target !== platform || cpu !== arch, file);
      }
    }
  });
}

test("actual Next config externalizes both resolvers and removes decoder packages only from lightweight MCP endpoints", () => {
  const source = ts.transpileModule(readFileSync(new URL("../next.config.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exported = {};
  vm.runInNewContext(source, { exports: exported, process,
    require(name) {
      if (name.endsWith("native-media-tracing.ts")) return { nativeMediaTracing };
      if (name.endsWith("landing-preview-assets.json")) return {};
      throw new Error(`Unexpected config import ${name}`);
    },
  });
  const config = exported.default;
  assert.ok(config.serverExternalPackages.includes("ffmpeg-static"));
  assert.ok(config.serverExternalPackages.includes("ffprobe-static"));
  const excluded = (route, file) => Object.entries(config.outputFileTracingExcludes)
    .filter(([pattern]) => picomatch(pattern, { contains: true, dot: true })(route))
    .some(([, files]) => picomatch(files, { contains: true, dot: true })(file));
  for (const route of ["/api/audio/transfer", "/api/explore/hook-starting-frame", "/api/explore/hook-keyframe"]) {
    for (const file of config.outputFileTracingIncludes[route]) assert.equal(excluded(route, file), false, `${route}: ${file}`);
  }
  for (const route of ["/mcp/health", "/.well-known/oauth-protected-resource/mcp"]) {
    for (const [pattern, files] of Object.entries(config.outputFileTracingIncludes)) {
      if (picomatch(pattern, { contains: true, dot: true })(route)) {
        assert.ok(!files.some(file => /ffmpeg|ffprobe/.test(file)), `${route}: native include overmatches`);
      }
    }
    for (const file of nativeMediaTracing().mediaFiles) assert.equal(excluded(route, file), true, `${route}: ${file}`);
  }
});
