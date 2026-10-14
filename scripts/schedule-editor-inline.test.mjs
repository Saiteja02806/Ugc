import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as persistence from "../lib/scheduling/schedule-form-persistence.ts";
import * as platformSettings from "../lib/scheduling/platform-settings.ts";
import * as connectionPolicy from "../lib/scheduling/social-connection-policy.ts";
import * as accountPicker from "../lib/scheduling/account-picker.ts";
import * as scheduleTypes from "../lib/scheduling/types.ts";
import * as scheduleTime from "../lib/scheduling/schedule-time.ts";
import * as tiktok from "../lib/social/tiktok-publishing.ts";

const source = readFileSync(new URL("../components/scheduling/schedule-editor.tsx", import.meta.url), "utf8");
const nodes = value => value == null ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
const text = value => value == null || typeof value === "boolean" ? "" : Array.isArray(value) ? value.map(text).join("") : typeof value === "object" ? text(value.props?.children) : String(value);
const settle = () => new Promise(setImmediate);
const finalVideo = { id: "00000000-0000-4000-8000-000000000010", sourceType: "combined_video", status: "ready", title: "Finished video", mediaUrl: "/fixture.mp4" };

// Render the real editor, execute its effects, and drive actual event handlers.
// Only browser primitives and network responses are isolated; validators stay real.
function fixture(overrides = {}) {
  let cursor = 0, tree;
  const slots = [], effects = [], frames = [], submitted = [], snapshots = [], calls = [];
  const browser = { overflow: "auto", listeners: 0, frames: 0, focused: 0, scrolled: 0, closed: 0 };
  const changed = (a, b) => !a || b.some((value, index) => !Object.is(value, a[index]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === "function" ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === "function" ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(create, deps) { const i = cursor++; if (changed(slots[i]?.deps, deps)) slots[i] = { deps, value: create() }; return slots[i].value; },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(create, deps) { const i = cursor++, prior = slots[i]; if (changed(prior?.deps, deps)) { slots[i] = { deps }; effects.push(() => { prior?.cleanup?.(); slots[i].cleanup = create(); }); } },
  };
  const document = { activeElement: null, body: { style: { get overflow() { return browser.overflow; }, set overflow(value) { browser.overflow = value; } } },
    addEventListener() { browser.listeners++; }, removeEventListener() { browser.listeners--; } };
  const imports = {
    "./schedule-editor.module.css": { default: { refreshAccounts: "refreshAccounts" } },
    react, "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "lucide-react": new Proxy({}, { get: (_, name) => name }),
    "@/components/ui/button": { Button: "SharedButton" },
    "@/components/social/platform-icon": { SocialPlatformIcon: "SocialPlatformIcon" },
    "@/components/social/instagram-caption-preview": { InstagramCaptionPreview: "InstagramCaptionPreview" },
    "@/components/ui/popover": new Proxy({}, { get: (_, name) => name }),
    "@/components/providers/account-timezone-provider": { useAccountTimeZone: () => "Asia/Calcutta" },
    "@/lib/scheduling/account-timezone": { getSchedulingTimeZoneOptions: value => [{ value, label: value }] },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "fixture-token" },
    "@/lib/scheduling/publishing-preferences-client": { requestPublishingPreferences: async () => ({ containsSyntheticMedia: false }) },
    "@/lib/scheduling/schedule-form-persistence": persistence,
    "@/lib/scheduling/platform-settings": platformSettings,
    "@/lib/scheduling/social-connection-policy": connectionPolicy,
    "@/lib/scheduling/account-picker": accountPicker,
    "@/lib/scheduling/types": scheduleTypes,
    "@/lib/scheduling/schedule-time": scheduleTime,
    "@/lib/social/tiktok-publishing": tiktok,
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: exported, require(name) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
    document, HTMLElement: class {}, AbortController, Intl, Date, console,
    window: { setInterval: () => 1, clearInterval() {}, requestAnimationFrame: callback => { browser.frames++; frames.push(callback); return browser.frames; }, cancelAnimationFrame() {} },
    fetch: async (url, options) => {
      calls.push({ url, options });
      assert.match(url, /\/publish-settings$/);
      return Response.json({ ok: true, capabilities: { privacyLevels: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"], directPostAudited: true, maxVideoDurationSeconds: 600, creatorUsername: "fixture", interactions: { commentsDisabled: false, duetsDisabled: false, stitchesDisabled: false } } });
    },
  });
  const accounts = ["instagram", "tiktok", "youtube"].map((platform, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, platform, status: "connected", scopes: [platform === "instagram" ? "instagram_business_content_publish" : platform === "tiktok" ? "video.publish" : "https://www.googleapis.com/auth/youtube.upload"], supportsBackgroundRefresh: true }));
  const props = { presentation: "inline", finalVideo, demoMediaOptions: [finalVideo], hookMediaOptions: [], editingIsCombinedVideo: false, editingPlannedPlatforms: [], editingSchedule: null, editingScheduledDate: null, editingScheduledTime: null, errorMessage: null,
    initialClipSelection: "secondary_only", initialDemoMediaId: finalVideo.id, initialHookMediaId: "", initialCaption: "My exact caption", initialPlannedTargets: [{ connectionId: accounts[0].id, platform: "instagram", settings: { shareToFeed: false } }], initialScheduledDate: "2099-12-01", initialScheduledTime: "16:30", minimumScheduleLeadMinutes: 5, requireScheduleTarget: true, saving: false, socialConnections: accounts, tiktokBetaEnabled: true, youtubeBetaEnabled: true,
    onClose() { browser.closed++; }, onCloseDraft(value) { snapshots.push(value); }, onRefreshMedia: async () => true, onRefreshConnections: async () => true, onSave(value) { submitted.push(value); }, ...overrides };
  return { props, browser, submitted, snapshots, calls,
    render() { cursor = 0; tree = exported.ScheduleEditor(props);
      const region = nodes(tree).find(node => ["region", "dialog"].includes(node.props?.role));
      region.props.ref.current = { focus() { browser.focused++; }, scrollIntoView() { browser.scrolled++; } };
      while (effects.length) effects.shift()(); while (frames.length) frames.shift()(); return tree; },
    nodes() { return nodes(tree); },
    save() { return nodes(tree).find(node => node.type === "SharedButton" && node.props.onClick?.name === "handleSaveDraft"); },
    publishing() { return nodes(tree).find(node => node.type?.name === "PlatformPublishingSettings"); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

const secondaryVideo = { ...finalVideo, id: "00000000-0000-4000-8000-000000000025", sourceType: "demo_video", title: "Uploaded secondary video" };
const hookVideo = { ...finalVideo, id: "00000000-0000-4000-8000-000000000026", sourceType: "user_video", title: "Uploaded hook video" };
const control = (h, name) => h.nodes().find(node => node.type?.name === name);
const ordinaryFixture = (overrides = {}) => fixture({ presentation: "modal", finalVideo: undefined, pendingVideo: undefined, initialClipSelection: undefined, initialDemoMediaId: "", initialHookMediaId: "", demoMediaOptions: [secondaryVideo], hookMediaOptions: [], ...overrides });
async function renderSettled(h) { h.render(); await settle(); h.render(); h.render(); }

test("an uploaded secondary video schedules alone without requiring a hook", async () => {
  const h = ordinaryFixture(); await renderSettled(h);
  assert.equal(control(h, "ScheduleOpeningClipControl").props.enabled, false);
  assert.equal(control(h, "ScheduleRoleMediaPicker").props.enabled, true);
  assert.equal(h.save().props.disabled, false); h.save().props.onClick();
  const saved = h.submitted[0];
  assert.equal(saved.clipSelection, "secondary_only"); assert.equal(saved.openingMedia, null);
  assert.equal(saved.useOpeningClip, false); assert.equal(saved.scheduledSource.id, secondaryVideo.id);
  // Validate the actual API payload as well as the editor's submitted selection.
  const workspace = readFileSync(new URL("../components/scheduling/scheduling-workspace.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("workspace.tsx", workspace, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const build = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "buildScheduleRequestBody");
  assert.ok(build);
  const code = ts.transpileModule(build.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const buildRequest = vm.runInNewContext(`${code}\nbuildScheduleRequestBody`);
  const body = buildRequest(saved);
  assert.equal(body.metadata.mediaMode, "single_video"); assert.equal(body.metadata.hookMediaId, null);
  assert.equal(body.source.id, secondaryVideo.id); h.unmount();
});

test("refreshing an empty scheduler selects and includes the newly uploaded secondary video", async () => {
  for (const initialDemoMediaId of ["", secondaryVideo.id]) {
    const h = ordinaryFixture({ demoMediaOptions: [], initialDemoMediaId });
    h.props.onRefreshMedia = async () => { h.props.demoMediaOptions = [secondaryVideo]; return true; };
    await renderSettled(h);
    assert.equal(h.save().props.disabled, true);
    assert.equal(control(h, "ScheduleOpeningClipControl").props.enabled, false);
    await control(h, "ScheduleRoleMediaPicker").props.onRefreshMedia(); await renderSettled(h);
    assert.equal(control(h, "ScheduleRoleMediaPicker").props.enabled, true);
    assert.equal(control(h, "ScheduleRoleMediaPicker").props.selectedMediaId, secondaryVideo.id);
    assert.equal(control(h, "ScheduleOpeningClipControl").props.enabled, false);
    assert.equal(h.save().props.disabled, false);
    assert.equal(h.submitted.length, 0, "Refresh must not schedule automatically");
    h.save().props.onClick(); assert.equal(h.submitted[0].clipSelection, "secondary_only"); h.unmount();
  }
});

test("a hook arriving after an empty catalog is selected and included too", async () => {
  const h = ordinaryFixture({ demoMediaOptions: [] }); await renderSettled(h);
  h.props.hookMediaOptions = [hookVideo]; await renderSettled(h);
  assert.equal(control(h, "ScheduleOpeningClipControl").props.enabled, true);
  assert.equal(control(h, "ScheduleOpeningMediaPicker").props.selectedMediaId, hookVideo.id);
  assert.equal(h.save().props.disabled, false); h.save().props.onClick();
  assert.equal(h.submitted[0].clipSelection, "hook_only"); assert.equal(h.submitted[0].scheduledSource.id, hookVideo.id); h.unmount();
});

test("refresh keeps explicit Skip choices and the already selected video", async () => {
  const h = ordinaryFixture({ hookMediaOptions: [hookVideo] }); await renderSettled(h);
  control(h, "ScheduleOpeningClipControl").props.onToggle(false);
  control(h, "ScheduleRoleMediaPicker").props.onToggle(false); h.render();
  h.props.hookMediaOptions = [{ ...hookVideo, id: "new-hook" }, hookVideo];
  h.props.demoMediaOptions = [{ ...secondaryVideo, id: "new-secondary" }, secondaryVideo];
  await renderSettled(h);
  assert.equal(control(h, "ScheduleOpeningClipControl").props.enabled, false);
  assert.equal(control(h, "ScheduleRoleMediaPicker").props.enabled, false);
  assert.equal(control(h, "ScheduleRoleMediaPicker").props.selectedMediaId, secondaryVideo.id);
  assert.equal(h.save().props.disabled, true); h.save().props.onClick(); assert.equal(h.submitted.length, 0); h.unmount();
});

test("a saved or explicitly secondary-only schedule cannot gain a hook from refresh", async () => {
  for (const overrides of [
    { initialClipSelection: "secondary_only" },
    { editingSchedule: { metadata: { clipSelection: "secondary_only" }, caption: "Saved caption" } },
  ]) {
    const h = ordinaryFixture({ initialDemoMediaId: secondaryVideo.id, ...overrides }); await renderSettled(h);
    h.props.hookMediaOptions = [hookVideo]; await renderSettled(h);
    assert.equal(control(h, "ScheduleOpeningClipControl").props.enabled, false);
    assert.equal(control(h, "ScheduleRoleMediaPicker").props.enabled, true);
    assert.equal(h.save().props.disabled, false); h.save().props.onClick();
    assert.equal(h.submitted[0].clipSelection, "secondary_only"); h.unmount();
  }
});

test("a missing included hook explains the clip problem instead of asking for date and time", async () => {
  const h = ordinaryFixture(); await renderSettled(h);
  control(h, "ScheduleOpeningClipControl").props.onToggle(true); h.render();
  assert.equal(h.save().props.disabled, true);
  assert.match(text(h.save()), /Select a hook clip or turn it off\./);
  assert.doesNotMatch(text(h.save()), /Choose date and time/);
  h.save().props.onClick(); assert.equal(h.submitted.length, 0);
  control(h, "ScheduleOpeningClipControl").props.onToggle(false); h.render();
  assert.equal(h.save().props.disabled, false); h.save().props.onClick();
  assert.equal(h.submitted[0].clipSelection, "secondary_only"); h.unmount();
});

test("refresh does not replace a removed selection with another clip and exposes failures without a hook", async () => {
  const h = ordinaryFixture(); await renderSettled(h);
  h.props.demoMediaOptions = [{ ...secondaryVideo, id: "different-video" }]; await renderSettled(h);
  assert.equal(h.save().props.disabled, true);
  assert.match(text(h.save()), /Select a secondary clip or turn it off\./);
  h.save().props.onClick(); assert.equal(h.submitted.length, 0);
  h.props.onRefreshMedia = async () => false;
  h.render();
  await control(h, "ScheduleRoleMediaPicker").props.onRefreshMedia(); await renderSettled(h);
  assert.equal(control(h, "ScheduleRoleMediaPicker").props.errorMessage, "Could not refresh scheduling media.");
  assert.equal(control(h, "ScheduleOpeningClipControl").props.enabled, false); h.unmount();
});

test("background preparation can be confirmed only for the fixed inline pending video", async () => {
  const pendingVideo = { ...finalVideo, status: "missing_render", mediaUrl: undefined };
  const h = fixture({ finalVideo: undefined, pendingVideo, demoMediaOptions: [pendingVideo] });
  h.render(); await settle(); h.render();
  assert.equal(h.save().props.disabled, false); h.save().props.onClick();
  assert.equal(h.submitted.length, 1); assert.equal(h.submitted[0].scheduledSource.id, pendingVideo.id); h.unmount();
  for (const overrides of [{ finalVideo: pendingVideo, pendingVideo: undefined }, { pendingVideo: { ...pendingVideo, id: "different-id" } }, { pendingVideo: { ...pendingVideo, sourceType: "edit_video" } }]) {
    const other = fixture({ finalVideo: undefined, pendingVideo, demoMediaOptions: [pendingVideo], ...overrides });
    other.render(); await settle(); other.render();
    assert.equal(other.save().props.disabled, true, JSON.stringify(overrides)); other.save().props.onClick(); assert.equal(other.submitted.length, 0); other.unmount();
  }
  // The ordinary scheduler can still save an existing render-required draft;
  // it uses its original server preparation flow rather than Explore's bypass.
  const modal = fixture({ presentation: "modal", finalVideo: undefined, pendingVideo, demoMediaOptions: [pendingVideo] });
  modal.render(); await settle(); modal.render();
  assert.equal(modal.nodes().some(node => node.props?.role === "dialog"), true);
  assert.equal(text(modal.nodes()).includes("Video preparation will continue in the background"), false); modal.unmount();
});

test("inline confirmation stays in a region without body lock, overlay focus trapping or duplicate final media", async () => {
  const h = fixture();
  h.render(); await settle(); h.render();
  assert.equal(h.browser.overflow, "auto"); assert.equal(h.browser.listeners, 0);
  assert.equal(h.browser.focused, 1); assert.equal(h.browser.scrolled, 1);
  assert.equal(h.nodes().some(node => node.props?.role === "dialog"), false);
  assert.match(text(h.nodes().find(node => node.props?.role === "region")), /Confirm your schedule/);
  assert.equal(h.nodes().some(node => node.props?.className?.includes("fixed inset-0")), false);
  assert.equal(h.nodes().some(node => node.props?.["aria-label"] === "Scheduling checklist"), false);
  assert.equal(h.nodes().some(node => ["FinalVideoPreview", "CompositionPreview", "ScheduleOpeningClipControl", "ScheduleRoleMediaPicker"].includes(node.type?.name)), false);
  assert.ok(h.publishing(), "Provider publishing controls remain in the inline region");
  assert.equal(h.submitted.length, 0, "Opening confirmation must never schedule automatically");
  h.props.onClose = () => {}; h.render();
  assert.equal(h.browser.focused, 1, "Changing parent handlers must not refocus during typing");
  assert.equal(h.save().props.disabled, false); h.save().props.onClick();
  const saved = h.submitted[0];
  assert.equal(saved.scheduledSource.id, finalVideo.id); assert.equal(saved.scheduledSource.kind, "media_asset");
  assert.equal(saved.openingMedia, null); assert.equal(saved.clipSelection, "secondary_only");
  assert.equal(saved.caption, "My exact caption"); assert.equal(saved.targets[0].settings.shareToFeed, false);
  assert.equal(saved.timezone, "Asia/Calcutta"); h.unmount();
});

test("inline Back returns unsent edited caption and timing; ordinary modal keeps its focus and scroll behavior", async () => {
  const h = fixture(); h.render(); await settle(); h.render();
  h.nodes().find(node => node.type === "textarea").props.onChange({ target: { value: "Keep these edits" } });
  h.nodes().find(node => node.props?.name === "scheduledDate").props.onChange({ target: { value: "2099-12-02" } });
  h.render();
  h.nodes().find(node => node.props?.["aria-label"] === "Back to schedule settings").props.onClick();
  assert.equal(h.browser.closed, 1); assert.equal(h.submitted.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(h.snapshots[0])), { caption: "Keep these edits", date: "2099-12-02", time: "16:30", timezone: "Asia/Calcutta" });
  h.unmount();
  const modal = fixture({ presentation: undefined }); modal.render();
  assert.equal(modal.browser.overflow, "hidden"); assert.equal(modal.browser.listeners, 1); assert.equal(modal.browser.frames, 1);
  assert.ok(modal.nodes().some(node => node.props?.role === "dialog" && node.props["aria-modal"] === true));
  assert.ok(modal.nodes().some(node => node.props?.["aria-label"] === "Scheduling checklist"));
  assert.ok(modal.nodes().some(node => node.type?.name === "FinalVideoPreview"));
  modal.nodes().find(node => node.props?.["aria-label"] === "Close scheduling workspace").props.onClick();
  assert.equal(modal.snapshots.length, 0); modal.unmount();
  assert.equal(modal.browser.overflow, "auto"); assert.equal(modal.browser.listeners, 0);
});

test("saved Explore slideshow schedules its exact library item without video selectors or null title access", async () => {
  const libraryId = "00000000-0000-4000-8000-000000000020";
  const h = fixture({ finalVideo: undefined, initialLibraryItemId: libraryId, demoMediaOptions: [], initialDemoMediaId: "" });
  h.render(); await settle(); h.render();
  assert.equal(h.save().props.disabled, false); h.save().props.onClick();
  assert.equal(h.submitted.length, 1); assert.equal(h.submitted[0].scheduledSource.id, libraryId);
  assert.equal(h.submitted[0].scheduledSource.kind, "library_item"); assert.equal(h.submitted[0].scheduledVideo, null);
  assert.equal(h.submitted[0].scheduledSourceTitle, "Saved slideshow");
  assert.equal(h.nodes().some(node => ["ScheduleOpeningClipControl", "ScheduleRoleMediaPicker"].includes(node.type?.name)), false);
  h.unmount();
});

test("reopened inline confirmation uses its preserved time zone rather than the account default", async () => {
  const h = fixture({ initialTimezone: "Europe/London" });
  h.render(); await settle(); h.render();
  assert.equal(h.nodes().find(node => node.props?.name === "scheduleTimezone").props.value, "Europe/London");
  h.save().props.onClick();
  assert.equal(h.submitted[0].timezone, "Europe/London");
  assert.equal(h.submitted[0].scheduledFor, "2099-12-01T16:30:00.000Z");
  h.nodes().find(node => node.props?.["aria-label"] === "Back to schedule settings").props.onClick();
  assert.equal(h.snapshots[0].timezone, "Europe/London"); h.unmount();
});

test("ordinary modal retains separate hook/demo selection and its existing composition submission", async () => {
  const hook = { ...finalVideo, id: "00000000-0000-4000-8000-000000000030", sourceType: "user_video", title: "Opening clip" };
  const h = fixture({ presentation: undefined, finalVideo: undefined, hookMediaOptions: [hook], initialHookMediaId: hook.id, initialClipSelection: undefined });
  h.render(); await settle(); h.render();
  assert.ok(h.nodes().some(node => node.type?.name === "ScheduleOpeningClipControl"));
  assert.ok(h.nodes().some(node => node.type?.name === "ScheduleRoleMediaPicker"));
  assert.equal(h.save().props.disabled, false); h.save().props.onClick();
  assert.equal(h.submitted[0].clipSelection, "hook_and_secondary");
  assert.equal(h.submitted[0].scheduledSource.id, finalVideo.id);
  assert.equal(h.submitted[0].openingMedia.id, hook.id); h.unmount();
});

test("inline confirmation retains date, caption and TikTok capability/privacy validation", async () => {
  for (const overrides of [{ initialScheduledDate: "2000-01-01" }, { initialCaption: "x".repeat(5_001) }]) {
    const h = fixture(overrides); h.render(); await settle(); h.render();
    assert.equal(h.save().props.disabled, true); h.save().props.onClick(); assert.equal(h.submitted.length, 0); h.unmount();
  }
  const tiktokId = "00000000-0000-4000-8000-000000000002";
  const h = fixture({ initialPlannedTargets: [{ connectionId: tiktokId, platform: "tiktok", settings: {} }] });
  h.render(); await settle(); h.render();
  assert.equal(h.calls.length, 1); assert.equal(h.save().props.disabled, true);
  h.save().props.onClick(); assert.equal(h.submitted.length, 0);
  h.publishing().props.onChange(tiktokId, "privacyLevel", "PUBLIC_TO_EVERYONE"); h.render();
  assert.equal(h.save().props.disabled, false); h.save().props.onClick();
  assert.equal(h.submitted[0].targets[0].settings.privacyLevel, "PUBLIC_TO_EVERYONE");
  assert.equal(h.submitted[0].targets[0].settings.allowComment, false); h.unmount();
});


test("workflow scheduling has one direct Schedule post action and no confirmation screen", async () => {
  const h = fixture({ presentation: "workflow" }); await renderSettled(h);
  const region = h.nodes().find(node => node.props?.role === "region");
  assert.match(text(region), /Schedule your video/);
  assert.doesNotMatch(text(region), /Confirm your schedule|Review schedule/);
  assert.equal(h.nodes().filter(node => node.type === "SharedButton" && text(node) === "Schedule post").length, 1);
  assert.equal(h.browser.overflow, "auto");
  assert.equal(h.submitted.length, 0);
  h.save().props.onClick();
  assert.equal(h.submitted.length, 1);
  assert.equal(h.submitted[0].scheduledSource.id, finalVideo.id);
  assert.equal(h.submitted[0].targets[0].settings.shareToFeed, false);
  h.unmount();
});


test("workflow form keeps its preview draft in sync without repeated parent updates or scheduling", async () => {
  const changes = [];
  const h = fixture({ presentation: "workflow", onDraftChange: value => changes.push(value) });
  await renderSettled(h);
  assert.equal(changes.length, 1);
  h.nodes().find(node => node.type === "textarea").props.onChange({ target: { value: "Updated live caption" } });
  h.render();
  assert.equal(changes.at(-1).caption, "Updated live caption");
  const count = changes.length;
  h.props.initialCaption = "Updated live caption";
  h.props.onDraftChange = value => changes.push(value);
  h.render(); h.render();
  assert.equal(changes.length, count);
  assert.equal(changes.at(-1).targets[0].connectionId, h.props.initialPlannedTargets[0].connectionId);
  assert.equal(h.submitted.length, 0);
  h.nodes().find(node => node.props?.["aria-label"] === "Back to Edit").props.onClick();
  assert.equal(h.snapshots[0].caption, "Updated live caption");
  assert.equal(h.snapshots[0].targets[0].connectionId, h.props.initialPlannedTargets[0].connectionId);
  h.unmount();
});
