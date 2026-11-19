import * as recreateTypes from "../lib/explore/recreate-types.ts";
import * as videoFeed from "../lib/explore/video-reference-feed.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { canOpenReferenceSource } from "../lib/explore/reference-source-access.ts";
import { getReferenceSource, referenceSourceLabel } from "../lib/explore/reference-source-link.ts";

const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];

test("user-reported rounded views show truthful provenance in the existing tooltip", () => {
  const h = harness("hook");
  h.reference.sourceUrl = "https://www.tiktok.com/@creator/video/123";
  h.reference.viewCount = 1300000;
  h.reference.viewsApproximate = true;
  h.reference.viewsSource = "user-reported";
  const badge = h.render().find(node => node.props?.["data-reference-views"]);
  assert.ok(badge);
  assert.match(badge.props.title, /^Approximately 1,300,000 source-post views.*User-reported$/);
  assert.ok(!badge.props.title.includes("Retrieved"));
  h.reference.viewsApproximate = false; h.reference.viewCount = 64;
  const exact = h.render().find(node => node.props?.["data-reference-views"]);
  assert.match(exact.props.title, /^64 source-post views.*User-reported$/);
});

test("a failed reference preview derivative falls back to the original video", () => {
  const h = harness("hook");
  h.reference.previewVideoUrl = "https://media.test/preview.mp4";
  let tree = h.render();
  assert.equal(h.playbackSources.at(-1).source, h.reference.previewVideoUrl);
  tree.find(node => node.type === "video").props.onError();
  tree = h.render();
  assert.equal(h.playbackSources.at(-1).source, h.reference.videoUrl);
  assert.equal(tree.some(node => node.props?.children === "Preview unavailable"), false);
});

function harness(format, reducedMotion = false, canOpenSource = false, showSource = false, overlay = showSource, subscription = canOpenSource
  ? { isSuccess: true, isFetching: false, isError: false, data: { isActive: true, planKey: "starter" } }
  : { isSuccess: true, isFetching: false, isError: false, data: { isActive: false, planKey: "free", freeGenerationCredits: { granted: 5, remaining: 0 } } }) {
  let cursor = 0, previews = 0, recreations = 0;
  const state = [];
  const playbackSources = [];
  const video = { muted: false, readyState: 2, currentTime: 4, plays: 0, pauses: 0,
    play() { this.plays++; return Promise.resolve(); }, pause() { this.pauses++; } };
  const element = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const imports = {
    "@/lib/explore/recreate-types": recreateTypes,
    "@/lib/explore/video-reference-feed": videoFeed,
    "./use-starting-frame-preload": { useStartingFramePreload: () => () => {} },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    react: { useRef: () => ({ current: video }), useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    } },
    "@/lib/utils": { cn: (...parts) => parts.filter(Boolean).join(" ") },
    "@/components/billing/use-billing-subscription": { useBillingSubscription: () => subscription },
    "@/lib/explore/reference-source-access": { canOpenReferenceSource },
    "@/lib/explore/reference-source-link": { getReferenceSource, referenceSourceLabel },
    "@/components/explore/use-cover-playback": { useCoverPlayback: (source, target) => { playbackSources.push({ source, target }); return { current: video }; } },
    "@/components/explore/use-creator-video-preview": { useCreatorVideoPreview: url => ({ url, loading: false, failed: false }) },
    "@/worker/src/lib/explore-instagram-source": { canonicalHookSource: () => showSource && format === "hook" ? { platform: "instagram", url: "https://www.instagram.com/reel/fixture/" } : null },
  };
  const exports = {};
  const source = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, window: { matchMedia: () => ({ matches: reducedMotion }) }, require(name) {
    if (name in imports) return imports[name];
    return new Proxy({}, { get: (_, key) => String(key) });
  } });
  const reference = { id: "reference", title: "Reference", format, posterUrl: "https://media.test/poster.webp",
    sourceUrl: showSource ? "https://www.instagram.com/reel/fixture/" : undefined,
    videoUrl: format === "slideshow" ? undefined : "https://media.test/reference.mp4", slides: format === "slideshow" ? [{ width: 1080, height: 1350 }] : [] };
  return { video, reference, playbackSources, filter: props => nodes(exports.FilterMenu(props)), get previews() { return previews; }, get recreations() { return recreations; }, render() {
    cursor = 0;
    return nodes(exports.ReferenceCard({ reference, isSelected: false, compact: showSource, showActionLabel: true, overlayActions: overlay, canOpenSource,
      onPreview: () => { previews++; }, onRecreate: () => { recreations++; } }));
  } };
}

