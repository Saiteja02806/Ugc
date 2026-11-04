import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const importer = path.resolve("scripts/import-talking-head-transcripts.mjs");
function fixture(t) {
  const base = path.resolve(".tmp"); fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, "talking-head-transcript-test-"));
  t.after(() => { assert.equal(path.dirname(root), base); fs.rmSync(root, { recursive: true, force: true }); });
  const write = (file, data) => { const absolute = path.join(root, file); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, JSON.stringify(data)); };
  const raw = { text: "Hook words. Demo narration.", words: [{ start: 0, end: 1 }], segments: [{ text: "Hook words.", start: 0, end: 1 }, { text: "Demo narration.", start: 2, end: 5 }] };
  write("raw.json", raw);
  const row = { referenceId: "talking-test", sourceSha256: "a".repeat(64), durationMs: 6000, responsePath: "raw.json", responseSha256: createHash("sha256").update(fs.readFileSync(path.join(root, "raw.json"))).digest("hex"), state: "completed", completedAt: "2026-11-04" };
  const manifest = { model: "whisper-1", items: [row] };
  const review = { version: 1, items: [{ referenceId: row.referenceId, sourceSha256: row.sourceSha256, transcriptSha256: row.responseSha256, hookStartMs: 0, hookEndMs: 1000, hookText: "Hook words.", status: "cross_checked_draft", notes: "Explicit hook before demo narration." }] };
  write("lib/explore/talking-head-source-manifest.json", { items: [{ id: row.referenceId, sourceSha256: row.sourceSha256 }] });
  const output = "lib/explore/talking-head-transcripts.json";
  write(output, { sentinel: "preserve the accepted catalog on failure" });
  const run = () => {
    write(".tmp/talking-head-openai-2026-11-04/manifest.json", manifest);
    write("lib/explore/talking-head-hook-reviews.json", review);
    return spawnSync(process.execPath, [importer], { cwd: root, encoding: "utf8" });
  };
  return { manifest, review, raw, run, read: () => JSON.parse(fs.readFileSync(path.join(root, output), "utf8")) };
}
test("the real importer preserves full ASR and packages only the explicit hook selection", t => {
  const f = fixture(t); const result = f.run(); assert.equal(result.status, 0, result.stderr);
  const row = f.read().items[0];
  assert.equal(row.fullText, f.raw.text); assert.equal(row.hookText, "Hook words.");
  assert.equal(row.hookEndMs, 1000); assert.match(row.selectionSha256, /^[a-f0-9]{64}$/u);
  assert.equal(row.review, "cross_checked_draft");
  const before = row.selectionSha256;
  f.review.items[0].hookEndMs = 1200; assert.equal(f.run().status, 0);
  assert.notEqual(f.read().items[0].selectionSha256, before);
});
for (const [name, mutate] of [
  ["missing hook review", f => { f.review.items = []; }],
  ["stale source fingerprint", f => { f.review.items[0].sourceSha256 = "b".repeat(64); }],
  ["stale ASR fingerprint", f => { f.review.items[0].transcriptSha256 = "b".repeat(64); }],
  ["hook beyond the full source", f => { f.review.items[0].hookEndMs = 6001; }],
  ["unsupported certification status", f => { f.review.items[0].status = "verified"; }],
  ["duplicate source review", f => { f.review.items.push(f.review.items[0]); }],
  ["incomplete transcription catalog", f => { f.manifest.items = []; }],
]) test(`the real importer rejects ${name} without replacing the accepted catalog`, t => {
  const f = fixture(t); mutate(f); assert.notEqual(f.run().status, 0);
  assert.equal(f.read().sentinel, "preserve the accepted catalog on failure");
});
