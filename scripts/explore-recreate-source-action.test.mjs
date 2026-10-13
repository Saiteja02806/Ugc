import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as references from "../lib/explore/recreate-types.ts";
import * as pagination from "../lib/explore/reference-pagination.ts";
import { isExploreUuid } from "../worker/src/lib/explore-finishing-contract.ts";

const element = (type, props) => ({ type, props });
const nodes = value => value == null ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
const styles = new Proxy({}, { get: (_, name) => name });
const sourceAsset = { id: "00000000-0000-4000-8000-000000000001", mediaAssetId: "00000000-0000-4000-8000-000000000001",
  url: "/owned-opening.mp4", title: "My earlier opening", durationSeconds: 8, remixTextSource: null };

// Execute the real FormatWorkspace click handlers with React/Next and network
// boundaries isolated. The gallery entries retain separate MP4 and poster URLs.
function fixture(format, { mode = "generate", preview = false, busy = false, generationBusy = false, existingOpening = false, initialReference = false, staleSearchParams = false } = {}) {
  const reference = { id: `${format}-gallery-video`, format, title: "The selected gallery clip", category: null, categoryLabel: null,
    posterUrl: "https://media.example/poster.jpg", videoUrl: "https://media.example/reference.mp4", durationSeconds: 7, slides: [] };
  let cursor = 0, tree, component;
  const slots = [], events = [];
  const location = { pathname: `/explore/${format === "hook" ? "hook-video" : "wall-of-text"}`,
    search: `?videoSource=${mode}${existingOpening ? `&editVideoId=${sourceAsset.id}` : ""}${initialReference ? `&refId=${reference.id}` : ""}` };
  const initialParams = new URLSearchParams(location.search);
  const source = { mode, busy, enabled: !preview, ownerId: "owner-a", dirty: false, error: null,
    source: null, preview: null, ready: false,
    setMode(next) { events.push({ kind: "mode", value: next }); source.mode = next; },
    removeUpload() { events.push({ kind: "removeUpload" }); }, selectAsset: () => true, chooseUpload: async () => true };
  const react = {
    Suspense: "Suspense",
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useId: () => "workspace-panels", useEffect() {}, useLayoutEffect() {}, useCallback: callback => callback, useMemo: create => create(),
  };
  let dynamicIndex = 0;
  const imports = {
    react, "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "Fragment" },
    "next/dynamic": { __esModule: true, default: loader => loader.toString().match(/module\.(FormatVideoEditor|FormatSlideshowEditor|WallSchedulePreview)/)?.[1] ?? (dynamicIndex++ === 0 ? "ImagePanel" : "VideoPanel") },
    "next/link": { __esModule: true, default: "Link" }, "next/navigation": { useSearchParams: () => staleSearchParams ? initialParams : new URLSearchParams(location.search) },
    "@base-ui/react/tabs": { Tabs: { Root: "Tabs.Root", Panel: "Tabs.Panel" } },
    "@tanstack/react-query": { useQuery: query => ({ data: query.queryKey[0] === "recreate-references" ? [reference] : query.queryKey[0] === "explore-edit-restore" && existingOpening && location.search.includes("editVideoId=") ? sourceAsset : undefined, isFetching: false, isError: false }) },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner-a" }, loading: false }) },
    "@/components/billing/use-billing-subscription": { useBillingSubscription: () => ({ data: { isActive: true } }) },
    "@/components/generation/use-ai-studio-access": { useAIStudioAccess: () => "pro" },
    "@/components/explore/use-workflow-source-video": { useWorkflowSourceVideo: () => source },
    "@/components/explore/pending-schedule-panel": { useBackgroundScheduleAvailability: () => ({ data: false, isFetching: false }) },
    "@/lib/explore/wall-pending-composition": { createWallScheduleComposition: () => ({ signature: "fixture", error: null, resolve: async () => ({}) }) },
    "@/lib/explore/recreate-types": references, "@/lib/explore/reference-pagination": pagination,
    "@/worker/src/lib/explore-finishing-contract": { isExploreUuid },
    "@/lib/explore/format-video-source": { formatVideoFromAsset: value => value },
    "@/lib/explore/remix-source": { resolveRemixSource: () => ({ reference: null }) },
    "@/lib/ai-studio/access-policy": { getAIStudioAccessMessage: () => "" },
    "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: () => { throw new Error("No owned-media request is allowed in this fixture"); } },
    "@/lib/firebase/auth": { getCurrentUserIdToken: () => { throw new Error("No authentication request is allowed in this fixture"); } },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/format-workspace.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, require: name => {
    if (name in imports) return imports[name];
    if (name.endsWith(".module.css")) return { __esModule: true, default: styles };
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, key) => key });
    throw new Error(`Unexpected import ${name}`);
  }, URLSearchParams, localStorage: { getItem: () => null }, window: { location, matchMedia: () => ({ matches: true }),
    history: { replaceState(_state, _title, url) { location.search = url.includes("?") ? url.slice(url.indexOf("?")) : ""; events.push({ kind: "url", value: url }); } } },
    requestAnimationFrame(callback) { callback(); },
  });
  const props = { format, ...(preview ? { previewReferences: [reference], ...(existingOpening ? { previewVideo: sourceAsset } : {}), ...(initialReference ? { previewText: { referenceId: reference.id } } : {}) } : {}) };
  component = exports.FormatWorkspace(props);
  function render() { cursor = 0; tree = component.type(component.props); return tree; }
  render();
  // Mount callback refs that supply the existing controls/results portal hosts.
  const hosts = new Map();
  for (const node of nodes(tree)) if (typeof node.props?.ref === "function" && !node.props.className?.includes("referenceGrid")) {
    const host = { focus() {}, querySelector() { return null; } };
    hosts.set(node.props.className, host); node.props.ref(host);
  }
  render();
  if (generationBusy) { nodes(tree).find(node => node.type === "VideoPanel").props.recreateView.workflow.onBusyChange(true); render(); }
  return { source, events, reference, location, render,
    card: () => nodes(tree).find(node => node.type === "ReferenceCard"),
    panel: () => nodes(tree).find(node => node.type === "VideoPanel"),
    stage: () => nodes(tree).find(node => node.type === "Tabs.Root"),
    dialog: () => nodes(tree).find(node => node.type === "ReferencePreviewDialog"),
    editor: () => nodes(tree).find(node => node.type === "FormatVideoEditor"),
  };
}

