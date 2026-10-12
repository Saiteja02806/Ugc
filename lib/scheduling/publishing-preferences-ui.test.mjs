import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { getDefaultScheduleTargetSettings } from "./platform-settings.ts";
import { DEFAULT_PUBLISHING_PREFERENCES } from "./publishing-preferences.ts";

const root = new URL("../../", import.meta.url);
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Run the real hook with controllable request completion and effect cleanup.
// Requests intentionally resolve after abort too, to exercise stale responses.
function preferenceHookFixture() {
  const slots = [];
  const requests = [];
  let cursor = 0;
  let effects = [];
  let latestRetry;
  const changed = (previous, next) => !previous || next.some((value, index) => value !== previous[index]);
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: initial };
      return [slots[index].value, (value) => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }];
    },
    useCallback(create, deps) { return hooks.useMemo(() => create, deps); },
    useMemo(create, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { value: create(), deps };
      return slots[index].value;
    },
    useEffect(create, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) {
        const previous = slots[index];
        slots[index] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          slots[index].cleanup = create();
        });
      }
    },
  };
  const source = readFileSync(new URL("components/scheduling/use-publishing-preferences-default.ts", root), "utf8");
  const exports = {};
  new Function("require", "exports", compile(source))((id) => {
    if (id === "react") return hooks;
    if (id === "@/lib/scheduling/publishing-preferences") return { DEFAULT_PUBLISHING_PREFERENCES };
    if (id === "@/lib/scheduling/publishing-preferences-client") return {
      requestPublishingPreferences: (value, signal) => new Promise((resolve, reject) => requests.push({ value, signal, resolve, reject })),
    };
    throw new Error(`Unexpected dependency: ${id}`);
  }, exports);
  return {
    requests,
    retry: () => latestRetry(),
    render(accountId = "owner", enabled = true) {
      cursor = 0;
      effects = [];
      const result = exports.usePublishingPreferencesDefault(accountId, enabled);
      effects.forEach((run) => run());
      const { retry, ...state } = result;
      latestRetry = retry;
      return { ...DEFAULT_PUBLISHING_PREFERENCES, ...state };
    },
  };
}
const settle = () => new Promise(setImmediate);

test("the publishing hook reads saved false and true defaults without writing preferences", async () => {
  for (const containsSyntheticMedia of [false, true]) {
    const fixture = preferenceHookFixture();
    assert.equal(fixture.render().loading, true);
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].value, undefined);
    fixture.requests[0].resolve({ containsSyntheticMedia });
    await settle();
    assert.deepEqual(fixture.render(), { ...DEFAULT_PUBLISHING_PREFERENCES, containsSyntheticMedia, loading: false, error: null });
    assert.equal(fixture.requests.length, 1);
  }
});

test("retry invalidates a failed read and recovers the saved defaults", async () => {
  const fixture = preferenceHookFixture();
  fixture.render();
  fixture.requests[0].reject(new Error("Unavailable"));
  await settle();
  assert.ok(fixture.render().error);
  fixture.retry();
  assert.equal(fixture.render().loading, true);
  assert.equal(fixture.requests[0].signal.aborted, true);
  fixture.requests[1].resolve({ ...DEFAULT_PUBLISHING_PREFERENCES, youtubePrivacyStatus: "private", containsSyntheticMedia: false });
  await settle();
  assert.equal(fixture.render().youtubePrivacyStatus, "private");
  assert.equal(fixture.render().error, null);
});

test("closing and reopening aborts the old request and reloads the current account preference", async () => {
  const fixture = preferenceHookFixture();
  fixture.render("owner", false);
  assert.equal(fixture.requests.length, 0);
  fixture.render("owner", true);
  assert.equal(fixture.render("owner", false).loading, false);
  assert.equal(fixture.requests[0].signal.aborted, true);
  assert.equal(fixture.render("owner", true).loading, true);
  fixture.requests[0].resolve({ containsSyntheticMedia: false });
  await settle();
  assert.equal(fixture.render().loading, true);
  fixture.requests[1].resolve({ containsSyntheticMedia: true });
  await settle();
  assert.equal(fixture.render().containsSyntheticMedia, true);
});

test("a previous account's result is never reused after switching accounts or signing out", async () => {
  const fixture = preferenceHookFixture();
  fixture.render("first-owner");
  fixture.requests[0].resolve({ containsSyntheticMedia: false });
  await settle();
  assert.equal(fixture.render("first-owner").containsSyntheticMedia, false);
  assert.equal(fixture.render("second-owner").loading, true);
  fixture.requests[1].resolve({ containsSyntheticMedia: true });
  await settle();
  assert.equal(fixture.render("second-owner").containsSyntheticMedia, true);
  assert.deepEqual(fixture.render(null), { ...DEFAULT_PUBLISHING_PREFERENCES, loading: false, error: null });
  assert.equal(fixture.requests.length, 2);
});

test("failed preference reads disclose the fallback and do not leave scheduling waiting forever", async () => {
  const fixture = preferenceHookFixture();
  fixture.render();
  fixture.requests[0].reject(new Error("Network unavailable"));
  await settle();
  const result = fixture.render();
  assert.equal(result.loading, false);
  assert.equal(result.containsSyntheticMedia, true);
  assert.match(result.error, /Retry before publishing/);
  fixture.render("owner", false);
  assert.equal(fixture.render().error, null);
  assert.equal(fixture.render().loading, true);
});

