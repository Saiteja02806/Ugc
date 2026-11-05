import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const element = (type, props) => ({ type, props });
const nodes = node => node == null ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
const text = node => node == null ? "" : typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
const cn = (...parts) => parts.filter(Boolean).join(" ");
const styles = new Proxy({}, { get: (_target, name) => String(name) });

// Execute the real presentation components with isolated React/Next contexts.
// This tests link destinations and pending UI, not browser navigation/network.
function load(path, imports = {}, environment = "production", flags = {}, globals = {}) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exported = {};
  vm.runInNewContext(compiled, {
    exports: exported,
    process: { env: { NODE_ENV: environment, ...flags } },
    URLSearchParams,
    ...globals,
    require: name => {
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element, Fragment: "fragment" };
      if (name === "@/lib/utils") return { cn };
      if (name.endsWith("explore-workspace.module.css") || name.endsWith("quiet-scrollbar.module.css")) return { default: styles, __esModule: true };
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency ${name}`);
      return imports[name];
    },
  });
  return exported;
}

const link = { WorkspaceLink: "link" };
const indicatorImport = { ExploreLinkIndicator: "indicator" };
const workflows = load("lib/explore/workflows.ts");
const presets = load("lib/explore/launch-presets.ts", {
  "../ai-studio/generation-settings": load("lib/ai-studio/generation-settings.ts"),
});

test("pending feedback reflects Next link status, clears on completion and reserves icon space", () => {
  let pending = false;
  const { ExploreLinkIndicator } = load("components/explore/explore-link-indicator.tsx", {
    "next/link": { useLinkStatus: () => ({ pending }) },
    "lucide-react": { ArrowUpRight: "arrow", LoaderCircle: "spinner" },
  });
  const render = () => ExploreLinkIndicator({ label: "AI character builder", className: "size-4" });
  const idle = render();
  assert.equal(idle.props["data-explore-link-pending"], false);
  assert.equal(nodes(idle).filter(node => node.props?.role === "status").length, 0);
  pending = true;
  const busy = render();
  assert.equal(busy.props.className, idle.props.className);
  assert.equal(busy.props["data-explore-link-pending"], true);
  assert.equal(nodes(busy).find(node => node.type === "arrow").props.className, "size-full invisible");
  assert.match(nodes(busy).find(node => node.type === "spinner").props.className, /motion-reduce:animate-none/);
  assert.equal(text(nodes(busy).find(node => node.props?.role === "status")), "Opening AI character builder…");
  pending = false;
  assert.equal(nodes(render()).filter(node => node.type === "spinner").length, 0);
});

test("all three workflow cards keep real links and place feedback inside the corresponding link", () => {
  const { ExploreWorkflowCard } = load("components/explore/explore-workflow-card.tsx", {
    "@/components/layout/workspace-navigation-feedback": link,
    "@/components/explore/use-cover-playback": { useCoverPlayback: () => ({ current: null }) },
    "@/components/explore/use-explore-workflow-preload": { useExploreWorkflowPreload: () => () => {} },
    "@/components/explore/explore-link-indicator": indicatorImport,
  });
  for (const workflow of workflows.EXPLORE_WORKFLOWS) {
    for (const localPreview of [false, true]) {
      const anchor = nodes(ExploreWorkflowCard({ workflow, localPreview })).find(node => node.type === "link");
      assert.equal(anchor.props.href, `${workflow.destination}${localPreview ? "?preview=1" : ""}`);
      assert.equal(nodes(anchor).find(node => node.type === "indicator").props.label, workflow.title);
      assert.equal(anchor.props.onClick, undefined);
      assert.equal(anchor.props.onNavigate, undefined);
      assert.equal(anchor.props.disabled, undefined);
      assert.equal(anchor.props.prefetch, true);
      assert.equal(nodes(anchor).find(node => node.type === "video").props.controls, undefined);
    }
  }
});

test("AI character cover and caption remain inside a single live link without a click lock", () => {
  const { AICharacterCard } = load("components/explore/ai-character-card.tsx", {
    "@/components/layout/workspace-navigation-feedback": link,
    "next/image": { default: "image", __esModule: true },
    "@/components/explore/use-cover-playback": { useCoverPlayback: () => ({ current: null }) },
    "@/components/explore/explore-link-indicator": indicatorImport,
  });
  for (const localPreview of [false, true]) {
    const anchors = nodes(AICharacterCard({ localPreview })).filter(node => node.type === "link");
    assert.equal(anchors.length, 1);
    assert.equal(anchors[0].props.href, `/explore/build-character${localPreview ? "?preview=1" : ""}`);
    assert.equal(anchors[0].props.onClick, undefined);
    assert.equal(anchors[0].props.disabled, undefined);
    const video = nodes(anchors[0]).find(node => node.type === "video");
    const image = nodes(anchors[0]).find(node => node.type === "image");
    assert.ok(video);
    assert.equal(video.props.poster, image.props.src, "Native and optimized poster use the same revision");
    const posterBytes = readFileSync(new URL(`../public${image.props.src}`, import.meta.url));
    const posterHash = createHash("sha256").update(posterBytes).digest("hex").slice(0, 12);
    assert.ok(image.props.src.endsWith(`-${posterHash}.webp`), "Poster filename must reflect its bytes to invalidate the optimized cache");
    assert.ok(nodes(anchors[0]).find(node => node.type === "indicator"));
  }
});

test("quick starts preserve destinations, duration and preview query parameters with per-link feedback", () => {
  let currentUser = null;
  const { ExploreWorkspace } = load("components/explore/explore-workspace.tsx", {
    "@/components/layout/workspace-navigation-feedback": link,
    "next/link": { default: "next-link", __esModule: true },
    "@/contexts/auth-context": { useAuth: () => ({ user: currentUser }) },
    "lucide-react": Object.fromEntries(["ArrowUpRight", "Headphones", "ImageIcon", "Sparkles", "Video"].map(name => [name, name])),
    "@/components/explore/ai-character-card": { AICharacterCard: "character-card" },
    "@/components/explore/explore-workflow-card": { ExploreWorkflowCard: "workflow-card" },
    "@/components/explore/explore-link-indicator": indicatorImport,
    "@/lib/explore/workflows": workflows,
    "@/lib/explore/launch-presets": presets,
  });
  for (const localPreview of [false, true]) {
    const tree = ExploreWorkspace({ localPreview });
    const mcp = nodes(tree).find(node => node.props?.className === "mcpComingSoon");
    assert.equal(text(mcp), "MCPComing soon");
    assert.equal(mcp.type, "span");
    assert.equal(mcp.props.role, undefined);
    assert.equal(mcp.props.tabIndex, undefined);
    assert.equal(mcp.props.href, undefined);
    assert.equal(mcp.props.onClick, undefined);
    const actions = nodes(tree).filter(node => node.type === "link" && ["/pricing", "/sign-in"].includes(node.props.href));
    assert.deepEqual(actions.map(node => [text(node), node.props.href]), [["Upgrade", "/pricing"], ["Sign up", "/sign-in"]]);
    assert.equal(nodes(tree).some(node => node.type === "nav" && node.props["aria-label"] === "Explore shortcuts"), false);
    assert.equal(nodes(tree).filter(node => node.type === "workflow-card").length, workflows.EXPLORE_WORKFLOWS.length);
    assert.equal(nodes(tree).filter(node => node.type === "character-card").length, 1);
    const anchors = nodes(tree).filter(node => node.type === "link" && node.props["data-explore-shortcut"]);
    assert.equal(anchors.length, presets.EXPLORE_QUICK_STARTS.length);
    anchors.forEach((anchor, index) => {
      const shortcut = presets.EXPLORE_QUICK_STARTS[index];
      const url = new URL(anchor.props.href, "https://getugcpilot.com");
      const expected = new URL(shortcut.destination, "https://getugcpilot.com");
      assert.equal(url.pathname, expected.pathname);
      assert.equal(url.searchParams.get("mode"), expected.searchParams.get("mode"));
      assert.equal(url.searchParams.get("preview"), localPreview ? "1" : null);
      assert.equal(url.searchParams.get("model"), "model" in shortcut ? shortcut.model : null);
      assert.equal(url.searchParams.get("duration"), "duration" in shortcut ? String(shortcut.duration) : null);
      assert.equal(anchor.props["data-explore-shortcut"], shortcut.id);
      assert.equal(anchor.props.onClick, undefined);
      assert.equal(anchor.props.disabled, undefined);
    });
  }
  currentUser = { uid: "signed-in" };
  const signedInActions = nodes(ExploreWorkspace({})).filter(node => node.type === "link" && ["/pricing", "/sign-in"].includes(node.props.href));
  assert.deepEqual(signedInActions.map(node => text(node)), ["Upgrade"]);
});

test("Explore route has a loading boundary using the existing accessible workspace fallback", () => {
  const { default: ExploreLoading } = load("app/explore/loading.tsx", {
    "@/components/layout/workspace-content-loading": { WorkspaceContentLoading: "workspace-loading" },
  });
  assert.equal(ExploreLoading().type, "workspace-loading");
  assert.equal(ExploreLoading().props.label, "Opening Explore workflow");
  const source = read("components/layout/workspace-content-loading.tsx");
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /role="status"/);
});

test("production Explore renders synchronously without consuming request query parameters", () => {
  const imports = { react: { Suspense: "suspense" },
    "@/components/explore/explore-workspace": { ExploreWorkspace: "explore" },
    "@/components/explore/explore-preview-entry": { ExplorePreviewEntry: "preview-entry" } };
  const { default: Page } = load("app/explore/page.tsx", imports);
  const searchParams = { then() { throw new Error("Explore must not wait for request query parameters"); } };
  const tree = Page({ searchParams });
  assert.equal(tree.type, "explore");
  assert.equal(tree.props.localPreview, undefined);
  assert.equal(tree instanceof Promise, false);
  const { default: DevPage } = load("app/explore/page.tsx", imports, "development");
  const preview = DevPage({ searchParams });
  assert.equal(preview.type, "suspense");
  assert.equal(preview.props.fallback.type, "explore");
  assert.equal(preview.props.children.type, "preview-entry");
});

test("production format routes do not wait for query parameters, while development fixtures stay available", async () => {
  const fixtures = [{ id: "local-reference" }];
  const imports = {
    react: { Suspense: "suspense" },
    "@/components/explore/format-workspace": { FormatWorkspace: "format-workspace" },
    "@/components/layout/workspace-content-loading": { WorkspaceContentLoading: "workspace-loading" },
    "@/lib/explore/recreate-catalog": { getLocalRecreateReferences: () => fixtures },
  };
  for (const [path, format] of [["hook-video", "hook"], ["wall-of-text", "wall_text"], ["slideshows", "slideshow"]]) {
    for (const enabled of ["true", "false"]) {
      const flags = { EXPLORE_FINISHING_ENABLED: enabled, EXPLORE_FORMAT_EDITING_ENABLED: "true", EXPLORE_SLIDESHOW_SAVING_ENABLED: enabled };
      const { default: Page } = load(`app/explore/${path}/page.tsx`, imports, "production", flags);
      const searchParams = { then() { throw new Error(`${path} must not wait for production query parameters`); } };
      const tree = Page({ searchParams });
      assert.equal(tree instanceof Promise, false);
      assert.equal(tree.type, "suspense");
      assert.equal(tree.props.fallback.type, "workspace-loading");
      assert.equal(tree.props.children.type, "format-workspace");
      assert.equal(tree.props.children.props.format, format);
      assert.equal(tree.props.children.props.previewReferences, undefined);
      assert.equal(tree.props.children.props[format === "slideshow" ? "slideshowSavingEnabled" : "finishingEnabled"], enabled === "true");

      const { default: DevPage } = load(`app/explore/${path}/page.tsx`, imports, "development", flags);
      for (const preview of [undefined, "1"]) {
        const devTree = DevPage({ searchParams: Promise.resolve({ preview }) });
        const child = devTree.props.children;
        const workspace = await child.type(child.props);
        assert.equal(workspace.type, "format-workspace");
        assert.equal(workspace.props.format, format);
        assert.equal(workspace.props.previewReferences, preview === "1" ? fixtures : undefined);
      }
    }
  }
});

test("Build AI influencer renders without waiting for production query parameters", async () => {
  const imports = {
    react: { Suspense: "suspense" },
    "@/components/characters/character-workspace": { CharacterWorkspace: "character-workspace" },
  };
  const { default: Page } = load("app/explore/build-character/page.tsx", imports);
  const tree = Page({ searchParams: { then() { throw new Error("Builder must not wait for production query parameters"); } } });
  assert.equal(tree.type, "character-workspace");
  assert.equal(tree instanceof Promise, false);
  const { default: DevPage } = load("app/explore/build-character/page.tsx", imports, "development");
  const dev = DevPage({ searchParams: Promise.resolve({ preview: "1" }) });
  const preview = await dev.props.children.type(dev.props.children.props);
  assert.equal(preview.props.localPreview, true);
});

test("Explore preview URL handling stays client-side and cannot enable production preview", () => {
  let params = new URLSearchParams("preview=1");
  const imports = { "next/navigation": { useSearchParams: () => params },
    "@/components/explore/explore-workspace": { ExploreWorkspace: "explore" } };
  const development = load("components/explore/explore-preview-entry.tsx", imports, "development");
  const production = load("components/explore/explore-preview-entry.tsx", imports);
  assert.equal(development.ExplorePreviewEntry().props.localPreview, true);
  assert.equal(production.ExplorePreviewEntry().props.localPreview, false);
  params = new URLSearchParams();
  assert.equal(development.ExplorePreviewEntry().props.localPreview, false);
});

test("decorative covers pass pointer input to the link rather than acting as media controls", () => {
  const css = read("components/explore/explore-workspace.module.css");
  assert.match(css, /\.cover video, \.characterMotion\s*\{\s*pointer-events: none;/);
});

test("explore catalog cards stay neutral and do not paint a violet hover chip", () => {
  const css = read("components/explore/explore-workspace.module.css");
  const workflow = read("components/explore/explore-workflow-card.tsx");
  const character = read("components/explore/ai-character-card.tsx");
  assert.doesNotMatch(workflow, /bg-primary|border-primary/);
  assert.doesNotMatch(character, /bg-primary|border-primary/);
  assert.match(css, /\.cover\s*\{[^}]*border:\s*0;/s);
  assert.match(css, /\.linkChip/);
});

test("Talking Head is a synchronous route and keeps its preview guard in the client", () => {
  for (const enabled of ["true", "false"]) {
    const route = load("app/explore/create-hook/page.tsx", {
      react: { Suspense: "suspense" },
      "@/components/explore/hook-workflow-entry": { HookWorkflowEntry: "entry" },
      "@/components/layout/workspace-content-loading": { WorkspaceContentLoading: "loading" },
    }, "production", { EXPLORE_GENERATION_ENABLED: enabled });
    const shell = route.default({ searchParams: { then() { throw Error("Must not consume request params"); } } });
    assert.equal(shell instanceof Promise, false);
    for (const query of ["", "preview=1", "preview=0"]) {
      const entry = load("components/explore/hook-workflow-entry.tsx", {
        "next/navigation": { useSearchParams: () => new URLSearchParams(query) },
        "@/components/explore/hook-workflow-preview": { HookWorkflowPreview: "workflow" },
        "@/components/explore/workflow-draft-entry": { WorkflowDraftEntryBoundary: "draft-entry" },
      });
      const result = entry.HookWorkflowEntry(shell.props.children.props);
      const rendered = result.type === "draft-entry" ? result.props.children({ id: "test-draft", createNew: true }) : result;
      assert.equal(rendered.props.generationEnabled, enabled === "true" && query !== "preview=1");
    }
  }
});

test("cover motion does not download on visibility, cancels fast clicks and respects reduced motion", () => {
  const handlers = new Map(), videoHandlers = new Map(), timers = new Map();
  let effect, observe, cleanup, paused = 0, released = 0;
  const preference = { matches: false, addEventListener() {}, removeEventListener() {} };
  const link = { matches: () => false, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const video = { src: null, closest: () => link, hasAttribute: () => video.src !== null,
    removeAttribute() { video.src = null; }, load() { released++; }, pause() { paused++; }, play: async () => {},
    addEventListener: (name, fn) => videoHandlers.set(name, fn), removeEventListener: name => videoHandlers.delete(name) };
  const { useCoverPlayback } = load("components/explore/use-cover-playback.ts", {
    react: { useRef: () => ({ current: video }), useEffect: fn => { effect = fn; } },
  }, "production", {}, {
    window: { matchMedia: () => preference, addEventListener() {}, removeEventListener() {} },
    document: { visibilityState: "visible", activeElement: null, addEventListener() {}, removeEventListener() {} },
    IntersectionObserver: class { constructor(fn) { observe = fn; } observe() {} disconnect() {} },
    setTimeout(fn, delay) { assert.equal(delay, 250); const id = Symbol(); timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  });
  useCoverPlayback("/cover.mp4"); cleanup = effect();
  observe([{ isIntersecting: true }]);
  assert.equal(video.src, null); assert.equal(timers.size, 0);
  handlers.get("pointerenter")({ pointerType: "touch" });
  assert.equal(timers.size, 0);
  handlers.get("pointerenter")({ pointerType: "mouse" });
  assert.equal(timers.size, 1);
  handlers.get("pointerdown")();
  assert.equal(timers.size, 0); assert.equal(video.src, null);
  handlers.get("focus")(); [...timers.values()][0](); timers.clear();
  assert.equal(video.src, "/cover.mp4");
  handlers.get("blur")(); assert.equal(video.src, null); assert.equal(released, 1);
  preference.matches = true;
  handlers.get("focus")(); assert.equal(timers.size, 0);
  assert.ok(paused > 0);
  cleanup(); assert.equal(handlers.size, 0); assert.equal(videoHandlers.size, 0);
});

test("Explore covers warm metadata and start immediately on hover without changing gallery behavior", () => {
  const handlers = new Map(), pageHandlers = new Map();
  let effect, observe, plays = 0, preferenceChanged;
  const preference = { matches: false, addEventListener(_name, fn) { preferenceChanged = fn; }, removeEventListener() {} };
  const link = { matches: () => false, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const video = { src: null, preload: "none", closest: () => link, hasAttribute: () => video.src !== null,
    removeAttribute() { video.src = null; }, load() {}, pause() {}, play: async () => { plays++; }, addEventListener() {}, removeEventListener() {} };
  const page = { visibilityState: "visible", activeElement: null, addEventListener: (name, fn) => pageHandlers.set(name, fn), removeEventListener: name => pageHandlers.delete(name) };
  const { useCoverPlayback } = load("components/explore/use-cover-playback.ts", {
    react: { useRef: () => ({ current: video }), useEffect: fn => { effect = fn; } },
  }, "production", {}, { window: { matchMedia: () => preference, addEventListener() {}, removeEventListener() {} }, document: page, navigator: { connection: { saveData: true } },
    IntersectionObserver: class { constructor(fn) { observe = fn; } observe() {} disconnect() {} },
    setTimeout() { throw Error("Explore covers must not delay playback"); }, clearTimeout() {} });
  useCoverPlayback("/cover.mp4", "a", true); const cleanup = effect();
  observe([{ isIntersecting: true }]);
  assert.equal(video.src, "/cover.mp4"); assert.equal(video.preload, "metadata"); assert.equal(plays, 0);
  handlers.get("pointerenter")({ pointerType: "touch" }); assert.equal(plays, 0);
  handlers.get("pointerenter")({ pointerType: "mouse" }); assert.equal(plays, 1);
  handlers.get("pointerleave")(); assert.equal(video.src, "/cover.mp4");
  handlers.get("focus")(); assert.equal(plays, 2);
  preference.matches = true; preferenceChanged(); assert.equal(video.src, null);
  handlers.get("focus")(); assert.equal(plays, 2);
  cleanup(); assert.equal(handlers.size, 0); assert.equal(pageHandlers.size, 0);
});

test("Explore catalog covers play while visible and keep playing after the pointer leaves", () => {
  const handlers = new Map();
  let effect, observe, plays = 0, paused = 0;
  const link = { matches: () => false, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const video = { src: null, preload: "none", closest: () => link, hasAttribute: () => video.src !== null,
    removeAttribute() { video.src = null; }, load() {}, pause() { paused++; }, play: async () => { plays++; }, addEventListener() {}, removeEventListener() {} };
  const { useCoverPlayback } = load("components/explore/use-cover-playback.ts", {
    react: { useRef: () => ({ current: video }), useEffect: fn => { effect = fn; } },
  }, "production", {}, {
    window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} },
    navigator: {},
    document: { visibilityState: "visible", activeElement: null, addEventListener() {}, removeEventListener() {} },
    IntersectionObserver: class { constructor(fn) { observe = fn; } observe() {} disconnect() {} },
    setTimeout() { throw Error("Catalog covers must not wait for hover"); }, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  });
  useCoverPlayback("/cover.mp4", "a", true, true); const cleanup = effect();
  observe([{ isIntersecting: true }]);
  assert.equal(video.src, "/cover.mp4"); assert.equal(plays, 1);
  handlers.get("pointerleave")(); handlers.get("pointerdown")(); handlers.get("click")();
  assert.equal(video.src, "/cover.mp4"); assert.equal(plays, 1); assert.equal(paused, 0);
  observe([{ isIntersecting: false }]);
  assert.equal(video.src, null); assert.ok(paused > 0);
  cleanup();
});

test("gallery button hover releases video on hidden tab, offscreen scroll, dialog click and unmount", () => {
  const handlers = new Map(), videoHandlers = new Map(), pageHandlers = new Map(), timers = new Map();
  let effect, observe, paused = 0, released = 0, disconnected = false, target;
  const button = { matches: () => false, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const page = { visibilityState: "visible", activeElement: null, addEventListener: (name, fn) => pageHandlers.set(name, fn), removeEventListener: name => pageHandlers.delete(name) };
  const video = { src: null, closest: selector => { target = selector; return button; }, hasAttribute: () => video.src !== null,
    removeAttribute() { video.src = null; }, load() { released++; }, pause() { paused++; }, play: async () => {},
    addEventListener: (name, fn) => videoHandlers.set(name, fn), removeEventListener: name => videoHandlers.delete(name) };
  const { useCoverPlayback } = load("components/explore/use-cover-playback.ts", {
    react: { useRef: () => ({ current: video }), useEffect: fn => { effect = fn; } },
  }, "production", {}, {
    window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} }, document: page,
    IntersectionObserver: class { constructor(fn) { observe = fn; } observe() {} disconnect() { disconnected = true; } },
    setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
  });
  useCoverPlayback("/reference-preview.mp4", "button"); const cleanup = effect();
  const flush = () => { for (const run of [...timers.values()]) run(); timers.clear(); };
  assert.equal(target, "button"); observe([{ isIntersecting: true }]);
  handlers.get("pointerenter")({ pointerType: "mouse" }); flush(); assert.equal(video.src, "/reference-preview.mp4");
  page.visibilityState = "hidden"; pageHandlers.get("visibilitychange")(); assert.equal(video.src, null);
  page.visibilityState = "visible"; pageHandlers.get("visibilitychange")(); flush();
  observe([{ isIntersecting: false }]); assert.equal(video.src, null);
  observe([{ isIntersecting: true }]); flush(); assert.equal(video.src, "/reference-preview.mp4");
  handlers.get("click")(); assert.equal(video.src, null, "Dialog launch releases the decorative player");
  handlers.get("pointerenter")({ pointerType: "mouse" }); cleanup(); flush();
  assert.equal(video.src, null); assert.equal(timers.size, 0); assert.equal(handlers.size, 0);
  assert.equal(pageHandlers.size, 0); assert.equal(videoHandlers.size, 0); assert.equal(disconnected, true);
  assert.ok(paused > 0 && released >= 3);
});

test("idle catalog covers recover in place from errors, frozen time, browser pauses and stalled loads without refreshing", () => {
  const handlers = new Map(), videoHandlers = new Map(), pageHandlers = new Map(), windowHandlers = new Map();
  let effect, observe, watchdog = null, plays = 0, loads = 0, assignments = 0, now = 0;
  const link = { matches: () => false, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  let source = null;
  const video = { preload: "none", paused: false, error: null, currentTime: 0, readyState: 4, closest: () => link,
    get src() { return source; }, set src(value) { source = value; assignments++; },
    hasAttribute: () => source !== null, removeAttribute() { source = null; }, load() { loads++; }, pause() {},
    play: async () => { plays++; video.paused = false; },
    addEventListener: (name, fn) => videoHandlers.set(name, fn), removeEventListener: name => videoHandlers.delete(name) };
  const page = { visibilityState: "visible", activeElement: null, addEventListener: (name, fn) => pageHandlers.set(name, fn), removeEventListener: name => pageHandlers.delete(name) };
  const { useCoverPlayback, COVER_WATCHDOG_MS, COVER_MAX_RELOADS, COVER_STALL_GRACE_MS } = load("components/explore/use-cover-playback.ts", {
    react: { useRef: () => ({ current: video }), useEffect: fn => { effect = fn; } },
  }, "production", {}, {
    window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener: (name, fn) => windowHandlers.set(name, fn), removeEventListener: name => windowHandlers.delete(name) },
    navigator: {}, document: page, Date: { now: () => now },
    IntersectionObserver: class { constructor(fn) { observe = fn; } observe() {} disconnect() {} },
    setTimeout() { throw Error("Catalog covers must not wait"); }, clearTimeout() {},
    setInterval(fn, delay) { assert.equal(delay, COVER_WATCHDOG_MS); watchdog = fn; return 1; }, clearInterval() { watchdog = null; },
  });
  useCoverPlayback("/cover.mp4", "a", true, true); const cleanup = effect();
  observe([{ isIntersecting: true }]);
  assert.equal(source, "/cover.mp4"); assert.equal(plays, 1); assert.equal(typeof watchdog, "function");
  // Healthy playback: time advances, nothing is reloaded.
  for (let i = 1; i <= 3; i++) { video.currentTime = i; watchdog(); }
  assert.equal(loads, 0); assert.equal(assignments, 1);
  // Browser silently paused the cover: resume play, do not reload.
  video.paused = true; watchdog(); assert.equal(plays, 2); assert.equal(loads, 0);
  // Frozen: time stops moving for two checks, then the same source reloads once.
  watchdog(); watchdog(); assert.equal(loads, 0); watchdog();
  assert.equal(loads, 1); assert.equal(assignments, 2); assert.equal(source, "/cover.mp4");
  // Media error event reloads, bounded so an offline page cannot loop forever.
  for (let i = 0; i < COVER_MAX_RELOADS + 3; i++) videoHandlers.get("error")();
  assert.equal(loads, COVER_MAX_RELOADS, "reload budget is bounded");
  // Return to the page restores the budget; a stalled source reloads immediately.
  video.readyState = 1; now = COVER_STALL_GRACE_MS + 10_000;
  windowHandlers.get("focus")(); assert.equal(loads, COVER_MAX_RELOADS + 1);
  // A fresh source still loading inside its grace period is not thrashed by hover.
  handlers.get("pointerenter")({ pointerType: "mouse" }); assert.equal(loads, COVER_MAX_RELOADS + 1);
  // Successful playback resets the budget; later hover on a long-stalled cover recovers it.
  videoHandlers.get("playing")(); now += COVER_STALL_GRACE_MS + 1;
  handlers.get("pointerenter")({ pointerType: "mouse" }); assert.equal(loads, COVER_MAX_RELOADS + 2);
  for (const name of ["pageshow", "online"]) assert.equal(typeof windowHandlers.get(name), "function");
  assert.equal(typeof pageHandlers.get("resume"), "function");
  // Hidden tab still releases the decoder and stops the watchdog.
  page.visibilityState = "hidden"; pageHandlers.get("visibilitychange")();
  assert.equal(source, null); assert.equal(watchdog, null);
  page.visibilityState = "visible"; pageHandlers.get("visibilitychange")();
  assert.equal(source, "/cover.mp4"); assert.equal(typeof watchdog, "function");
  cleanup();
  assert.equal(handlers.size, 0); assert.equal(videoHandlers.size, 0); assert.equal(pageHandlers.size, 0); assert.equal(windowHandlers.size, 0);
  assert.equal(watchdog, null);
});

test("hover-only gallery previews never start a watchdog or play without interest", () => {
  const videoHandlers = new Map(), windowHandlers = new Map(), timers = new Map();
  let effect, observe, plays = 0, intervals = 0, source = null;
  const link = { matches: () => false, addEventListener() {}, removeEventListener() {} };
  const video = { paused: true, error: null, readyState: 0, closest: () => link, set src(value) { source = value; }, get src() { return source; },
    hasAttribute: () => source !== null, removeAttribute() { source = null; }, load() {}, pause() {}, play: async () => { plays++; },
    addEventListener: (name, fn) => videoHandlers.set(name, fn), removeEventListener: name => videoHandlers.delete(name) };
  const { useCoverPlayback } = load("components/explore/use-cover-playback.ts", {
    react: { useRef: () => ({ current: video }), useEffect: fn => { effect = fn; } },
  }, "production", {}, {
    window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener: (name, fn) => windowHandlers.set(name, fn), removeEventListener: name => windowHandlers.delete(name) },
    document: { visibilityState: "visible", activeElement: null, addEventListener() {}, removeEventListener() {} },
    IntersectionObserver: class { constructor(fn) { observe = fn; } observe() {} disconnect() {} },
    setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    setInterval() { intervals++; return 1; }, clearInterval() {},
  });
  useCoverPlayback("/reference-preview.mp4", "button"); const cleanup = effect();
  observe([{ isIntersecting: true }]);
  windowHandlers.get("focus")(); windowHandlers.get("online")(); videoHandlers.get("error")();
  assert.equal(source, null); assert.equal(plays, 0); assert.equal(timers.size, 0); assert.equal(intervals, 0);
  cleanup();
});
