import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { getDefaultScheduleTargetSettings, getScheduleTargetSettingsError } from "../scheduling/platform-settings.ts";
import { isTikTokPrivacyLevel } from "../social/tiktok-publishing.ts";
import { getConnectionPublishingBlockMessage } from "../scheduling/social-connection-policy.ts";
import { getEarliestScheduleTimestamp, getZonedDateTimeParts, resolveZonedDateTime, validateScheduleLeadTime } from "../scheduling/schedule-time.ts";

// Execute the real modal's controls and callbacks with hosted/OAuth dependencies
// substituted. No browser, provider post, or duplicate scheduling policy is used.
const source = readFileSync(new URL("../../components/social/platform-selection-modal.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("modal.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = ["AccountsStep", "CarouselAccountSettings", "YouTubeVideoSettings", "SettingCheckbox", "getContentKind", "getPostAccountUnavailableMessage", "getStatusDisplay", "getConnectionAccountName", "getPlatformLabel", "getBooleanSetting", "getStringSetting"];
const statements = ast.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && functions.includes(node.name?.text)) ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === "platforms")),
);
const compile = code => ts.transpileModule(code, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const wrapper = ({ children }) => React.createElement("div", null, children);
const Button = ({ children, ...props }) => React.createElement("button", props, children);
const Checkbox = ({ onCheckedChange, ...props }) => React.createElement("input", { ...props, type: "checkbox", onChange: onCheckedChange });
const icon = () => React.createElement("span", { "aria-hidden": "true" });
const components = new Function("React", "getConnectionPublishingBlockMessage", "cn", "SocialAccountAvatar", "Badge", "Button", "Checkbox", "Skeleton", "SocialPlatformIcon", "LoaderCircle", "ExternalLink", "Plus", "AlertCircle", "TikTokCarouselSettings", `${compile(statements.map(node => node.getText(ast)).join("\n"))}\nreturn { AccountsStep, CarouselAccountSettings, YouTubeVideoSettings };`)(
  React, getConnectionPublishingBlockMessage, (...values) => values.filter(Boolean).join(" "), icon, wrapper, Button, Checkbox, wrapper, icon, icon, icon, icon, icon, () => React.createElement("div", null, "TikTok settings"),
);

function findNode(predicate) {
  let found;
  function visit(node) {
    if (!found && predicate(node)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found);
  return found;
}
const platformMemo = findNode(node => ts.isVariableDeclaration(node) && node.name.getText(ast) === "visiblePlatforms").initializer;
const platformFilter = new Function("tiktokBetaEnabled", "youtubeBetaEnabled", "contentKind", "useMemo", `${compile(`${statements.find(ts.isVariableStatement).getText(ast)}\nconst visiblePlatforms = ${platformMemo.getText(ast)};`)}\nreturn visiblePlatforms;`);
const connectAttribute = findNode(node => ts.isJsxAttribute(node) && node.name.getText(ast) === "onConnect");
const connectCallback = connectAttribute.initializer.expression.getText(ast);
const makeConnect = new Function("context", "startConnection", "setLoadError", `${compile(`const connect = ${connectCallback};`)}\nreturn connect;`);
const submitFunction = findNode(node => ts.isFunctionDeclaration(node) && node.name?.text === "submitSchedule");
const timeHelpers = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ["getEarliestScheduleSlot", "validateLaterSchedule", "getFutureSlot", "getErrorMessage", "getDefaultPublishingSettings"].includes(node.name?.text));
function submissionCallback(overrides = {}) {
  const submitted = [];
  const events = [];
  const selectedConnections = [connection("tiktok"), connection("youtube")];
  const publishingSettings = {
    "tiktok-account": { ...getDefaultScheduleTargetSettings("tiktok"), musicUsageConfirmed: true },
    "youtube-account": { ...getDefaultScheduleTargetSettings("youtube"), privacyStatus: "public" },
  };
  const later = getZonedDateTimeParts(Date.now() + 24 * 60 * 60_000, "Asia/Kolkata");
  const dependencies = {
    context: { contentType: "reaction" }, canContinueAccounts: true, publishingSettingsError: null,
    selectedConnections, publishingSettings, minimumLeadMinutes: 5, timezone: "Asia/Kolkata", caption: "My caption",
    scheduledDate: later.date, scheduledTime: later.time,
    getDefaultScheduleTargetSettings, getEarliestScheduleTimestamp, getZonedDateTimeParts, resolveZonedDateTime, validateScheduleLeadTime,
    setCurrentTime() {}, setConfirmError: value => events.push(["error", value]), setRecoveryDraftId() {}, setSubmitting() {},
    onConfirmed: async value => submitted.push(value), invalidateAccountSchedules() {}, queryClient: {}, accountId: "owner",
    resetModal: () => events.push(["reset"]), onOpenChange: value => events.push(["open", value]),
    CarouselScheduleRecoveryError: class extends Error {}, ...overrides,
  };
  const submit = new Function("dependencies", `const { ${Object.keys(dependencies).join(", ")} } = dependencies;\n${compile([...timeHelpers, submitFunction].map(node => node.getText(ast)).join("\n"))}\nreturn submitSchedule;`)(dependencies);
  return { submit, submitted, events, dependencies };
}

function connection(platform, overrides = {}) {
  return { id: `${platform}-account`, platform, platformAccountId: "account", platformAccountName: "My channel", status: "connected", supportsBackgroundRefresh: true, scopes: platform === "youtube" ? ["https://www.googleapis.com/auth/youtube.upload"] : ["video.publish"], ...overrides };
}
function renderAccounts(contentType, account) {
  const visiblePlatforms = platformFilter(true, true, contentType, fn => fn());
  return renderToStaticMarkup(React.createElement(components.AccountsStep, {
    carouselConnections: [account], contentLabel: "Video", context: { contentType },
    connectingConnectionId: null, connectingIntent: null, connectingPlatform: null,
    loading: false, onConnect() {}, onToggle() {}, selectedConnectionIds: [], visiblePlatforms,
  }));
}

test("Trending videos offer TikTok and YouTube; carousels offer supported destinations", () => {
  for (const kind of ["wall_text", "reaction"]) {
    assert.deepEqual(platformFilter(true, true, kind, fn => fn()).map(value => value.platform), ["instagram", "tiktok", "youtube"]);
    const youtube = renderAccounts(kind, connection("youtube"));
    assert.match(youtube, /YouTube channel/);
    assert.match(youtube, /Add another YouTube account/);
    assert.doesNotMatch(youtube, /disabled=""|not carousel posts/);
    assert.doesNotMatch(renderAccounts(kind, connection("tiktok")), /disabled=""/);
  }
  assert.deepEqual(platformFilter(true, true, "carousel", fn => fn()).map(value => value.platform), ["instagram", "tiktok"]);
  assert.deepEqual(platformFilter(false, false, "reaction", fn => fn()).map(value => value.platform), ["instagram"]);
});

test("video accounts with missing publishing scope or background refresh require reconnect", () => {
  for (const account of [connection("youtube", { supportsBackgroundRefresh: false }), connection("youtube", { scopes: [] }), connection("tiktok", { scopes: [] })]) {
    const html = renderAccounts("reaction", account);
    assert.match(html, /disabled=""/);
    assert.match(html, /Reconnect/);
  }
});

test("Reaction and Text Reel connection buttons use OAuth without requiring a carousel Library item", () => {
  for (const contentType of ["reaction", "wall_text"]) {
    for (const platform of ["tiktok", "youtube"]) {
      const calls = [];
      const connect = makeConnect({ contentType, returnTo: contentType === "reaction" ? "trending" : "accounts" }, input => calls.push(input), assert.fail);
      connect({ platform });
      connect({ platform }, connection(platform, { updatedAt: "version" }));
      assert.equal(calls[0].returnTo, "accounts");
      assert.equal(calls[0].intent, "add");
      assert.equal(calls[0].platform, platform);
      assert.equal(calls[1].returnTo, "accounts");
      assert.equal(calls[1].forceConsent, true);
      assert.equal(calls[1].expectedConnectionId, `${platform}-account`);
      assert.equal(calls[1].previousConnectionUpdatedAt, "version");
    }
  }
  const calls = [];
  makeConnect({ carouselId: "carousel", libraryItemId: "owned-item", returnTo: "trending" }, input => calls.push(input), assert.fail)({ platform: "tiktok" });
  assert.equal(calls[0].returnTo, "trending");
  assert.equal(calls[0].libraryItemId, "owned-item");
  assert.equal(calls[0].carouselId, "carousel");
});

test("YouTube details display the right platform and allow an explicit public visibility selection", () => {
  const settings = getDefaultScheduleTargetSettings("youtube");
  const changes = [];
  const html = renderToStaticMarkup(React.createElement(components.CarouselAccountSettings, {
    connection: connection("youtube"), contentKind: "reaction", settings, onChange() {}, onRetry() {},
  }));
  assert.match(html, /YouTube/);
  assert.match(html, /value="private" selected=""/);
  assert.match(html, /value="public"/);
  assert.doesNotMatch(html, /TikTok settings/);
  const details = components.YouTubeVideoSettings({ settings, onChange: (...args) => changes.push(args) });
  details.props.children[0].props.children[1].props.onChange({ target: { value: "public" } });
  assert.deepEqual(changes, [["privacyStatus", "public"]]);
});

test("clicking Schedule submits both selected destinations, visibility settings, and the exact chosen timezone/time", async () => {
  for (const mode of ["later", "asap"]) {
    const fixture = submissionCallback();
    await fixture.submit(mode);
    assert.equal(fixture.submitted.length, 1);
    const selection = fixture.submitted[0];
    assert.deepEqual(selection.targets.map(target => target.platform), ["tiktok", "youtube"]);
    assert.equal(selection.targets[0].settings.privacyLevel, "PUBLIC_TO_EVERYONE");
    assert.equal(selection.targets[0].settings.brandOrganic, true);
    assert.equal(selection.targets[0].settings.commercialContentDisclosureEnabled, true);
    assert.equal(selection.targets[0].settings.brandedContent, false);
    assert.equal(selection.targets[1].settings.privacyStatus, "public");
    assert.equal(selection.caption, "My caption");
    assert.equal(selection.timezone, "Asia/Kolkata");
    assert.equal(selection.useDefaultScheduleTime, mode === "asap");
    assert.equal(selection.scheduledFor, resolveZonedDateTime({ date: selection.scheduledDate, time: selection.scheduledTime, timeZone: selection.timezone }));
    if (mode === "later") {
      assert.equal(selection.scheduledDate, fixture.dependencies.scheduledDate);
      assert.equal(selection.scheduledTime, fixture.dependencies.scheduledTime);
    }
    assert.ok(fixture.events.some(event => event[0] === "open" && event[1] === false));
  }
});

test("Schedule waits for a successful save and leaves the modal open on failure", async () => {
  const fixture = submissionCallback({ onConfirmed: async () => { throw new Error("Scheduler unavailable"); } });
  await fixture.submit("later");
  assert.ok(fixture.events.some(event => event[0] === "error" && event[1] === "Scheduler unavailable"));
  assert.ok(!fixture.events.some(event => event[0] === "open" || event[0] === "reset"));
});

test("TikTok consent and account selection block Schedule before a request is sent", async () => {
  const fixture = submissionCallback();
  fixture.dependencies.publishingSettings["tiktok-account"].musicUsageConfirmed = false;
  const message = getScheduleTargetSettingsError({
    connections: fixture.dependencies.selectedConnections, settings: fixture.dependencies.publishingSettings,
    tiktokCapabilities: { "tiktok-account": { status: "ready", capabilities: { directPostAudited: true, privacyLevels: ["PUBLIC_TO_EVERYONE"] } } },
  });
  assert.match(message, /Music Usage Confirmation/);
  for (const override of [{ publishingSettingsError: message }, { canContinueAccounts: false }]) {
    const blocked = submissionCallback(override);
    await blocked.submit("later");
    assert.deepEqual(blocked.submitted, []);
  }
});

function capabilityLoader(relativePath, capabilities, initialSettings) {
  const fileSource = readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
  const fileAst = ts.createSourceFile("scheduler.tsx", fileSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let loaderSource;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "loadTikTokCapabilities") {
      loaderSource = node.getText(fileAst);
    } else if (ts.isVariableDeclaration(node) && node.name.getText(fileAst) === "loadTikTokCapabilities") {
      loaderSource = `const loadTikTokCapabilities = ${node.initializer.arguments[0].getText(fileAst)};`;
    }
    ts.forEachChild(node, visit);
  }
  visit(fileAst);
  assert.ok(loaderSource);
  let settings = initialSettings;
  let capabilityStates = {};
  const updateSettings = updater => { settings = updater(settings); };
  const dependencies = {
    setTikTokCapabilities: updater => { capabilityStates = updater(capabilityStates); },
    setSettings: updateSettings, setPublishingSettings: updateSettings,
    requireToken: async () => "test-token", getCurrentUserIdToken: async () => "test-token",
    fetch: async () => Response.json({ ok: true, capabilities }),
    getDefaultScheduleTargetSettings, getDefaultPublishingSettings: getDefaultScheduleTargetSettings,
    isTikTokPrivacyLevel, getErrorMessage: error => error.message,
    getApiMessage: () => assert.fail("Unexpected API error"),
    getApiResponseMessage: () => assert.fail("Unexpected API error"),
  };
  const load = new Function("dependencies", `const { ${Object.keys(dependencies).join(", ")} } = dependencies;\n${compile(loaderSource)}\nreturn loadTikTokCapabilities;`)(dependencies);
  return { load, getSettings: () => settings, getCapabilities: () => capabilityStates };
}