function findNode(ast, predicate) {
  let found;
  function visit(node) {
    if (!found && predicate(node)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found);
  return found;
}

function settingsFixture(path, stateName, overridesName, selectName) {
  const source = readFileSync(new URL(path, root), "utf8");
  const ast = ts.createSourceFile("publishing.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const memo = findNode(ast, (node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === stateName);
  const select = findNode(ast, (node) => ts.isFunctionDeclaration(node) && node.name?.text === selectName);
  let overrides = {};
  const setSettings = (update) => { overrides = update(overrides); };
  const selectConnection = new Function("dependencies", `const { setPublishingSettings, setSettings, setSelectedConnectionIds, setConfirmError, selectedConnectionIds, tiktokCapabilities, MAX_SELECTED_INSTAGRAM_ACCOUNTS, getPostAccountUnavailableMessage, contentKind } = dependencies;
    ${compile(select.getText(ast))}
    return ${selectName};`)({
    setPublishingSettings: setSettings, setSettings, setSelectedConnectionIds() {}, setConfirmError: (value) => assert.equal(value, null),
    selectedConnectionIds: [], tiktokCapabilities: { "tiktok-account": { status: "ready" } },
    MAX_SELECTED_INSTAGRAM_ACCOUNTS: 5, getPostAccountUnavailableMessage: () => null, contentKind: "carousel",
  });
  const resolve = new Function("connections", overridesName, "publishingPreferences", "tiktokCapabilities", "getDefaultPublishingSettings", "getDefaultScheduleTargetSettings", "useMemo",
    `${compile(`const ${memo.getText(ast)};`)}\nreturn ${stateName};`);
  const connections = ["tiktok", "youtube", "instagram"].map((platform) => ({ id: `${platform}-account`, platform, status: "connected" }));
  return {
    connections,
    select: () => connections.forEach((connection) => selectConnection(connection)),
    edit: (id, value) => { overrides = { ...overrides, [id]: { ...overrides[id], containsSyntheticMedia: value } }; },
    getOverrides: () => overrides,
    resolve: (value, preferences = {}, capabilities = {}) => resolve(connections, overrides, { ...DEFAULT_PUBLISHING_PREFERENCES, containsSyntheticMedia: value, ...preferences }, capabilities, getDefaultScheduleTargetSettings, getDefaultScheduleTargetSettings, (fn) => fn()),
  };
}

for (const [path, stateName, overridesName, selectName] of [
  ["components/social/platform-selection-modal.tsx", "publishingSettings", "publishingSettingsOverrides", "selectConnection"],
  ["components/trending/hook-video-schedule-drawer.tsx", "settings", "settingsOverrides", "toggleConnection"],
]) {
  test(`${path}: account selection preserves the saved AI default and explicit per-post edits`, () => {
    const fixture = settingsFixture(path, stateName, overridesName, selectName);
    fixture.select();
    assert.equal(fixture.getOverrides()["tiktok-account"].containsSyntheticMedia, undefined);
    assert.equal(fixture.resolve(false)["tiktok-account"].containsSyntheticMedia, false);
    assert.equal(fixture.resolve(false)["youtube-account"].containsSyntheticMedia, false);
    assert.equal(fixture.resolve(true)["tiktok-account"].containsSyntheticMedia, true);
    assert.deepEqual(fixture.resolve(false)["instagram-account"], { shareToFeed: true });
    fixture.edit("tiktok-account", true);
    fixture.edit("youtube-account", false);
    assert.equal(fixture.resolve(false)["tiktok-account"].containsSyntheticMedia, true);
    assert.equal(fixture.resolve(true)["youtube-account"].containsSyntheticMedia, false);
    assert.equal(fixture.resolve(false)["tiktok-account"].privacyLevel, "PUBLIC_TO_EVERYONE");
    assert.equal(fixture.resolve(false)["tiktok-account"].allowComment, true);
    assert.equal(fixture.resolve(false)["youtube-account"].privacyStatus, "public");
    const saved = fixture.resolve(false, { tiktokPrivacyLevel: "SELF_ONLY", tiktokAllowComments: false, youtubePrivacyStatus: "unlisted", youtubeMadeForKids: true, youtubeNotifySubscribers: true });
    assert.equal(saved["tiktok-account"].privacyLevel, "SELF_ONLY");
    assert.equal(saved["tiktok-account"].allowComment, false);
    assert.equal(saved["youtube-account"].privacyStatus, "unlisted");
    assert.equal(saved["youtube-account"].madeForKids, true);
    assert.equal(saved["youtube-account"].notifySubscribers, true);
  });
  test(`${path}: creator-disabled comments override the saved default without changing it`, () => {
    const fixture = settingsFixture(path, stateName, overridesName, selectName);
    const preferences = { tiktokPrivacyLevel: "SELF_ONLY", tiktokAllowComments: true };
    const saved = fixture.resolve(true, preferences, { "tiktok-account": { status: "ready", capabilities: { interactions: { commentsDisabled: true } } } });
    assert.equal(saved["tiktok-account"].allowComment, false);
    assert.equal(saved["tiktok-account"].privacyLevel, "SELF_ONLY");
    assert.equal(preferences.tiktokAllowComments, true);
    assert.equal(fixture.resolve(true, preferences)["tiktok-account"].allowComment, true);
  });
}
