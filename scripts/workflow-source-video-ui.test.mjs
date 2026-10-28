import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { withReadDeadline } from "../lib/http/read-deadline.ts";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const element = (type, props = {}) => typeof type === "function" ? type(props) : { type, props };
const jsx = { jsx: element, jsxs: element, Fragment: "fragment" };
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : ""; }
function runtime() {
  let cursor = 0; const slots = [], effects = [];
  return { react: {
    useCallback(callback) { cursor++; return callback; },
    useId() { return `source-${cursor++}`; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], v => { slots[i] = typeof v === "function" ? v(slots[i]) : v; }]; },
    useEffect(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((v, n) => !Object.is(v, prior.deps[n]))) effects.push(() => { prior?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
    useLayoutEffect(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((v, n) => !Object.is(v, prior.deps[n]))) effects.push(() => { prior?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  }, render(fn) { cursor = 0; const tree = fn(); while (effects.length) effects.shift()(); return tree; }, unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}
function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, Error, AbortController, URLSearchParams, ...globals,
  });
  return exports;
}
const css = { default: new Proxy({}, { get: (_, name) => name }) };
const tick = () => new Promise(setImmediate);
const asset = { id: "00000000-0000-4000-8000-000000000001", title: "Existing hook", url: "https://media.example/hook.mp4", status: "ready", collection: "influencer", mimeType: "video/mp4", durationSeconds: 5, fileSizeBytes: 1000, thumbnailUrl: null };

test("source controls in both workflows expose the three choices and keep source failures actionable", () => {
  for (const kind of ["hook", "phone"]) {
    const rt = runtime(), modes = [], uploads = [];
    const mod = load("components/explore/workflow-video-source-section.tsx", {
      react: rt.react, "react/jsx-runtime": jsx, "lucide-react": { FolderOpen: "folder", Upload: "upload", Video: "video-icon", X: "x" },
      "@/components/ui/button": { Button: "button" }, "@/components/explore/workflow-video-asset-picker": { WorkflowVideoAssetPicker: "asset-picker" }, "@/components/explore/workflow-creation.module.css": css,
    });
    const selection = { ownerId: "owner", enabled: true, mode: "generate", preview: null, setMode: mode => modes.push(mode), chooseUpload: file => uploads.push(file) };
    let tree = rt.render(() => mod.WorkflowVideoSourceSection({ kind, selection }));
    const labelled = rt.render(() => mod.WorkflowVideoSourceSection({ kind, selection, label: "Talking head video", hideHeading: true }));
    assert.equal(nodes(labelled).find(n => n.type === "h2").props.className,"sr-only");
    assert.equal(nodes(tree).find(n => n.type === "h2").props.className,"text-sm font-medium");
    const buttons = nodes(tree).filter(n => n.type === "button");
    assert.deepEqual(buttons.map(text), ["Generate", "Upload", "Creative Assets"]); assert.equal(buttons[0].props["aria-pressed"], true);
    buttons[1].props.onClick(); buttons[2].props.onClick(); assert.deepEqual(modes, ["upload", "assets"]);
    const focusedTree = rt.render(() => mod.WorkflowVideoSourceSection({ kind, selection, presentation: "focused" }));
    const focusedModes = nodes(focusedTree).find(n => n.props["aria-label"] === `${kind === "hook" ? "Hook video" : "Creator / phone video"} source`);
    assert.deepEqual(nodes(focusedModes).filter(n => n.type === "button").map(text), ["Generate", "Use video"]);
    nodes(focusedModes).find(n => n.type === "button" && text(n) === "Use video").props.onClick();
    assert.equal(modes.at(-1), "upload");
    const input = nodes(tree).find(n => n.type === "input"), event = { target: { files: [{ name: "existing.mp4" }], value: "existing.mp4" } };
    input.props.onChange(event); assert.equal(uploads.length, 1); assert.equal(event.target.value, "");
    selection.mode = "upload"; selection.error = "Upload failed"; selection.preview = { name: "existing.mp4", duration: 5 };
    const existing = rt.render(() => mod.WorkflowVideoSourceSection({ kind, selection, presentation: "focused" }));
    assert.ok(nodes(existing).some(n => n.props["aria-label"] === "Existing video source"));
    const modeCount = modes.length;
    nodes(existing).find(n => n.type === "button" && text(n) === "Use video").props.onClick();
    assert.equal(modes.length, modeCount, "Selecting the current existing-video mode preserves the uploaded clip");
    tree = rt.render(() => mod.WorkflowVideoSourceSection({ kind, selection }));
    assert.equal(nodes(tree).find(n => n.props.role === "alert").props.children, "Upload failed");
    assert.ok(nodes(tree).find(n => n.type === "button" && text(n) === "Replace")); rt.unmount();
  }
});

