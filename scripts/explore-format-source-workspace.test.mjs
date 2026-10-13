import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as remixSource from "../lib/explore/remix-source.ts";
import { createWallScheduleComposition } from "../lib/explore/wall-pending-composition.ts";

function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, URLSearchParams, queueMicrotask, window: imports.window, ResizeObserver: imports.ResizeObserver, requestAnimationFrame: fn => fn(), require(name) {
    if (name in imports) return imports[name];
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}
const policy = load("lib/explore/workflow-source-video.ts", {});
const mapper = load("lib/explore/format-video-source.ts", { "./workflow-source-video.ts": policy, "./remix-source.ts": remixSource });
const pagination = load("lib/explore/reference-pagination.ts", {});
const video = { id: "00000000-0000-4000-8000-000000000001", collection: "influencer", status: "ready", mimeType: "video/mp4", durationSeconds: 8,
  fileSizeBytes: 2000, title: "My saved clip", url: "/owned.mp4", ratio: "16:9", width: 1280, height: 720, metadata: {}, createdAt: "2026-10-08T00:00:00Z" };
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : ""; }
function harness(format, query = "", { local = true, selected = video, catalogue = [], subscription = { isActive: true }, backgroundCapability = { data: false, isFetching: false }, finalSlideshow } = {}) {
  let cursor = 0, params = new URLSearchParams(query), columns = 5, resizeCallback, sourceInput;
  const slots = [], effects = [], queries = [], tokens = [], reads = [];
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
    useEffect(callback, deps) {
      const i = cursor++, previous = slots[i];
      if (previous && deps !== undefined && previous.deps !== undefined && deps.length === previous.deps.length && deps.every((value, n) => Object.is(value, previous.deps[n]))) return;
      const next = { deps: deps?.slice(), cleanup: previous?.cleanup };
      slots[i] = next;
      effects.push(() => { previous?.cleanup?.(); next.cleanup = callback(); });
    },
  }, "next/dynamic": { default: loader => loader.toString().match(/module\.(FormatVideoEditor|FormatSlideshowEditor|WallSchedulePreview)/)?.[1] ?? "generation-panel" }, "next/link": { default: "link" }, "next/navigation": { useSearchParams: () => params },
  "@base-ui/react/tabs": { Tabs: { Root: "tabs-root", List: "tablist", Tab: "tab", Panel: "tabpanel" } },
  "@tanstack/react-query": { useQuery(options) { queries.push(options); return options.queryKey[0] === "recreate-references" ? { data: catalogue } : {}; } },
  "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" }, loading: false }) },
  "@/components/billing/use-billing-subscription": { useBillingSubscription: () => ({ data: subscription }) },
  "@/components/generation/use-ai-studio-access": { useAIStudioAccess: () => "pro" },
  "@/components/explore/use-workflow-source-video": { useWorkflowSourceVideo(input) { sourceInput = input; return source; } },
  "@/components/explore/pending-schedule-panel": { useBackgroundScheduleAvailability: () => backgroundCapability },
  "@/components/explore/format-workspace.module.css": new Proxy({}, { get: (_, key) => key }),
  "@/lib/ai-studio/access-policy": { getAIStudioAccessMessage: () => "" }, "@/lib/explore/format-video-source": mapper,
  "@/lib/explore/remix-source": remixSource,
  "@/lib/explore/wall-pending-composition": { createWallScheduleComposition },
  "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async (...args) => { reads.push(args); return video; } },
  "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { tokens.push(owner); return "owner-token"; } },
  "@/worker/src/lib/explore-finishing-contract": { isExploreUuid: value => typeof value === "string" && /^[\da-f-]{36}$/i.test(value) },
  "@/lib/explore/recreate-types": { referenceCategories: () => [], filterReferences: (items, kind, categories) => items.filter(item => item.format === kind && (!categories.length || categories.includes(item.category))), interleaveReferenceCategories: items => items },
  "@/lib/explore/reference-pagination": pagination,
  "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  imports.react.useLayoutEffect = imports.react.useEffect;
  const mod = load("components/explore/format-workspace.tsx", imports);
  return { source, accept, queries, tokens, reads, params: () => params, resize(count) { columns = count; resizeCallback?.(); }, render() {
    cursor = 0;
    const tree = mod.FormatWorkspace({ format, previewReferences: local ? catalogue : undefined, previewFinalSlideshow: finalSlideshow });
    for (const commit of effects.splice(0)) commit();
    return tree;
  } };
}

