import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("storage audit distinguishes repeated trace references, unique paths and exact duplicate content", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ugc-build-storage-"));
  const write = (name, content) => { const file = path.join(dir, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, content); };
  write(".next/BUILD_ID", "fixture");
  write("lib/font-a.ttf", Buffer.alloc(100000, 7)); write("lib/font-b.ttf", Buffer.alloc(100000, 7));
  write(".next/cache/local-only.bin", Buffer.alloc(300000));
  write(".next/server/one.js.nft.json", JSON.stringify({ files: ["../../lib/font-a.ttf", "../../lib/font-b.ttf"] }));
  write(".next/server/two.js.nft.json", JSON.stringify({ files: ["../../lib/font-a.ttf", "../../lib/missing.ttf"] }));
  const script = fileURLToPath(new URL("./audit-build-storage.mjs", import.meta.url));
  execFileSync(process.execPath, [script, ".next", "audit.json"], { cwd: dir });
  const result = JSON.parse(readFileSync(path.join(dir, "audit.json"), "utf8"));
  assert.equal(result.traces.count, 2);
  assert.equal(result.traces.logicalBytesAcrossTraces, 300000);
  assert.equal(result.traces.uniquePathBytes, 200000);
  assert.equal(result.traces.exactDuplicateAssets.length, 1);
  assert.equal(result.traces.exactDuplicateAssets[0].redundantPathBytes, 100000);
  assert.equal(result.traces.topRepeatedFiles.find(file => file.file === "lib/font-a.ttf").traceCount, 2);
  assert.equal(result.traces.largest.find(trace => trace.trace.endsWith("two.js.nft.json")).missing, 1);
  assert.equal(result.directories.find(directory => directory.directory === ".next/cache").bytes, 300000);
});
