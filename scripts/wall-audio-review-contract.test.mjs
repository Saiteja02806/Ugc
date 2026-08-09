import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./apply-wall-audio-review.mjs", import.meta.url),
  "utf8",
);

test("review application is dry-run by default and execute needs confirmation", () => {
  assert.match(source, /const execute = Boolean\(args\.execute\)/);
  assert.match(source, /if \(execute && !args\.yes\)/);
  assert.match(source, /No metadata file was changed/);
});

test("approval requires all subjective listening decisions", () => {
  assert.match(source, /Approved row \$\{asset\.id\} needs mood, message type, energy, and loopable decisions/);
  assert.match(source, /reviewStatus: "approved"/);
  assert.match(source, /status: "active"/);
});

test("rejection requires a reason and remains inactive", () => {
  assert.match(source, /Rejected row \$\{asset\.id\} needs reviewNotes/);
  assert.match(source, /reviewStatus: "rejected"/);
  assert.match(source, /status: "inactive"/);
});

test("writes a recoverable backup before changing metadata", () => {
  assert.match(source, /wall_audio_assets\.before-review-/);
  assert.match(source, /copyFileSync\(metadataPath, backupPath\)/);
  assert.match(source, /writeFileSync\([\s\S]+metadataPath/);
});
