import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as inlineSymbols from "../worker/src/lib/explore-inline-symbols.ts";
import sharp from "sharp";
import * as remixSource from "../lib/explore/remix-source.ts";
import { prepareSlideshowSequence } from "../lib/explore/slideshow-preparation.ts";
import { readSlideshowEditableDraft } from "../lib/explore/slideshow-editable-draft.ts";
import { insertReferenceSlides } from "../lib/explore/slideshow-assembly.ts";
import { withReadDeadline } from "../lib/http/read-deadline.ts";
import { sameBackgroundTargets } from "../lib/media/image-library.ts";
import { imagePickerThumbnailUrl } from "../lib/media/image-picker.ts";

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name === "server-only") return {};
    if (name === "../../worker/src/lib/explore-inline-symbols.ts") return inlineSymbols;

    if (name === "@/components/media/image-library-picker") return { ImageLibraryPicker: "ImageLibraryPicker" };
    if (name === "@/lib/media/image-library") return { sameBackgroundTargets };
    if (name === "@/lib/media/image-picker") return { imagePickerThumbnailUrl };
      if (name === "./slideshow-editable-draft.ts" || name === "./slideshow-editable-draft" || name === "@/lib/explore/slideshow-editable-draft") return { readSlideshowEditableDraft };
    if (name === "@/lib/explore/slideshow-api") return load("lib/explore/slideshow-api.ts", imports, globals);
    if (name === "./slideshow-draft" || name === "@/lib/explore/slideshow-draft") return load("lib/explore/slideshow-draft.ts", { "../../worker/src/lib/explore-finishing-contract.ts": { isExploreUuid: uuid } });
    if (name === "./format-slideshow-text-tools") return { FormatSlideshowTextTools: "FormatSlideshowTextTools" };
    if (name === "./slideshow-add-slides") return { SlideshowAddSlides: "SlideshowAddSlides" };
    if (name === "./use-slideshow-slide-drag") return load("components/explore/use-slideshow-slide-drag.ts", imports, globals);
    if (name === "@/lib/explore/slideshow-assembly") return { insertReferenceSlides };
    if (name === "@/lib/http/read-deadline") return { withReadDeadline };
    if (name === "./remix-text-section") return { RemixTextSection: "RemixTextSection" };
    if (name === "@/lib/explore/remix-source") return remixSource;
    if (!(name in imports)) throw new Error(`Unexpected dependency ${name}`); return imports[name]; }, ...globals });
  return exports;
}
const { slideTextSvg, parseSlideText, EMPTY_SLIDE_TEXT } = load("lib/explore/slideshow-text.ts");
const measure = (text, font) => [...text].length * Number(font.match(/([\d.]+)px/)[1]) * .6;
test("slide text validates bounded text, fonts, colors and opacity before producing SVG", () => {
  for (const patch of [{ heading: "\0unsafe" }, { body: "a".repeat(601) }, { font: "url(evil)" }, { size: Infinity }, { color: 'red" onclick="evil' }, { opacity: NaN }, { position: "outside" }, { background: "url(evil)" }]) assert.throws(() => parseSlideText({ ...EMPTY_SLIDE_TEXT, ...patch }));
  assert.throws(() => slideTextSvg(EMPTY_SLIDE_TEXT, 0, 1080, measure));
  assert.equal(slideTextSvg(EMPTY_SLIDE_TEXT, 1080, 1920, measure), "");
});
test("headings/body preserve line breaks and escape markup rather than executing SVG content", () => {
  const svg = slideTextSvg({ ...EMPTY_SLIDE_TEXT, heading: '<script>&"', body: "First\n\nSecond", background: "rounded" }, 1080, 1920, measure);
  assert.ok(svg.includes("&lt;script&gt;&amp;&quot;"));
  assert.ok(!svg.includes("<script>"));
  assert.equal((svg.match(/<text /g) ?? []).length, 5);
  assert.ok(svg.includes('<rect x="81"'));
});
test("long Unicode text fits portrait and landscape slides without losing characters", () => {
  const value = "你好世界".repeat(140);
  for (const [width, height] of [[1080, 1920], [1920, 1080], [800, 800]]) {
    const svg = slideTextSvg({ ...EMPTY_SLIDE_TEXT, body: value, size: 80, position: "bottom", background: "pill" }, width, height, measure);
    const rows = [...svg.matchAll(/<text .*? y="([\d.]+)".*?>(.*?)<\/text>/g)];
    assert.equal(rows.map(row => row[2]).join(""), value);
    assert.ok(rows.every(row => Number(row[1]) > 0 && Number(row[1]) < height));
  }
});
test("vector background shapes and text render into actual PNG pixels", async () => {
  const svg = slideTextSvg({ ...EMPTY_SLIDE_TEXT, heading: "Your heading", body: "Your message", background: "rounded", backgroundColor: "#ff683b", opacity: 1 }, 540, 960, measure);
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 540); assert.equal(info.height, 960);
  let orange = 0, white = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset] > 240 && data[offset + 1] > 80 && data[offset + 1] < 130 && data[offset + 2] < 90 && data[offset + 3] > 200) orange++;
    if (data[offset] > 240 && data[offset + 1] > 240 && data[offset + 2] > 240 && data[offset + 3] > 200) white++;
  }
  assert.ok(orange > 1000); assert.ok(white > 100);
});

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const asset = n => ({ id: id(n), user_id: "owner", deleted_at: null, collection: "image", status: "ready", mime_type: "image/png", url: `https://storage.test/${n}.png`, storage_key: `${n}.png` });
function route({ assets = new Map(), enabled = true, allowed = true } = {}) {
  const calls = [], owners = [];
  class AuthError extends Error { status = 403; }
  const reference = { id: "catalog", title: "Example", format: "slideshow", slides: Array.from({ length: 12 }, (_, i) => ({ id: `slide-${i}`, url: `https://storage.test/reference-${i}.png` })) };
  const routeModule = load("app/api/explore/slideshows/route.ts", {
    "node:crypto": { createHash },
    "@supabase/supabase-js": { createClient: () => ({ rpc: async (name, values) => { calls.push({ name, values }); return { data: id(99), error: null }; } }) },
    "@/lib/ai-studio/server-access": { requireAIStudioProUser: async () => { if (!allowed) throw new AuthError("Access required"); return { uid: "owner" }; } },
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError },
    "@/lib/explore/recreate-catalog": { getRecreateReferences: () => [reference] },
    "@/lib/media/media-storage": { getMediaAssetForOwner: async value => { owners.push(value); return assets.get(value.assetId) ?? null; } },
    "@/lib/storage/storage": { isTrustedStorageUrl: value => value.startsWith("https://storage.test/") },
    "@/worker/src/lib/explore-finishing-contract": { isExploreUuid: uuid },
  }, { Response, process: { env: { EXPLORE_SLIDESHOW_SAVING_ENABLED: String(enabled), SUPABASE_URL: "https://database.test", SUPABASE_SERVICE_ROLE_KEY: "offline-fixture" } } });
  const post = (referenceId, slides, key = id(50)) => routeModule.POST(new Request("https://app.test/api/explore/slideshows", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ requestKey: key, referenceId, slides }) }));
  return { post, calls, owners };
}
test("catalog sequences can reorder and remove slides from a larger example", async () => {
  const h = route();
  const response = await h.post("catalog", [{ referenceSlideId: "slide-4", mediaAssetId: null }, { referenceSlideId: "slide-0", mediaAssetId: null }]);
  assert.equal(response.status, 200);
  assert.deepEqual(Array.from(h.calls[0].values.p_slides, slide => slide.renderedUrl), ["https://storage.test/reference-4.png", "https://storage.test/reference-0.png"]);
  assert.deepEqual(Array.from(h.calls[0].values.p_slides, slide => slide.slideNumber), [1, 2]);
});
test("uploaded slideshow saves resolve every output to an owned ready image and preserve order", async () => {
  const h = route({ assets: new Map([[id(1), asset(1)], [id(2), asset(2)]]) });
  const response = await h.post(`uploaded:${id(40)}`, [{ referenceSlideId: id(2), mediaAssetId: id(2) }, { referenceSlideId: id(1), mediaAssetId: id(1) }]);
  assert.equal(response.status, 200);
  assert.ok(h.owners.every(value => value.userId === "owner"));
  assert.deepEqual(Array.from(h.calls[0].values.p_slides, slide => slide.mediaAssetId), [id(2), id(1)]);
  assert.equal(h.calls[0].values.p_user_id, "owner");
});
test("one retained library image can back several distinct slides, including after archive", async () => {
  const h = route({ assets: new Map([[id(1), { ...asset(1), metadata: { imageLibraryArchived: true } }]]) });
  const slides = [11, 12, 13].map(number => ({ referenceSlideId: id(number), mediaAssetId: id(1) }));
  const response = await h.post(`uploaded:${id(40)}`, slides);
  assert.equal(response.status, 200);
  assert.deepEqual(Array.from(h.calls[0].values.p_slides, slide => slide.mediaAssetId), [id(1), id(1), id(1)]);
  assert.deepEqual(Array.from(h.calls[0].values.p_slides, slide => slide.slideNumber), [1, 2, 3]);
});
test("foreign, deleted, pending, non-image and untrusted outputs cannot reach Library saving", async () => {
  for (const patch of [{ user_id: "other" }, { deleted_at: "2026-10-08" }, { status: "pending" }, { collection: "video" }, { mime_type: "image/svg+xml" }, { url: "https://evil.test/image.png" }]) {
    const h = route({ assets: new Map([[id(1), { ...asset(1), ...patch }], [id(2), asset(2)]]) });
    assert.equal((await h.post(`uploaded:${id(40)}`, [{ referenceSlideId: id(1), mediaAssetId: id(1) }, { referenceSlideId: id(2), mediaAssetId: id(2) }])).status, 400);
    assert.equal(h.calls.length, 0);
  }
});
test("duplicate, foreign-reference, missing-asset and out-of-range sequences are rejected", async () => {
  const h = route();
  for (const slides of [[], [{ referenceSlideId: "slide-0", mediaAssetId: null }], [{ referenceSlideId: "slide-0", mediaAssetId: null }, { referenceSlideId: "slide-0", mediaAssetId: null }], [{ referenceSlideId: "foreign", mediaAssetId: null }, { referenceSlideId: "slide-0", mediaAssetId: null }], Array.from({ length: 11 }, (_, i) => ({ referenceSlideId: `slide-${i}`, mediaAssetId: null }))]) assert.equal((await h.post("catalog", slides)).status, 400);
  assert.equal((await h.post(`uploaded:${id(40)}`, [{ referenceSlideId: id(1), mediaAssetId: null }, { referenceSlideId: id(2), mediaAssetId: null }])).status, 400);
  assert.equal(h.calls.length, 0);
});
test("save fingerprints are stable for retries and change with the output order", async () => {
  const h = route(), slides = [{ referenceSlideId: "slide-0", mediaAssetId: null }, { referenceSlideId: "slide-1", mediaAssetId: null }];
  await h.post("catalog", slides); await h.post("catalog", slides); await h.post("catalog", [...slides].reverse());
  assert.equal(h.calls[0].values.p_fingerprint, h.calls[1].values.p_fingerprint);
  assert.notEqual(h.calls[0].values.p_fingerprint, h.calls[2].values.p_fingerprint);
});
test("access and release gates stop a save before database mutations", async () => {
  for (const options of [{ allowed: false }, { enabled: false }]) {
    const h = route(options);
    assert.equal((await h.post("catalog", [{ referenceSlideId: "slide-0", mediaAssetId: null }, { referenceSlideId: "slide-1", mediaAssetId: null }])).status, options.allowed === false ? 403 : 503);
    assert.equal(h.calls.length, 0);
  }
});