test("reuse footer continues only when ready and edit/schedule keep their existing actions", () => {
  const mod = load("components/explore/workflow-creation-panel.tsx", { "react/jsx-runtime": jsx, "@/components/ui/button": { Button: "button" }, "@/components/explore/workflow-creation.module.css": css, "@/components/explore/workflow-section-layout.module.css": css, "@/lib/utils": { cn: (...values) => values.join(" ") } });
  let continued = 0;
  for (const disabled of [true, false]) {
    const tree = mod.WorkflowCreationPanel({ kind: "hook", section: "create", create: { disabled, busy: false, message: "Choose a video", onAction: () => continued++ } });
    const buttons = nodes(tree).filter(n => n.type === "button"); assert.equal(buttons.length, 1); assert.equal(text(buttons[0]), "Continue"); assert.equal(buttons[0].props.disabled, disabled);
    if (!disabled) buttons[0].props.onClick();
  }
  assert.equal(continued, 1);
  const action = { disabled: false, busy: false, message: "Ready", onAction() {}, refresh() {} };
  for (const section of ["edit", "schedule"]) {
    const tree = mod.WorkflowCreationPanel({ kind: "phone", section, create: { message: "Wrong message" }, edit: action, schedule: action });
    assert.deepEqual(nodes(tree).filter(n => n.type === "button").map(text), [section === "edit" ? "Prepare final video" : "Schedule post"]);
    assert.ok(!text(tree).includes("Wrong message"));
  }
});