test("actual Filter menu commits both view choices and retains category/clear callbacks", () => {
  const h = harness("hook"), calls = [];
  const tree = h.filter({ activeCategories: ["instagram"], categories: [{ id: "instagram", label: "Instagram", count: 1 }], disabled: false, count: 1,
    onToggle: (...args) => calls.push(args), onClear: () => calls.push("clear"), views: { sort: "highest", filter: "all", onSort: value => calls.push(value), onFilter: value => calls.push(value) } });
  const radios = tree.filter(node => node.type === "input");
  assert.deepEqual(radios.map(node => node.props.value), ["highest", "lowest", "all", "available", "unavailable"]);
  radios.find(node => node.props.value === "lowest").props.onChange();
  radios.find(node => node.props.value === "unavailable").props.onChange();
  tree.find(node => node.type === "Checkbox").props.onCheckedChange(false);
  tree.find(node => node.props?.children === "Clear filters").props.onClick();
  assert.deepEqual(calls, ["lowest", "unavailable", ["instagram", false], "clear"]);
  assert.equal(h.filter({ activeCategories: [], categories: [], disabled: false, count: 0 }).some(node => node.type === "input"), false, "sibling filters do not acquire view controls");
});

test("actual video cards hide unavailable/no-link metrics and expose genuine zero plus snapshot date", () => {
  const h = harness("hook", false, true, true);
  assert.equal(h.render().some(node => node.props?.["data-reference-views"]), false);
  h.reference.viewCount = 0; h.reference.viewsRetrievedAt = "2026-11-04T12:42:05Z";
  const badge = h.render().find(node => node.props?.["data-reference-views"]);
  assert.ok(badge); assert.match(badge.props.title, /0 source-post views.*Retrieved/);
  h.reference.sourceUrl = undefined;
  assert.equal(h.render().some(node => node.props?.["data-reference-views"]), false);
});

for (const overlay of [false, true]) test(`free Hook ${overlay ? "overlay" : "caption"} source click opens Upgrade to Pro without an external source link or selecting the reference`, () => {
  // A generation-eligible free account must remain locked for source posts.
  const h = harness("hook", false, true, true, overlay, { isSuccess: true, isFetching: false, isError: false, data: { isActive: false, planKey: "free", freeGenerationCredits: { granted: 5, remaining: 0 } } }), tree = h.render();
  assert.equal(tree.some(n => n.type === "a"), false);
  const source = tree.find(n => n.type === "button" && n.props["aria-label"]?.includes("Upgrade to Pro"));
  assert.ok(source); assert.match(source.props["aria-label"], /Upgrade to Pro/);
  source.props.onClick();
  const opened = h.render();
  assert.equal(opened.find(n => n.type === "Dialog").props.open, true);
  assert.ok(opened.some(n => n.type === "DialogTitle" && n.props.children === "Upgrade to Pro"));
  assert.equal(opened.find(n => n.type === "Button" && n.props.render?.props?.href === "/pricing").props.children, "Upgrade to Pro");
  assert.equal(h.previews, 0); assert.equal(h.recreations, 0);
});

test("verified Pro retains the original source link while Wall has no source action", () => {
  const pro = harness("hook", false, true, true).render();
  assert.equal(pro.find(n => n.type === "a").props.href, "https://www.instagram.com/reel/fixture/");
  assert.equal(pro.find(n => n.type === "a").props.target, "_blank");
  const wall = harness("wall_text").render();
  assert.equal(wall.some(n => n.props?.["data-reference-source-overlay"]), false);
});

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
    assert.equal(recreate.type, "button", "Recreate is a native keyboard-accessible action separate from Preview");
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
      assert.equal(media.props.src, undefined, "Decorative cover playback acquires its source only after sustained interest");
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

test("muted reference covers delegate interest and visibility handling to the shared playback lifecycle", () => {
  const h = harness("hook"), tree = h.render();
  assert.deepEqual(h.playbackSources, [{ source: h.reference.videoUrl, target: "button" }]);
  assert.equal(tree.find(node => node.type === "video").props.muted, true);
});

test("reduced motion and media failures still allow the in-app preview", () => {
  const h = harness("hook", true), tree = h.render();
  const preview = tree.find(node => node.props?.["aria-label"] === "Preview Reference");
  preview.props.onPointerEnter({ pointerType: "mouse" });
  assert.equal(h.video.plays, 0);
  tree.find(node => node.type === "video").props.onError();
  const failed = h.render();
  assert.ok(failed.some(node => node.props?.children === "Preview unavailable"));
  failed.find(node => node.props?.["aria-label"] === "Preview Reference").props.onClick();
  assert.equal(h.previews, 1);
});
