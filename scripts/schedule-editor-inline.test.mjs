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
import * as timeDisplay from "../lib/scheduling/time-display.ts";
import * as scheduleTime from "../lib/scheduling/schedule-time.ts";
import * as tiktok from "../lib/social/tiktok-publishing.ts";
import { withReadDeadline } from "../lib/http/read-deadline.ts";

const source = readFileSync(new URL("../components/scheduling/schedule-editor.tsx", import.meta.url), "utf8");
const nodes = value => value == null ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
const text = value => value == null || typeof value === "boolean" ? "" : Array.isArray(value) ? value.map(text).join("") : typeof value === "object" ? text(value.props?.children) : String(value);
const settle = () => new Promise(setImmediate);
const finalVideo = { id: "00000000-0000-4000-8000-000000000010", sourceType: "combined_video", status: "ready", title: "Finished video", mediaUrl: "/fixture.mp4" };

// Render the real editor, execute its effects, and drive actual event handlers.
// Only browser primitives and network responses are isolated; validators stay real.
function fixture(overrides = {}, instant = Date.now()) {
  let cursor = 0, tree;
  let now = instant, tick;
  class FixtureDate extends Date { static now() { return now; } }
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
    "@/components/scheduling/schedule-quick-actions": { ScheduleQuickActions: "quick-actions" },
    "./use-device-time-format": { useDeviceTimeFormat: () => overrides.hour12 === true },
    "@/lib/scheduling/time-display": timeDisplay,
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
    "@/lib/http/read-deadline": { withReadDeadline },
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
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText + "\nexports.__ScheduleTimePicker = ScheduleTimePicker;", {
    exports: exported, require(name) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
    document, HTMLElement: class {}, AbortController, Intl, Date: FixtureDate, Error, console,
    window: { setInterval: callback => { tick = callback; return 1; }, clearInterval() {}, requestAnimationFrame: callback => { browser.frames++; frames.push(callback); return browser.frames; }, cancelAnimationFrame() {} },
    fetch: async (url, options) => {
      calls.push({ url, options });
      assert.match(url, /\/publish-settings$/);
      return Response.json({ ok: true, capabilities: { privacyLevels: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"], directPostAudited: true, maxVideoDurationSeconds: 600, creatorUsername: "fixture", interactions: { commentsDisabled: false, duetsDisabled: false, stitchesDisabled: false } } });
    },
  });
  const accounts = ["instagram", "tiktok", "youtube"].map((platform, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, platform, status: "connected", scopes: [platform === "instagram" ? "instagram_business_content_publish" : platform === "tiktok" ? "video.publish" : "https://www.googleapis.com/auth/youtube.upload"], supportsBackgroundRefresh: true }));
  const props = { initialUseDefaultScheduleTime: false, presentation: "inline", finalVideo, demoMediaOptions: [finalVideo], hookMediaOptions: [], editingIsCombinedVideo: false, editingPlannedPlatforms: [], editingSchedule: null, editingScheduledDate: null, editingScheduledTime: null, errorMessage: null,
    initialClipSelection: "secondary_only", initialDemoMediaId: finalVideo.id, initialHookMediaId: "", initialCaption: "My exact caption", initialPlannedTargets: [{ connectionId: accounts[0].id, platform: "instagram", settings: { shareToFeed: false } }], initialScheduledDate: "2099-12-01", initialScheduledTime: "16:30", minimumScheduleLeadMinutes: 5, requireScheduleTarget: true, saving: false, socialConnections: accounts, tiktokBetaEnabled: true, youtubeBetaEnabled: true,
    onClose() { browser.closed++; }, onCloseDraft(value) { snapshots.push(value); }, onRefreshMedia: async () => true, onRefreshConnections: async () => true, onSave(value) { submitted.push(value); }, ...overrides };
  return { props, browser, submitted, snapshots, calls,
    advance(milliseconds, refresh = true) { now += milliseconds; if (refresh) tick?.(); },
    render() { cursor = 0; tree = exported.ScheduleEditor(props);
      const region = nodes(tree).find(node => ["region", "dialog"].includes(node.props?.role));
      region.props.ref.current = { focus() { browser.focused++; }, scrollIntoView() { browser.scrolled++; } };
      while (effects.length) effects.shift()(); while (frames.length) frames.shift()(); return tree; },
    nodes() { return nodes(tree); },
    picker(value, onChange) { cursor = 0; tree = exported.__ScheduleTimePicker({ value, onChange, invalid: false }); return tree; },
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

test("the scheduler deduplicates Demo and Creative Assets into one video selection and one-video API payload", async () => {
  const h = ordinaryFixture({ hookMediaOptions: [secondaryVideo, hookVideo] }); await renderSettled(h);
  const picker = control(h, "ScheduleVideoPicker");
  assert.equal(picker.props.mediaOptions.length, 2);
  assert.equal(h.nodes().filter(node => node.type?.name === "ScheduleVideoPicker").length, 1);
  assert.equal(control(h, "ScheduleOpeningClipControl"), undefined);
  assert.equal(control(h, "ScheduleRoleMediaPicker"), undefined);
  picker.props.onSelectMedia(hookVideo.id); h.render();
  assert.equal(h.save().props.disabled, false); h.save().props.onClick();
  const saved = h.submitted[0];
  assert.equal(saved.clipSelection, "secondary_only"); assert.equal(saved.openingMedia, null);
  assert.equal(saved.useOpeningClip, false); assert.equal(saved.scheduledSource.id, hookVideo.id);
  const workspace = readFileSync(new URL("../components/scheduling/scheduling-workspace.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("workspace.tsx", workspace, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const build = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "buildScheduleRequestBody");
  const code = ts.transpileModule(build.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const body = vm.runInNewContext(`${code}\nbuildScheduleRequestBody`)(saved);
  assert.equal(body.metadata.mediaMode, "single_video"); assert.equal(body.metadata.hookMediaId, null);
  assert.equal(body.source.id, hookVideo.id); h.unmount();
});

test("refresh selects newly available media but retains an explicit choice and never schedules by itself", async () => {
  const h = ordinaryFixture({ demoMediaOptions: [] }); await renderSettled(h);
  assert.equal(h.save().props.disabled, true);
  h.props.onRefreshMedia = async () => { h.props.hookMediaOptions = [hookVideo]; return true; }; h.render();
  await control(h, "ScheduleVideoPicker").props.onRefreshMedia(); await renderSettled(h);
  assert.equal(control(h, "ScheduleVideoPicker").props.selectedMediaId, hookVideo.id);
  h.props.demoMediaOptions = [secondaryVideo]; await renderSettled(h);
  assert.equal(control(h, "ScheduleVideoPicker").props.selectedMediaId, hookVideo.id);
  assert.equal(h.submitted.length, 0); h.save().props.onClick();
  assert.equal(h.submitted[0].clipSelection, "secondary_only"); h.unmount();
});

test("removed selected videos block publishing and failed refresh is explained", async () => {
  const h = ordinaryFixture(); await renderSettled(h);
  h.props.demoMediaOptions = [{ ...secondaryVideo, id: "different-video" }]; await renderSettled(h);
  assert.equal(h.save().props.disabled, true);
  assert.match(text(h.save()), /Choose or upload a video/);
  h.save().props.onClick(); assert.equal(h.submitted.length, 0);
  h.props.onRefreshMedia = async () => false; h.render();
  await control(h, "ScheduleVideoPicker").props.onRefreshMedia(); await renderSettled(h);
  assert.equal(control(h, "ScheduleVideoPicker").props.errorMessage, "Could not refresh scheduling media."); h.unmount();
});

test("direct upload blocks submission until completion, selects its exact asset, and survives catalog refresh failure", async () => {
  let finish;
  const h = ordinaryFixture({ onUploadVideo: () => new Promise(resolve => { finish = resolve; }), onRefreshMedia: async () => false });
  await renderSettled(h);
  const uploaded = { ...hookVideo, id: "uploaded-video", title: "Direct upload" };
  const request = control(h, "ScheduleVideoPicker").props.onUploadVideo({ name: "clip.mp4" }); h.render();
  assert.equal(h.save().props.disabled, true); h.save().props.onClick(); assert.equal(h.submitted.length, 0);
  finish(uploaded); await request; await renderSettled(h);
  assert.equal(control(h, "ScheduleVideoPicker").props.selectedMediaId, uploaded.id);
  assert.equal(h.save().props.disabled, false); h.save().props.onClick();
  assert.equal(h.submitted[0].scheduledSource.id, uploaded.id); assert.equal(h.submitted[0].useOpeningClip, false); h.unmount();
});

test("failed upload preserves the selected video and exposes the retryable error", async () => {
  const h = ordinaryFixture({ onUploadVideo: async () => { throw new Error("Upload interrupted"); } }); await renderSettled(h);
  await control(h, "ScheduleVideoPicker").props.onUploadVideo({ name: "clip.mp4" }); await renderSettled(h);
  assert.equal(control(h, "ScheduleVideoPicker").props.selectedMediaId, secondaryVideo.id);
  assert.equal(control(h, "ScheduleVideoPicker").props.errorMessage, "Upload interrupted");
  assert.equal(h.save().props.disabled, false); h.unmount();
});

test("an upload cannot double-submit or accept stale picker/save callbacks in the same frame", async () => {
  let finish, uploads = 0;
  const h = ordinaryFixture({ hookMediaOptions: [hookVideo], onUploadVideo: () => { uploads++; return new Promise(resolve => { finish = resolve; }); } });
  await renderSettled(h);
  const picker = control(h, "ScheduleVideoPicker"), save = h.save();
  const first = picker.props.onUploadVideo({ name: "first.mp4" });
  await picker.props.onUploadVideo({ name: "second.mp4" });
  picker.props.onSelectMedia(hookVideo.id); save.props.onClick(); h.render();
  assert.equal(uploads, 1); assert.equal(h.submitted.length, 0);
  assert.equal(control(h, "ScheduleVideoPicker").props.selectedMediaId, secondaryVideo.id);
  finish({ ...hookVideo, id: "first-upload" }); await first; await renderSettled(h);
  h.save().props.onClick(); assert.equal(h.submitted[0].scheduledSource.id, "first-upload"); h.unmount();
});

test("catalog refresh updates an uploaded video's details while its local snapshot remains a fallback", async () => {
  const uploaded = { ...hookVideo, id: "fresh-upload", title: "Upload response", mediaUrl: "/upload-url.mp4" };
  const refreshed = { ...uploaded, title: "Refreshed title", mediaUrl: "/refreshed-url.mp4" };
  const h = ordinaryFixture({ onUploadVideo: async () => uploaded });
  h.props.onRefreshMedia = async () => { h.props.demoMediaOptions = [refreshed]; return true; };
  await renderSettled(h);
  await control(h, "ScheduleVideoPicker").props.onUploadVideo({ name: "clip.mp4" }); await renderSettled(h);
  assert.equal(control(h, "ScheduleVideoPicker").props.mediaOptions.find(video => video.id === uploaded.id).mediaUrl, refreshed.mediaUrl);
  h.save().props.onClick(); assert.equal(h.submitted[0].scheduledSourceTitle, refreshed.title); h.unmount();
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
  assert.equal(h.nodes().some(node => ["FinalVideoPreview", "ScheduleVideoPreview", "ScheduleVideoPicker"].includes(node.type?.name)), false);
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
  assert.equal(h.nodes().some(node => ["ScheduleVideoPicker"].includes(node.type?.name)), false);
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

test("legacy combined schedules remain intact until a single replacement video is explicitly chosen", async () => {
  for (const replace of [false, true]) {
    const h = ordinaryFixture({ hookMediaOptions: [hookVideo], initialHookMediaId: hookVideo.id, initialDemoMediaId: secondaryVideo.id,
      editingIsCombinedVideo: true, editingSchedule: { title: "Saved sequence", metadata: { clipSelection: "hook_and_secondary" }, caption: "Saved caption" } });
    await renderSettled(h);
    assert.equal(control(h, "ScheduleVideoPicker").props.savedSequenceTitle, "Saved sequence");
    if (replace) { control(h, "ScheduleVideoPicker").props.onSelectMedia(hookVideo.id); h.render(); }
    assert.equal(h.save().props.disabled, false); h.save().props.onClick();
    assert.equal(h.submitted[0].useOpeningClip, !replace);
    assert.equal(h.submitted[0].clipSelection, replace ? "secondary_only" : "hook_and_secondary");
    assert.equal(h.submitted[0].scheduledSource.id, replace ? hookVideo.id : secondaryVideo.id);
    assert.equal(h.submitted[0].openingMedia?.id ?? null, replace ? null : hookVideo.id); h.unmount();
  }
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


test("workflow account replacement keeps one choice per platform and preserves other platforms", async () => {
  const first = fixture({ presentation: "workflow" });
  const alternate = { ...first.props.socialConnections[0], id: "00000000-0000-4000-8000-000000000009" };
  first.props.socialConnections = [...first.props.socialConnections, alternate];
  await renderSettled(first);
  let picker = first.nodes().find(node => node.type?.name === "ConnectedAccountSelector");
  const youtube = first.props.socialConnections.find(account => account.platform === "youtube");
  picker.props.onToggle(youtube.id); first.render();
  picker = first.nodes().find(node => node.type?.name === "ConnectedAccountSelector");
  picker.props.onToggle(alternate.id); first.render();
  picker = first.nodes().find(node => node.type?.name === "ConnectedAccountSelector");
  assert.deepEqual(Array.from(picker.props.selectedConnectionIds).sort(), [alternate.id, youtube.id].sort());
  first.save().props.onClick();
  assert.equal(first.submitted[0].targets.length, 2);
  assert.equal(first.submitted[0].targets.find(target => target.platform === "instagram").connectionId, alternate.id);
  first.unmount();
  const ordinary = fixture({ presentation: "modal" }); ordinary.props.socialConnections = [...ordinary.props.socialConnections, alternate];
  await renderSettled(ordinary);
  ordinary.nodes().find(node => node.type?.name === "ConnectedAccountSelector").props.onToggle(alternate.id); ordinary.render();
  assert.equal(ordinary.nodes().find(node => node.type?.name === "ConnectedAccountSelector").props.selectedConnectionIds.length, 2, "Generic Scheduling retains its multiple-account behavior");
  ordinary.unmount();
});

test("the screenshot's 02:49 is past at 14:40 IST, while 14:49 submits the intended afternoon instant", async () => {
  const h = fixture({ presentation: "workflow", initialScheduledDate: "2026-10-14", initialScheduledTime: "02:49" }, Date.parse("2026-10-14T09:10:30Z"));
  await renderSettled(h);
  assert.equal(h.save().props.disabled, true);
  assert.match(text(h.nodes().find(node => node.props?.id === "schedule-time-feedback")), /in the past/);
  assert.match(text(h.nodes().find(node => node.props?.id === "schedule-clock-help")), /Now: 2026-10-14 14:40.*Asia\/Calcutta.*Earliest: 2026-10-14 14:46/);
  h.save().props.onClick(); assert.equal(h.submitted.length, 0);
  control(h, "ScheduleTimePicker").props.onChange("14:49"); h.render();
  assert.equal(h.save().props.disabled, false);
  assert.equal(h.nodes().find(node => node.props?.id === "schedule-time-feedback"), undefined);
  assert.equal(h.submitted.length, 0);
  h.save().props.onClick();
  assert.equal(h.submitted[0].scheduledTime, "14:49");
  assert.equal(h.submitted[0].scheduledFor, "2026-10-14T09:19:00.000Z");
  h.unmount();
});

test("24-hour selection preserves morning, afternoon, midnight and noon without period conversion", () => {
  for (const value of ["02:49", "14:49", "00:05", "12:05", "23:59"]) {
    const h = fixture(); let changed;
    const tree = h.picker(value, next => { changed = next; });
    const trigger = h.nodes().find(node => node.type === "PopoverTrigger");
    assert.equal(text(trigger), value);
    assert.equal(trigger.props.render.props["aria-label"], `Choose publish time, currently ${value}`);
    assert.equal(h.nodes().find(node => node.props?.name === "scheduledTime").props.value, value);
    const rails = nodes(tree).filter(node => node.type?.name === "ScheduleTimeRail");
    assert.deepEqual(Array.from(rails, node => node.props.label), ["Hour", "Minute"]);
    assert.deepEqual(Array.from(rails[0].props.values), Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0")));
    rails.find(node => node.props.label === "Hour").props.onSelect("12");
    assert.equal(changed, `12:${value.slice(3)}`);
    rails.find(node => node.props.label === "Hour").props.onSelect("00");
    assert.equal(changed, `00:${value.slice(3)}`);
    rails.find(node => node.props.label === "Minute").props.onSelect("17");
    assert.equal(changed, `${value.slice(0, 2)}:17`);
  }
});

test("next available time rolls into tomorrow in the selected timezone without submitting or losing the draft", async () => {
  const changes = [];
  const h = fixture({ presentation: "workflow", initialTimezone: "Asia/Kolkata", initialScheduledDate: "2026-10-14", initialScheduledTime: "23:59", onDraftChange: value => changes.push(value) }, Date.parse("2026-10-14T18:27:30Z"));
  await renderSettled(h);
  const before = changes.at(-1);
  assert.equal(h.save().props.disabled, true);
  h.nodes().find(node => node.type === "button" && text(node) === "Use next available time").props.onClick(); h.render();
  const after = changes.at(-1);
  assert.equal(after.date, "2026-10-15"); assert.equal(after.time, "00:04");
  assert.equal(after.timezone, "Asia/Kolkata"); assert.equal(after.caption, before.caption);
  assert.deepEqual(after.targets, before.targets);
  assert.equal(h.save().props.disabled, false); assert.equal(h.submitted.length, 0);
  h.save().props.onClick(); assert.equal(h.submitted[0].scheduledFor, "2026-10-14T18:34:00.000Z");
  h.unmount();
});

test("submission revalidates a sleeping tab and minute refresh disables a newly expired slot", async () => {
  for (const refresh of [false, true]) {
    const h = fixture({ presentation: "workflow", initialScheduledDate: "2026-10-14", initialScheduledTime: "14:46" }, Date.parse("2026-10-14T09:10:30Z"));
    await renderSettled(h); assert.equal(h.save().props.disabled, false);
    h.advance(31_000, refresh); if (refresh) h.render();
    if (refresh) assert.equal(h.save().props.disabled, true);
    h.save().props.onClick(); h.render();
    assert.equal(h.submitted.length, 0); assert.equal(h.save().props.disabled, true);
    assert.match(text(h.nodes().find(node => node.props?.id === "schedule-clock-help")), /Earliest: 2026-10-14 14:47/);
    h.unmount();
  }
});


test("default Post now is a single action, resolves at click time and retains optional manual scheduling", async () => {
  const h=fixture({initialUseDefaultScheduleTime:true,initialScheduledDate:"2000-01-01",initialScheduledTime:"21:30"});await renderSettled(h);
  assert.equal(h.nodes().filter(node=>node.props?.["aria-label"]==="Publishing time").length,0);
  assert.equal(h.nodes().filter(node=>node.type==="SharedButton"&&text(node).includes("Post now")).length,1);
  assert.equal(h.submitted.length,0);assert.equal(h.save().props.disabled,false);
  h.advance(3600000);h.render();h.save().props.onClick();assert.equal(h.submitted[0].useDefaultScheduleTime,true);
  control(h,"ScheduleTimePicker").props.onChange("21:30");h.render();assert.equal(h.save().props.disabled,true);h.unmount();
});

test("Post now cannot silently create a targetless draft in generic Scheduling", async () => {
  const h=fixture({requireScheduleTarget:false,initialPlannedTargets:[],initialUseDefaultScheduleTime:true});await renderSettled(h);
  assert.equal(h.save().props.disabled,true);h.save().props.onClick();assert.equal(h.submitted.length,0);h.unmount();
});

test("five-minute shortcut resolves at final click and either manual field restores exact scheduling", async () => {
  for (const manual of [null, "date", "time", "other-preset"]) {
    const h = fixture({ presentation: "workflow", initialUseDefaultScheduleTime: true, initialTimezone: "Asia/Calcutta" }, Date.parse("2026-10-26T12:00:30Z"));
    await renderSettled(h);
    h.nodes().find(node => node.type === "quick-actions").props.onSelect({ date: "2026-10-26", time: "17:36" }, 5); h.render();
    assert.equal(text(h.save()), "Schedule post", "Retain the existing final button label");
    assert.equal(h.submitted.length, 0);
    h.advance(20 * 60_000); h.render();
    if (manual === "date") h.nodes().find(node => node.props?.name === "scheduledDate").props.onChange({ target: { value: "2026-10-27" } });
    if (manual === "time") control(h, "ScheduleTimePicker").props.onChange("21:30");
    if (manual === "other-preset") h.nodes().find(node => node.type === "quick-actions").props.onSelect({ date: "2026-10-26", time: "19:00" }, 60);
    h.render(); assert.equal(h.save().props.disabled, false); h.save().props.onClick();
    const result = h.submitted[0];
    assert.equal(result.caption, "My exact caption"); assert.equal(result.scheduledSource.id, finalVideo.id);
    assert.equal(result.useDefaultScheduleTime, manual ? undefined : true);
    assert.equal(result.scheduledFor, manual === "date" ? "2026-10-27T12:06:00.000Z" : manual === "time" ? "2026-10-26T16:00:00.000Z" : manual === "other-preset" ? "2026-10-26T13:30:00.000Z" : "2026-10-26T12:26:00.000Z");
    h.unmount();
  }
});


test("12-hour rail preserves midnight/noon and converts AM/PM without changing wall-clock storage", () => {
  const h=fixture({hour12:true});let next;
  h.picker("00:30",value=>next=value);
  assert.match(text(h.nodes().find(node=>node.type==="PopoverTrigger")),/12:30.*AM/i);
  const rails=h.nodes().filter(node=>node.type?.name==="ScheduleTimeRail");
  assert.equal(rails.find(node=>node.props.label==="Hour").props.values.length,12);
  rails.find(node=>node.props.label==="AM/PM").props.onSelect("PM");assert.equal(next,"12:30");
  h.picker("21:30",value=>next=value);
  assert.match(text(h.nodes().find(node=>node.type==="PopoverTrigger")),/9:30.*PM/i);
  h.nodes().find(node=>node.props?.label==="Hour").props.onSelect("12");assert.equal(next,"12:30");
  h.nodes().find(node=>node.props?.label==="AM/PM").props.onSelect("AM");assert.equal(next,"09:30");
  h.unmount();
});
