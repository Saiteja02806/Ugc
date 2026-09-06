import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const validatorPath = path.resolve("scripts/validate-reaction-asset-manifest.mjs");

test("accepts an inspection template before assets are reviewed", () => {
  const manifest = createReadyManifest();
  manifest.videos[0].status = "pending";
  manifest.backgrounds[0].status = "pending";
  const output = execFileSync(process.execPath, [validatorPath, "--manifest", writeManifest(manifest)], {
    encoding: "utf8",
  });

  assert.match(output, /0 clips and 0 backgrounds are active/u);
});

test("accepts only minimally tagged active reaction assets for catalog import", () => {
  const output = execFileSync(
    process.execPath,
    [validatorPath, "--manifest", writeManifest(createReadyManifest()), "--require-active"],
    { encoding: "utf8" },
  );

  assert.match(output, /1 clips and 1 backgrounds are active/u);
});

test("rejects an active clip missing a required final tag", () => {
  const manifest = createReadyManifest();
  manifest.videos[0].subjectCount = null;
  const result = spawnSync(
    process.execPath,
    [validatorPath, "--manifest", writeManifest(manifest), "--require-active"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /needs subjectCount one, two, or group/u);
});

test("does not allow an unreviewed source into a required active import", () => {
  const manifest = createReadyManifest();
  manifest.videos[0].status = "pending";
  const result = spawnSync(
    process.execPath,
    [validatorPath, "--manifest", writeManifest(manifest), "--require-active"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /At least one active clip and background/u);
});

test("does not allow duplicate source files into the catalog", () => {
  const manifest = createReadyManifest();
  manifest.backgrounds[0].sourceSha256 = manifest.videos[0].sourceSha256;
  const result = spawnSync(
    process.execPath,
    [validatorPath, "--manifest", writeManifest(manifest)],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate source checksum/u);
});

function createReadyManifest() {
  return {
    schemaVersion: "reaction-asset-manifest-v2",
    videos: [
      {
        assetId: "reaction:test-clip",
        codec: "prores",
        composition: "bust",
        durationSeconds: 6,
        hasAlpha: true,
        height: 1920,
        pixelFormat: "yuva444p10le",
        placement: { anchor: "bottom_center", heightPercent: 0.7 },
        reactions: ["relief", "unbothered"],
        sourceFileName: "clip.mov",
        sourceRoot: "C:/reaction-source/clips",
        sourceSha256: "a".repeat(64),
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
        sourceRoot: "C:/reaction-source/backgrounds",
        sourceSha256: "b".repeat(64),
        status: "active",
        width: 1080,
      },
    ],
  };
}

function writeManifest(manifest) {
  const directory = mkdtempSync(path.join(tmpdir(), "reaction-manifest-test-"));
  const manifestPath = path.join(directory, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  return manifestPath;
}
