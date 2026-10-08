import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import sharp from "sharp";

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in imports)) throw new Error(`Unexpected dependency ${name}`); return imports[name]; }, ...globals });
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
  const module = load("app/api/explore/slideshows/route.ts", {
    "node:crypto": { createHash },
    "@supabase/supabase-js": { createClient: () => ({ rpc: async (name, values) => { calls.push({ name, values }); return { data: id(99), error: null }; } }) },
    "@/lib/ai-studio/server-access": { requireAIStudioProUser: async () => { if (!allowed) throw new AuthError("Access required"); return { uid: "owner" }; } },
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError },
    "@/lib/explore/recreate-catalog": { getRecreateReferences: () => [reference] },
    "@/lib/media/media-storage": { getMediaAssetForOwner: async value => { owners.push(value); return assets.get(value.assetId) ?? null; } },
    "@/lib/storage/storage": { isTrustedStorageUrl: value => value.startsWith("https://storage.test/") },
    "@/worker/src/lib/explore-finishing-contract": { isExploreUuid: uuid },
  }, { Response, process: { env: { EXPLORE_SLIDESHOW_SAVING_ENABLED: String(enabled), SUPABASE_URL: "https://database.test", SUPABASE_SERVICE_ROLE_KEY: "offline-fixture" } } });
  const post = (referenceId, slides, key = id(50)) => module.POST(new Request("https://app.test/api/explore/slideshows", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ requestKey: key, referenceId, slides }) }));
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
function editor({ failFirst = false } = {}) {
  let cursor = 0, nextRequest = 100;
  const slots = [], storage = new Map(), requests = [], renders = [], uploads = [], saved = [], dirty = [], controller = { current: null };
  const element = (type, props) => ({ type, props });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {}, useId: () => "slide-editor",
    useImperativeHandle: (ref, factory) => { ref.current = factory(); }, isValidElement: child => Boolean(child?.props), cloneElement: (child, props) => element(child.type, { ...child.props, ...props }),
  };
  const mod = load("components/explore/format-slideshow-editor.tsx", {
    react, "react-dom": { createPortal: children => element("portal", { children }) }, "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
    "lucide-react": { ArrowLeft: "icon", ArrowRight: "icon", Download: "icon", Trash2: "icon" },
    "@/components/ui/button": { Button: "Button" }, "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" } }) },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async (file, kind, _, owner) => { uploads.push({ file, kind, owner }); return { asset: { id: id(300 + uploads.length) } }; } },
    "@/lib/explore/slideshow-text": { EMPTY_SLIDE_TEXT, parseSlideText },
    "@/lib/explore/slideshow-text-client": { renderSlideText: async (source, design) => { renders.push({ source, design }); return { source, design }; }, createSlideTextSvg: () => "" },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { assert.equal(owner, "owner"); return "offline-token"; } },
    "@/worker/src/lib/explore-finishing-contract": { isExploreUuid: uuid }, "./slideshow-editor.module.css": { default: {} }, "./workflow-creation.module.css": { default: {} },
  }, {
    window: {}, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    crypto: { randomUUID: () => id(nextRequest++) }, navigator: { locks: { request: async (_, options, callback) => { assert.equal(options.ifAvailable, true); return callback({}); } } },
    fetch: async (url, options) => {
      assert.equal(url, "/api/explore/slideshows", "Only the mocked slideshow saving endpoint may be called");
      const body = JSON.parse(options.body); requests.push(body);
      if (failFirst && requests.length === 1) return { ok: false, json: async () => ({ error: "Interrupted save" }) };
      return { ok: true, json: async () => ({ ok: true, id: id(99), kind: "library_item", title: "Saved", url: "https://storage.test/first.png", slides: body.slides.map((_, i) => `https://storage.test/${i}.png`) }) };
    },
  });
  const props = { reference: { id: `uploaded:${id(40)}`, slides: [asset(1), asset(2)].map(value => ({ id: value.id, url: value.url, width: 540, height: 960 })) }, controllerRef: controller, slideIndex: 0, active: true, generationBusy: false, controlsTarget: {}, resultsTarget: {}, localPreview: false, savingEnabled: true, onDirty: () => dirty.push(true), onSaved: output => saved.push(output), onContinue: () => {}, onRegenerate: () => {} };
  const render = () => { cursor = 0; return mod.FormatSlideshowEditor(props); };
  const control = (type, value) => nodes(render()).find(node => node.type === type && (text(node) === value || node.props["aria-label"] === value));
  const heading = value => nodes(render()).find(node => node.type === "textarea" && node.props.maxLength === 180).props.onChange({ target: { value } });
  const clickSave = async label => { control("Button", label).props.onClick(); await new Promise(setImmediate); };
  return { render, control, heading, clickSave, requests, renders, uploads, saved, dirty, controller };
}
test("saving edited text uploads its rendered image with the owner and keeps untouched slides", async () => {
  const h = editor(); h.heading("My heading"); await h.clickSave("Save slideshow");
  assert.equal(h.renders.length, 1); assert.equal(h.renders[0].design.heading, "My heading");
  assert.equal(h.uploads[0].owner, "owner"); assert.equal(h.uploads[0].kind, "image");
  assert.equal(h.requests[0].slides[0].mediaAssetId, id(301)); assert.equal(h.requests[0].slides[1].mediaAssetId, id(2));
  assert.equal(h.saved.length, 1); assert.ok(h.control("Button", "Continue to Schedule"));
  h.heading("Changed heading"); assert.ok(h.control("Button", "Save slideshow")); assert.equal(h.control("Button", "Continue to Schedule"), undefined);
});
test("an interrupted save freezes editing and retries the same key and rendered asset IDs", async () => {
  const h = editor({ failFirst: true }); h.heading("My heading"); await h.clickSave("Save slideshow");
  assert.equal(nodes(h.render()).find(node => node.type === "textarea").props.disabled, true);
  h.heading("Must not change during retry"); await h.clickSave("Resume save");
  assert.deepEqual(h.requests[0], h.requests[1]); assert.equal(h.renders.length, 1); assert.equal(h.uploads.length, 1); assert.equal(h.saved.length, 1);
});
test("moving an uploaded slide preserves its identity and saves the displayed sequence", async () => {
  const h = editor(); h.control("Button", "Move slide later").props.onClick(); await h.clickSave("Save slideshow");
  assert.deepEqual(h.requests[0].slides.map(slide => slide.referenceSlideId), [id(2), id(1)]);
  assert.equal(h.renders.length, 0); assert.equal(h.uploads.length, 0);
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