const catalogue = Array.from({ length: 90 }, (_, index) => ({ id: `wall-${index}`, format: "wall_text", title: `Productivity ${index + 1}`, category: index < 45 ? "productivity" : "other", slides: [], posterUrl: "/poster.jpg", videoUrl: "/reference.mp4" }));
for (const format of ["hook", "wall_text"]) {
  if (format === "hook") test(`${format}: background scheduling enters Schedule with exact raw composition and no export requests`, () => {
    const h = harness(format, "", { local: false, backgroundCapability: { data: true, isFetching: false } });
    h.render(); h.accept(video, "assets");
    const composition = { signature: "exact-snapshot", sourceId: video.id, draft: { sourceAssetId: video.id }, error: null };
    nodes(h.render()).find(n => n.type === "FormatDemoSection").props.onPendingCompositionChange(composition);
    nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("schedule");
    const tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.pendingComposition, composition);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.prepareRequest, 0);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.prepareRequest, 0);
  });
  test(`${format}: entering Schedule while capability loads starts no render and falls back only after the reply`, async () => {
    const backgroundCapability = { data: undefined, isFetching: true };
    const h = harness(format, "", { local: false, backgroundCapability });
    h.render(); h.accept(video, "assets");
    nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("schedule");
    assert.equal(nodes(h.render()).find(n => n.type === "FormatVideoEditor").props.prepareRequest, 0);
    backgroundCapability.data = false; backgroundCapability.isFetching = false;
    h.render(); await Promise.resolve();
    assert.equal(nodes(h.render()).find(n => n.type === "FormatVideoEditor").props.prepareRequest, 1);
  });
}
test("slideshow context supports all, subsets and zero without sending unchecked slides, then resets for a new reference", () => {
  const refs = ["first", "second"].map(id => ({ id, format: "slideshow", title: id, slides: Array.from({ length: 6 }, (_, index) => ({ id: `${id}-${index}`, url: `https://storage.test/${id}-${index}.png` })) }));
  const h = harness("slideshow", "refId=first", { catalogue: refs });
  nodes(h.render()).filter(n => n.type === "div" && typeof n.props?.ref === "function").forEach(n => n.props.ref({ clientWidth: 0 }));
  const view = () => nodes(h.render()).find(n => n.type === "generation-panel").props.recreateView;
  assert.deepEqual(Array.from(view().referenceImageUrls), [refs[0].slides[0].url]);
  view().contextBanner.props.onSelectionChange(["first-1", "first-4"], 4);
  assert.deepEqual(Array.from(view().referenceImageUrls), [refs[0].slides[4].url, refs[0].slides[1].url]);
  assert.equal(view().referenceImageUrl, refs[0].slides[4].url);
  nodes(h.render()).find(n => n.type === "FormatSlideshowEditor").props.onRegenerate(2, { id: video.id, url: "https://owned.test/generated.png" });
  assert.deepEqual(Array.from(view().referenceImageUrls), [refs[0].slides[4].url, refs[0].slides[1].url]);
  assert.equal(view().referenceImageAssetId, video.id);
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

// Demo and the two-clip overview belong to Hook; Wall has a single Edit stage.
for (const format of ["hook"]) {
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
    const reveal = nodes(nodes(tree).find(n => n.props?.["aria-label"] === "Workspace panels")).find(n => n.type === "Button" && text(n) === "Controls");
    assert.equal(reveal.props["aria-pressed"], false);
    assert.equal(reveal.props["aria-controls"], nodes(tree).find(n => n.type === "aside").props.id);
    reveal.props.onClick();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props["data-controls-expanded"], true);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").key, openingKey);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").key, demoKey);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.editingActive, true);
    nodes(tree).find(n => n.type === "Button" && text(n).trim() === "Back to editor").props.onClick();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props["data-controls-expanded"], false);
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onBackToPreview();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props["data-editing"], false);
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "demo");
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
    nodes(h.render()).find(n => n.type === "FormatDemoSection").props.onContinue();
    nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("create");
    const tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "create");
    assert.ok(nodes(tree).find(n => n.type === "WorkflowVideoSourceSection"));
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
      const navigation = nodes(tree).find(n => n.type === "WorkflowSectionNavigation");
      assert.equal(navigation.props.editValue, "demo");
      assert.equal(navigation.props.presentation, "panel");
      assert.ok(nodes(nodes(tree).find(n => n.type === "aside")).includes(navigation), "Workflow stages belong to the controls panel");
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
  test(`${format}: editing both previews uses the Edit stage while preserving both editor identities`, () => {
    const h = harness(format, "", { selected: null }); h.render(); h.accept(video, "assets");
    let tree = h.render(); const openingKey = nodes(tree).find(n => n.type === "FormatVideoEditor").key;
    let demo = nodes(tree).find(n => n.type === "FormatDemoSection"); const demoKey = demo.key;
    demo.props.onSelectionChange(true); demo.props.onEdit(); tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "demo");
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.active, false);
    demo = nodes(tree).find(n => n.type === "FormatDemoSection");
    assert.equal(demo.props.editActive, true); assert.equal(demo.key, demoKey);
    assert.equal(nodes(tree).some(n => n.props?.["aria-label"] === "Video to edit"), false);
    demo.props.onEditDone();
    tree = h.render(); assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.active, true);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.editingActive, false);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").key, openingKey);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.editPreviewActive, true);
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onEdit();
    tree = h.render(); assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.editingActive, true);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.editActive, false);
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onEditDone();
    tree = h.render(); assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "demo");
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
    const choose = nodes(h.render()).find(n => n.type === "Button" && text(n) === "Go to Create");
    assert.ok(choose); assert.equal(Boolean(choose.props.disabled), false); choose.props.onClick();
    assert.equal(nodes(h.render()).find(n => n.type === "tabs-root").props.value, "create");
  });
  test(`${format}: the empty opening card uses Create as the single source chooser and preserves Demo`, () => {
    const h = harness(format, "", { selected: null });
    nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("demo");
    let tree = h.render(); const demoKey = nodes(tree).find(n => n.type === "FormatDemoSection").key;
    const preview = nodes(tree).find(n => n.props?.["aria-label"] === "Clip previews and editor");
    assert.equal(nodes(preview).some(n => n.type === "Button" && ["Upload", "Create", "Choose from Creative Assets"].includes(text(n))), false);
    nodes(preview).find(n => n.type === "Button" && text(n) === "Go to Create").props.onClick();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "create");
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").key, demoKey);
    assert.equal(nodes(tree).find(n => n.type === "WorkflowVideoSourceSection").props.selection.selectAsset(video), true);
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.video.url, video.url);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").key, demoKey);
  });
  test(`${format}: Change returns to Create without clearing the opening, its edits or Demo`, () => {
    const h = harness(format, "", { selected: null }); h.render(); h.accept(video, "assets");
    let tree = h.render();
    const openingKey = nodes(tree).find(n => n.type === "FormatVideoEditor").key;
    const demoKey = nodes(tree).find(n => n.type === "FormatDemoSection").key;
    const output = { id: "saved-opening", kind: "media_asset", url: "/edited.mp4", title: "Edited hook" };
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onSaved(output);
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onSelectionChange(true);
    nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("demo");
    tree = h.render();
    const change = nodes(nodes(tree).find(n => n.type === "FormatVideoEditor").props.previewActions).find(n => n.type === "Button");
    assert.equal(text(change), "Change"); change.props.onClick();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "create");
    assert.equal(h.source.mode, "assets");
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").key, openingKey);
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.video.id, video.id);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").key, demoKey);
    assert.deepEqual(nodes(tree).find(n => n.type === "FormatDemoSection").props.opening, output);
    assert.equal(h.params().get("editVideoId"), video.id);
  });
  test(`${format}: current generation selects its first ready opening in Demo and preserves a later manual choice`, () => {
    const h = harness(format, "", { selected: null });
    nodes(h.render()).filter(n => n.type === "div" && typeof n.props?.ref === "function").forEach(n => n.props.ref({ clientWidth: 0 }));
    const workflow = () => nodes(h.render()).find(n => n.type === "generation-panel").props.recreateView.workflow;
    const result = { ...video, mediaAssetId: video.id, modelLabel: null, prompt: "My hook", resolution: null, thumbnailUrl: null, status: "Ready" };
    workflow().onGenerationStart();
    nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("demo");
    workflow().onGeneratedVideo(result);
    let tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "demo");
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.video.id, result.id);
    assert.equal(h.params().get("editVideoId"), result.id);
    workflow().onGeneratedVideo({ ...result, id: "later-in-batch" });
    assert.equal(nodes(h.render()).find(n => n.type === "FormatVideoEditor").props.video.id, result.id);
    workflow().onGenerationStart();
    nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("demo");
    const manual = { ...video, id: "00000000-0000-4000-8000-000000000003" };
    h.accept(manual, "assets"); workflow().onGeneratedVideo(result);
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.video.id, manual.id);
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "demo");
    assert.equal(h.params().has(`explore-${format}Job`), false);
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
    const demoCopy = text(nodes(tree).find(n => n.type === "tabpanel" && n.props.value === "demo"));
    if (format === "hook") assert.match(demoCopy, /Add a hook in Create to remix its text/);
    else assert.equal(demoCopy.trim(), "");
    assert.equal(nodes(nodes(tree).find(n => n.type === "tabpanel" && n.props.value === "demo")).some(n => n.type === "Button" && text(n) === "Go to Create"), false, "Demo uploads must remain available without an opening");
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
  test(`${format}: background audio keeps the opening out of both final preview and scheduling until the mix is saved`, () => {
    const h = harness(format); h.render(); h.accept(video, "assets");
    let tree = h.render();
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onFinalRequiredChange(true);
    const opening = { id: "opening", kind: "media_asset", url: "/opening.mp4", title: "Opening" };
    nodes(tree).find(n => n.type === "FormatVideoEditor").props.onSaved(opening);
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
    assert.equal(nodes(tree).find(n => n.type === "FormatDemoSection").props.finalVideo, null);
    const mixed = { id: "mixed-final", kind: "media_asset", url: "/mixed.mp4", title: "Final video" };
    nodes(tree).find(n => n.type === "FormatDemoSection").props.onSaved(mixed);
    tree = h.render();
    assert.deepEqual(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, mixed);
    assert.deepEqual(JSON.parse(JSON.stringify(nodes(tree).find(n => n.type === "FormatDemoSection").props.finalVideo)), mixed);
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
    assert.equal((await query.queryFn()).id, video.id); assert.deepEqual(h.tokens, ["owner"]); assert.deepEqual(JSON.parse(JSON.stringify(h.reads)), [[video.id, "owner-token", { remixSource: true }]]);
  });
  test(`${format}: generated-result restoration still enforces the original workflow boundary`, async () => {
    const h = harness(format, `editVideoId=${video.id}&videoSource=generate`, { local: false, selected: null }); h.render();
    await assert.rejects(h.queries.find(q => q.queryKey[0] === "explore-edit-restore").queryFn(), /this workflow/);
  });
}

