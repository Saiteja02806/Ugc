import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertCarouselRoleManifestHasNoRetiredSources,
  getCarouselRoleSourceRetirement,
  isPreservedCarouselRoleAssetRetirement,
} from "./carousel-role-library.mjs";

const policy = JSON.parse(
  readFileSync(new URL("./carousel-role-library-retirements.json", import.meta.url), "utf8"),
);
const retirement = policy.retirements[0];
const rejectedHash = retirement.sourceFileSha256s[0];
const allowedHash = "a".repeat(64);
const rejectedPath = retirement.exactSourcePaths[0];

test("Productivity cleanup records all 40 unique rejected source hashes", () => {
  assert.equal(retirement.sourceFileSha256s.length, 40);
  assert.equal(new Set(retirement.sourceFileSha256s).size, 40);
  assert.equal(retirement.retiredAt, "2026-10-11");
  assert.ok(retirement.sourceFileSha256s.every((hash) => /^[a-f0-9]{64}$/.test(hash)));
});

test("specific retired source path is excluded after Windows path normalization", () => {
  const result = getCarouselRoleSourceRetirement({
    relativePath: `./${rejectedPath.replaceAll("/", "\\").toUpperCase()}`,
    sourceFileSha256: allowedHash,
  });
  assert.equal(result?.matchedBy, "source-path");
  assert.equal(result?.reason, "user-retired-carousel-source");
});

test("part-2 source prefix excludes descendants without matching neighbouring folders", () => {
  for (const relativePath of [
    "productivity_humanhookpart-2/human/new.jpg",
    "productivity_humanhookpart-2/human/nested/new.png",
  ]) {
    assert.equal(getCarouselRoleSourceRetirement({ relativePath })?.matchedBy, "source-path");
  }
  for (const relativePath of [
    "productivity_humanhookpart-2/human-other/new.jpg",
    "productivity_humanhookpart-2/human2/new.jpg",
    "productivity_humanhookpart-20/human/new.jpg",
    "productivity-human/Pinterest_2026-08-16 (61)/pinterest_028.jpg",
  ]) {
    assert.equal(getCarouselRoleSourceRetirement({ relativePath }), null);
  }
});

test("exact wrong-image copies stay rejected under another category and source folder", () => {
  assert.equal(
    getCarouselRoleSourceRetirement({
      relativePath: "gym_hook/renamed-copy.jpg",
      sourceFileSha256: rejectedHash.toUpperCase(),
    })?.matchedBy,
    "sha256",
  );
  assert.equal(getCarouselRoleSourceRetirement({
    relativePath: "productivity_hook/new-approved-image.jpg",
    sourceFileSha256: allowedHash,
  }), null);
});

test("manifest guard checks source metadata even if its display source path differs", () => {
  assert.throws(() => assertCarouselRoleManifestHasNoRetiredSources([{
    libraryAssetId: "stale-path-asset",
    source: { relativePath: "productivity_hook/allowed.jpg" },
    dbRow: {
      source_file_sha256: allowedHash,
      source_metadata: { sourceRelativePath: rejectedPath },
    },
  }]), /Manifest contains retired Carousel source/);
  assert.throws(() => assertCarouselRoleManifestHasNoRetiredSources([{
    libraryAssetId: "stale-folder-asset",
    dbRow: {
      source_file_sha256: allowedHash,
      source_folder: "productivity_humanhookpart-2/human",
      source_filename: "renamed.png",
    },
  }]), /Manifest contains retired Carousel source/);
  assert.doesNotThrow(() => assertCarouselRoleManifestHasNoRetiredSources([{
    libraryAssetId: "allowed-asset",
    source: { relativePath: "productivity_hook/allowed.jpg" },
    dbRow: { source_file_sha256: allowedHash },
  }]));
});

test("preserved retirement marker and denylisted hashes protect remote historical assets", () => {
  assert.equal(isPreservedCarouselRoleAssetRetirement({
    is_active: false,
    status: "archived",
    runtime_exclusion_reason: "user_requested_retirement",
    source_file_sha256: allowedHash,
    source_metadata: { retirement: { preserveHistoricalRenders: true } },
  }), true);
  assert.equal(isPreservedCarouselRoleAssetRetirement({
    is_active: true,
    source_file_sha256: rejectedHash,
    source_metadata: {},
  }), true);
  assert.equal(isPreservedCarouselRoleAssetRetirement({
    is_active: true,
    source_file_sha256: allowedHash,
    source_metadata: {},
  }), false);
});