function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join("") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : ""; }
async function editor({ failFirst = false, generated = true, storedDraft = null, localPreview = false, previewImages, onBackToPreview, onContinue = () => {}, storageState, actionsTarget = null, uploadResult, fitUpload = async file => file, libraryItem, libraryItemId, locationHref } = {}) {
  let cursor = 0, nextRequest = 100;
  const slots = [], effects = [], storage = new Map(storageState ?? []), requests = [], libraryReads = [], renders = [], uploads = [], saved = [], dirty = [], controller = { current: null };
  const navigations = [], browserLocation = locationHref ? { href: locationHref } : undefined;
  if (storedDraft) storage.set(`ugc-explore:slideshow-draft:v2:owner:uploaded:${id(40)}`, JSON.stringify(storedDraft));
  const element = (type, props) => ({ type, props });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: (fn, deps) => { const i = cursor++; if (!(i in slots)) { slots[i] = deps; effects.push(fn); } }, useId: () => "slide-editor",
    useImperativeHandle: (ref, factory) => { ref.current = factory(); }, isValidElement: child => Boolean(child?.props), cloneElement: (child, props) => element(child.type, { ...child.props, ...props }),
  };
  const mod = load("components/explore/format-slideshow-editor.tsx", {
    react, "react-dom": { createPortal: (children, target) => element("portal", { children, target }) }, "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
    "lucide-react": { ArrowLeft: "icon", ArrowRight: "icon", Download: "icon", Trash2: "icon" },
    "@/components/ui/button": { Button: "Button" }, "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" } }) },
    "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async value => ({ id: value, collection: "image", status: "ready", url: "https://storage.test/" + value + ".png", title: "Saved image", createdAt: "", ratio: "9:16" }) },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async (file, kind, _, owner) => { uploads.push({ file, kind, owner }); return uploadResult ? uploadResult(file) : { asset: { id: id(300 + uploads.length) } }; } },
    "@/lib/explore/slideshow-text": { EMPTY_SLIDE_TEXT, parseSlideText },
    "@/lib/explore/slideshow-preparation": { prepareSlideshowSequence },
    "@/lib/explore/slideshow-image-client": { fitSlideshowUpload: fitUpload },
    "@/lib/explore/slideshow-text-client": { renderSlideText: async (source, design) => { renders.push({ source, design }); return { source, design }; }, createSlideTextSvg: (design, width, height) => slideTextSvg(design, width, height, measure) },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { assert.equal(owner, "owner"); return "offline-token"; } },
    "@/worker/src/lib/explore-finishing-contract": { isExploreUuid: uuid }, "./slideshow-editor.module.css": { default: { preview: "preview", overlay: "overlay" } }, "./workflow-creation.module.css": { default: {} },
  }, {
    document: {}, URL, window: { location: browserLocation, history: { state: {}, replaceState(_state, _title, url) { navigations.push(url); browserLocation.href = new URL(url, browserLocation.href).href; } }, addEventListener() {}, removeEventListener() {} }, setTimeout, clearTimeout, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    crypto: { randomUUID: () => id(nextRequest++) }, navigator: { locks: { request: async (_, options, callback) => { assert.equal(options.ifAvailable, true); return callback({}); } } },
    fetch: async (url, options) => {
      if (url === `/api/library/carousels/${id(99)}`) {
        libraryReads.push(url);
        const body = requests.at(-1);
        const item = libraryItem ?? (body ? { id: id(99), title: "Saved", sourceId: `explore-slideshow:${body.requestKey}`, projectId: "explore", slideCount: body.slides.length, slides: body.slides.map((_, i) => ({ slideNumber: i + 1, renderedUrl: `https://storage.test/${i}.png` })) } : null);
        return { ok: true, json: async () => ({ok:true, item}) };
      }
      assert.equal(url, "/api/explore/slideshows", "Only the mocked slideshow saving endpoint may be called");
      const body = JSON.parse(options.body); requests.push(body);
      if (failFirst && requests.length === 1) return { ok: false, json: async () => ({ error: "Interrupted save" }) };
      return { ok: true, json: async () => ({ ok: true, id: id(99), kind: "library_item", title: "Saved", url: "https://storage.test/0.png", slides: body.slides.map((_, i) => `https://storage.test/${i}.png`) }) };
    },
  });
  const props = { reference: { id: `uploaded:${id(40)}`, slides: [asset(1), asset(2)].map(value => ({ id: value.id, url: value.url, width: 540, height: 960 })) }, libraryItemId, previewImages, controllerRef: controller, slideIndex: 0, active: true, generationBusy: false, controlsTarget: {}, resultsTarget: {}, actionsTarget, localPreview, savingEnabled: true, onDirty: () => dirty.push(true), onSaved: output => saved.push(output), onContinue, onRegenerate: () => {}, onBackToPreview };
  const render = () => { cursor = 0; const tree = mod.FormatSlideshowEditor(props); for (const effect of effects.splice(0)) effect(); return tree; };
  const control = (type, value) => nodes(render()).find(node => node.type === type && (text(node) === value || node.props["aria-label"] === value));
  const heading = value => nodes(render()).find(node => node.type === "FormatSlideshowTextTools").props.onChange({ heading: value });
  const clickSave = async label => { control("Button", label).props.onClick(); await new Promise(setImmediate); };
  const addImage = (image, index) => { render(); controller.current.useImage(image, index); };
  render(); await new Promise(resolve => setTimeout(resolve, 10));
  if (generated) {
    addImage({ id: id(201), url: "https://storage.test/generated-1.png" }, 0);
    addImage({ id: id(202), url: "https://storage.test/generated-2.png" }, 1);
    control("button", "Preview slide 1").props.onClick();
  }
  return { render, control, heading, clickSave, requests, libraryReads, renders, uploads, saved, dirty, controller, useImage: addImage, storage, props, navigations };
}

