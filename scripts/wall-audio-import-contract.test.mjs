import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./import-wall-audio-assets.mjs", import.meta.url),
  "utf8",
);

test("Wall audio import is dry-run by default and execute needs confirmation", () => {
  assert.match(source, /const execute = Boolean\(args\.execute\)/);
  assert.match(source, /if \(execute && !args\.yes\)/);
  assert.match(source, /No GCP object or Supabase row was changed/);
});

test("imports only human-approved active V2 audio", () => {
  assert.match(source, /wall-audio-library-v2/);
  assert.match(
    source,
    /asset\.status === ACTIVE_STATUS[\s\S]+asset\.reviewStatus === APPROVED_REVIEW_STATUS/,
  );
  assert.match(source, /Approved tags are incomplete/);
});

test("uploads immutable MP3 files and verifies their bytes and SHA-256", () => {
  assert.match(source, /audio\/wall-text\/library-v2/);
  assert.match(source, /contentType: "audio\/mpeg"/);
  assert.match(source, /headStorageObject/);
  assert.match(source, /getStorageObject/);
  assert.match(source, /hash\.digest\("hex"\) !== item\.sha256/);
});

test("uses an idempotent remote row check before inserting", () => {
  assert.match(source, /const existingById = await loadExistingRows/);
  assert.match(source, /assertExistingRowMatches/);
  assert.match(source, /\.from\("wall_audio_assets"\)[\s\S]+\.insert\(toDatabaseRow/);
});

test("supports canary import and read-only verification", () => {
  assert.match(source, /selectDiverseCanary/);
  assert.match(source, /const verify = Boolean\(args\.verify\)/);
  assert.match(source, /await verifyRemoteItems/);
});

test("resumes missing assets and retries transient storage failures", () => {
  assert.match(source, /const missingOnly = Boolean\(args\["missing-only"\]\)/);
  assert.match(source, /plan\.items\.filter\(\(item\) => !existingById\.has\(item\.asset\.id\)\)/);
  assert.match(source, /STORAGE_RETRY_ATTEMPTS = 4/);
  assert.match(source, /ECONNRESET/);
  assert.match(source, /withStorageRetry/);
});