// Wall uses the shared single-video editor, with no optional Demo composition.
for (const mode of ["upload", "assets"]) {
  test(`wall_text: ${mode} enters Edit through its panel tab and retains the exact source`, () => {
    const h = harness("wall_text", "", { selected: null }); h.render(); h.accept(video, mode);
    let tree = h.render();
    const navigation = nodes(tree).find(n => n.type === "WorkflowSectionNavigation");
    assert.equal(navigation.props.presentation, "panel"); assert.equal(navigation.props.editValue, "edit");
    assert.ok(nodes(nodes(tree).find(n => n.type === "aside")).includes(navigation));
    assert.equal(nodes(tree).some(n => n.type === "FormatDemoSection"), false);
    const before = nodes(tree).find(n => n.type === "FormatVideoEditor");
    assert.equal(before.props.active, false);
    nodes(tree).find(n => n.type === "tabs-root").props.onValueChange("edit");
    tree = h.render(); const editor = nodes(tree).find(n => n.type === "FormatVideoEditor");
    assert.equal(editor.key, before.key); assert.equal(editor.props.active, true); assert.equal(editor.props.editingActive, true);
    assert.equal(editor.props.video.mediaAssetId, video.id); assert.equal(editor.props.video.url, video.url);
    assert.equal(h.params().get("videoSource"), mode); assert.equal(h.params().get("editVideoId"), video.id);
    const output = { id: "wall-final", kind: "media_asset", url: "/wall-final.mp4", title: "Wall final" };
    editor.props.onSaved(output); editor.props.onContinue(); tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "schedule");
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, output);
    nodes(tree).find(n => n.type === "FormatSchedulePanel").props.onBackToEdit(); tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "edit");
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").key, before.key);
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, output);
  });
}
test("wall_text: changing its source preserves the draft until a replacement is accepted", async () => {
  const h = harness("wall_text", "", { selected: null }); h.render(); h.accept(video, "assets");
  let tree = h.render(); const editor = nodes(tree).find(n => n.type === "FormatVideoEditor");
  const saved = { id: "saved-wall", kind: "media_asset", url: "/saved-wall.mp4", title: "Saved wall" };
  editor.props.onSaved(saved); nodes(tree).find(n => n.type === "tabs-root").props.onValueChange("edit");
  nodes(editor.props.previewActions).find(n => n.type === "Button").props.onClick(); tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "create");
  assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").key, editor.key);
  assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, saved);
  h.source.chooseUpload = async () => false;
  assert.equal(await nodes(tree).find(n => n.type === "WorkflowVideoSourceSection").props.selection.chooseUpload({ name: "bad.mp4" }), false);
  assert.equal(nodes(h.render()).find(n => n.type === "FormatSchedulePanel").props.output, saved);
  const replacement = { ...video, id: "00000000-0000-4000-8000-000000000002" };
  h.accept(replacement, "assets"); tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
  assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.video.mediaAssetId, replacement.id);
  assert.equal(h.params().get("editVideoId"), replacement.id);
});
test("wall_text: enabled background scheduling captures its clip and does not export on Schedule navigation", async () => {
  const h = harness("wall_text", "", { local: false, backgroundCapability: { data: true, isFetching: false } });
  h.render(); h.accept(video, "assets");
  const clip = { sourceId: video.id, editing: { version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: 8000,
    originalVolume: .5, musicVolume: .2, text: null }, busy: false, error: null };
  nodes(h.render()).find(n => n.type === "FormatVideoEditor").props.onClipStateChange(clip);
  nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("schedule");
  const tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.prepareRequest, 0);
  const composition = nodes(tree).find(n => n.type === "FormatSchedulePanel").props.pendingComposition;
  assert.equal(composition.error, null);
  assert.equal((await composition.resolve()).editing.originalVolume, .5);
  const pendingPreview = nodes(tree).find(n => n.type === "WallSchedulePreview");
  assert.ok(pendingPreview, "Pending Wall schedules use the live-preview path, not export-first guidance");
  assert.equal(pendingPreview.props.error, null);
  assert.equal(pendingPreview.props.preview, null, "A preview from another source must not be reused");
  nodes(tree).find(n => n.type === "FormatVideoEditor").props.onClipStateChange({ ...clip, editing: { ...clip.editing, originalVolume: .8 } });
  h.render();
  await assert.rejects(composition.resolve(), /changed/);
});
test("wall_text: unavailable background capability retains the established export-first path", () => {
  const h = harness("wall_text", "", { local: false });
  h.render(); h.accept(video, "assets");
  nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("schedule");
  const tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.prepareRequest, 1);
  assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.pendingComposition, null);
});
test("wall_text: generated choices stay reachable and do not replace a later manual selection", () => {
  const h = harness("wall_text", "", { selected: null });
  nodes(h.render()).filter(n => n.type === "div" && typeof n.props?.ref === "function").forEach(n => n.props.ref({ clientWidth: 0 }));
  const generation = () => nodes(h.render()).find(n => n.type === "generation-panel").props.recreateView.workflow;
  generation().onGenerationStart();
  const result = { ...video, mediaAssetId: video.id, modelLabel: null, prompt: "Wall background", resolution: null, thumbnailUrl: null, status: "Ready" };
  generation().onGeneratedVideo(result); let tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.video.id, result.id);
  nodes(tree).find(n => n.type === "tabs-root").props.onValueChange("edit");
  generation().onGenerationStart(); nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("edit");
  const manual = { ...video, id: "00000000-0000-4000-8000-000000000003" };
  h.accept(manual, "assets"); generation().onGeneratedVideo(result); tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "edit");
  assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").props.video.id, manual.id);
  assert.equal(h.params().has("explore-wall_textJob"), false);
});
test("wall_text: a local upload uses the common editor without inventing an owned media ID", () => {
  const h = harness("wall_text", "", { selected: null }); h.render(); h.accept(null, "upload");
  nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("edit");
  const editor = nodes(h.render()).find(n => n.type === "FormatVideoEditor");
  assert.equal(editor.props.active, true); assert.equal(editor.props.video.mediaAssetId, null);
  assert.equal(editor.props.video.url, "blob:local-opening"); assert.equal(h.params().has("editVideoId"), false);
});
test("wall_text: empty Edit recovers to Create without permitting a pending upload to be scheduled", () => {
  const h = harness("wall_text", "", { selected: null }); h.source.busy = true;
  nodes(h.render()).find(n => n.type === "tabs-root").props.onValueChange("edit"); let tree = h.render();
  assert.equal(nodes(tree).some(n => n.type === "FormatVideoEditor"), false);
  assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, null);
  h.source.busy = false; tree = h.render();
  nodes(tree).find(n => n.type === "Button" && text(n) === "Go to Create").props.onClick();
  assert.equal(nodes(h.render()).find(n => n.type === "tabs-root").props.value, "create");
});
test("wall_text: restoration checks owned media and retains the workflow boundary for generated results", async () => {
  const imported = harness("wall_text", `editVideoId=${video.id}&videoSource=assets`, { local: false, selected: null }); imported.render();
  const query = imported.queries.find(q => q.queryKey[0] === "explore-edit-restore"); assert.equal(query.enabled, true);
  assert.equal((await query.queryFn()).id, video.id); assert.deepEqual(imported.tokens, ["owner"]);
  assert.deepEqual(JSON.parse(JSON.stringify(imported.reads)), [[video.id, "owner-token", { remixSource: true }]]);
  const generated = harness("wall_text", `editVideoId=${video.id}&videoSource=generate`, { local: false, selected: null }); generated.render();
  await assert.rejects(generated.queries.find(q => q.queryKey[0] === "explore-edit-restore").queryFn(), /this workflow/);
});