test("Create preview shares the edited sequence, text and upload actions without mounting the inspector", async () => {
  const h = await editor();
  h.heading("Keep my manual text");
  const target = h.props.resultsTarget;
  h.props.active = false; h.props.previewActive = true;
  let opened = 0; h.props.onEdit = () => opened++;
  h.props.previewActions = { type: "Button", props: { children: "Generated slides" } };
  const preview = nodes(h.render()).find(n => n.props?.["aria-label"] === "Slideshow edit preview");
  assert.match(text(preview), /Your slideshow.*Preview your current sequence.*Generated slides.*Edit slides/s);
  assert.equal(nodes(h.render()).some(n => n.type === "FormatSlideshowTextTools"), false);
  assert.equal(nodes(h.render()).some(n => n.type === "portal" && n.props.target === h.props.actionsTarget), false);
  assert.ok(nodes(preview).some(n => n.props?.["data-slide-text-overlay"] !== undefined));
  assert.equal(h.control("input", "Upload slideshow images").props.multiple, true);
  assert.equal(h.control("button", "Preview slide 2").props["aria-pressed"], false);
  h.control("button", "Preview slide 2").props.onClick();
  h.control("Button", "Edit slides").props.onClick(); assert.equal(opened, 1);
  h.props.active = true;
  assert.equal(h.props.resultsTarget, target);
  assert.equal(h.control("button", "Preview slide 2").props["aria-pressed"], true);
  h.control("button", "Preview slide 1").props.onClick();
  assert.equal(nodes(h.render()).find(n => n.type === "FormatSlideshowTextTools").props.design.heading, "Keep my manual text");
  assert.equal(h.requests.length, 0, "Navigation never saves or replaces a draft");
  h.props.active = false; h.props.previewActive = false;
  assert.equal(h.render(), null);
});

