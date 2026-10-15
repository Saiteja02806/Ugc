import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];

function harness(format, reducedMotion = false) {
  let cursor = 0, previews = 0, recreations = 0;
  const state = [];
  const video = { muted: false, readyState: 2, currentTime: 4, plays: 0, pauses: 0,
    play() { this.plays++; return Promise.resolve(); }, pause() { this.pauses++; } };
  const element = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const imports = {
    "react/jsx-runtime": { jsx: element, jsxs: element },
    react: { useRef: () => ({ current: video }), useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    } },
    "@/lib/utils": { cn: (...parts) => parts.filter(Boolean).join(" ") },
    "@/worker/src/lib/explore-instagram-source": { canonicalHookSource: () => null },
  };
  const exports = {};
  const source = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, window: { matchMedia: () => ({ matches: reducedMotion }) }, require(name) {
    if (name in imports) return imports[name];
    return new Proxy({}, { get: (_, key) => String(key) });
  } });
  const reference = { id: "reference", title: "Reference", format, posterUrl: "https://media.test/poster.webp",
    videoUrl: format === "slideshow" ? undefined : "https://media.test/reference.mp4", slides: format === "slideshow" ? [{ width: 1080, height: 1350 }] : [] };
  return { video, reference, get previews() { return previews; }, get recreations() { return recreations; }, render() {
    cursor = 0;
    return nodes(exports.ReferenceCard({ reference, isSelected: false, showActionLabel: true,
      onPreview: () => { previews++; }, onRecreate: () => { recreations++; } }));
  } };
}

test("reference card clicks preview in-app and Recreate remains a separate action", () => {
  for (const format of ["hook", "wall_text", "slideshow"]) {
    const h = harness(format), tree = h.render();
    assert.equal(tree.some(node => node.type === "a" || node.type === "iframe" || node.props?.href || node.props?.target), false);
    const preview = tree.find(node => node.type === "button" && node.props["aria-label"] === "Preview Reference");
    assert.equal(preview.props.type, "button");
    preview.props.onClick();
    assert.equal(h.previews, 1);
    assert.equal(h.recreations, 0);
    const recreate = tree.find(node => node.props?.["aria-label"] === "Recreate Reference");
    assert.equal(recreate.type, "Button", "The overlay keeps the shared button's focus and disabled treatment");
    assert.equal(recreate.props["data-reference-recreate"], true);
    assert.equal(nodes(preview).includes(recreate), false, "Preview and Recreate cannot be nested interactive controls");
    recreate.props.onClick();
    assert.equal(h.recreations, 1);
    assert.equal(h.previews, 1);
    if (format !== "slideshow") {
      // Do not expose an image element for browser image-search overlays on video cards.
      assert.equal(tree.some(node => node.type === "img"), false);
      assert.equal(nodes(preview).some(node => node.type === "Play" || node.type === "Layers3"), false);
      const media = tree.find(node => node.type === "video");
      assert.equal(media.props.poster, h.reference.posterUrl);
      assert.equal(media.props.src, h.reference.videoUrl);
      assert.match(media.props.className, /pointer-events-none/);
      assert.equal(media.props.preload, "none");
    } else {
      assert.equal(nodes(preview).filter(node => node.type === "Layers3").length, 1);
      const image = tree.find(node => node.type === "img");
      assert.equal(image.props.src, h.reference.posterUrl);
      assert.equal(image.props.draggable, false);
      assert.match(image.props.className, /pointer-events-none/);
    }
  }
});

test("hover and keyboard focus play muted references and stop/reset when leaving", () => {
  const h = harness("hook"), preview = h.render().find(node => node.props?.["aria-label"] === "Preview Reference");
  preview.props.onPointerEnter();
  assert.equal(h.video.plays, 1);
  assert.equal(h.video.muted, true);
  preview.props.onPointerLeave();
  assert.equal(h.video.pauses, 1);
  assert.equal(h.video.currentTime, 0);
  preview.props.onFocus();
  assert.equal(h.video.plays, 2);
  preview.props.onBlur();
  assert.equal(h.video.pauses, 2);
});

test("reduced motion and media failures still allow the in-app preview", () => {
  const h = harness("hook", true), tree = h.render();
  const preview = tree.find(node => node.props?.["aria-label"] === "Preview Reference");
  preview.props.onPointerEnter();
  preview.props.onFocus();
  assert.equal(h.video.plays, 0);
  tree.find(node => node.type === "video").props.onError();
  const failed = h.render();
  assert.ok(failed.some(node => node.props?.children === "Preview unavailable"));
  failed.find(node => node.props?.["aria-label"] === "Preview Reference").props.onClick();
  assert.equal(h.previews, 1);
});