for (const format of ["slideshow", "hook", "wall_text"]) {
  test(`${format}: stage changes reset both scroll areas after commit without clearing selected media or saved drafts`, () => {
    const reference = { id: "retained-reference", format, title: "Reference", slides: [{ id: "reference-slide", url: "/reference-slide.png" }], posterUrl: "/poster.png", videoUrl: "/reference.mp4" };
    const h = harness(format, "refId=retained-reference", { catalogue: [reference] });
    h.render();
    if (format !== "slideshow") h.accept(video, "assets");
    let tree = h.render();
    const editorType = format === "slideshow" ? "FormatSlideshowEditor" : "FormatVideoEditor";
    const saved = { id: "retained-output", kind: format === "slideshow" ? "library_item" : "media_asset", url: "/saved-output", title: "Retained saved draft", ...(format === "slideshow" ? { slides: ["/first.png", "/second.png"] } : {}) };
    const initialEditor = nodes(tree).find(n => n.type === editorType);
    initialEditor.props.onSaved(saved);
    tree = h.render();
    const controls = nodes(tree).find(n => n.type === "aside");
    const controlsScrollRef = nodes(controls).find(n => n.type === "div" && n.props.ref && typeof n.props.ref === "object").props.ref;
    const previewScrollRef = nodes(tree).find(n => n.props?.["aria-label"] === "Workflow preview").props.ref;
    const controlsScroll = { scrollTop: 420 }, previewScroll = { scrollTop: 180 };
    controlsScrollRef.current = controlsScroll; previewScrollRef.current = previewScroll;
    const beforeParams = h.params().toString();

    for (const stage of [format === "hook" ? "demo" : "edit", "create", "schedule"]) {
      controlsScroll.scrollTop = 420; previewScroll.scrollTop = 180;
      nodes(tree).find(n => n.type === "tabs-root").props.onValueChange(stage);
      assert.equal(controlsScroll.scrollTop, 420, "Scroll work belongs to the committed effect, not the event handler");
      assert.equal(previewScroll.scrollTop, 180);
      tree = h.render();
      assert.equal(controlsScroll.scrollTop, 0); assert.equal(previewScroll.scrollTop, 0);
      assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, saved);
      assert.equal(nodes(tree).find(n => n.type === editorType).key, initialEditor.key);
      assert.equal(h.params().toString(), beforeParams);
      if (format !== "slideshow") assert.equal(nodes(tree).find(n => n.type === editorType).props.video.mediaAssetId, video.id);
      else assert.equal(nodes(tree).find(n => n.type === editorType).props.reference, reference);

      controlsScroll.scrollTop = 140; previewScroll.scrollTop = 60;
      nodes(tree).find(n => n.type === "tabs-root").props.onValueChange(stage);
      tree = h.render();
      assert.equal(controlsScroll.scrollTop, 140, "Refocusing the current stage must not disrupt its scroll position");
      assert.equal(previewScroll.scrollTop, 60);
    }
    assert.equal(h.tokens.length, 0); assert.equal(h.reads.length, 0);
  });
}