test("Edit version loads every slide in order and switching versions preserves earlier edited drafts", async () => {
  const h = await editor({ generated: false });
  const images = n => Array.from({ length: 5 }, (_, index) => ({ id: id(n + index), url: `https://storage.test/${n + index}.png` }));
  h.render(); assert.equal(h.controller.current.useSlideshow(images(600)), true);
  assert.equal(nodes(h.render()).filter(node => node.type === "button" && /^Preview slide /.test(node.props["aria-label"] ?? "")).length, 5);
  h.heading("Keep this edited copy");
  h.render(); assert.equal(h.controller.current.useSlideshow(images(700), true), false, "background completion cannot replace a current draft");
  assert.equal(h.controller.current.useSlideshow(images(700)), true); h.render();
  const history = JSON.parse(h.storage.get("ugc-explore:slideshow-draft:v2:owner:history"));
  assert.equal(history[0].slides.length, 5);
  assert.ok(Object.values(history[0].text).some(design => design.heading === "Keep this edited copy"));
  h.control("select", "Reopen earlier slideshow draft").props.onChange({ target: { value: history[0].id } });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Keep this edited copy");
  const restored = await editor({ generated: false, storageState: h.storage });
  assert.equal(nodes(restored.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Keep this edited copy");
});

test("a saved Library slideshow reopens source images and editable text without rendering or overwriting the Library item", async () => {
  const first = await editor(); first.heading("Editable after reopening"); await first.clickSave("Save slideshow");
  assert.equal(first.requests[0].editorDraft.slides[0].design.heading, "Editable after reopening");
  const item = { id: id(99), projectId: "explore", sourceId: `explore-slideshow:${first.requests[0].requestKey}`, slideCount: 2, slides: [1, 2].map(slideNumber => ({ slideNumber, mediaAssetId: id(900 + slideNumber), renderedUrl: `https://storage.test/rendered-${slideNumber}.png` })), editorDraft: first.requests[0].editorDraft };
  const h = await editor({ generated: false, libraryItemId: id(99), libraryItem: item, locationHref: `https://getugcpilot.com/explore/slideshows?step=edit&slideshowId=${id(99)}` });
  assert.equal(h.libraryReads.length, 1); assert.equal(h.requests.length, 0); assert.equal(h.uploads.length, 0);
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Editable after reopening");
  assert.ok(nodes(h.render()).find(node => node.type === "img").props.src.endsWith(`${id(201)}.png`), "preview uses the original source, not the text-rendered output");
  assert.deepEqual(h.navigations, ["/explore/slideshows?step=edit"]);
  h.heading("Newer unsaved work");
  const afterReload = await editor({ generated: false, storageState: h.storage });
  assert.equal(nodes(afterReload.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Newer unsaved work");
  h.heading("A new edit"); await h.clickSave("Save slideshow");
  assert.equal(h.requests[0].editorDraft.slides[0].design.heading, "A new edit");
  const invalid = await editor({ generated: false, libraryItemId: id(99), libraryItem: { ...item, projectId: "other" } });
  assert.match(text(invalid.render()), /saved slideshow is unavailable/);
});

test("saved slideshows restore by exact ID without depending on the first sixty browsing results", async () => {
  const first = await editor(); first.heading("Saved heading"); await first.clickSave("Save slideshow");
  const request = first.requests[0];
  const item = {id:id(99), title:"Saved", sourceId:`explore-slideshow:${request.requestKey}`, projectId:"explore", slideCount:2, slides:[1,2].map((slideNumber,index) => ({slideNumber, renderedUrl:`https://storage.test/${index}.png`}))};
  const reopened = await editor({generated:false, storageState:first.storage, libraryItem:item});
  assert.deepEqual(reopened.libraryReads, [`/api/library/carousels/${id(99)}`]);
  assert.equal(reopened.requests.length, 0); assert.equal(reopened.saved.length, 1);
  assert.ok(reopened.control("Button", "Schedule slideshow"));
  for (const patch of [{projectId:"other"}, {sourceId:"explore-slideshow:another-request"}, {slides:[item.slides[1],item.slides[0]]}]) {
    const invalid = await editor({generated:false, storageState:first.storage, libraryItem:{...item,...patch}});
    assert.equal(invalid.saved.length, 0); assert.equal(invalid.control("Button", "Schedule slideshow"), undefined);
  }
});

test("two edited slides prepare together and still save in their exact displayed order", async () => {
  const finish = new Map();
  const h = await editor({uploadResult: file => new Promise(resolve => finish.set(file.design.heading, resolve))});
  h.heading("First slide"); h.control("button", "Preview slide 2").props.onClick(); h.heading("Second slide");
  await h.clickSave("Save slideshow");
  assert.equal(h.uploads.length, 2); assert.equal(h.requests.length, 0);
  assert.match(text(h.render()), /Preparing slides · 0 of 2/);
  finish.get("Second slide")({asset:{id:id(302)}}); await new Promise(setImmediate);
  assert.match(text(h.render()), /Preparing slides · 1 of 2/); assert.equal(h.requests.length, 0);
  finish.get("First slide")({asset:{id:id(301)}}); await new Promise(setImmediate);
  assert.deepEqual(h.requests[0].slides.map(slide => slide.mediaAssetId), [id(301),id(302)]);
  assert.ok(h.control("Button", "Schedule slideshow"));
});

test("recovering another tab's earlier save preserves newer text as unsaved until its own save", async () => {
  const first = await editor({failFirst:true}); first.heading("First tab text"); await first.clickSave("Save slideshow");
  const key = "ugc-explore:slideshow-draft:v2:owner:save";
  const raw = first.storage.get(key);
  const otherStorage = new Map(first.storage); otherStorage.delete(key);
  const other = await editor({generated:false, storageState:otherStorage}); other.heading("Second tab text");
  // The first tab writes its immutable unfinished receipt after this tab's edit.
  other.storage.set(key, raw);
  await other.clickSave("Save slideshow");
  assert.deepEqual(other.requests[0], first.requests[0]); assert.equal(other.saved.length, 0);
  assert.equal(nodes(other.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Second tab text");
  assert.equal(other.control("Button", "Schedule slideshow"), undefined);
  assert.match(text(other.render()), /newer edits are still unsaved/);
  await other.clickSave("Save slideshow");
  assert.notEqual(other.requests[1].requestKey, first.requests[0].requestKey);
  assert.equal(other.renders[0].design.heading, "Second tab text"); assert.equal(other.saved.length, 1);
});
test("slide selection and preview navigation retain the saved slideshow without marking it dirty", async () => {
  const h = await editor(); h.heading("First message");
  h.control("button", "Preview slide 2").props.onClick(); h.heading("Second message");
  await h.clickSave("Save slideshow");
  const beforeDirty = h.dirty.length, beforeStorage = [...h.storage];
  const tools = () => nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools");
  h.control("button", "Preview slide 1").props.onClick();
  assert.equal(tools().props.design.heading, "First message");
  h.control("Button", "Next").props.onClick();
  assert.equal(tools().props.design.heading, "Second message");
  h.control("Button", "Previous").props.onClick();
  assert.equal(tools().props.design.heading, "First message");
  assert.equal(h.dirty.length, beforeDirty); assert.deepEqual([...h.storage], beforeStorage);
  assert.equal(h.requests.length, 1); assert.equal(h.saved.length, 1);
  assert.ok(h.control("Button", "Schedule slideshow"));
});

test("a pending image replacement blocks scheduling the previously saved sequence and requires a new save", async () => {
  let finishUpload, continued = 0;
  const h = await editor({ onContinue: () => continued++, uploadResult: () => new Promise(resolve => { finishUpload = resolve; }) });
  await h.clickSave("Save slideshow");
  const priorSchedule = h.control("Button", "Schedule slideshow");
  h.control("input", "Replace slideshow image").props.onChange({ currentTarget: { files: [{ name: "replacement.png", type: "image/png", size: 100 }], value: "selected" } });
  priorSchedule.props.onClick();
  assert.equal(continued, 0, "The upload starts locking the old schedule before the next render");
  assert.equal(h.control("Button", "Schedule slideshow"), undefined);
  assert.equal(h.control("Button", "Save slideshow").props.disabled, true);
  await new Promise(setImmediate);
  finishUpload({ asset: { id: id(301), collection: "image", status: "ready", url: "https://storage.test/replacement.png", title: "Replacement", createdAt: "", ratio: "4:5" } });
  await new Promise(setImmediate);
  assert.equal(h.control("Button", "Schedule slideshow"), undefined);
  assert.equal(h.control("Button", "Save slideshow").props.disabled, false);
  assert.equal(nodes(h.render()).find(node => node.type === "img").props.src, "https://storage.test/replacement.png");
  await h.clickSave("Save slideshow");
  h.control("Button", "Schedule slideshow").props.onClick();
  assert.equal(continued, 1);
  assert.deepEqual(h.requests[1].slides.map(slide => slide.mediaAssetId), [id(301), id(202)]);
});

test("slide uploads send fitted files before adding owned images and retain successful files when another conversion fails", async () => {
  const prepared = [];
  const h = await editor({ fitUpload: async file => { prepared.push(file.name); if (file.name === "bad.png") throw new Error("Could not read this image"); return { ...file, name: "portrait-4x5.png" }; },
    uploadResult: file => ({ asset: { id: id(350), collection: "image", status: "ready", url: "https://storage.test/portrait-4x5.png", title: file.name, createdAt: "", ratio: "4:5" } }) });
  h.control("input", "Upload slideshow images").props.onChange({ currentTarget: { files: ["portrait.png", "bad.png"].map(name => ({ name, type: "image/png", size: 100 })), value: "chosen" } });
  assert.equal(h.control("Button", "Save slideshow").props.disabled, true);
  await new Promise(setImmediate);
  assert.deepEqual(prepared, ["portrait.png", "bad.png"]);
  assert.equal(h.uploads.length, 1); assert.equal(h.uploads[0].file.name, "portrait-4x5.png");
  assert.ok(h.control("button", "Preview slide 3"));
  assert.match(text(h.render()), /1 image added.*Some images could not be uploaded/s);
  await h.clickSave("Save slideshow");
  assert.deepEqual(h.requests.at(-1).slides.map(slide => slide.mediaAssetId), [id(201), id(202), id(350)]);
});

test("a failed valid image replacement keeps the old sequence unscheduled until explicit re-save", async () => {
  let rejectUpload, continued = 0;
  const h = await editor({ onContinue: () => continued++, uploadResult: () => new Promise((_, reject) => { rejectUpload = reject; }) });
  await h.clickSave("Save slideshow");
  const dirtyBefore = h.dirty.length, priorSchedule = h.control("Button", "Schedule slideshow");
  h.control("input", "Replace slideshow image").props.onChange({ currentTarget: { files: [{ name: "replacement.png", type: "image/png", size: 100 }], value: "selected" } });
  assert.equal(h.dirty.length, dirtyBefore + 1);
  priorSchedule.props.onClick();
  await new Promise(setImmediate);
  rejectUpload(new Error("Upload failed"));
  await new Promise(setImmediate);
  assert.equal(continued, 0);
  assert.equal(h.control("Button", "Schedule slideshow"), undefined);
  assert.equal(h.control("Button", "Save slideshow").props.disabled, false);
  assert.equal(nodes(h.render()).find(node => node.type === "img").props.src, "https://storage.test/generated-1.png");
  await h.clickSave("Save slideshow");
  h.control("Button", "Schedule slideshow").props.onClick();
  assert.equal(continued, 1);
  assert.equal(h.requests.length, 1, "Explicit re-save verifies the unchanged owned Library receipt without a new write");
});
test("moving then removing a slide preserves the selected identity, neighboring text and exact save order", async () => {
  const h = await editor(); h.heading("Retained heading");
  h.useImage({ id: id(203), url: "https://storage.test/third.png" }); h.heading("Removed heading");
  const target = () => nodes(h.render()).find(node => node.type === "RemixTextSection").props.targetKey;
  const removedTarget = target();
  h.control("button", "Preview slide 1").props.onClick();
  const retainedTarget = target();
  h.control("Button", "Move slide 1 later").props.onClick();
  assert.equal(target(), retainedTarget);
  assert.equal(h.control("button", "Preview slide 2").props["aria-pressed"], true);
  h.control("button", "Preview slide 3").props.onClick(); h.control("Button", "Remove slide").props.onClick();
  assert.equal(target(), retainedTarget, "Removing the last slide selects the existing neighboring slide");
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Retained heading");
  assert.equal(h.control("button", "Preview slide 2").props["aria-pressed"], true);
  assert.equal(h.control("Button", "Next").props.disabled, true);
  const storedText = JSON.parse(h.storage.get("ugc-explore:slideshow-draft:v2:owner:text"));
  assert.equal(storedText[removedTarget.slice("slide:".length)], undefined);
  assert.equal(storedText[retainedTarget.slice("slide:".length)].heading, "Retained heading");
  await h.clickSave("Save slideshow");
  assert.deepEqual(h.requests[0].slides.map(slide => slide.mediaAssetId), [id(202), id(301)]);
  assert.equal(h.requests[0].slides[1].referenceSlideId, retainedTarget.slice("slide:".length));
  assert.equal(h.renders.length, 1); assert.equal(h.renders[0].source, "https://storage.test/generated-1.png");
});
test("slide arrangement stays beside the preview while text tools remain in the inspector", async () => {
  const h = await editor({ actionsTarget: {} });
  const portals = nodes(h.render()).filter(node => node.type === "portal");
  const preview = portals.find(node => node.props.target === h.props.resultsTarget);
  const inspector = portals.find(node => node.props.target === h.props.controlsTarget);
  assert.equal(nodes(preview).filter(node => node.type === "button" && node.props["aria-label"]?.startsWith("Preview slide ")).length, 2);
  assert.ok(nodes(preview).find(node => node.type === "Button" && node.props["aria-label"] === "Move slide 1 later"));
  assert.equal(nodes(inspector).some(node => node.type === "button" && node.props["aria-label"]?.startsWith("Preview slide ")), false);
  assert.equal(nodes(inspector).filter(node => node.type === "FormatSlideshowTextTools").length, 1);
  assert.equal(nodes(preview).some(node => node.type === "FormatSlideshowTextTools"), false);
});
test("the dedicated footer exposes exactly one save, resume or schedule action throughout recovery", async () => {
  let continued = 0;
  const h = await editor({ failFirst: true, actionsTarget: {}, onContinue: () => continued++ });
  const primary = () => nodes(h.render()).filter(node => node.type === "Button" && ["Save slideshow", "Resume save", "Schedule slideshow", "Saving…"].includes(text(node)));
  const assertAction = label => {
    assert.equal(primary().length, 1); assert.equal(text(primary()[0]), label);
    const footer = nodes(h.render()).find(node => node.type === "portal" && node.props.target === h.props.actionsTarget);
    assert.equal(nodes(footer).filter(node => node.type === "Button" && text(node) === label).length, 1);
  };
  assertAction("Save slideshow"); await h.clickSave("Save slideshow"); assertAction("Resume save");
  for (const label of ["Move slide 1 later", "Remove slide"]) assert.equal(h.control("Button", label).props.disabled, true);
  await h.clickSave("Resume save"); assertAction("Schedule slideshow");
  h.control("Button", "Schedule slideshow").props.onClick(); assert.equal(continued, 1);
  assert.deepEqual(h.requests[0], h.requests[1]);
});

test("Create preview saves and resumes the same draft before scheduling, then invalidates after arrangement changes", async () => {
  let continued = 0;
  const h = await editor({ failFirst: true, actionsTarget: {}, onContinue: () => continued++ });
  h.heading("Keep this heading from Edit");
  h.props.active = false; h.props.previewActive = true;
  const actionNodes = () => nodes(h.render()).filter(node => node.type === "Button" && ["Save slideshow", "Resume save", "Schedule slideshow", "Saving…"].includes(text(node)));
  const assertSurface = label => {
    const tree = h.render(), preview = nodes(tree).find(node => node.props?.["aria-label"] === "Slideshow edit preview");
    assert.equal(actionNodes().length, 1); assert.equal(text(actionNodes()[0]), label);
    assert.ok(nodes(preview).some(node => node.props?.["aria-label"] === "Slideshow actions"));
    assert.equal(nodes(tree).some(node => node.type === "portal" && node.props.target === h.props.actionsTarget), false);
    assert.equal(nodes(tree).some(node => node.type === "FormatSlideshowTextTools"), false);
  };
  assertSurface("Save slideshow");
  await h.clickSave("Save slideshow"); assertSurface("Resume save");
  assert.equal(continued, 0); assert.equal(h.saved.length, 0);
  assert.equal(nodes(h.render()).filter(node => node.props?.role === "alert" && text(node).includes("Interrupted save")).length, 1);
  await h.clickSave("Resume save"); assertSurface("Schedule slideshow");
  assert.deepEqual(h.requests[0], h.requests[1]);
  assert.equal(h.requests[1].editorDraft.slides[0].design.heading, "Keep this heading from Edit");
  h.control("Button", "Schedule slideshow").props.onClick(); assert.equal(continued, 1);
  const oldSchedule = h.control("Button", "Schedule slideshow");
  h.control("Button", "Move slide 1 later").props.onClick(); assertSurface("Save slideshow");
  oldSchedule.props.onClick(); assert.equal(continued, 1, "A stale saved action cannot schedule the changed sequence");
  h.props.generationBusy = true; assert.equal(h.control("Button", "Save slideshow").props.disabled, true);
  h.props.generationBusy = false;
  await h.clickSave("Save slideshow"); assertSurface("Schedule slideshow");
  assert.equal(h.requests.at(-1).editorDraft.slides[1].design.heading, "Keep this heading from Edit");
  h.control("button", "Remove slide 1").props.onClick(); assertSurface("Save slideshow");
  assert.equal(h.control("Button", "Save slideshow").props.disabled, true, "One remaining slide cannot be saved");
  h.props.active = true;
  assert.equal(actionNodes().length, 1);
  assert.ok(nodes(h.render()).some(node => node.type === "portal" && node.props.target === h.props.actionsTarget));
});
test("saving edited text uploads its generated image with the owner and keeps untouched generated slides", async () => {
  const h = await editor(); h.heading("My heading"); await h.clickSave("Save slideshow");
  assert.equal(h.renders.length, 1); assert.equal(h.renders[0].design.heading, "My heading");
  assert.equal(h.uploads[0].owner, "owner"); assert.equal(h.uploads[0].kind, "image");
  assert.equal(h.renders[0].source, "https://storage.test/generated-1.png");
  assert.equal(h.requests[0].slides[0].mediaAssetId, id(301)); assert.equal(h.requests[0].slides[1].mediaAssetId, id(202));
  assert.equal(h.saved.length, 1); assert.ok(h.control("Button", "Schedule slideshow"));
  h.heading("Changed heading"); assert.ok(h.control("Button", "Save slideshow")); assert.equal(h.control("Button", "Schedule slideshow"), undefined);
});
test("an interrupted save freezes editing and retries the same key and rendered asset IDs", async () => {
  const h = await editor({ failFirst: true }); h.heading("My heading"); await h.clickSave("Save slideshow");
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.disabled, true);
  h.heading("Must not change during retry"); await h.clickSave("Resume save");
  assert.deepEqual(h.requests[0], h.requests[1]); assert.equal(h.renders.length, 1); assert.equal(h.uploads.length, 1); assert.equal(h.saved.length, 1);
});
test("remix applies to the selected owned slide while retaining its design and target identity", async () => {
  const h = await editor();
  const tools = () => nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools");
  const remix = () => nodes(h.render()).find(node => node.type === "RemixTextSection");
  tools().props.onChange({ heading: "User heading", body: "User body", size: 64, position: "bottom", background: "pill" });
  const target = remix().props.targetKey;
  assert.equal(tools().props.design.heading, "User heading");
  remix().props.onUse({ heading: "Remixed heading", body: "Remixed body", blocks: [] });
  assert.equal(tools().props.design.heading, "Remixed heading"); assert.equal(tools().props.design.body, "Remixed body");
  assert.equal(tools().props.design.size, 64); assert.equal(tools().props.design.position, "bottom"); assert.equal(tools().props.design.background, "pill");
  h.control("Button", "Move slide 1 later").props.onClick();
  assert.equal(remix().props.targetKey, target);
  assert.equal(tools().props.design.heading, "Remixed heading");
});
test("manual and remixed text appears in the live preview at the loaded image dimensions without saving", async () => {
  const h = await editor();
  const preview = () => nodes(h.render()).find(node => node.type === "img" && node.props.alt?.startsWith("Slide "));
  const overlay = () => nodes(h.render()).find(node => node.type === "img" && "data-slide-text-overlay" in node.props);
  assert.equal(overlay(), undefined, "An unedited slide has no text overlay");
  h.heading("Live heading");
  preview().props.onLoad({ currentTarget: { naturalWidth: 1080, naturalHeight: 1920 } });
  assert.equal(overlay().props.alt, "Live heading");
  assert.equal(overlay().props.width, 1080); assert.equal(overlay().props.height, 1920);
  const vector = decodeURIComponent(overlay().props.src.split(",").slice(1).join(","));
  assert.ok(vector.includes('viewBox="0 0 1080 1920"'));
  assert.ok(vector.includes("Live heading"));
  nodes(h.render()).find(node => node.type === "RemixTextSection").props.onUse({ heading: "Remixed heading", body: "Remixed body", blocks: [] });
  assert.equal(overlay().props.alt, "Remixed heading\nRemixed body");
  h.control("Button", "Next").props.onClick();
  assert.equal(overlay(), undefined, "Text belongs only to the selected slide");
  h.control("Button", "Previous").props.onClick();
  assert.equal(overlay().props.alt, "Remixed heading\nRemixed body");
  assert.equal(h.requests.length, 0); assert.equal(h.uploads.length, 0); assert.equal(h.renders.length, 0);
});
test("loaded landscape images keep the preview and export overlay proportions, with one back action", async () => {
  let back = 0;
  const h = await editor({ onBackToPreview: () => back++ }); h.heading("Landscape text");
  const preview = nodes(h.render()).find(node => node.type === "img" && node.props.alt?.startsWith("Slide "));
  preview.props.onLoad({ currentTarget: { naturalWidth: 3840, naturalHeight: 2160 } });
  const overlay = nodes(h.render()).find(node => node.type === "img" && "data-slide-text-overlay" in node.props);
  assert.equal(overlay.props.width, 2048); assert.equal(overlay.props.height, 1152);
  assert.ok(decodeURIComponent(overlay.props.src).includes('viewBox="0 0 2048 1152"'));
  const backActions = nodes(h.render()).filter(node => node.type === "Button" && text(node) === "Back to Create");
  assert.equal(backActions.length, 1); backActions[0].props.onClick(); assert.equal(back, 1);
});
test("repeated add-text-remove cycles retain only active text and reload both remaining slide edits", async () => {
  const h = await editor(); h.heading("Kept heading");
  h.control("button", "Preview slide 2").props.onClick();
  h.control("Button", "Remove slide").props.onClick();
  const textKey = "ugc-explore:slideshow-draft:v2:owner:text";
  for (let n = 0; n < 14; n++) {
    h.useImage({ id: id(400 + n), url: `https://storage.test/temporary-${n}.png` });
    h.heading(`Removed heading ${n}`); h.control("Button", "Remove slide").props.onClick();
    assert.equal(Object.keys(JSON.parse(h.storage.get(textKey))).length, 1);
  }
  h.useImage({ id: id(500), url: "https://storage.test/final.png" }); h.heading("Newest heading");
  assert.equal(Object.keys(JSON.parse(h.storage.get(textKey))).length, 2);
  const restored = await editor({ generated: false, storageState: h.storage });
  const tools = () => nodes(restored.render()).find(node => node.type === "FormatSlideshowTextTools");
  assert.equal(tools().props.design.heading, "Kept heading");
  restored.control("button", "Preview slide 2").props.onClick();
  assert.equal(tools().props.design.heading, "Newest heading");
  assert.equal(restored.requests.length, 0); assert.equal(restored.uploads.length, 0);
});
test("restore filters obsolete text before applying the ten-slide limit, preserving later active entries", async () => {
  const active = [1, 2].map(n => ({ referenceSlideId: id(n + 600), mediaAssetId: id(n + 700) }));
  const stale = Object.fromEntries(Array.from({ length: 14 }, (_, n) => [id(n + 800), { ...EMPTY_SLIDE_TEXT, heading: "Deleted slide" }]));
  const texts = { ...stale, [active[0].referenceSlideId]: { ...EMPTY_SLIDE_TEXT, heading: "First active" }, [active[1].referenceSlideId]: { ...EMPTY_SLIDE_TEXT, heading: "Second active" } };
  const storageState = new Map([
    ["ugc-explore:slideshow-draft:v2:owner", JSON.stringify({ version: 2, owner: "owner", slides: active })],
    ["ugc-explore:slideshow-draft:v2:owner:text", JSON.stringify(texts)],
  ]);
  const h = await editor({ generated: false, storageState });
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "First active");
  h.control("button", "Preview slide 2").props.onClick();
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Second active");
});
test("moving an uploaded slide preserves its identity and saves the displayed sequence", async () => {
  const h = await editor(); h.control("Button", "Move slide 1 later").props.onClick(); await h.clickSave("Save slideshow");
  assert.deepEqual(h.requests[0].slides.map(slide => slide.mediaAssetId), [id(202), id(201)]);
  assert.equal(h.renders.length, 0); assert.equal(h.uploads.length, 0);
});

test("recreating a slide replaces only its image and retains Remix Text, styling and neighboring slides", async () => {
  const h = await editor();
  const tools = () => nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools");
  const target = nodes(h.render()).find(node => node.type === "RemixTextSection").props.targetKey;
  tools().props.onChange({ heading: "Editable heading", body: "Editable body", size: 64, position: "bottom", background: "pill" });
  nodes(h.render()).find(node => node.type === "Button" && text(node).startsWith("Recreate slide")).props.onClick();
  h.useImage({ id: id(203), url: "https://storage.test/recreated.png" });
  assert.equal(nodes(h.render()).find(node => node.type === "RemixTextSection").props.targetKey, target);
  assert.equal(tools().props.design.heading, "Editable heading");
  assert.equal(tools().props.design.body, "Editable body");
  assert.equal(tools().props.design.size, 64);
  assert.equal(tools().props.design.position, "bottom");
  assert.equal(tools().props.design.background, "pill");
  await h.clickSave("Save slideshow");
  assert.deepEqual(h.requests[0].slides.map(slide => slide.mediaAssetId), [id(301), id(202)]);
  assert.equal(h.renders[0].source, "https://storage.test/recreated.png");
});


test("restored generated images replace their exact original image instead of appending a duplicate", async () => {
  const h = await editor(); h.heading("Retain this heading"); h.render();
  assert.equal(h.controller.current.useImage({ id: id(803), url: "https://storage.test/area-edit.png" }, undefined, id(201)), true);
  assert.equal(nodes(h.render()).filter(node => node.type === "button" && /^Preview slide /.test(node.props["aria-label"] ?? "")).length, 2);
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Retain this heading");
  assert.equal(h.controller.current.useImage({ id: id(804), url: "https://storage.test/other.png" }, undefined, id(999)), false);
});

test("thumbnail removal preserves the selected image and its text, then saves the remaining sequence", async () => {
  const h = await editor();
  h.heading("Stay with the first image");
  h.useImage({ id: id(203), url: "https://storage.test/third.png" });
  h.control("button", "Preview slide 1").props.onClick();
  const before = h.dirty.length;
  h.control("button", "Remove slide 2").props.onClick();
  assert.equal(nodes(h.render()).find(node => node.type === "img" && node.props.alt?.startsWith("Slide ")).props.src, "https://storage.test/generated-1.png");
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Stay with the first image");
  assert.ok(h.dirty.length > before);
  await h.clickSave("Save slideshow");
  assert.deepEqual(h.requests.at(-1).editorDraft.slides.map(slide => slide.mediaAssetId), [id(201), id(203)]);
  const storedText = JSON.parse(h.storage.get("ugc-explore:slideshow-draft:v2:owner:text"));
  assert.equal(Object.values(storedText).some(design => design.heading === "Stay with the first image"), true);
});

test("reorder handles keep image/text identity and thumbnail controls lock during a pending save", async () => {
  const h = await editor({ failFirst: true }); h.heading("Original first slide");
  const key = h.control("button", "Reorder slide 1");
  key.props.onKeyDown({ key: "ArrowRight", preventDefault() {} });
  assert.equal(h.control("button", "Preview slide 2").props["aria-pressed"], true);
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Original first slide");
  await h.clickSave("Save slideshow");
  for (const label of ["Reorder slide 1", "Remove slide 1", "Reorder slide 2", "Remove slide 2"]) assert.equal(h.control("button", label).props.disabled, true);
  const before = h.dirty.length;
  h.control("button", "Remove slide 1").props.onClick();
  assert.equal(h.dirty.length, before);
  assert.equal(nodes(h.render()).filter(node => node.type === "button" && /^Preview slide /.test(node.props["aria-label"] ?? "")).length, 2);
});

test("removing a preceding or selected thumbnail keeps the correct neighbor, and the last removal returns to an empty draft", async () => {
  const h = await editor();
  h.useImage({ id: id(203), url: "https://storage.test/third.png" }); h.heading("Third slide text");
  h.control("button", "Preview slide 2").props.onClick(); h.heading("Second slide text");
  h.control("button", "Remove slide 1").props.onClick();
  assert.equal(h.control("button", "Preview slide 1").props["aria-pressed"], true);
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Second slide text");
  h.control("button", "Remove slide 1").props.onClick();
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Third slide text");
  assert.equal(h.control("button", "Reorder slide 1").props.disabled, true);
  h.control("button", "Remove slide 1").props.onClick();
  assert.equal(nodes(h.render()).some(node => node.type === "button" && /^Preview slide /.test(node.props["aria-label"] ?? "")), false);
  assert.equal(h.control("Button", "Save slideshow").props.disabled, true);
  assert.equal(h.requests.length, 0);
});

test("reference pixels cannot enter the editor or a save before generation", async () => {
  const h = await editor({ generated: false });
  assert.equal(nodes(h.render()).some(node => node.type === "img"), false);
  assert.equal(nodes(h.render()).some(node => node.type === "textarea"), false);
  assert.equal(h.control("Button", "Save slideshow").props.disabled, true);
  await h.clickSave("Save slideshow");
  assert.equal(h.requests.length, 0);
  h.useImage({ id: id(201), url: "https://storage.test/generated-1.png" }, 0);
  assert.equal(h.control("Button", "Save slideshow").props.disabled, true);
  assert.equal(nodes(h.render()).find(node => node.type === "img").props.src, "https://storage.test/generated-1.png");
  h.useImage({ id: id(202), url: "https://storage.test/generated-2.png" }, 1);
  assert.equal(h.control("Button", "Save slideshow").props.disabled, false);
  await h.clickSave("Save slideshow");
  assert.deepEqual(h.requests[0].slides.map(slide => slide.mediaAssetId), [id(201), id(202)]);
});

test("sample slideshow outputs are editable only in local preview and cannot be saved", async () => {
  const previewImages = [1, 2].map(n => ({ id: id(200 + n), url: `/sample-${n}.png` }));
  const h = await editor({ generated: false, localPreview: true, previewImages });
  h.heading("Sample heading");
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "Sample heading");
  assert.equal(h.control("Button", "Save slideshow").props.disabled, true);
  await h.clickSave("Save slideshow");
  assert.equal(h.requests.length, 0); assert.equal(h.uploads.length, 0);
  const live = await editor({ generated: false, previewImages });
  assert.equal(nodes(live.render()).some(node => node.type === "textarea"), false);
  await live.clickSave("Save slideshow");
  assert.equal(live.requests.length, 0);
});

test("older drafts retain generated edits while excluding unmodified reference slides", async () => {
  const h = await editor({ generated: false, storedDraft: {
    order: [id(2), id(1)],
    replacements: { [id(1)]: { id: id(201), url: "https://storage.test/generated-1.png" } },
    text: { [id(1)]: { ...EMPTY_SLIDE_TEXT, heading: "My saved heading" } },
  } });
  assert.equal(nodes(h.render()).filter(node => node.type === "button" && node.props["aria-label"]?.startsWith("Preview slide")).length, 1);
  assert.equal(nodes(h.render()).find(node => node.type === "FormatSlideshowTextTools").props.design.heading, "My saved heading");
  assert.equal(h.control("Button", "Restore original image"), undefined);
});

function imageRoute({ production = true, allowed = true, owned = asset(1), contentType = "image/png", oversized = false, streamOverflow = false } = {}) {
  const reads = [], fetched = [];
  class AuthError extends Error { status = 401; }
  const mod = load("app/api/explore/slideshows/image/route.ts", {
    "@/lib/ai-studio/server-access": { requireAIStudioProUser: async () => { if (!allowed) throw new AuthError("Sign in"); return { uid: "owner" }; } },
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError },
    "@/lib/explore/recreate-catalog": { getRecreateReferences: () => [{ id: "catalog", format: "slideshow", slides: [{ id: "first", url: "https://storage.test/reference.png" }] }] },
    "@/lib/media/media-storage": { getMediaAssetForOwner: async input => { reads.push(input); return owned; } },
    "@/lib/storage/storage": { isTrustedStorageUrl: url => url.startsWith("https://storage.test/") },
    "@/lib/media/media-delivery": { isPrivateUserMedia: row => row.metadata?.storageLocation === "private_user_media" },
    "@/lib/media/private-media-storage": { assertPrivateMediaIdentity: () => {}, privateMediaObject: async () => ({ body: new ReadableStream({ start(controller) { controller.enqueue(Uint8Array.from([137, 80, 78, 71])); controller.close(); } }), size: 4, contentType: "image/png" }) },
    "@/worker/src/lib/explore-finishing-contract": { isExploreUuid: uuid },
  }, { URL, Response, ReadableStream, AbortSignal, process: { env: { NODE_ENV: production ? "production" : "development" } }, fetch: async (url, options) => {
    fetched.push({ url, options });
    const bytes = streamOverflow ? new Uint8Array(25 * 1024 ** 2 + 1) : Uint8Array.from([137, 80, 78, 71]);
    return new Response(bytes, { headers: { "Content-Type": contentType, ...(oversized ? { "Content-Length": String(26 * 1024 ** 2) } : {}) } });
  } });
  return { get: query => mod.GET(new Request(`https://app.test/api/explore/slideshows/image?${query}`)), reads, fetched };
}
test("canvas image delivery loads only the catalogue URL and never forwards authorization or redirects", async () => {
  const h = imageRoute(), response = await h.get("referenceId=catalog&slideId=first&url=https://evil.test");
  assert.equal(response.status, 200); assert.equal(h.fetched[0].url, "https://storage.test/reference.png");
  assert.equal(h.fetched[0].options.redirect, "error"); assert.equal(h.fetched[0].options.headers, undefined);
  assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([137, 80, 78, 71]));
});
test("unknown canvas image identifiers cannot become an arbitrary URL fetch", async () => {
  const h = imageRoute(); assert.equal((await h.get("referenceId=other&slideId=first&url=https://evil.test")).status, 400); assert.equal(h.fetched.length, 0);
});
test("canvas delivery rechecks image ownership, deletion and readiness", async () => {
  for (const patch of [{ user_id: "other" }, { deleted_at: "2026-10-08" }, { status: "pending" }, { mime_type: "image/svg+xml" }]) {
    const h = imageRoute({ owned: { ...asset(1), ...patch } }); assert.equal((await h.get(`mediaAssetId=${id(1)}`)).status, 404); assert.equal(h.fetched.length, 0);
    assert.equal(h.reads[0].userId, "owner");
  }
});

test("owned private screenshot bytes can be read without exposing or fetching a public URL", async () => {
  const h = imageRoute({ owned: { ...asset(1), url: "https://private-bucket.test/source.png", metadata: { storageLocation: "private_user_media" } } });
  const response = await h.get(`mediaAssetId=${id(1)}`);
  assert.equal(response.status, 200); assert.equal((await response.arrayBuffer()).byteLength, 4);
  assert.equal(h.fetched.length, 0); assert.equal(h.reads[0].userId, "owner");
});
test("production canvas exports require access even if preview=1 is supplied", async () => {
  const prod = imageRoute({ allowed: false }); assert.equal((await prod.get("referenceId=catalog&slideId=first&preview=1")).status, 401); assert.equal(prod.fetched.length, 0);
  const dev = imageRoute({ production: false, allowed: false }); assert.equal((await dev.get("referenceId=catalog&slideId=first&preview=1")).status, 200);
  assert.equal((await dev.get(`mediaAssetId=${id(1)}&preview=1`)).status, 400); assert.equal(dev.reads.length, 0);
});
test("canvas delivery refuses SVG and oversized responses before sending image data", async () => {
  for (const options of [{ contentType: "image/svg+xml" }, { oversized: true }]) {
    const h = imageRoute(options); assert.equal((await h.get("referenceId=catalog&slideId=first")).status, 400);
  }
});
test("canvas delivery bounds streamed images even when upstream size is omitted", async () => {
  const h = imageRoute({ streamOverflow: true }), response = await h.get("referenceId=catalog&slideId=first");
  await assert.rejects(response.arrayBuffer(), /too large/);
});
