import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const element = (type, props = {}) => typeof type === "function" ? type(props) : { type, props };
const jsx = { jsx: element, jsxs: element, Fragment: "fragment" };
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : ""; }
function runtime() {
  let cursor = 0; const slots = [], effects = [];
  return { react: {
    useId() { return `source-${cursor++}`; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], v => { slots[i] = typeof v === "function" ? v(slots[i]) : v; }]; },
    useEffect(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((v, n) => !Object.is(v, prior.deps[n]))) effects.push(() => { prior?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  }, render(fn) { cursor = 0; const tree = fn(); while (effects.length) effects.shift()(); return tree; }, unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}
function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, Error, AbortController, ...globals,
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
    const buttons = nodes(tree).filter(n => n.type === "button");
    assert.deepEqual(buttons.map(text), ["Generate", "Upload", "Creative Assets"]); assert.equal(buttons[0].props["aria-pressed"], true);
    buttons[1].props.onClick(); buttons[2].props.onClick(); assert.deepEqual(modes, ["upload", "assets"]);
    const input = nodes(tree).find(n => n.type === "input"), event = { target: { files: [{ name: "existing.mp4" }], value: "existing.mp4" } };
    input.props.onChange(event); assert.equal(uploads.length, 1); assert.equal(event.target.value, "");
    selection.mode = "upload"; selection.error = "Upload failed"; selection.preview = { name: "existing.mp4", duration: 5 };
    tree = rt.render(() => mod.WorkflowVideoSourceSection({ kind, selection }));
    assert.equal(nodes(tree).find(n => n.props.role === "alert").props.children, "Upload failed");
    assert.ok(nodes(tree).find(n => n.type === "button" && text(n) === "Replace")); rt.unmount();
  }
});

test("reuse footer continues only when ready and edit/schedule keep their existing actions", () => {
  const mod = load("components/explore/workflow-creation-panel.tsx", { "react/jsx-runtime": jsx, "@base-ui/react/tabs": { Tabs: { List: "tablist", Tab: "tab" } }, "@/components/ui/button": { Button: "button" }, "@/components/explore/workflow-creation.module.css": css });
  let continued = 0;
  for (const disabled of [true, false]) {
    const tree = mod.WorkflowCreationPanel({ kind: "hook", section: "create", create: { disabled, busy: false, message: "Choose a video", onAction: () => continued++ } });
    const buttons = nodes(tree).filter(n => n.type === "button"); assert.equal(buttons.length, 1); assert.equal(text(buttons[0]), "Continue to edit"); assert.equal(buttons[0].props.disabled, disabled);
    if (!disabled) buttons[0].props.onClick();
  }
  assert.equal(continued, 1);
  const action = { disabled: false, busy: false, message: "Ready", onAction() {}, refresh() {} };
  for (const section of ["edit", "schedule"]) {
    const tree = mod.WorkflowCreationPanel({ kind: "phone", section, create: { message: "Wrong message" }, edit: action, schedule: action });
    assert.deepEqual(nodes(tree).filter(n => n.type === "button").map(text), [section === "edit" ? "Apply edits" : "Schedule post", "Refresh status"]);
    assert.ok(!text(tree).includes("Wrong message"));
  }
});