test("slideshow keeps all workflow stages in its controls panel and preserves image-selection transitions", () => {
  const h = harness("slideshow", "", { selected: null });
  let tree = h.render();
  const navigation = nodes(tree).filter(n => n.type === "WorkflowSectionNavigation");
  assert.equal(navigation.length, 1);
  assert.equal(navigation[0].props.editValue, "edit");
  assert.equal(navigation[0].props.presentation, "panel");
  assert.equal(navigation[0].props.hideSchedule, undefined, "The restored panel includes Schedule without altering its action handler");
  assert.ok(nodes(nodes(tree).find(n => n.type === "aside")).includes(navigation[0]));
  assert.equal(nodes(nodes(tree).find(n => n.type === "header")).includes(navigation[0]), false);
  nodes(tree).filter(n => n.type === "div" && typeof n.props?.ref === "function").forEach(n => n.props.ref({ clientWidth: 0 }));
  tree = h.render();
  nodes(tree).find(n => n.type === "FormatSlideshowEditor").props.controllerRef.current = { useImage: () => true };
  nodes(tree).find(n => n.type === "generation-panel").props.recreateView.workflow.onSelectImage({ id: "image", url: "/image.png" });
  tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "edit");
  assert.equal(nodes(tree).find(n => n.type === "FormatSlideshowEditor").props.active, true);
  assert.equal(nodes(tree).find(n => n.type === "tabs-root").props["data-pane"], "preview");
  nodes(tree).find(n => n.type === "tabs-root").props.onValueChange("edit");
  assert.equal(nodes(h.render()).find(n => n.type === "tabs-root").props["data-pane"], "preview", "Refocusing the active stage must not hide its Preview panel");
});

