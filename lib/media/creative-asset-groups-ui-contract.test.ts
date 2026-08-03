import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const collection = readProjectFile(
  "components/media/user-media-collection.tsx",
);
const groupsRoute = readProjectFile("app/api/media/groups/route.ts");
const groupRoute = readProjectFile(
  "app/api/media/groups/[groupId]/route.ts",
);
const itemsRoute = readProjectFile(
  "app/api/media/groups/[groupId]/items/route.ts",
);
const createUploadRoute = readProjectFile(
  "app/api/media/create-upload-url/route.ts",
);
const completeUploadRoute = readProjectFile(
  "app/api/media/complete-upload/route.ts",
);
const storage = readProjectFile("lib/media/creative-asset-groups.ts");

test("groups are optional and All assets remains the default library", () => {
  assert.match(collection, />\s*All assets\s*</);
  assert.match(collection, />\s*Optional\s*</);
  assert.match(
    collection,
    /Groups are optional\. They help you organize related assets without[\s\S]*changing All assets\./,
  );
  assert.match(collection, /useState<string \| null>\(null\)/);
});

test("existing uploads remain usable without creating or choosing a group", () => {
  assert.doesNotMatch(createUploadRoute, /\bgroupId\b/);
  assert.doesNotMatch(completeUploadRoute, /\bgroupId\b/);
  assert.match(
    collection,
    /onClick=\{\(\) => inputRef\.current\?\.click\(\)\}/,
  );
  assert.doesNotMatch(
    collection,
    /disabled=\{[^}]*selectedGroupId[^}]*\}/,
  );
});

test("group routes require Firebase ownership on every operation", () => {
  for (const route of [groupsRoute, groupRoute, itemsRoute]) {
    assert.match(route, /requireFirebaseUser\(request\)/);
    assert.match(route, /userId: user\.uid/);
  }
});

test("users can create free-purpose video or image groups", () => {
  assert.match(groupsRoute, /isCreativeAssetGroupMediaType/);
  assert.match(groupsRoute, /createCreativeAssetGroup/);
  assert.doesNotMatch(groupsRoute, /hook|wall.?text|purpose/i);
  assert.match(collection, /mediaType: groupMediaType, name/);
});

test("one or many existing assets can be added without removing other memberships", () => {
  const addManyFunction = getSection(
    storage,
    "export async function addMediaAssetsToGroup",
    "export async function removeMediaAssetFromGroup",
  );

  assert.match(storage, /export async function addMediaAssetsToGroup/);
  assert.match(
    addManyFunction,
    /onConflict: "group_id,media_asset_id"/,
  );
  assert.match(itemsRoute, /mediaAssetIds/);
  assert.match(collection, /Add existing assets/);
  assert.doesNotMatch(addManyFunction, /\.delete\(\)/);
});

test("removing an asset from a group keeps it in All assets", () => {
  assert.match(
    collection,
    /The asset stays in All assets and any other groups\./,
  );
  assert.match(
    collection,
    /method: "DELETE"[\s\S]*setGroupAssets/,
  );
  assert.match(itemsRoute, /removeMediaAssetFromGroup/);
});

test("deleting a group keeps the underlying media assets", () => {
  assert.match(groupRoute, /deleteCreativeAssetGroup/);
  assert.match(
    collection,
    /Its assets stay safe in All assets and any other groups\./,
  );
  assert.match(
    collection,
    /Its assets are still in All assets\./,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}

function getSection(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  assert.ok(startIndex >= 0, `Missing contract start: ${start}`);
  assert.ok(endIndex > startIndex, `Missing contract end: ${end}`);
  return source.slice(startIndex, endIndex);
}
