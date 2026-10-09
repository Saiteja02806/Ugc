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
function load(path, imports = {}, environment = "production") {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exported = {};
  vm.runInNewContext(compiled, {
    exports: exported,
    process: { env: { NODE_ENV: environment } },
    URLSearchParams,
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
    react: { useRef: () => ({ current: null }), useEffect: () => {} },
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
      assert.equal(anchor.props.prefetch, undefined);
      assert.equal(nodes(anchor).find(node => node.type === "video").props.controls, undefined);
    }
  }
});

test("AI character cover and caption remain inside a single live link without a click lock", () => {
  const { AICharacterCard } = load("components/explore/ai-character-card.tsx", {
    "next/link": link,
    "next/image": { default: "image", __esModule: true },
    react: { useRef: () => ({ current: null }), useEffect: () => {} },
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
    "lucide-react": Object.fromEntries(["ArrowUpRight", "CalendarDays", "FolderOpen", "ImageIcon", "Sparkles", "TrendingUp", "Video"].map(name => [name, name])),
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