test("slideshow shares Schedule actions and returns to Edit without changing its saved post", () => {
  const h = harness("slideshow", "", { selected: null });
  let tree = h.render();
  const saved = { id: "saved-slides", kind: "library_item", url: "/slide-1.png", title: "Saved slideshow", slides: ["/slide-1.png", "/slide-2.png"] };
  nodes(tree).find(n => n.type === "FormatSlideshowEditor").props.onSaved(saved);
  nodes(tree).find(n => n.type === "tabs-root").props.onValueChange("schedule");
  tree = h.render();
  const actions = nodes(tree).filter(n => n.props?.["aria-label"] === "Schedule actions");
  assert.equal(actions.length, 0, "There is no separate full-width scheduling footer");
  const scheduling = nodes(tree).find(n => n.type === "FormatSchedulePanel");
  assert.equal(scheduling.props.actionsTarget, undefined, "Actions stay inside the scheduling panel");
  assert.equal(scheduling.props.imageOnly, true); assert.equal(scheduling.props.output, saved);
  const postPreview = nodes(tree).find(n => n.props?.["aria-label"] === "Saved slideshow preview");
  assert.equal(postPreview.props.tabIndex, 0, "Long saved sequences remain keyboard scrollable");
  assert.deepEqual(nodes(postPreview).filter(n => n.type === "img").map(n => n.props.src), saved.slides);
  scheduling.props.onBackToEdit(); tree = h.render();
  assert.equal(nodes(tree).find(n => n.type === "tabs-root").props.value, "edit");
  assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output, saved);
});

