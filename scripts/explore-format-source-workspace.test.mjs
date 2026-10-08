import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, URLSearchParams, window: imports.window, ResizeObserver: imports.ResizeObserver, requestAnimationFrame: fn => fn(), require(name) {
    if (name in imports) return imports[name];
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}
const policy = load("lib/explore/workflow-source-video.ts", {});
const mapper = load("lib/explore/format-video-source.ts", { "./workflow-source-video.ts": policy });
const pagination = load("lib/explore/reference-pagination.ts", {});
const video = { id: "00000000-0000-4000-8000-000000000001", collection: "influencer", status: "ready", mimeType: "video/mp4", durationSeconds: 8,
  fileSizeBytes: 2000, title: "My saved clip", url: "/owned.mp4", ratio: "16:9", width: 1280, height: 720, metadata: {}, createdAt: "2026-10-08T00:00:00Z" };
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : ""; }
function harness(format, query = "", { local = true, selected = video, catalogue = [] } = {}) {
  let cursor = 0, params = new URLSearchParams(query), columns = 5, resizeCallback, sourceInput;
  const slots = [], queries = [], tokens = [], reads = [];
  const window = { location: { pathname: `/explore/${format}`, get search() { return `?${params}`; } }, history: { replaceState(_, __, url) { params = new URLSearchParams(url.split("?")[1]); } }, matchMedia: () => ({ matches: false }), getComputedStyle: () => ({ gridTemplateColumns: Array(columns).fill("200px").join(" ") }) };
  const source = { mode: "assets", source: selected, preview: selected ? { name: selected.title, url: selected.url, duration: selected.durationSeconds } : null,
    ready: Boolean(selected), dirty: Boolean(selected), busy: false, setMode(value) { source.mode = value; }, selectAsset(value) { accept(value, "assets"); return true; }, removeUpload() {}, chooseUpload: async () => false };
  function accept(value, mode, preview = { name: value?.title ?? "Local upload", url: value?.url ?? "blob:local-opening", duration: value?.durationSeconds ?? 8 }) {
    source.source = value; source.preview = preview; source.ready = true; source.mode = mode;
    sourceInput.onSelected(value, preview, mode);
  }
  const element = (type, props, key) => typeof type === "function" ? type(props) : { type, props, key };
  const jsx = { jsx: element, jsxs: element, Fragment: "fragment" };
  // JSX functions are called as module properties by the transpiled component.
  const imports = { window, ResizeObserver: class { constructor(callback) { resizeCallback = callback; } observe() {} disconnect() {} }, "react/jsx-runtime": jsx, react: {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; }, useCallback: fn => fn, useMemo: fn => fn(),
    useId: () => "workflow-controls-test",
  }, "next/dynamic": { default: () => "generation-panel" }, "next/link": { default: "link" }, "next/navigation": { useSearchParams: () => params },
  "@base-ui/react/tabs": { Tabs: { Root: "tabs-root", List: "tablist", Tab: "tab", Panel: "tabpanel" } },
  "@tanstack/react-query": { useQuery(options) { queries.push(options); return {}; } },
  "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" }, loading: false }) },
  "@/components/billing/use-billing-subscription": { useBillingSubscription: () => ({}) },
  "@/components/generation/use-ai-studio-access": { useAIStudioAccess: () => "pro" },
  "@/components/explore/use-workflow-source-video": { useWorkflowSourceVideo(input) { sourceInput = input; return source; } },
  "@/components/explore/format-workspace.module.css": new Proxy({}, { get: (_, key) => key }),
  "@/lib/ai-studio/access-policy": { getAIStudioAccessMessage: () => "" }, "@/lib/explore/format-video-source": mapper,
  "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async (...args) => { reads.push(args); return video; } },
  "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { tokens.push(owner); return "owner-token"; } },
  "@/worker/src/lib/explore-finishing-contract": { isExploreUuid: value => typeof value === "string" && /^[\da-f-]{36}$/i.test(value) },
  "@/lib/explore/recreate-types": { referenceCategories: () => [], filterReferences: (items, kind, categories) => items.filter(item => item.format === kind && (!categories.length || categories.includes(item.category))), interleaveReferenceCategories: items => items },
  "@/lib/explore/reference-pagination": pagination,
  "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  const mod = load("components/explore/format-workspace.tsx", imports);
  return { source, accept, queries, tokens, reads, params: () => params, resize(count) { columns = count; resizeCallback?.(); }, render() { cursor = 0; return mod.FormatWorkspace({ format, previewReferences: local ? catalogue : undefined }); } };
}