test("both Create layouts preserve instruction drafts when reusing a video and pass that exact clip into editing", () => {
  for (const kind of ["hook", "phone"]) {
    const rt = runtime();
    const selection = { ownerId: "owner", mode: "generate", source: asset, preview: { name: asset.title, url: asset.url, duration: 5 }, ready: true, dirty: true };
    const finishing = { options: {}, setOptions() {}, output: null };
    const imports = {
      react: rt.react, "react/jsx-runtime": jsx, "@base-ui/react/tabs": { Tabs: { Root: "tabs-root", Panel: "tabs-panel" } }, "lucide-react": { ArrowLeft: "arrow", BookOpen: "book" }, "next/link": { default: "link" },
      "@/components/explore/workflow-owned-video-boundary": { WorkflowOwnedVideoBoundary: ({ children }) => children(selection) },
      "@/components/explore/workflow-finishing-boundary": { WorkflowFinishingBoundary: ({ children }) => children(finishing) },
      "@/components/explore/workflow-video-source-section": { WorkflowVideoSourceSection: "source-section" },
      "@/components/explore/workflow-creation-panel": { WorkflowCreationPanel: "creation-panel" },
      "@/components/explore/workflow-composition-panel": { WorkflowCompositionPanel: "composition-panel" },
      "@/components/explore/workflow-edit-workspace": { WorkflowEditWorkspace: "edit-workspace", WorkflowScheduleWorkspace: "schedule-workspace" },
      "@/components/explore/workflow-scheduling-panel": { EMPTY_SCHEDULE_DRAFT: {}, WorkflowSchedulingPanel: "scheduling-panel" },
      "@/components/explore/workflow-preview-canvas": { WorkflowPreviewCanvas: "preview-canvas" },
      "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => ({ asset: null }) },
      "@/components/explore/use-local-app-screen": { useLocalAppScreen: () => ({ asset: null }) },
      "@/components/explore/workflow-connected-accounts": { WorkflowConnectedAccounts: "accounts" },
      "@/lib/explore/workflow-scheduling-draft": { workflowSelectedAccounts: () => [], workflowSelectedPlatforms: () => [], selectWorkflowAccount() {} },
      "@/lib/utils": { cn: (...values) => values.join(" ") }, "@/components/explore/workflow-creation.module.css": css, "@/components/explore/workflow-studio.module.css": css,
      [`@/components/explore/${kind}-workflow-composer`]: kind === "hook" ? { HookWorkflowComposer: "composer" } : { PhoneWorkflowComposer: "composer", AppScreenPicker: "app-screen" },
    };
    const mod = load(`components/explore/${kind}-workflow-preview.tsx`, imports, { window: { addEventListener() {}, removeEventListener() {} }, requestAnimationFrame: fn => fn() });
    const render = () => rt.render(() => (kind === "hook" ? mod.HookWorkflowPreview : mod.PhoneWorkflowPreview)({ finishingEnabled: true }));
    let tree = render(); nodes(tree).find(n => n.type === "composer").props.onInstructionsChange("Keep my original prompt");
    selection.mode = "upload"; tree = render();
    assert.equal(nodes(tree).find(n => n.type === "composer").props.instructions, "Keep my original prompt");
    assert.equal(nodes(tree).find(n => n.props.className === "generationFields").props.hidden, true);
    assert.equal(nodes(tree).filter(n => n.type === "source-section").length, 1);
    assert.equal(nodes(tree).find(n => n.type === "preview-canvas").props.source.url, asset.url);
    nodes(tree).find(n => n.type === "creation-panel").props.create.onAction(); tree = render();
    assert.equal(nodes(tree).find(n => n.type === "creation-panel").props.section, "edit");
    assert.equal(nodes(tree).find(n => n.type === "edit-workspace").props.generatedVideo.id, asset.id);
    nodes(tree).find(n => n.type === "button" && text(n) === "Change video").props.onClick(); tree = render();
    selection.mode = "generate"; tree = render(); assert.equal(nodes(tree).find(n => n.props.className === "generationFields").props.hidden, false);
    assert.equal(nodes(tree).find(n => n.type === "composer").props.instructions, "Keep my original prompt"); rt.unmount();
  }
});

test("Creative Assets fetch is owner-authenticated, excludes unfinished/non-video rows, and does no work while closed", async () => {
  const rt = runtime(), calls = [], selected = [];
  const policy = load("lib/explore/workflow-source-video.ts", {});
  const mod = load("components/explore/workflow-video-asset-picker.tsx", { react: rt.react, "react/jsx-runtime": jsx, "next/image": { default: "image" }, "lucide-react": { Video: "video-icon" },
    "@/components/ui/button": { Button: "button" }, "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle"].map(n => [n, n])),
    "@/lib/explore/workflow-source-video": policy, "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { assert.equal(owner, "owner"); return "owned-token"; } },
  }, { fetch: async (url, init) => { calls.push({ url, ...init }); return Response.json({ ok: true, assets: [asset, { ...asset, id: "00000000-0000-4000-8000-000000000002", status: "uploading" }, { ...asset, mimeType: "image/png" }] }); } });
  const props = { open: false, ownerId: "owner", onSelect: value => { selected.push(value); return true; }, onOpenChange() {} };
  const render = () => rt.render(() => mod.WorkflowVideoAssetPicker(props));
  render(); await tick(); assert.equal(calls.length, 0); props.open = true; render(); await tick();
  const tree = render(), rows = nodes(tree).filter(n => n.type === "button");
  assert.equal(calls.length, 1); assert.equal(calls[0].url, "/api/media"); assert.equal(calls[0].headers.Authorization, "Bearer owned-token"); assert.equal(calls[0].cache, "no-store");
  assert.equal(rows.length, 1); rows[0].props.onClick(); assert.equal(selected[0].id, asset.id); rt.unmount(); assert.equal(calls[0].signal.aborted, true);
});