test("both Create layouts preserve instruction drafts when reusing a video and pass that exact clip into editing", () => {
  for (const kind of ["hook", "phone"]) {
    const rt = runtime();
    const panels = [{ scrollTop: 120 }, { scrollTop: 240 }], scrollCalls = [], focusCalls = [];
    let pageScroll = 340, pauses = 0, frames = 0;
    const workflowRoot = {
      querySelectorAll(selector) { return selector === "audio, video" ? [{ pause() { pauses++; } }] : panels; },
      querySelector() { return { focus(options) { focusCalls.push(options); } }; },
      scrollIntoView(options) { scrollCalls.push(options); pageScroll = 0; },
    };
    const selection = { ownerId: "owner", mode: "generate", source: asset, preview: { name: asset.title, url: asset.url, duration: 5 }, ready: true, dirty: true, busy: false, error: null, restoreOwned() {}, ownedForMode() { return null; }, setMode() {}, chooseUpload() {}, removeUpload() {}, clearUploadError() {}, clearSelection() {} };
    const recovery = { loaded: true, error: null, recoveryRevision: 0, session: { section: "create", scheduleDraft: {}, sourceMode: "generate", generationSettings: { model: "seedance_2_5", aspectRatio: "9:16" }, instructions: "", localReferences: false, demoAudioPlayback: "once", demoFraming: null, demoAssetId: null, sourceAssetId: null, pendingSource: false, generatedAssetId: null, generatedSelectionCleared: false, options: {} }, assets: { source: null, demo: null, demoAudio: null }, problems: {}, acceptAsset() { return true; }, update() {}, clearMedia() {}, clearProblem() {}, markPending() {}, retry() {}, reset() {} };
    const localMedia = { asset: null, loading: false, error: null, choose: async () => false, chooseRemote: async () => false, remove() {}, cancelPending() {}, clearError() {} };
    const generationRun = { selected: asset, results: [], busy: false, error: null, onGenerate() {} };
    const finishing = { options: {}, setOptions() {}, output: null, pendingComposition: null, captions: { transcript: null }, music: { source: null, playback: "repeat", selectionError: null }, edit: { busy: false }, schedule: { busy: false } };
    const imports = {
    "./lazy-hook-starting-frame-workspace": { LazyHookStartingFrameWorkspace: "starting-frame-preparation" },
    "./starting-frame-animation-references": { StartingFrameAnimationReferences: "animation-references" },
      "./use-starting-frame-photos": { useStartingFramePhotos: () => ({ pending: false, error: null, remember() {} }) },
      "@/lib/explore/starting-frame-photo-selection": { startingFramePhotoKey: () => "starting-frame-photos" },
      "next/dynamic": { default: () => "starting-frame-preparation" },
      "./lazy-hook-starting-frame-workspace": { LazyHookStartingFrameWorkspace: "starting-frame-preparation" },
      "next/image": { default: "image" },
      "./use-hook-composer-selection": { useHookComposerSelection: () => ({ frame: null, ready: true, error: null, setFrame() {}, retry() {} }) },
      "@/worker/src/lib/hook-starting-frame-video": { isHookStartingFrameVideoModel: () => true, hookStartingFrameVideoDurations: () => [4, 8], hookStartingFrameFaceReferenceLimit: () => 5 },
      "./pending-schedule-panel": { PendingExploreSchedulePanel: "pending-schedule", useBackgroundScheduleAvailability: () => ({ data: false }) },
      react: rt.react, "react/jsx-runtime": jsx, "@base-ui/react/tabs": { Tabs: { Root: "tabs-root", Panel: "tabs-panel" } }, "lucide-react": { ArrowLeft: "arrow", BookOpen: "book" }, "next/link": { default: "link" },
      "@/components/ui/button": { Button: "button" },
      "@/components/layout/workflow-navigation": { WorkflowNavigationButton: "navigation-button" },
      "@/components/ui/quiet-scrollbar.module.css": css,
      "@/components/explore/workflow-section-navigation": { WorkflowSectionNavigation: "section-nav", WorkflowSectionHeading: "section-heading", useWorkflowSectionOrientation: () => "vertical" },
      "next/navigation": { useSearchParams: () => new URLSearchParams() },
      "@/components/providers/account-timezone-provider": { useAccountTimeZone: () => "UTC" },
      "@/components/explore/workflow-section-layout.module.css": css,
      "@/components/explore/use-workflow-source-video": { useWorkflowSourceVideo: () => selection },
      "@/components/explore/use-workflow-session": { useWorkflowSession: () => recovery },
      "@/components/explore/use-workflow-generation-settings": { useWorkflowGenerationSettings: () => ({ dirty: false, settings: { aspectRatio: "9:16" }, changeSettings() {} }) },
      "@/lib/explore/workflow-generation-settings": { createWorkflowGenerationSettings: () => recovery.session.generationSettings, normalizeWorkflowGenerationSettings: value => value },
      "@/lib/trending/hook-video-client-upload": { uploadHookVideoDemo: async () => { throw Error("Unexpected demo upload"); } },
      "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async () => ({ asset }) },
      "@/components/explore/workflow-generation-boundary": { WorkflowAccountBoundary: ({children}) => children("owner"), WorkflowGenerationBoundary: ({children}) => children(generationRun) },
      "@/components/explore/workflow-finishing-boundary": { WorkflowFinishingBoundary: ({ children }) => children(finishing) },
      "@/components/explore/talking-head-clip-editing": { TalkingHeadClipEditing: ({ children, source, sourcePreview, demo, demoFraming }) => children({ source, sourcePreview, demoSource: null, demo: demo.asset, demoFraming, openingState: null, demoState: null, openingPreview: null, demoPreview: null, editing: false, busy: false, error: null, controls: null, preview: null, actions: null, openOpening() {}, openDemo() {} }) },
      "@/components/explore/talking-head-schedule-review": { TalkingHeadScheduleSummary: "schedule-summary", TalkingHeadScheduleActions: "schedule-actions" },
      "@/components/explore/workflow-schedule-review.module.css": css,
      "@/components/explore/talking-head-schedule-preview.module.css": css,
      "@/components/explore/workflow-clip-source-actions": { WorkflowClipSourceActions: "source-actions" },
      "@/components/explore/workflow-video-asset-picker": { WorkflowVideoAssetPicker: "video-picker" },
      "@/components/explore/workflow-video-source-section": { WorkflowVideoSourceSection: "source-section" },
      "@/components/explore/workflow-creation-panel": { WorkflowCreationPanel: "creation-panel" },
      "@/components/explore/workflow-composition-panel": { WorkflowCompositionPanel: "composition-panel" },
      "@/components/explore/workflow-edit-workspace": { WorkflowEditWorkspace: "edit-workspace", WorkflowScheduleWorkspace: "schedule-workspace" },
      "@/components/explore/workflow-scheduling-panel": { EMPTY_SCHEDULE_DRAFT: {}, WorkflowSchedulingPanel: "scheduling-panel" },
      "@/components/explore/workflow-preview-canvas": { WorkflowPreviewCanvas: "preview-canvas" },
      "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => localMedia },
      "./use-talking-head-reference": { useTalkingHeadReference: () => ({ videoReference: localMedia, selectedId: null, instructions: "", query: { data: [], isPending: false, isError: false }, choose: async () => true }) },
      "./talking-head-references": { TalkingHeadReferences: "talking-references" },
      "./talking-head-references.module.css": css,
      "@/components/explore/use-local-workflow-images": { useLocalWorkflowImages: () => ({ asset: null, assets: [], loading: false, error: null, remove() {}, clearError() {} }) },
      "@/lib/ai-studio/video-reference-policy": { getVideoReferencePolicy: () => ({ maxImages: 6 }) },
      "@/components/explore/use-local-app-screen": { useLocalAppScreen: () => localMedia },
      "@/components/explore/workflow-connected-accounts": { WorkflowConnectedAccounts: "accounts" },
      "@/lib/explore/workflow-scheduling-draft": { workflowSelectedAccounts: () => [], workflowSelectedPlatforms: () => [], selectWorkflowAccount() {} },
      "@/lib/utils": { cn: (...values) => values.join(" ") }, "@/components/explore/workflow-creation.module.css": css, "@/components/explore/workflow-studio.module.css": css,
      [`@/components/explore/${kind}-workflow-composer`]: kind === "hook" ? { HookWorkflowComposer: "composer" } : { PhoneWorkflowComposer: "composer", AppScreenPicker: "app-screen" },
    };
    const mod = load(`components/explore/${kind}-workflow-preview.tsx`, imports, { window: { location: { pathname: "/explore/create-hook", search: "" }, history: { replaceState() {} }, addEventListener() {}, removeEventListener() {}, requestAnimationFrame: fn => { frames++; fn(); } }, requestAnimationFrame: fn => fn() });
    const render = () => rt.render(() => (kind === "hook" ? mod.HookWorkflowPreview : mod.PhoneWorkflowPreview)({ generationEnabled: true }));
    let tree = render();
    const preview = view => nodes(view).find(n => n.props.id === `${kind}-workflow-preview`);
    assert.equal(preview(tree).props.hidden, kind !== "hook", "Talking Head preview is visible by default");
    if (kind === "hook") {
      assert.equal(nodes(tree).find(n => n.type === "creation-panel").props.heading, undefined, "Talking Head has no redundant heading or hide control");
      const viewButton = label => nodes(tree).find(n => n.type === "button" && text(n) === label);
      const visible = node => !nodes(tree).some(ancestor => ancestor.props.hidden && nodes(ancestor.props.children).includes(node));
      generationRun.selected = null; tree = render();
      viewButton("Your videos").props.onClick(); tree = render();
      assert.equal(visible(nodes(tree).find(n => n.type === "edit-workspace")), true, "Empty Create uses the real hook/demo cards");
      assert.equal(nodes(tree).find(n => n.type === "edit-workspace").props.generatedVideo, null);
      assert.equal(visible(nodes(tree).find(n => n.type === "preview-canvas")), false, "Generic generation placeholder is hidden");
      viewButton("References").props.onClick(); tree = render();
      assert.equal(visible(nodes(tree).find(n => n.type === "talking-references")), true);
      assert.equal(visible(nodes(tree).find(n => n.type === "edit-workspace")), false);
      generationRun.selected = asset;
      viewButton("Your videos").props.onClick(); tree = render();
      assert.equal(nodes(tree).filter(n => n.type === "edit-workspace").length, 1);
      assert.equal(viewButton("Generated videos"), undefined);
      nodes(tree).find(n => n.type === "preview-canvas").props.generation.onGenerate();
      generationRun.busy = true; tree = render();
      assert.equal(visible(nodes(tree).find(n => n.type === "preview-canvas")), true);
      viewButton("Your videos").props.onClick(); tree = render();
      assert.equal(visible(nodes(tree).find(n => n.type === "edit-workspace")), true, "Users can return to selected clips during generation");
      assert.equal(nodes(tree).find(n => n.type === "preview-canvas").props.generation.busy, true, "Generation remains mounted and keeps polling");
      generationRun.busy = false;
    }
    nodes(tree).find(n => n.type === "composer").props.onInstructionsChange("Keep my original prompt");
    selection.mode = "upload"; tree = render();
    if (kind === "hook") nodes(tree).find(n => n.type === "tabs-root").props.ref.current = workflowRoot;
    assert.equal(preview(tree).props.hidden, false, "A selected source appears automatically");
    assert.equal(nodes(tree).find(n => n.type === "composer").props.instructions, "Keep my original prompt");
    assert.equal(nodes(tree).find(n => n.props.className === "generationFields").props.hidden, true);
    assert.equal(nodes(tree).filter(n => n.type === "source-section").length, 1);
    if (kind === "hook") {
      nodes(tree).find(n => n.type === "button" && text(n) === "Your videos").props.onClick(); tree = render();
      assert.equal(nodes(tree).filter(n => n.type === "edit-workspace").length, 1, "Create uses the single mounted Demo overview");
      assert.equal(nodes(tree).find(n => n.type === "edit-workspace").props.generatedVideo.id, asset.id);
    } else assert.equal(nodes(tree).find(n => n.type === "preview-canvas").props.source.url, asset.url);
    nodes(tree).find(n => n.type === "creation-panel").props.create.onAction(); tree = render();
    assert.equal(nodes(tree).find(n => n.type === "creation-panel").props.section, "edit");
    assert.equal(preview(tree).props.hidden, false);
    assert.equal(nodes(tree).find(n => n.type === (kind === "hook" ? "edit-workspace" : "schedule-workspace")).props[kind === "hook" ? "generatedVideo" : "source"].id, asset.id);
    if (kind === "hook") {
      const workspace = nodes(tree).find(n => n.type === "edit-workspace");
      const sourceMenu = nodes(workspace.props.sourceActions).find(n => n.type === "source-actions");
      const demoMenu = nodes(workspace.props.demoSourceActions).find(n => n.type === "source-actions");
      assert.equal(demoMenu.props.library, "content");
      const sidebarDemoMenu = nodes(nodes(tree).find(n => n.type === "composition-panel").props.demoSourceActions).find(n => n.type === "source-actions");
      assert.equal(sidebarDemoMenu.props.library, "content", "Sidebar and preview use the same Demo inventory");
      assert.equal(sourceMenu.props.triggerLabel, "Change");
      sourceMenu.props.onChooseAssets(); tree = render();
      let picker = nodes(tree).find(n => n.type === "video-picker" && n.props.library !== "generation_history");
      assert.equal(picker.props.open, true); picker.props.onOpenChange(false); tree = render();
      assert.equal(nodes(tree).find(n => n.type === "creation-panel").props.section, "edit");
      assert.equal(nodes(tree).find(n => n.type === "edit-workspace").props.generatedVideo, asset);
      const acceptedDemos = []; recovery.acceptAsset = (role, value) => { acceptedDemos.push([role,value.id]); return true; };
      demoMenu.props.onChooseAssets(); tree = render(); picker = nodes(tree).find(n => n.type === "video-picker" && n.props.library !== "generation_history");
      assert.match(picker.props.description, /Demo screen/); assert.equal(picker.props.library,"content"); assert.equal(picker.props.onSelect({...asset,id:"ordinary-video"}),false); assert.equal(picker.props.onSelect({...asset,id:"replacement-demo",sourceType:"demo_upload"}), true);
      assert.deepEqual(acceptedDemos, [["demo","replacement-demo"]]); picker.props.onOpenChange(false); tree = render();
      assert.equal(nodes(tree).find(n => n.type === "creation-panel").props.section, "edit");
      assert.equal(pageScroll, 0, "A real stage change reveals the workflow heading even when the document scrolled");
      assert.deepEqual(scrollCalls.map(value => [value.block, value.behavior]), [["start", "instant"]]);
      assert.deepEqual(panels.map(panel => panel.scrollTop), [0, 0]);
      assert.equal(focusCalls[0].preventScroll, true);
      const before = { pauses, frames, scrolls: scrollCalls.length, focus: focusCalls.length };
      panels[0].scrollTop = 90; panels[1].scrollTop = 180; pageScroll = 260;
      nodes(tree).find(n => n.type === "tabs-root").props.onValueChange("edit"); tree = render();
      assert.deepEqual({ pauses, frames, scrolls: scrollCalls.length, focus: focusCalls.length }, before, "Refocusing the active stage does not pause playback or reset scrolling");
      assert.equal(pageScroll, 260); assert.deepEqual(panels.map(panel => panel.scrollTop), [90, 180]);
      assert.equal(nodes(tree).find(n => n.type === "composer").props.instructions, "Keep my original prompt");
      assert.equal(nodes(tree).find(n => n.type === "edit-workspace").props.generatedVideo, asset);
      nodes(tree).find(n => n.type === "scheduling-panel").props.onChange({ platform: "instagram", caption: "Keep this schedule caption", date: "2026-10-13", time: "16:30" }); tree = render();
      nodes(tree).find(n => n.type === "tabs-root").props.onValueChange("schedule"); tree = render();
      assert.equal(pageScroll, 0); assert.deepEqual(panels.map(panel => panel.scrollTop), [0, 0]);
      assert.equal(scrollCalls.length, before.scrolls + 1);
      assert.equal(nodes(tree).find(n => n.type === "schedule-workspace").props.source, asset);
      assert.equal(nodes(tree).find(n => n.type === "scheduling-panel").props.draft.caption, "Keep this schedule caption");
      nodes(tree).find(n => n.type === "scheduling-panel").props.footer.props.onBackToEdit(); tree = render();
      assert.equal(nodes(tree).find(n => n.type === "scheduling-panel").props.draft.caption, "Keep this schedule caption");
    }
    nodes(tree).find(n => n.type === (kind === "hook" ? "edit-workspace" : "schedule-workspace")).props.onChangeSource(); tree = render();
    selection.mode = "generate"; tree = render(); assert.equal(nodes(tree).find(n => n.props.className === "generationFields").props.hidden, false);
    assert.equal(nodes(tree).find(n => n.type === "composer").props.instructions, "Keep my original prompt"); rt.unmount();
  }
});

