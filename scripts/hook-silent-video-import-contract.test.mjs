import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const importer = readFileSync(
  new URL("./import-silent-hook-video-assets.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

test("silent Hook importer is GCP-only and dry-run by default", () => {
  assert.match(
    importer,
    /getStorageProviderName\(\) !== "gcp"/u,
  );
  assert.match(
    importer,
    /if \(!execute && !verifyOnly && !rollback\)[\s\S]+No GCP object or Supabase row was changed/u,
  );
  assert.match(
    importer,
    /\(execute \|\| rollback\) && !args\.yes/u,
  );
});

test("silent Hook importer validates the reviewed source bytes and media", () => {
  assert.match(importer, /import ffprobeStatic from "ffprobe-static"/u);
  assert.match(importer, /execFileSync\(\s*ffprobeStatic\.path/u);
  assert.match(importer, /getFileSha256\(filePath\)/u);
  assert.match(importer, /actualHash !== asset\.sha256/u);
  assert.match(importer, /metadata\.audioStreamCount !== 0/u);
  assert.match(importer, /metadata\.width \* 16 !== metadata\.height \* 9/u);
  assert.match(importer, /DURATION_TOLERANCE_SECONDS/u);
});

test("silent Hook importer activates rows only after exact stored verification", () => {
  const processingIndex = importer.indexOf(
    "await createProcessingAssetRow(item)",
  );
  const uploadIndex = importer.indexOf("await uploadBufferToStorage");
  const verifyIndex = importer.indexOf(
    "await verifyStoredObjects(item)",
    uploadIndex,
  );
  const readyIndex = importer.indexOf('status: "ready"', verifyIndex);

  assert.ok(processingIndex >= 0);
  assert.ok(uploadIndex > processingIndex);
  assert.ok(verifyIndex > uploadIndex);
  assert.ok(readyIndex > verifyIndex);
  assert.match(importer, /getStoredObjectSha256\(item\.videoKey\)/u);
  assert.match(importer, /storedSha256 !== item\.asset\.sha256/u);
});

test("silent Hook importer requires reviewed text placement before activation", () => {
  assert.match(importer, /--placement-manifest/u);
  assert.match(importer, /Refusing to activate[\s\S]+without first-frame-reviewed Hook text placement/u);
  assert.match(importer, /hook_text_placement: item\.hookTextPlacement/u);
  assert.match(importer, /normalized_0_to_1_center_anchor/u);
  assert.match(importer, /Ready Hook text placement is missing/u);
  assert.match(importer, /areHookTextPlacementsEqual/u);
  assert.match(
    importer,
    /normalizedLeft\.preset === normalizedRight\.preset[\s\S]+normalizedLeft\.reviewVersion === normalizedRight\.reviewVersion[\s\S]+normalizedLeft\.reviewedAt === normalizedRight\.reviewedAt[\s\S]+normalizedLeft\.x === normalizedRight\.x[\s\S]+normalizedLeft\.y === normalizedRight\.y/u,
  );
});

test("silent Hook importer persists all Slice 2 catalog fields", () => {
  for (const field of [
    "source_file_sha256",
    "source_batch",
    "influencer_key",
    "visual_group",
    "hook_format_id",
    "has_audio",
  ]) {
    assert.match(importer, new RegExp(`${field}:`, "u"));
  }

  assert.match(importer, /has_audio: false/u);
  assert.match(importer, /reactionType: asset\.reactionType/u);
  assert.match(importer, /thumbnailStorageKey: thumbnailKey/u);
  assert.match(importer, /const sortOrder = asset\.sortOrder \?\? manifestIndex/u);
});

test("silent Hook importer supports a diverse canary and guarded rollback", () => {
  assert.match(importer, /selectDiverseCanary/u);
  assert.match(importer, /seenInfluencers/u);
  assert.match(importer, /seenGroups/u);
  assert.match(importer, /assertNoBatchReferences\(rowIds\)/u);
  assert.match(
    importer,
    /avatars\/global\/\$\{manifest\.sourceBatch\}\//u,
  );
  assert.match(
    importer,
    /avatars\/thumbnails\/\$\{manifest\.sourceBatch\}\//u,
  );
});

test("package exposes the reviewed Hook import commands", () => {
  assert.equal(
    packageJson.scripts["hook:silent:import"],
    "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/import-silent-hook-video-assets.mjs",
  );
  assert.equal(
    packageJson.scripts["hook:silent:import:test"],
    "node --test scripts/hook-silent-video-import-contract.test.mjs",
  );
});