const catalogue = Array.from({ length: 90 }, (_, index) => ({ id: `wall-${index}`, format: "wall_text", title: `Productivity ${index + 1}`, category: index < 45 ? "productivity" : "other", slides: [], posterUrl: "/poster.jpg", videoUrl: "/reference.mp4" }));
test("slideshow context supports all, subsets and zero without sending unchecked slides, then resets for a new reference", () => {
  const refs = ["first", "second"].map(id => ({ id, format: "slideshow", title: id, slides: Array.from({ length: 6 }, (_, index) => ({ id: `${id}-${index}`, url: `https://storage.test/${id}-${index}.png` })) }));
  const h = harness("slideshow", "refId=first", { catalogue: refs });
  nodes(h.render()).filter(n => n.type === "div" && typeof n.props?.ref === "function").forEach(n => n.props.ref({ clientWidth: 0 }));
  const view = () => nodes(h.render()).find(n => n.type === "generation-panel").props.recreateView;
  assert.deepEqual(Array.from(view().referenceImageUrls), [refs[0].slides[0].url]);
  view().contextBanner.props.onSelectionChange(["first-1", "first-4"], 4);
  assert.deepEqual(Array.from(view().referenceImageUrls), [refs[0].slides[4].url, refs[0].slides[1].url]);
  assert.equal(view().referenceImageUrl, refs[0].slides[4].url);
  nodes(h.render()).find(n => n.type === "FormatSlideshowEditor").props.onRegenerate(2);
  assert.deepEqual(Array.from(view().referenceImageUrls), [refs[0].slides[2].url, refs[0].slides[1].url, refs[0].slides[4].url]);
  view().contextBanner.props.onSelectionChange(refs[0].slides.map(slide => slide.id));
  assert.equal(view().referenceImageUrls.length, 6);
  view().contextBanner.props.onSelectionChange([]);
  assert.equal(view().referenceImageUrl, undefined);
  assert.equal(view().referenceImageUrls.length, 0);
  nodes(h.render()).find(n => n.type === "ReferenceCard" && n.props.reference.id === "second").props.onRecreate();
  assert.deepEqual(Array.from(view().referenceImageUrls), [refs[1].slides[0].url]);
  view().contextBanner.props.onRemove();
  assert.equal(view().referenceImageUrl, undefined);
  assert.equal(view().referenceImageUrls.length, 0);
});

test("reference batches fill complete rows at different column counts until the catalogue ends", () => {
  for (const columns of [1, 2, 3, 4, 5, 6, 7]) {
    const h = harness("wall_text", "", { selected: null, catalogue });
    let tree = h.render();
    nodes(tree).find(n => n.type === "div" && typeof n.props?.ref === "function" && nodes(n.props.children).some(child => child.type === "ReferenceCard")).props.ref({ clientWidth: 1000 });
    h.resize(columns);
    for (let page = 0; page < 12; page++) {
      tree = h.render();
      const cards = nodes(tree).filter(n => n.type === "ReferenceCard");
      assert.equal(new Set(cards.map(n => n.props.reference.id)).size, cards.length);
      assert.ok(cards.every(n => n.props.hideCaption === true));
      if (cards.length < catalogue.length) assert.equal(cards.length % columns, 0, `Incomplete row at ${columns} columns`);
      const more = nodes(tree).find(n => n.type === "Button" && text(n) === "Show more references");
      if (cards.length === catalogue.length) { assert.equal(more, undefined); break; }
      assert.ok(more); more.props.onClick();
    }
    assert.equal(nodes(h.render()).filter(n => n.type === "ReferenceCard").length, 90);
  }
});

