import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../components/layout/workspace-navigation-feedback.tsx", import.meta.url), "utf8");
function fixture(pathname = "/explore", globals = {}) {
  const slots = [], starts = []; let cursor = 0, path = pathname;
  const exports = {};
  const imports = {
    "next/link": { default: "next-link", __esModule: true },
    "next/navigation": { usePathname: () => path },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    react: {
      createContext: () => ({}), useContext: () => href => starts.push(href),
      useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value; }]; },
      useEffect: globals.useEffect ?? (() => {}), useCallback: callback => callback,
    },
    "lucide-react": { LoaderCircle: "spinner" },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, { ...globals, exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return { starts, setPath: value => { path = value; }, render(props = {}) { cursor = 0; return exports.WorkspaceLink({ href: "/explore/slideshows", ...props }); }, feedback() { cursor = 0; return exports.WorkspaceNavigationFeedback({}); } };
}

test("document fallback runs once for a visible, online Explore click that never commits", () => {
  for (const [pathname, committed, expected] of [
    ["/explore", false, 1],
    ["/explore", true, 0],
    ["/explore/hook-video", false, 0],
  ]) {
    let time = 0, tick, cleanup;
    const assigned = [];
    const document = { visibilityState: "hidden" };
    const navigator = { onLine: false };
    const origin = "https://example.test";
    const location = { origin, pathname, search: "", href: origin + pathname, assign: href => assigned.push(href) };
    const h = fixture(pathname, {
      URL, Date: { now: () => time }, document, navigator,
      window: { location, setInterval: fn => { tick = fn; return 1; }, clearInterval: () => { tick = undefined; } },
      useEffect: fn => { cleanup = fn(); },
    });
    h.feedback().props.value("/explore/slideshows?view=library#cards");
    h.feedback();
    tick();
    assert.equal(assigned.length, 0);
    time = 16_000;
    if (committed) location.pathname = "/explore/slideshows";
    tick();
    document.visibilityState = "visible";
    tick();
    assert.equal(assigned.length, 0);
    navigator.onLine = true;
    tick();
    tick();
    assert.deepEqual(assigned, expected ? ["https://example.test/explore/slideshows?view=library#cards"] : []);
    cleanup();
    assert.equal(tick, undefined);
  }
});

for (const handler of ["onPointerEnter", "onPointerDown", "onFocus"]) {
  test(`Explore waits for ${handler} then preserves requested prefetch and caller warmup`, () => {
    for (const prefetch of [undefined, true, false, "auto"]) {
      const h = fixture(); let calls = 0;
      const props = { prefetch, [handler]: () => { calls++; } };
      assert.equal(h.render(props).props.prefetch, false);
      h.render(props).props[handler]({ defaultPrevented: false });
      assert.equal(calls, 1); assert.equal(h.render(props).props.prefetch, prefetch);
      assert.equal(h.render(props).props.href, "/explore/slideshows");
      assert.equal(h.render({ ...props, href: "/explore/hook-video" }).props.prefetch, false, "another destination requires its own intent");
      assert.deepEqual(h.starts, [], "warming never navigates or submits work");
    }
  });
}

test("prevented intent, explicit opt-out, Preview URLs and ordinary anchor attributes are respected", () => {
  const h = fixture("/explore/");
  const props = { href: "/explore/slideshows?preview=1", prefetch: true, target: "_blank", rel: "noopener", className: "same-geometry", "aria-label": "Open slideshow", onPointerDown: event => { event.defaultPrevented = true; } };
  let link = h.render(props); link.props.onPointerDown({ defaultPrevented: false });
  assert.equal(h.render(props).props.prefetch, false);
  h.render(props).props.onFocus({ defaultPrevented: false });
  link = h.render(props);
  for (const key of ["href", "target", "rel", "className", "aria-label"]) assert.equal(link.props[key], props[key]);
  assert.equal(link.props.prefetch, true);
  assert.equal(h.render({ ...props, prefetch: false }).props.prefetch, false);
});

test("other screens retain their exact original policy before and after pointer or focus", () => {
  for (const path of ["/explore/slideshows", "/explore/create-hook", "/pricing", "/ai-studio", null]) {
    for (const prefetch of [undefined, true, false, "auto"]) {
      const h = fixture(path);
      assert.equal(h.render({ prefetch }).props.prefetch, prefetch);
      h.render({ prefetch }).props.onFocus({ defaultPrevented: false });
      assert.equal(h.render({ prefetch }).props.prefetch, prefetch);
      h.setPath("/explore");
      assert.equal(h.render({ prefetch }).props.prefetch, false, "intent on another screen does not warm this Explore visit");
    }
  }
});

test("existing navigation feedback and cancellation remain unchanged", () => {
  const h = fixture();
  let cancelled = false, invoked = 0;
  h.render({ onNavigate: event => { invoked++; event.preventDefault(); } }).props.onNavigate({ preventDefault() { cancelled = true; } });
  assert.equal(invoked, 1); assert.equal(cancelled, true); assert.deepEqual(h.starts, []);
  h.render().props.onNavigate({ preventDefault() { throw Error("Should not cancel"); } });
  assert.deepEqual(h.starts, ["/explore/slideshows"]);
});

test("Explore header shares intent-gated links; direct-link auth/catalog/composer warmup stays wired", () => {
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.doesNotMatch(read("components/explore/explore-workspace.tsx"), /import NextLink from "next\/link"/);
  assert.match(read("components/layout/workspace-route-boundary.tsx"), /useEffect\(preload, \[preload\]\)/);
  const preload = read("lib/explore/workflow-preload.ts");
  assert.match(preload, /queryClient.prefetchQuery/); assert.match(preload, /loadComposer\(workflow\)/);
});
