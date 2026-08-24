import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const collection = readProjectFile(
  "components/media/user-media-collection.tsx",
);
const workspace = readProjectFile(
  "components/avatars/avatars-workspace.tsx",
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
  assert.match(
    collection,
    /Groups are optional\. They help you organize related assets without[\s\S]*changing All assets\./,
  );
  assert.match(collection, /useState<string \| null>\(null\)/);
});

test("group controls stay compact without a dedicated explanatory card", () => {
  const groupSwitcher = getSection(
    collection,
    'aria-label={`${title} groups`}',
    '<div className="flex flex-col gap-4 rounded',
  );

  assert.match(groupSwitcher, />\s*Create group\s*</);
  assert.match(groupSwitcher, /shrink-0/);
  assert.doesNotMatch(groupSwitcher, /shadow-card/);
  assert.doesNotMatch(groupSwitcher, />\s*Groups\s*</);
});

test("the inactive Saved collection loads through a separate client bundle", () => {
  assert.match(workspace, /import dynamic from "next\/dynamic"/);
  assert.doesNotMatch(
    workspace,
    /import\s+\{\s*SavedCreativeAssetsTab\s*\}\s+from\s+"@\/components\/avatars\/saved-creative-assets-tab"/,
  );
  assert.match(
    workspace,
    /const SavedCreativeAssetsTab = dynamic\([\s\S]*import\("@\/components\/avatars\/saved-creative-assets-tab"\)[\s\S]*module\.SavedCreativeAssetsTab[\s\S]*loading: SavedCreativeAssetsLoading/,
  );
  assert.match(workspace, /activeTab === "videos"[\s\S]*activeTab === "images"[\s\S]*<SavedCreativeAssetsTab \/>/);
  assert.match(workspace, /import \{ UserMediaCollection \} from "@\/components\/media\/user-media-collection"/);
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

test("asset removal confirmation uses a clear destructive action", () => {
  const removalDialog = getSection(
    collection,
    "open={pendingDeleteAsset !== null}",
    "open={groupDialogMode !== null}",
  );

  assert.match(
    removalDialog,
    /<DialogFooter className="border-border bg-popover">/,
  );
  assert.match(removalDialog, /variant="outline"[\s\S]*Keep asset/);
  assert.match(
    removalDialog,
    /variant="destructive"[\s\S]*className="bg-error text-error-foreground shadow-sm hover:bg-error\/90"/,
  );
  assert.match(removalDialog, /onClick=\{\(\) => void removeAsset\(\)\}/);
});

test("video playback control keeps a visible icon in either theme", () => {
  const card = getSection(
    collection,
    "function MediaAssetCard",
    "function getCreativeAssetCardStatusLabel",
  );

  assert.match(card, /bg-white\/95 text-slate-950/);
  assert.match(card, /<Play className="ml-0\.5 size-4 fill-current text-current"/);
});

test("group deletion confirmation uses the shared surface and a clear destructive action", () => {
  const deletionDialog = getSection(
    collection,
    "open={pendingDeleteGroup !== null}",
    "function MediaAssetCard",
  );

  assert.match(deletionDialog, /<DialogFooter>/);
  assert.match(deletionDialog, /variant="outline"[\s\S]*Keep group/);
  assert.match(
    deletionDialog,
    /variant="destructive"[\s\S]*className="bg-error text-error-foreground shadow-sm hover:bg-error\/90"/,
  );
  assert.match(deletionDialog, /onClick=\{\(\) => void deleteGroup\(\)\}/);
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
