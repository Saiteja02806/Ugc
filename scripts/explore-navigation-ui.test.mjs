import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const link = { default: "link", __esModule: true };
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
    "next/link": link,
    "@/components/explore/use-cover-playback": { useCoverPlayback: () => ({ current: null }) },
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
    "next/link": link,
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
    assert.ok(nodes(anchors[0]).find(node => node.type === "video"));
    assert.ok(nodes(anchors[0]).find(node => node.type === "indicator"));
  }
});

test("quick starts preserve destinations, duration and preview query parameters with per-link feedback", () => {
  const { ExploreWorkspace } = load("components/explore/explore-workspace.tsx", {
    "next/link": link,
    "lucide-react": Object.fromEntries(["ArrowUpRight", "Headphones", "ImageIcon", "Sparkles", "Video"].map(name => [name, name])),
    "@/components/explore/ai-character-card": { AICharacterCard: "character-card" },
    "@/components/explore/explore-workflow-card": { ExploreWorkflowCard: "workflow-card" },
    "@/components/explore/explore-link-indicator": indicatorImport,
    "@/lib/explore/workflows": workflows,
    "@/lib/explore/launch-presets": presets,
  });
  for (const localPreview of [false, true]) {
    const anchors = nodes(ExploreWorkspace({ localPreview })).filter(node => node.type === "link");
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
      });
      assert.equal(entry.HookWorkflowEntry(shell.props.children.props).props.generationEnabled, enabled === "true" && query !== "preview=1");
    }
  }
});

test("cover motion does not download on visibility, cancels fast clicks and respects reduced motion", () => {
  const handlers = new Map(), videoHandlers = new Map(), timers = new Map();
  let effect, observe, cleanup, paused = 0, released = 0;
  const preference = { matches: false, addEventListener() {}, removeEventListener() {} };
  const link = { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const video = { src: null, closest: () => link, hasAttribute: () => video.src !== null,
    removeAttribute() { video.src = null; }, load() { released++; }, pause() { paused++; }, play: async () => {},
    addEventListener: (name, fn) => videoHandlers.set(name, fn), removeEventListener: name => videoHandlers.delete(name) };
  const { useCoverPlayback } = load("components/explore/use-cover-playback.ts", {
    react: { useRef: () => ({ current: video }), useEffect: fn => { effect = fn; } },
  }, "production", {}, {
    window: { matchMedia: () => preference },
    document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} },
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