test("reference resizing preserves revealed items and filter changes restart with complete rows", () => {
  const h = harness("wall_text", "", { selected: null, catalogue });
  let tree = h.render(); nodes(tree).find(n => n.type === "div" && typeof n.props?.ref === "function" && nodes(n.props.children).some(child => child.type === "ReferenceCard")).props.ref({ clientWidth: 1000 });
  tree = h.render(); assert.equal(nodes(tree).filter(n => n.type === "ReferenceCard").length, 15);
  nodes(tree).find(n => n.type === "Button" && text(n) === "Show more references").props.onClick();
  h.resize(4); tree = h.render(); assert.equal(nodes(tree).filter(n => n.type === "ReferenceCard").length, 32);
  h.resize(5); tree = h.render(); assert.equal(nodes(tree).filter(n => n.type === "ReferenceCard").length, 35);
  nodes(tree).find(n => n.type === "FilterMenu").props.onToggle("other", true);
  tree = h.render(); nodes(tree).find(n => n.type === "div" && typeof n.props?.ref === "function" && nodes(n.props.children).some(child => child.type === "ReferenceCard")).props.ref({ clientWidth: 1000 });
  tree = h.render(); const cards = nodes(tree).filter(n => n.type === "ReferenceCard");
  assert.equal(cards.length, 15); assert.ok(cards.every(n => n.props.reference.category === "other"));
});

test("only Wall of text hides captions; hook and slideshow names stay visible", () => {
  for (const format of ["hook", "slideshow"]) {
    const tree = harness(format, "", { selected: null, catalogue: [{ ...catalogue[0], format }] }).render();
    assert.equal(nodes(tree).find(n => n.type === "ReferenceCard").props.hideCaption, false);
  }
});

test("all three workflow return links prefetch the complete Explore menu", () => {
  for (const format of ["hook", "wall_text", "slideshow"]) {
    const tree = harness(format, "", { selected: null }).render();
    const back = nodes(tree).find(n => n.type === "link" && n.props["aria-label"] === "Back to Explore");
    assert.equal(back.props.href, "/explore?preview=1");
    assert.equal(back.props.prefetch, true);
  }
});