test("Content Demo picker uses its own inventory and cache, excluding ordinary creative videos", async () => {
  const rt = runtime(), calls = [];
  let query, data;
  const policy = load("lib/explore/workflow-source-video.ts", {});
  const demo = { id: "00000000-0000-4000-8000-000000000001", status: "ready", sourceType: "demo_upload", collection: "video", mimeType: "video/mp4", url: "/demo.mp4", title: "My demo" };
  const mod = load("components/explore/workflow-video-asset-picker.tsx", {
    react: rt.react, "react/jsx-runtime": jsx, "next/image": { default: "image" }, "lucide-react": { Video: "video-icon" },
    "@tanstack/react-query": { useQuery: input => { query = input; return { data, isPending: !data }; } },
    "@/lib/http/read-deadline": { withReadDeadline: action => action(new AbortController().signal) },
    "@/components/ui/button": { Button: "button" }, "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle"].map(n => [n, n])),
    "@/lib/explore/workflow-source-video": policy, "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { assert.equal(owner, "owner"); return "owned-token"; } },
  }, { fetch: async (url, init) => { calls.push({ url, ...init }); return Response.json({ ok: true, assets: [demo, { ...demo, sourceType: "generated_video", id: "00000000-0000-4000-8000-000000000002" }] }); } });
  const props = { open: false, library: "content", ownerId: "owner", onSelect() { return true; }, onOpenChange() {} };
  rt.render(() => mod.WorkflowVideoAssetPicker(props)); assert.equal(query.enabled, false); assert.equal(calls.length, 0);
  props.open = true; rt.render(() => mod.WorkflowVideoAssetPicker(props));
  assert.deepEqual(Array.from(query.queryKey), ["explore-source-videos", "owner", "content"]);
  data = await query.queryFn({ signal: new AbortController().signal });
  const tree = rt.render(() => mod.WorkflowVideoAssetPicker(props));
  assert.equal(calls[0].url, "/api/demo/sources"); assert.equal(calls[0].headers.Authorization, "Bearer owned-token");
  assert.equal(nodes(tree).filter(n => n.type === "button" && "aria-pressed" in n.props).length, 1);
  assert.match(text(tree).replace(/\s+/g, " "), /Choose from Demo/);
  data = [];
  const empty = rt.render(() => mod.WorkflowVideoAssetPicker(props));
  assert.match(text(empty), /Upload a video on the Demo screen, then choose it here/);
  assert.doesNotMatch(text(empty), /Upload one here/);
  assert.equal(nodes(empty).some(node => node.type === "input" || node.type === "button" && /upload/i.test(text(node))), false);
  rt.unmount();
});