test("compact panel navigation retains accepted clips and saved output", () => {
  const h = harness("hook"); h.render(); h.accept(video, "assets");
  let tree = h.render();
  const before = nodes(tree).find(n => n.type === "FormatVideoEditor");
  before.props.onSaved({ id: "saved", kind: "media_asset", url: "/saved.mp4", title: "Saved" });
  for (const label of ["Preview", "Controls", "Preview"]) {
    tree = h.render();
    nodes(nodes(tree).find(n => n.props?.["aria-label"] === "Workspace panels")).find(n => n.type === "Button" && text(n) === label).props.onClick();
    tree = h.render();
    assert.equal(nodes(tree).find(n => n.type === "tabs-root").props["data-pane"], label.toLowerCase());
    assert.equal(nodes(tree).find(n => n.type === "FormatVideoEditor").key, before.key);
    assert.equal(nodes(tree).find(n => n.type === "FormatSchedulePanel").props.output.id, "saved");
  }
});


test("sample slideshow Schedule preview stays non-publishing and preserves ordered images", () => {
  const finalSlideshow = { id: "local-slideshow-sample", title: "Sample only", slides: ["/one.jpg", "/two.jpg"] };
  const h = harness("slideshow", "", { finalSlideshow });
  const panel = nodes(h.render()).find(n => n.type === "FormatSchedulePanel");
  assert.equal(panel.props.localPreview, true);
  assert.equal(panel.props.output.kind, "library_item");
  assert.deepEqual(panel.props.output.slides, finalSlideshow.slides);
  assert.equal(panel.props.output.url, "/one.jpg");
});

test("sample slideshow props cannot become outputs in the live workflow or another format", () => {
  const finalSlideshow = { id: "local-slideshow-sample", title: "Sample only", slides: ["/one.jpg", "/two.jpg"] };
  for (const [format, local] of [["slideshow", false], ["hook", true], ["wall_text", true]]) {
    const h = harness(format, "", { local, finalSlideshow });
    assert.equal(nodes(h.render()).find(n => n.type === "FormatSchedulePanel").props.output, null);
  }
});
