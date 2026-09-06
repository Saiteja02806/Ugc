import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const importer = readFileSync(
  new URL("./import-explore-hook-videos.mjs", import.meta.url),
  "utf8",
);
const library = readFileSync(
  new URL("../lib/explore/hook-video-library.ts", import.meta.url),
  "utf8",
);
const wallTextLibrary = readFileSync(
  new URL("../lib/explore/wall-text-video-library.ts", import.meta.url),
  "utf8",
);

test("Explore Hook importer uses only GCP and requires an explicit write confirmation", () => {
  assert.match(importer, /STORAGE_PREFIX = "explore\/hook-videos\/2026-08-29"/u);
  assert.match(importer, /PREVIEW_STORAGE_PREFIX = "explore\/landing-preview\/2026-08-29"/u);
  assert.match(importer, /getStorageProviderName\(\) !== "gcp"/u);
  assert.match(importer, /execute && !args\.yes/u);
  assert.match(importer, /No GCP object was changed/u);
  assert.doesNotMatch(importer, /from ["'][^"']*supabase/i);
  assert.doesNotMatch(importer, /from ["'][^"']*trending/i);
});

test("Explore Hook importer validates and verifies every direct video", () => {
  assert.match(importer, /ffprobeStatic\.path/u);
  assert.match(importer, /metadata\.audioStreamCount !== 0/u);
  assert.match(importer, /metadata\.width \* 16 !== metadata\.height \* 9/u);
  assert.match(importer, /getFileSha256\(filePath\)/u);
  assert.match(importer, /readStoredObjectHash\(item\.storageKey\)/u);
  assert.match(importer, /storedHash !== item\.sha256/u);
});

test("the landing preview preserves the supplied source and permits muted autoplay audio", () => {
  assert.match(importer, /DEFAULT_PREVIEW_SOURCE_FILE/u);
  assert.match(importer, /!isPreview && !isWallText && metadata\.audioStreamCount !== 0/u);
  assert.match(importer, /id: isPreview\s*\?\s*"explore-landing-preview"/u);
  assert.match(importer, /["']preview["']/u);
  assert.match(library, /explore\/landing-preview\/2026-08-29/u);
  assert.match(library, /getExplorePreviewVideo/u);
});

test("the application catalog is a separate direct-video library", () => {
  assert.match(library, /explore\/hook-videos\/2026-08-29/u);
  assert.match(library, /sourceFileSha256/u);
  assert.match(library, /buildPublicStorageUrl/u);
  assert.doesNotMatch(library, /from ["'][^"']*trending/i);
  assert.doesNotMatch(library, /from ["'][^"']*viral/i);
  assert.doesNotMatch(library, /instagram\.com/i);
});

test("the Wall-of-Text import keeps direct source audio while preserving the Hook catalog contract", () => {
  assert.match(importer, /DEFAULT_WALL_TEXT_SOURCE_DIRECTORY = "D:\/walloftext"/u);
  assert.match(importer, /WALL_TEXT_STORAGE_PREFIX = "explore\/wall-text-videos\/2026-09-03"/u);
  assert.match(importer, /!isPreview && !isWallText && metadata\.audioStreamCount !== 0/u);
  assert.match(importer, /explore-\$\{isWallText \? "wall-text" : "hook"\}/u);
  assert.match(importer, /Wall-of-Text catalog retains supplied audio/u);
});

test("the Wall-of-Text catalog exposes all supplied references from its own immutable prefix", () => {
  assert.match(
    wallTextLibrary,
    /STORAGE_PREFIX = "explore\/wall-text-videos\/2026-09-03"/u,
  );
  assert.equal(
    [...wallTextLibrary.matchAll(/id: "explore-wall-text-\d{2}"/gu)].length,
    63,
  );
  assert.match(wallTextLibrary, /getExploreWallTextVideos/u);
  assert.match(wallTextLibrary, /isExploreWallTextVideoId/u);
  assert.doesNotMatch(wallTextLibrary, /from ["'][^"']*trending/i);
  assert.doesNotMatch(wallTextLibrary, /from ["'][^"']*viral/i);
});
