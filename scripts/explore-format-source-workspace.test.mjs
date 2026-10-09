import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, URLSearchParams, window: imports.window, requestAnimationFrame: fn => fn(), require(name) {
    if (name in imports) return imports[name];
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}
const policy = load("lib/explore/workflow-source-video.ts", {});
const mapper = load("lib/explore/format-video-source.ts", { "./workflow-source-video.ts": policy });
const video = { id: "00000000-0000-4000-8000-000000000001", collection: "influencer", status: "ready", mimeType: "video/mp4", durationSeconds: 8,
  fileSizeBytes: 2000, title: "My saved clip", url: "/owned.mp4", ratio: "16:9", width: 1280, height: 720, metadata: {}, createdAt: "2026-10-08T00:00:00Z" };
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : ""; }
function harness(format, query = "", { local = true, selected = video, references = [], subscription } = {}) {
  let cursor = 0, params = new URLSearchParams(query);
  const slots = [], queries = [], tokens = [], reads = [];
  const window = { location: { pathname: `/explore/${format}`, get search() { return `?${params}`; } }, history: { replaceState(_, __, url) { params = new URLSearchParams(url.split("?")[1]); } }, matchMedia: () => ({ matches: false }) };
  const source = { mode: "assets", source: selected, preview: selected ? { name: selected.title, url: selected.url, duration: selected.durationSeconds } : null,
    ready: Boolean(selected), dirty: Boolean(selected), busy: false, setMode(value) { source.mode = value; }, selectAsset(value) { source.source = value; source.preview = { name: value.title, url: value.url, duration: value.durationSeconds }; source.ready = true; return true; }, removeUpload() {}, chooseUpload: async () => false };
  const element = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const jsx = { jsx: element, jsxs: element, Fragment: "fragment" };
  // JSX functions are called as module properties by the transpiled component.
  const imports = { window, "react/jsx-runtime": jsx, react: {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; }, useCallback: fn => fn, useMemo: fn => fn(),
  }, "next/dynamic": { default: () => "generation-panel" }, "next/link": { default: "link" }, "next/navigation": { useSearchParams: () => params },
  "@base-ui/react/tabs": { Tabs: { Root: "tabs-root", List: "tablist", Tab: "tab", Panel: "tabpanel" } },
  "@tanstack/react-query": { useQuery(options) { queries.push(options); return options.queryKey[0] === "recreate-references" ? { data: references } : {}; } },
  "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" }, loading: false }) },
  "@/components/billing/use-billing-subscription": { useBillingSubscription: () => ({ data: subscription }) },
  "@/components/generation/use-ai-studio-access": { useAIStudioAccess: () => "pro" },
  "@/components/explore/use-workflow-source-video": { useWorkflowSourceVideo: () => source },
  "@/components/explore/format-workspace.module.css": new Proxy({}, { get: (_, key) => key }),
  "@/lib/ai-studio/access-policy": { getAIStudioAccessMessage: () => "" }, "@/lib/explore/format-video-source": mapper,
  "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async (...args) => { reads.push(args); return video; } },
  "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { tokens.push(owner); return "owner-token"; } },
  "@/worker/src/lib/explore-finishing-contract": { isExploreUuid: value => typeof value === "string" && /^[\da-f-]{36}$/i.test(value) },
  "@/lib/explore/recreate-types": load("lib/explore/recreate-types.ts", {}),
  "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  const mod = load("components/explore/format-workspace.tsx", imports);
  return { source, queries, tokens, reads, params: () => params, render() { cursor = 0; return mod.FormatWorkspace({ format, previewReferences: local ? references : undefined }); } };
}

for (const format of ["hook", "wall_text", "slideshow"]) {
  test(`${format}: reopening defaults to References and preserves manual view selection`, () => {
    const h = harness(format, "", { local: false, selected: null });
    let tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "button" && text(n) === "References").props["aria-pressed"], true);
    nodes(tree).find(n => n.type === "button" && text(n) !== "References" && "aria-pressed" in n.props).props.onClick();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "button" && text(n) === "References").props["aria-pressed"], false);
  });
}