for (const format of ["hook", "wall_text"]) {
  for (const preview of [false, true]) test(`${format}: removing the initial ${preview ? "preview" : "linked"} reference stays cleared while URL hooks catch up and Recreate can select it again`, () => {
    const h = fixture(format, { preview, initialReference: true, staleSearchParams: true });
    assert.equal(h.panel().props.recreateView.styleVideo.id, h.reference.id);
    h.panel().props.recreateView.onClearReference(); h.render();
    assert.equal(h.panel().props.recreateView.styleVideo, undefined);
    assert.equal(h.card().props.isSelected, false);
    assert.equal(new URLSearchParams(h.location.search).has("refId"), false);
    h.render(); assert.equal(h.panel().props.recreateView.styleVideo, undefined);
    h.card().props.onRecreate(); h.render();
    assert.equal(h.panel().props.recreateView.styleVideo.id, h.reference.id);
    assert.equal(h.card().props.isSelected, true);
  });
  for (const preview of [false, true]) for (const mode of ["generate", "upload", "assets"]) {
    test(`${format}: Recreate from ${mode} enters Generate with the clicked MP4 in ${preview ? "preview" : "live"} controls`, () => {
      const h = fixture(format, { mode, preview });
      h.card().props.onRecreate(); h.render();
      assert.equal(h.source.mode, "generate");
      assert.equal(h.stage().props.value, "create");
      const view = h.panel().props.recreateView;
      assert.equal(view.workflow.controlsActive, true);
      assert.equal(view.styleVideo.id, h.reference.id);
      assert.equal(view.styleVideo.url, h.reference.videoUrl);
      assert.equal(view.referenceImageUrl, undefined);
      assert.equal(view.referenceImageUrls, undefined);
      assert.equal(view.preview, preview);
      const query = new URLSearchParams(h.location.search);
      assert.equal(query.get("videoSource"), "generate");
      assert.equal(query.get("refId"), h.reference.id);
      assert.equal(query.get("sourceUrl"), h.reference.videoUrl);
      assert.equal(h.events.some(event => event.kind === "removeUpload"), false);
    });
  }
  test(`${format}: previewing a gallery video opens that video without selecting or changing Create mode`, () => {
    const h = fixture(format, { mode: "upload" });
    h.card().props.onPreview(); h.render();
    assert.equal(h.dialog().props.open, true);
    assert.equal(h.dialog().props.reference.id, h.reference.id);
    assert.equal(h.source.mode, "upload");
    assert.equal(h.panel().props.recreateView.styleVideo, undefined);
    assert.equal(h.events.length, 0);
  });
  for (const preview of [false, true]) test(`${format}: Recreate leaves an existing ${preview ? "preview" : "restored owned"} opening available for editing`, () => {
    const h = fixture(format, { mode: "assets", preview, existingOpening: true });
    assert.equal(h.editor().props.video.id, sourceAsset.id);
    h.card().props.onRecreate(); h.render();
    assert.equal(h.editor().props.video.id, sourceAsset.id);
    assert.equal(new URLSearchParams(h.location.search).has("editVideoId"), false);
    assert.equal(h.stage().props["data-editing"], false);
  });
  for (const activity of ["upload", "generation"]) test(`${format}: Recreate cannot redirect an active ${activity}`, () => {
    const h = fixture(format, { mode: "upload", busy: activity === "upload", generationBusy: activity === "generation" });
    h.card().props.onRecreate(); h.render();
    assert.equal(h.source.mode, "upload");
    assert.equal(h.panel().props.recreateView.styleVideo, undefined);
    assert.equal(h.events.length, 0);
  });
}
