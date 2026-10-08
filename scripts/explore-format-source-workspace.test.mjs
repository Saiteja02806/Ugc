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
  let cursor = 0, params = new URLSearchParams(query), columns = 5, resizeCallback;
  const slots = [], queries = [], tokens = [], reads = [];
  const window = { location: { pathname: `/explore/${format}`, get search() { return `?${params}`; } }, history: { replaceState(_, __, url) { params = new URLSearchParams(url.split("?")[1]); } }, matchMedia: () => ({ matches: false }), getComputedStyle: () => ({ gridTemplateColumns: Array(columns).fill("200px").join(" ") }) };
  const source = { mode: "assets", source: selected, preview: selected ? { name: selected.title, url: selected.url, duration: selected.durationSeconds } : null,
    ready: Boolean(selected), dirty: Boolean(selected), busy: false, setMode(value) { source.mode = value; }, selectAsset(value) { source.source = value; source.preview = { name: value.title, url: value.url, duration: value.durationSeconds }; source.ready = true; return true; }, removeUpload() {}, chooseUpload: async () => false };
  const element = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const jsx = { jsx: element, jsxs: element, Fragment: "fragment" };
  // JSX functions are called as module properties by the transpiled component.
  const imports = { window, ResizeObserver: class { constructor(callback) { resizeCallback = callback; } observe() {} disconnect() {} }, "react/jsx-runtime": jsx, react: {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; }, useCallback: fn => fn, useMemo: fn => fn(),
  }, "next/dynamic": { default: () => "generation-panel" }, "next/link": { default: "link" }, "next/navigation": { useSearchParams: () => params },
  "@base-ui/react/tabs": { Tabs: { Root: "tabs-root", List: "tablist", Tab: "tab", Panel: "tabpanel" } },
  "@tanstack/react-query": { useQuery(options) { queries.push(options); return {}; } },
  "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" }, loading: false }) },
  "@/components/billing/use-billing-subscription": { useBillingSubscription: () => ({}) },
  "@/components/generation/use-ai-studio-access": { useAIStudioAccess: () => "pro" },
  "@/components/explore/use-workflow-source-video": { useWorkflowSourceVideo: () => source },
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
  return { source, queries, tokens, reads, params: () => params, resize(count) { columns = count; resizeCallback?.(); }, render() { cursor = 0; return mod.FormatWorkspace({ format, previewReferences: local ? catalogue : undefined }); } };
}

const catalogue = Array.from({ length: 90 }, (_, index) => ({ id: `wall-${index}`, format: "wall_text", title: `Productivity ${index + 1}`, category: index < 45 ? "productivity" : "other", slides: [], posterUrl: "/poster.jpg", videoUrl: "/reference.mp4" }));
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