test("Generation history lists only ready generations, requires an explicit choice and separates owners", async () => {
  const rt = runtime(), calls = [];
  let query, data; const selected = [], closed = [];
  const policy = load("lib/explore/workflow-source-video.ts", {});
  const demo = { id: "00000000-0000-4000-8000-000000000001", status: "ready", sourceType: "generated_video", collection: "video", mimeType: "video/mp4", url: "/demo.mp4", title: "My demo" };
  const mod = load("components/explore/workflow-video-asset-picker.tsx", {
    react: rt.react, "react/jsx-runtime": jsx, "next/image": { default: "image" }, "lucide-react": { Video: "video-icon" },
    "@tanstack/react-query": { useQuery: input => { query = input; return { data, isPending: !data }; } },
    "@/lib/http/read-deadline": { withReadDeadline: action => action(new AbortController().signal) },
    "@/components/ui/button": { Button: "button" }, "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle"].map(n => [n, n])),
    "@/lib/explore/workflow-source-video": policy, "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { assert.equal(owner, "owner"); return "owned-token"; } },
  }, { fetch: async (url, init) => { calls.push({ url, ...init }); return Response.json({ ok: true, assets: [demo, { ...demo, status: "processing", id: "00000000-0000-4000-8000-000000000004" }, { ...demo, sourceType: "demo_upload", id: "00000000-0000-4000-8000-000000000002" }] }); } });
  const props = { open: false, library: "generation_history", ownerId: "owner", onSelect(value) { selected.push(value); return selected.length > 1; }, onOpenChange(value) { closed.push(value); } };
  rt.render(() => mod.WorkflowVideoAssetPicker(props)); assert.equal(query.enabled, false); assert.equal(calls.length, 0);
  props.open = true; rt.render(() => mod.WorkflowVideoAssetPicker(props));
  assert.deepEqual(Array.from(query.queryKey), ["explore-source-videos", "owner", "generation_history"]);
  data = await query.queryFn({ signal: new AbortController().signal });
  const tree = rt.render(() => mod.WorkflowVideoAssetPicker(props));
  assert.equal(calls[0].url, "/api/media?collection=video&sourceTypes=generated_video"); assert.equal(calls[0].headers.Authorization, "Bearer owned-token");
  assert.equal(nodes(tree).filter(n => n.type === "button" && "aria-pressed" in n.props).length, 1);
  assert.match(text(tree).replace(/\s+/g, " "), /Generation history/);
  assert.equal(selected.length, 0, "Opening history cannot replace a selected clip");
  const row = nodes(tree).find(n => n.type === "button" && "aria-pressed" in n.props);
  row.props.onClick(); assert.equal(closed.length, 0, "A rejected selection keeps the drawer open");
  row.props.onClick(); assert.deepEqual(closed, [false]);
  props.ownerId = null; rt.render(() => mod.WorkflowVideoAssetPicker(props)); assert.equal(query.enabled, false);
  assert.equal(query.queryKey[1], null); rt.unmount();
});