test("actual reconciliation planner preserves tombstones and refuses restoration or replacement", () => {
  const source = readFileSync(new URL("./reconcile-carousel-role-library.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function buildPlan(params) {");
  const end = source.indexOf("async function loadRemoteRoleAssets()", start);
  assert.ok(start >= 0 && end > start);
  // Evaluate only the pure planner, without importing the CLI's remote-read entry point.
  const buildPlan = new Function(
    "isPreservedCarouselRoleAssetRetirement", "getRemoteSourcePath", "matchesAnyPrefix", "assertRemoteIdentity",
    `${source.slice(start, end)}; return buildPlan;`,
  )(
    isPreservedCarouselRoleAssetRetirement,
    (row) => row.source_metadata?.sourceRelativePath ?? `${row.source_folder}/${row.source_filename}`,
    (value, prefixes) => prefixes.some((prefix) => value.startsWith(prefix)),
    () => undefined,
  );
  const preserved = {
    id: "preserved-id", library_asset_id: "preserved-library-id",
    source_file_sha256: allowedHash,
    source_metadata: {
      sourceRelativePath: "productivity-human/retired.jpg",
      retirement: { preserveHistoricalRenders: true },
    },
  };
  const deniedHash = {
    id: "rejected-id", library_asset_id: "rejected-library-id",
    source_file_sha256: rejectedHash,
    source_metadata: { sourceRelativePath: "productivity-human/old-canonical-copy.jpg" },
  };
  const ordinaryStale = {
    id: "ordinary-id", library_asset_id: "ordinary-library-id",
    source_file_sha256: "b".repeat(64),
    source_metadata: { sourceRelativePath: "productivity-human/ordinary.jpg" },
  };
  const params = {
    desiredAssets: [], remoteAssets: [preserved, deniedHash, ordinaryStale],
    reconcilePrefixes: ["productivity-human/"], refreshPrefixes: ["productivity-human/"],
  };
  const plan = buildPlan(params);
  assert.deepEqual(plan.stale.map((row) => row.id), ["ordinary-id"]);
  assert.deepEqual(plan.preservedRetirements.map((row) => row.id), ["preserved-id", "rejected-id"]);
  assert.equal(plan.refreshes.length, 0);
  for (const libraryAssetId of ["preserved-library-id", "new-canonical-id"]) {
    assert.throws(() => buildPlan({
      ...params,
      desiredAssets: [{
        libraryAssetId,
        source: { relativePath: "productivity-human/retired.jpg" },
        dbRow: { source_file_sha256: allowedHash },
      }],
    }), /Refusing to (restore|replace) preserved retired asset/);
  }
});

test("destructive reconciliation rechecks locked database rows before historical writes", () => {
  const source = readFileSync(new URL("./reconcile-carousel-role-library.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function deleteStaleDatabaseRows(items) {");
  const end = source.indexOf("async function deleteStaleStorageObjects(items) {", start);
  const deletion = source.slice(start, end);
  assert.match(deletion, /items\.find\(isPreservedCarouselRoleAssetRetirement\)/);
  assert.match(deletion, /where id = any\(\$\{idArray\}\) for update/);
  assert.match(deletion, /source_metadata #>> '\{retirement,preserveHistoricalRenders\}' = 'true'/);
  assert.match(deletion, /lower\(source_file_sha256\) = any\(\$\{retiredHashArray\}\)/);
  assert.ok(deletion.indexOf("carousel_role_library_reconcile_preserved_retirement") < deletion.indexOf("update public.carousel_image_rotation_pools"));
  assert.match(source.slice(end, source.indexOf("async function uploadAssets", end)), /items\.find\(isPreservedCarouselRoleAssetRetirement\)/);
});

test("import and reconciliation reject stale manifests before DB or storage preflight", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "carousel-retirement-test-"));
  const manifestPath = path.join(directory, "role-library-manifest.json");
  writeFileSync(manifestPath, JSON.stringify({
    version: "carousel-role-library-v1",
    errors: [],
    summary: { deduplicated: { total: 1 } },
    assets: [{
      libraryAssetId: "rejected-copy",
      category: "productivity",
      role: "hook",
      source: { relativePath: "productivity_hook/renamed.jpg" },
      dbRow: { source_file_sha256: rejectedHash },
    }],
  }));
  try {
    for (const [script, extraArgs] of [
      ["import-carousel-role-library.mjs", []],
      ["reconcile-carousel-role-library.mjs", [
        "--desired-prefixes", "productivity_hook/",
        "--reconcile-prefixes", "productivity_hook/",
        "--refresh-prefixes", "productivity_hook/",
      ]],
    ]) {
      const result = spawnSync(process.execPath, [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        path.resolve("scripts", script),
        "--manifest", manifestPath,
        "--dry-run",
        ...extraArgs,
      ], {
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true,
        env: { ...process.env, SUPABASE_URL: "invalid-url-for-preflight-test" },
      });
      assert.equal(result.error, undefined, `${script}: ${result.error}`);
      assert.equal(result.status, 1, `${script}: ${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /Manifest contains retired Carousel source rejected-copy/);
      assert.doesNotMatch(result.stderr, /supabaseUrl is required|Invalid supabaseUrl|fetch failed/);
    }
  } finally {
    unlinkSync(manifestPath);
    rmdirSync(directory);
  }
});
