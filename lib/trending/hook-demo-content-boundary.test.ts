import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const uploadClient = read("lib/trending/hook-video-client-upload.ts");
const hookSources = read("lib/trending/hook-video-sources.ts");
const composer = read("components/trending/hook-video-composer.tsx");
const creativeAssets = read("components/avatars/avatars-workspace.tsx");

test("Trending demo uploads persist through the Content demo API", () => {
  assert.match(uploadClient, /fetch\("\/api\/demo\/create-upload-url"/);
  assert.match(uploadClient, /fetch\("\/api\/demo\/complete-upload"/);
  assert.match(uploadClient, /fetch\("\/api\/demo\/delete"/);
  assert.doesNotMatch(uploadClient, /\/api\/media\/create-upload-url/);
  assert.doesNotMatch(uploadClient, /\/api\/media\/complete-upload/);
});

test("Trending accepts only Content-owned demo projections", () => {
  const sourceTypes = getConstArrayBody(hookSources, "demoSourceTypes");
  const values = Array.from(sourceTypes.matchAll(/"([^"]+)"/g), (match) =>
    match[1],
  );

  assert.deepEqual(values, ["demo_upload"]);
  assert.match(hookSources, /sourceTypes:\s*demoSourceTypes/);
  assert.match(hookSources, /!demoSourceTypes\.includes\(asset\.source_type\)/);
});

test("the Hook picker names Content and Creative Assets excludes demos", () => {
  const creativeAssetSourceTypes = getConstArrayBody(
    creativeAssets,
    "hookVideoSourceTypes",
  );

  assert.doesNotMatch(creativeAssetSourceTypes, /"demo_upload"/);
  assert.match(composer, /Choose a demo from Content/);
  assert.match(composer, /Browse demo videos from Content/);
  assert.match(composer, /href="\/library"/);
});

function read(path: string) {
  return readFileSync(path, "utf8");
}

function getConstArrayBody(source: string, name: string) {
  const match = source.match(
    new RegExp(`const\\s+${name}[^=]*=\\s*\\[([\\s\\S]*?)\\];`),
  );

  assert.ok(match, `Could not find ${name}.`);
  return match[1];
}