test("Creative Assets fetch is owner-authenticated, excludes demos/unfinished/non-video rows, and does no work while closed", async () => {
  const rt = runtime(), calls = [], selected = [];
  const client = new QueryClient();
  let observer, unsubscribe;
  const useQuery = options => {
    if (!observer) { observer = new QueryObserver(client, options); unsubscribe = observer.subscribe(() => {}); }
    else observer.setOptions(options);
    return { ...observer.getCurrentResult(), refetch: () => observer.refetch() };
  };
  const policy = load("lib/explore/workflow-source-video.ts", {});
  const mod = load("components/explore/workflow-video-asset-picker.tsx", { react: rt.react, "react/jsx-runtime": jsx, "next/image": { default: "image" }, "lucide-react": { Video: "video-icon" },
    "@tanstack/react-query": { useQuery }, "@/lib/http/read-deadline": { withReadDeadline },
    "@/components/ui/button": { Button: "button" }, "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle"].map(n => [n, n])),
    "@/lib/explore/workflow-source-video": policy, "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { assert.equal(owner, "owner"); return "owned-token"; } },
  }, { AbortSignal, fetch: async (url, init) => { calls.push({ url, ...init }); return Response.json({ ok: true, assets: [asset, { ...asset, id: "00000000-0000-4000-8000-000000000002", status: "uploading" }, { ...asset, mimeType: "image/png" }, { ...asset, id: "00000000-0000-4000-8000-000000000003", sourceType: "demo_upload" }] }); } });
  const props = { open: false, ownerId: "owner", onSelect: value => { selected.push(value); return true; }, onOpenChange() {} };
  const render = () => rt.render(() => mod.WorkflowVideoAssetPicker(props));
  render(); await tick(); assert.equal(calls.length, 0); props.open = true; render(); await tick();
  const tree = render(), rows = nodes(tree).filter(n => n.type === "button" && "aria-pressed" in n.props);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, "/api/media?collection=video"); assert.equal(calls[0].headers.Authorization, "Bearer owned-token"); assert.equal(calls[0].cache, "no-store");
  assert.equal(rows.length, 1); rows[0].props.onClick(); assert.equal(selected[0].id, asset.id);
  props.open = false; render(); props.open = true; render(); await tick();
  assert.equal(calls.length, 1, "Reopening uses the owner's fresh cached library");
  props.ownerId = "different-owner"; props.open = false;
  assert.equal(nodes(render()).filter(n => n.type === "button" && "aria-pressed" in n.props).length, 0, "Another account cannot see the previous owner's cached videos");
  rt.unmount(); unsubscribe(); client.clear();
});
