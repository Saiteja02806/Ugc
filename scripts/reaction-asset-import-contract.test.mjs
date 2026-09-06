import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const importerPath = path.resolve("scripts/import-reaction-assets.mjs");

test("builds an active reaction import plan without remote writes", () => {
  const fixture = createFixture();
  const output = execFileSync(
    process.execPath,
    ["--experimental-strip-types", importerPath, "--manifest", fixture.manifestPath],
    { encoding: "utf8" },
  );

  assert.match(output, /Operation: dry-run/u);
  assert.match(output, /Active clips: 1/u);
  assert.match(output, /Active backgrounds: 1/u);
  assert.match(output, /No object-storage upload or database write was performed/u);
});

test("refuses a file that changed after review", () => {
  const fixture = createFixture({ alteredClip: true });
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", importerPath, "--manifest", fixture.manifestPath],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /source checksum no longer matches the reviewed manifest/u);
});

test("requires an explicit confirmation before remote import", () => {
  const fixture = createFixture();
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", importerPath, "--manifest", fixture.manifestPath, "--execute"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to import without --yes/u);
});

test("uploads and verifies storage before creating an active database row", () => {
  const source = readFileSync(importerPath, "utf8");
  assert.match(source, /await ensureStoredObject\(item\);[\s\S]+\.upsert\(toDatabaseRow\(item\)/u);
  assert.match(source, /status: "active"/u);
  assert.match(source, /verifyRemoteItems\(supabase, plan\)/u);
});

test("remote verification uses reviewed hashes without requiring the source drive", () => {
  const source = readFileSync(importerPath, "utf8");
  assert.match(
    source,
    /buildImportPlan\(manifest, \{ requireLocalSource: !verify \}\)/u,
  );
  assert.match(source, /if \(!requireLocalSource\) \{[\s\S]*sizeBytes: null/u);
  assert.match(source, /item\.sizeBytes !== null/u);
});

function createFixture(options = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "reaction-import-test-"));
  const clipsRoot = path.join(root, "clips");
  const backgroundsRoot = path.join(root, "backgrounds");
  const clipPath = path.join(clipsRoot, "clip.mov");
  const backgroundPath = path.join(backgroundsRoot, "background.jpg");
  const clipContents = Buffer.from(
    options.alteredClip ? "different clip after review" : "reviewed clip bytes",
  );
  const reviewedClipSha = sha256(Buffer.from("reviewed clip bytes"));
  const backgroundContents = Buffer.from("reviewed background bytes");

  mkdirSync(clipsRoot);
  mkdirSync(backgroundsRoot);
  writeFileSync(clipPath, clipContents);
  writeFileSync(backgroundPath, backgroundContents);

  const manifest = {
    schemaVersion: "reaction-asset-manifest-v2",
    videos: [
      {
        assetId: "reaction:test-clip",
        codec: "prores",
        composition: "bust",
        durationSeconds: 4,
        hasAlpha: true,
        height: 1920,
        pixelFormat: "yuva444p10le",
        placement: { anchor: "bottom_center", heightPercent: 0.6 },
        reactions: ["facepalm"],
        sourceFileName: "clip.mov",
        sourceRoot: clipsRoot,
        sourceSha256: reviewedClipSha,
        status: "active",
        subjectCount: "one",
        width: 1080,
      },
    ],
    backgrounds: [
      {
        assetId: "background:test-image",
        contextTags: ["outdoor"],
        foregroundPlacement: "bottom_center",
        height: 1920,
        sourceFileName: "background.jpg",
        sourceRoot: backgroundsRoot,
        sourceSha256: sha256(backgroundContents),
        status: "active",
        width: 1080,
      },
    ],
  };
  const manifestPath = path.join(root, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  return { manifestPath };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
