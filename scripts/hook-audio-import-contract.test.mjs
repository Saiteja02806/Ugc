import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const importer = readFileSync(
  new URL("./import-hook-audio-assets.mjs", import.meta.url),
  "utf8",
);
const databaseAccess = readFileSync(
  new URL("../lib/trending/hook-audio-db.ts", import.meta.url),
  "utf8",
);

test("Hook audio import is dry-run by default and execution needs confirmation", () => {
  assert.match(importer, /const execute = Boolean\(args\.execute\)/u);
  assert.match(importer, /if \(execute && !args\.yes\)/u);
  assert.match(importer, /No GCP object or Supabase row was changed/u);
});

test("imports the combined catalog only as pending and inactive", () => {
  assert.match(importer, /hook-audio-library-v1/u);
  assert.match(importer, /asset\.reviewStatus !== "pending"/u);
  assert.match(importer, /asset\.status !== "inactive"/u);
  assert.match(importer, /review_status: "pending"/u);
  assert.match(importer, /status: "inactive"/u);
  assert.match(importer, /loopable: false/u);
});

test("uploads immutable MP3 objects and verifies exact bytes", () => {
  assert.match(importer, /audio\/hook\/library-v1/u);
  assert.match(importer, /contentType: "audio\/mpeg"/u);
  assert.match(importer, /headStorageObject/u);
  assert.match(importer, /getStorageObject/u);
  assert.match(importer, /hash\.digest\("hex"\) !== item\.sha256/u);
  assert.match(
    importer,
    /\$\{asset\.id\}-\$\{sha256\.slice\(0, 12\)\}/u,
  );
});

test("checks existing rows before inserting into the separate Hook library", () => {
  assert.match(importer, /const existingById = await loadExistingRows/u);
  assert.match(importer, /assertExistingRowMatches/u);
  assert.match(
    importer,
    /\.from\("hook_audio_assets"\)[\s\S]+\.insert\(toDatabaseRow/u,
  );
});

test("safely synchronizes semantic tags on existing pending inactive rows", () => {
  assert.match(importer, /semanticMetadataMatches/u);
  assert.match(importer, /updatePendingMetadata/u);
  assert.match(
    importer,
    /\.update\([\s\S]+\.eq\("id", item\.asset\.id\)[\s\S]+\.eq\("sha256", item\.sha256\)[\s\S]+\.eq\("status", "inactive"\)[\s\S]+\.eq\("review_status", "pending"\)/u,
  );
  assert.match(importer, /updatedMetadata/u);
});

test("backend reads only approved and active audio", () => {
  assert.match(databaseAccess, /import "server-only"/u);
  assert.match(databaseAccess, /\.eq\("status", "active"\)/u);
  assert.match(databaseAccess, /\.eq\("review_status", "approved"\)/u);
  assert.match(databaseAccess, /row\.loopable !== false/u);
});

test("does not implement Preferred or per-video overrides", () => {
  const implementation = `${importer}\n${databaseAccess}`.toLowerCase();
  assert.doesNotMatch(implementation, /preferred_audio/u);
  assert.doesNotMatch(implementation, /video_audio_override/u);
});