test("free Hook browsing exposes every reference through pagination without an upgrade gate", () => {
  const references = Array.from({ length: 15 }, (_, index) => ({ id: `hook-${index}`, format: "hook", title: `Hook ${index + 1}`,
    category: null, categoryLabel: null, posterUrl: `/hook-${index}.webp`, videoUrl: `/hook-${index}.mp4`, slides: [] }));
  references.push({ ...references[0], id: "wall-only", format: "wall_text" });
  for (const subscription of [undefined, { isActive: false }, { isActive: true }]) {
    const h = harness("hook", "", { local: false, selected: null, references, subscription });
    let tree = h.render();
    let cards = nodes(tree).filter(node => node.type === "ReferenceCard");
    assert.equal(cards.length, 12);
    assert.equal(nodes(tree).some(node => node.type === "ProReferenceGate"), false);
    assert.equal(h.queries.find(query => query.queryKey[0] === "recreate-references").enabled, true);
    const more = nodes(tree).find(node => node.type === "Button" && text(node) === "Show more references");
    assert.ok(more);
    more.props.onClick();
    tree = h.render();
    cards = nodes(tree).filter(node => node.type === "ReferenceCard");
    assert.deepEqual(cards.map(node => node.props.reference.id), references.slice(0, 15).map(reference => reference.id));
    assert.equal(nodes(tree).some(node => node.type === "ProReferenceGate"), false);
    assert.equal(nodes(tree).some(node => node.type === "Button" && text(node) === "Show more references"), false);
    cards[14].props.onPreview();
    tree = h.render();
    assert.equal(nodes(tree).find(node => node.type === "ReferencePreviewDialog").props.reference.id, "hook-14");
    cards[14].props.onRecreate();
    tree = h.render();
    assert.equal(h.params().get("refId"), "hook-14");
    assert.equal(nodes(tree).find(node => node.type === "ReferenceCard" && node.props.reference.id === "hook-14").props.isSelected, true);
    assert.deepEqual(h.tokens, []);
    assert.deepEqual(h.reads, []);
  }
});

for (const format of ["hook", "wall_text"]) {
  test(`${format}: empty Edit actions open the requested source in Create`, () => {
    for (const mode of ["generate", "upload", "assets"]) {
      const h = harness(format, "", { selected: null });
      let tree = h.render(); nodes(tree).find(n => n.type === "tabs-root").props.onValueChange("edit");
      tree = h.render();
      assert.equal(text(tree).includes("Generate, upload or choose a video from"), false);
      nodes(tree).find(n => n.type === "WorkflowVideoStartActions").props.onChoose(mode);
      tree = h.render();
      assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "create");
      assert.equal(h.source.mode, mode); assert.equal(h.params().get("videoSource"), mode);
    }
  });
  test(`${format}: existing footage opens the same editor and replacement invalidates the saved schedule output`, () => {
    const h = harness(format); let tree = h.render();
    const create = nodes(tree).find(n => n.type === "Button" && text(n) === "Edit this video"); create.props.onClick();
    tree = h.render(); let editor = nodes(tree).find(n => n.type === "FormatVideoEditor");
    assert.equal(editor.props.video.mediaAssetId, video.id); assert.equal(editor.props.video.url, video.url);
    assert.equal(h.params().get("videoSource"), "assets"); assert.equal(h.params().get("editVideoId"), video.id);
    editor.props.onSaved({ id: "saved-final", kind: "media_asset", url: "/final.mp4", title: "Final" }); tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output.id, "saved-final");
    nodes(tree).find(n => n.type === "WorkflowVideoSourceSection").props.selection.selectAsset({ ...video, id: "00000000-0000-4000-8000-000000000002" });
    tree = h.render(); assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
    assert.equal(h.params().get("editVideoId"), null); assert.equal(nodes(tree).some(n => n.type === "FormatVideoEditor"), false);
  });
  test(`${format}: restoring an imported edit rechecks owned media without requiring generation tags`, async () => {
    const h = harness(format, `editVideoId=${video.id}&videoSource=assets`, { local: false, selected: null }); h.render();
    const query = h.queries.find(q => q.queryKey[0] === "explore-edit-restore"); assert.equal(query.enabled, true);
    assert.equal((await query.queryFn()).id, video.id); assert.deepEqual(h.tokens, ["owner"]); assert.deepEqual(h.reads, [[video.id, "owner-token"]]);
  });
  test(`${format}: generated-result restoration still enforces the original workflow boundary`, async () => {
    const h = harness(format, `editVideoId=${video.id}&videoSource=generate`, { local: false, selected: null }); h.render();
    await assert.rejects(h.queries.find(q => q.queryKey[0] === "explore-edit-restore").queryFn(), /this workflow/);
  });
}