test("all TikTok scheduling forms keep the new defaults through capability loading and preserve per-post edits", async () => {
  for (const path of ["components/trending/hook-video-schedule-drawer.tsx", "components/social/platform-selection-modal.tsx", "components/scheduling/schedule-editor.tsx"]) {
    for (const scenario of [
      { directPostAudited: true, privacyLevels: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"], expected: "PUBLIC_TO_EVERYONE" },
      { directPostAudited: true, privacyLevels: ["FOLLOWER_OF_CREATOR", "SELF_ONLY"], expected: "" },
      { directPostAudited: false, privacyLevels: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"], expected: "" },
    ]) {
      const capabilities = { ...scenario, interactions: { commentsDisabled: false, duetsDisabled: false, stitchesDisabled: false } };
      const loader = capabilityLoader(path, capabilities, {});
      await loader.load("tiktok-account");
      assert.equal(loader.getCapabilities()["tiktok-account"].status, "ready", path);
      const settings = loader.getSettings()["tiktok-account"];
      assert.equal(settings.privacyLevel, scenario.expected, path);
      assert.equal(settings.brandOrganic, true, path);
      assert.equal(settings.commercialContentDisclosureEnabled, true, path);
      assert.equal(settings.brandedContent, false, path);
    }
    const edited = { ...getDefaultScheduleTargetSettings("tiktok"), privacyLevel: "SELF_ONLY", brandOrganic: false, commercialContentDisclosureEnabled: false };
    const other = getDefaultScheduleTargetSettings("instagram");
    const loader = capabilityLoader(path, {
      directPostAudited: true, privacyLevels: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
      interactions: { commentsDisabled: false, duetsDisabled: false, stitchesDisabled: false },
    }, { "tiktok-account": edited, "other-account": other });
    await loader.load("tiktok-account");
    assert.deepEqual(loader.getSettings()["tiktok-account"], edited, path);
    assert.equal(loader.getSettings()["other-account"], other, path);
  }
});