for (const format of ["hook", "wall_text"]) {
  test(`${format}: compact workflow controls can be revealed without replacing either clip editor`, () => {
    const h = harness(format); h.render(); h.accept(video, "assets");
    let tree = h.render();
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onSelectionChange(true);
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onEdit();
    tree = h.render();
    const openingKey = nodes(tree).find(n => n.type === "FormatVideoEditor").key;
    const demoKey = nodes(tree).find(n => n.type === "FormatDemoSection").key;
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props["data-editing"], true);
    assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Creation views").props.hidden, true);
    const reveal = nodes(tree).find(n => n.type === "Button" && text(n) === "Workflow controls");
    assert.equal(reveal.props["aria-expanded"], false);
    assert.equal(reveal.props["aria-controls"], nodes(tree).find(n => n.type === "aside").props.id);
    reveal.props.onClick();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props["data-controls-expanded"], true);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").key, openingKey);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").key, demoKey);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.editingActive, true);
    nodes(tree).find(n => n.type === "Button" && text(n) === "Hide workflow controls").props.onClick();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props["data-controls-expanded"], false);
    nodes(tree).find(n => n.type === "Button" && text(n).trim() === "Back to previews").props.onClick();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props["data-editing"], false);
    assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Creation views").props.hidden, false);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").key, openingKey);
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onEdit();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props["data-controls-expanded"], false);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").key, demoKey);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.editActive, true);
  });
  test(`${format}: generation progress and generated choices stay reachable after a clip is selected`, () => {
    const h = harness(format); h.render(); h.accept(video, "generate");
    nodes(h.render()).filter(n => n.type === "div" && typeof n.props?.ref === "function").forEach(n => n.props.ref({ clientWidth: 0 }));
    const stage = () => nodes(h.render()).find(n => n.props?.["aria-label"] === "Clip previews and editor");
    const generation = () => nodes(h.render()).find(n => n.type === "generation-panel").props.recreateView.workflow;
    assert.equal(stage().props.hidden, false);
    const editorKey = nodes(h.render()).find(n => n.type === "FormatVideoEditor").key;
    nodes(h.render()).find(n => n.type === "Button" && text(n) === "Generated videos").props.onClick();
    assert.equal(stage().props.hidden, true);
    nodes(h.render()).find(n => n.type === "button" && text(n) === "Your videos").props.onClick();
    assert.equal(stage().props.hidden, false);
    generation().onGenerationStart();
    assert.equal(stage().props.hidden, true, "Existing clips must not hide generation results/progress");
    assert.equal(nodes(h.render()).find(n => n.type === "FormatVideoEditor").key, editorKey);
    generation().onSelectVideo({ id: "new-result", mediaAssetId: video.id, url: "/new.mp4", title: "New result", durationSeconds: 8 });
    assert.equal(stage().props.hidden, false);
    assert.equal(nodes(h.render()).find(n => n.type === "tabs-root").props.value, "create");
    assert.equal(nodes(h.render()).find(n => n.type === "FormatVideoEditor").props.video.url, "/new.mp4");
  });
  test(`${format}: Demo shows editable previews, then the saved join, and can reopen its editor`, () => {
    const h = harness(format); h.render(); h.accept(video, "assets");
    let tree = h.render();
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onSelectionChange(true);
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onSaved({ id: "opening", kind: "media_asset", url: "/opening.mp4", title: "Opening" });
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onContinue();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Clip previews and editor").props.hidden, false);
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onSaved({ id: "joined", kind: "media_asset", url: "/joined.mp4", title: "Joined" });
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Clip previews and editor").props.hidden, true);
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onEdit();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Clip previews and editor").props.hidden, false);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.editActive, true);
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onDirty();
    assert.equal(nodes(h.render()).find(n => n.type === "FormatSchedulePanel").props.output, null);
  });
  test(`${format}: Schedule recovery returns to previews and cannot activate a removed Edit tab`, () => {
    const h = harness(format, "", { selected: null });
    nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("schedule");
    nodes(h.render()).find(n => n.type === "Button" && text(n) === "Go to videos").props.onClick();
    const tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "create");
    assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Clip previews and editor").props.hidden, false);
    nodes(tree).find(n => n.type === "tabs-root").props.onValueChange("edit");
    assert.equal(nodes(h.render()).find(n => n.type === "tabs-root").props.value, "create");
    assert.equal(nodes(h.render()).some(n => n.type === "tabpanel" && n.props.value === "edit"), false);
  });
  test(`${format}: an opening finished with background audio is shown and scheduled without a Demo`, () => {
    const h = harness(format); h.render(); h.accept(video, "assets");
    let tree = h.render();
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onSaved({ id: "opening", kind: "media_asset", url: "/opening.mp4", title: "Opening" });
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onContinue();
    tree = h.render();
    const final = { id: "with-music", kind: "media_asset", url: "/with-music.mp4", title: "Final with music" };
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onSaved(final);
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Clip previews and editor").props.hidden, true);
    assert.deepEqual(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, final);
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onDirty();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.props?.["aria-label"] === "Clip previews and editor").props.hidden, false);
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
  });
  for (const mode of ["upload", "assets"]) {
    test(`${format}: accepting ${mode} automatically shows its editable preview in Create`, () => {
      const h = harness(format, "", { selected: null }); h.render();
      h.accept(video, mode);
      const tree = h.render(), editor = nodes(tree).find(n => n.type === "FormatVideoEditor");
      assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "create");
      assert.deepEqual(nodes(tree).filter(n => n.type === "tab").map(n => text(n)), ["Create", "Demo", "Schedule"]);
      assert.equal(editor.props.active, true); assert.equal(editor.props.video.mediaAssetId, video.id);
      assert.equal(editor.props.editingActive, false, "Accepted clips show their preview before exposing tools");
      assert.equal(h.params().get("videoSource"), mode);
    });
  }
  test(`${format}: local upload opens its blob preview in the common editor without an owned asset`, () => {
    const h = harness(format, "", { selected: null }); h.render(); h.accept(null, "upload");
    const editor = nodes(h.render()).find(n => n.type === "FormatVideoEditor");
    assert.equal(editor.props.active, true); assert.equal(editor.props.video.url, "blob:local-opening");
    assert.equal(editor.props.video.mediaAssetId, null);
  });
  test(`${format}: editing each preview uses Create or Demo while preserving both editor identities`, () => {
    const h = harness(format, "", { selected: null }); h.render(); h.accept(video, "assets");
    let tree = h.render(); const openingKey = nodes(tree).find(n => n.type === "FormatVideoEditor").key;
    let demo = nodes(tree).find(n => n.type === "FormatDemoSection"); const demoKey = demo.key;
    demo.props.onSelectionChange(true); demo.props.onEdit(); tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "demo");
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.active, false);
    demo = nodes(tree).find(n => n.type === "FormatDemoSection");
    assert.equal(demo.props.editActive, true); assert.equal(demo.key, demoKey);
    assert.equal(nodes(tree).some(n => n.props?.["aria-label"] === "Video to edit"), false);
    nodes(tree).find(n => n.type === "Button" && text(n).trim() === "Back to previews").props.onClick();
    tree = h.render(); assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.active, true);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.editingActive, false);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").key, openingKey);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.editPreviewActive, true);
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onEdit();
    tree = h.render(); assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.editingActive, true);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.editActive, false);
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onEditDone();
    tree = h.render(); assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "create");
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.editPreviewActive, true);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.editingActive, false);
  });
  test(`${format}: Demo can be edited before an opening without showing the opening empty state`, () => {
    const h = harness(format, "", { selected: null }); h.render();
    let demo = nodes(h.render()).find(n => n.type === "FormatDemoSection");
    demo.props.onSelectionChange(true); demo.props.onEdit(); const tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.editActive, true);
    assert.equal(nodes(tree).some(n => n.type === "Button" && text(n) === "Choose a video"), false);
    assert.equal(text(tree).includes("Choose a video in Create"), false);
  });
  test(`${format}: failed opening replacement retains editor, saved output and URL; success invalidates them`, async () => {
    const h = harness(format); h.render(); h.accept(video, "assets");
    nodes(h.render()).find(n => n.type === "FormatVideoEditor").props.onSaved({ id: "saved-final", kind: "media_asset", url: "/final.mp4", title: "Final" });
    h.source.mode = "upload";
    let complete; h.source.chooseUpload = () => { h.source.busy = true; return new Promise(resolve => { complete = resolve; }); };
    const failed = nodes(h.render()).find(n => n.type === "WorkflowVideoSourceSection").props.selection.chooseUpload({ name: "bad.mp4" });
    const pendingTree = h.render();
    assert.equal(nodes(pendingTree).find(n => n.type === "FormatSchedulePanel").props.pendingSource, true);
    assert.equal(nodes(pendingTree).find(n => n.type === "FormatDemoSection").props.pendingSource, true);
    h.source.busy = false; complete(false); assert.equal(await failed, false);
    assert.equal(nodes(h.render()).find(n => n.type === "FormatSchedulePanel").props.output.id, "saved-final");
    assert.ok(nodes(h.render()).find(n => n.type === "FormatVideoEditor")); assert.equal(h.params().get("editVideoId"), video.id);
    const accepted = nodes(h.render()).find(n => n.type === "WorkflowVideoSourceSection").props.selection.chooseUpload({ name: "good.mp4" });
    h.source.busy = false; const replacement = { ...video, id: "00000000-0000-4000-8000-000000000002" }; h.accept(replacement, "upload"); complete(true); assert.equal(await accepted, true);
    assert.equal(nodes(h.render()).find(n => n.type === "FormatSchedulePanel").props.output, null);
    const editor = nodes(h.render()).find(n => n.type === "FormatVideoEditor");
    assert.equal(editor.props.active, true); assert.equal(editor.props.video.id, replacement.id); assert.equal(h.params().get("editVideoId"), replacement.id);
  });
  test(`${format}: an empty video preview recovers through Create without an Edit tab`, () => {
    const h = harness(format, "", { selected: null }); nodes(h.render()).find(n => n.type === "button" && text(n) === "Your videos").props.onClick();
    const choose = nodes(h.render()).find(n => n.type === "Button" && text(n) === "Add a video");
    assert.ok(choose); assert.equal(Boolean(choose.props.disabled), false); choose.props.onClick();
    assert.equal(nodes(h.render()).find(n => n.type === "tabs-root").props.value, "create");
  });
  test(`${format}: Demo is available before an opening and keeps the same identity across opening changes`, () => {
    const h = harness(format, "", { selected: null });
    let tree = h.render();
    nodes(tree).find(n => n.type === "tabs-root").props.onValueChange("demo");
    tree = h.render();
    let demo = nodes(tree).find(n => n.type === "FormatDemoSection");
    assert.ok(demo); assert.equal(demo.props.active, true);
    const demoKey = demo.key;
    assert.equal(demo.props.opening, null); assert.equal(demo.props.videoId, null);
    assert.equal(text(nodes(tree).find(n => n.type === "tabpanel" && n.props.value === "demo")).trim(), "");
    assert.equal(nodes(tree).some(n => n.type === "Button" && text(n) === "Go to Create"), false);
    demo.props.onSelectionChange(true);
    nodes(h.render()).find(n => n.type === "WorkflowVideoSourceSection").props.selection.selectAsset(video);
    tree = h.render(); demo = nodes(tree).find(n => n.type === "FormatDemoSection");
    assert.equal(demo.key, demoKey, "Opening selection must not remount Demo");
    const revision = demo.props.openingRevision;
    const editor = nodes(tree).find(n => n.type === "FormatVideoEditor");
    editor.props.onSaved({ id: "opening", kind: "media_asset", url: "/opening.mp4", title: "Opening" });
    tree = h.render(); demo = nodes(tree).find(n => n.type === "FormatDemoSection");
    assert.equal(demo.key, demoKey, "Saving an opening must not remount Demo");
    assert.equal(demo.props.opening.id, "opening"); assert.equal(demo.props.openingRevision, revision);
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null, "Opening alone cannot bypass a selected demo");
    editor.props.onDirty(); tree = h.render();
    demo = nodes(tree).find(n => n.type === "FormatDemoSection");
    assert.equal(demo.key, demoKey, "Editing an opening must not remount Demo");
    assert.equal(demo.props.opening, null); assert.ok(demo.props.openingRevision > revision);
    editor.props.onSaved({ id: "opening", kind: "media_asset", url: "/opening.mp4", title: "Opening" });
    tree = h.render(); assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
    nodes(h.render()).find(n => n.type === "FormatDemoSection").props.onSkip();
    assert.equal(nodes(h.render()).find(n => n.type === "FormatSchedulePanel").props.output.id, "opening");
  });
  test(`${format}: Demo follows the saved opening and schedules only the confirmed merged output`, () => {
    const h = harness(format);
    h.render(); h.accept(video, "assets");
    let tree = h.render();
    const edited = { id: "edited-opening", kind: "media_asset", url: "/edited.mp4", title: "Edited opening" };
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onSaved(edited);
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onContinue();
    tree = h.render(); const demo = nodes(tree).find(n => n.type === "FormatDemoSection");
    assert.equal(demo.props.active, true); assert.equal(demo.props.opening.id, edited.id);
    demo.props.onDirty(); assert.equal(nodes(h.render()).find(n => n.type === "FormatSchedulePanel").props.output, null);
    demo.props.onSaved({ id: "merged-final", kind: "media_asset", url: "/joined.mp4", title: "Joined" });
    demo.props.onContinue(); tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output.id, "merged-final");
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onDirty(); tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.opening, null);
  });
  test(`${format}: skipping demo schedules the saved opening`, () => {
    const h = harness(format);
    h.render(); h.accept(video, "assets");
    nodes(h.render()).find(n => n.type === "FormatVideoEditor").props.onSaved({ id: "opening", kind: "media_asset", url: "/opening.mp4", title: "Opening" });
    nodes(h.render()).find(n => n.type === "FormatDemoSection").props.onSkip();
    assert.equal(nodes(h.render()).find(n => n.type === "FormatSchedulePanel").props.output.id, "opening");
  });
  for (const mode of ["upload", "assets"]) {
    test(`${format}: its preview Edit action opens the ready ${mode} clip without a separate tab`, () => {
      const h = harness(format); h.source.mode = mode;
      h.render(); h.accept(video, mode);
      nodes(h.render()).find(n => n.type === "FormatVideoEditor").props.onEdit();
      const editor = nodes(h.render()).find(n => n.type === "FormatVideoEditor");
      assert.equal(editor.props.active, true);
      assert.equal(editor.props.editingActive, true);
      assert.equal(editor.props.video.mediaAssetId, video.id);
      assert.equal(editor.props.video.url, video.url);
      assert.equal(h.params().get("videoSource"), mode);
      assert.equal(h.params().get("editVideoId"), video.id);
    });
  }
  test(`${format}: a pending upload cannot become an editable or schedulable video`, () => {
    const h = harness(format, "", { selected: null });
    h.source.mode = "upload"; h.source.busy = true;
    nodes(h.render()).find(n => n.type === "button" && text(n) === "Your videos").props.onClick();
    assert.equal(nodes(h.render()).some(n => n.type === "FormatVideoEditor"), false);
    assert.equal(nodes(h.render()).find(n => n.type === "FormatSchedulePanel").props.output, null);
  });
  test(`${format}: existing footage opens the same editor and replacement invalidates the saved schedule output`, () => {
    const h = harness(format); h.render(); h.accept(video, "assets"); let tree;
    tree = h.render(); let editor = nodes(tree).find(n => n.type === "FormatVideoEditor");
    assert.equal(editor.props.video.mediaAssetId, video.id); assert.equal(editor.props.video.url, video.url);
    assert.equal(h.params().get("videoSource"), "assets"); assert.equal(h.params().get("editVideoId"), video.id);
    editor.props.onSaved({ id: "saved-final", kind: "media_asset", url: "/final.mp4", title: "Final" }); tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output.id, "saved-final");
    nodes(tree).find(n => n.type === "WorkflowVideoSourceSection").props.selection.selectAsset({ ...video, id: "00000000-0000-4000-8000-000000000002" });
    tree = h.render(); assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
    assert.equal(h.params().get("editVideoId"), "00000000-0000-4000-8000-000000000002");
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.active, true);
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

test("slideshow keeps its Edit slides tab and image-selection transition", () => {
  const h = harness("slideshow", "", { selected: null });
  let tree = h.render();
  assert.deepEqual(nodes(tree).filter(n => n.type === "tab").map(n => text(n)), ["Create", "Edit slides", "Schedule"]);
  nodes(tree).filter(n => n.type === "div" && typeof n.props?.ref === "function").forEach(n => n.props.ref({ clientWidth: 0 }));
  tree = h.render();
  nodes(tree).find(n => n.type === "generation-panel").props.recreateView.workflow.onSelectImage({ id: "image", url: "/image.png" });
  tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "edit");
  assert.equal(nodes(tree).find(n => n.type === "FormatSlideshowEditor").props.active, true);
});