test("Hook Demo previews the selected source before saving and schedules only the current final output", () => {
  const h = harness("hook"); let tree = h.render();
  nodes(tree).find(n => n.type === "Button" && text(n) === "Edit this video").props.onClick();
  tree = h.render();
  let demo = nodes(tree).find(n => n.type === "FormatDemoWorkspace");
  assert.equal(demo.props.sourcePreview.url, video.url); assert.equal(demo.props.opening, null);
  const editor = nodes(tree).find(n => n.type === "FormatVideoEditor");
  editor.props.onSaved({ id: "saved-hook", kind: "media_asset", url: "/hook-edit.mp4", title: "Hook" });
  editor.props.onContinue(); tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "demo");
  demo = nodes(tree).find(n => n.type === "FormatDemoWorkspace");
  assert.equal(demo.props.opening.url, "/hook-edit.mp4");
  demo.props.onDemoChange(true); tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
  demo.props.onSaved({ id: "combined", kind: "media_asset", url: "/combined.mp4", title: "Final" }); tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output.id, "combined");
  demo.props.onDemoChange(true); tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
  demo.props.onDemoChange(false); tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output.id, "saved-hook");
  editor.props.onDirty(); tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "FormatDemoWorkspace").props.opening, null);
  assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
});

test("normal Hook keeps three steps, opens editing below the selected preview, and returns to its origin", () => {
  const h = harness("hook", "", { local: false });
  let tree = h.render();
  assert.deepEqual(nodes(tree).filter(node => node.type === "tab").map(text), ["Create", "Demo", "Schedule"]);
  nodes(tree).find(node => node.type === "Button" && text(node) === "Edit hook video").props.onClick();
  tree = h.render();
  let editor = nodes(tree).find(node => node.type === "FormatVideoEditor");
  assert.equal(editor.props.previewSide, true);
  assert.equal(editor.props.video.mediaAssetId, video.id);
  assert.equal(nodes(tree).find(node => node.type === "FormatVideoEditFrame").props.clip, "hook");
  editor.props.onBackToPreview();
  tree = h.render();
  assert.equal(nodes(tree).find(node => node.type === "tabs-root").props.value, "create");
  nodes(tree).find(node => node.type === "tabs-root").props.onValueChange("demo");
  tree = h.render();
  nodes(tree).find(node => node.type === "FormatDemoWorkspace").props.onEditOpening();
  tree = h.render();
  editor = nodes(tree).find(node => node.type === "FormatVideoEditor");
  assert.equal(editor.props.backLabel, "Back to previews");
  assert.equal(nodes(tree).find(node => node.type === "tabs-root").props.value, "demo");
  editor.props.onBackToPreview();
  tree = h.render();
  assert.equal(nodes(tree).find(node => node.type === "FormatDemoWorkspace").props.active, true);
});
