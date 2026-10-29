import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as sequence from "../lib/explore/sequence-preview.ts";
const settled = () => new Promise(resolve => setImmediate(resolve));

function harness(extra = {}) {
  let cursor = 0, nextFrame = 0; const slots = [], cleanups = [], frames = new Map(), listeners = new Map();
  const react = {
    useId() { return `preview-status-${cursor++}`; },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(callback) { const i = cursor++; if (!(i in slots)) { slots[i] = true; cleanups.push(callback()); } },
  };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const doc = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/workflow-sequence-preview.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, document: doc,
    requestAnimationFrame: fn => { const id = ++nextFrame; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return jsx;
      if (name === "@/lib/explore/sequence-preview") return sequence;
      if (name.endsWith(".module.css")) return { default: {} };
      if (name.endsWith("format-video-text-overlay")) return { FormatVideoTextOverlay: "TextOverlay" };
      if (name === "@/components/ui/button") return { Button: "Button" };
      return new Proxy({}, { get: (_, key) => String(key) });
    },
  });
  const segments = [{ id: "hook", label: "Hook", url: "blob:hook", durationSeconds: 10, width: 1080, height: 1920,
    editing: { version: 1, format: "hook", trimStartMs: 2000, trimEndMs: 7000, originalVolume: .4, musicVolume: .3,
      text: { value: "Hook only", width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 5000 } } },
    { id: "demo", label: "Demo", url: "blob:demo", durationSeconds: 10, width: 1080, height: 1920,
      editing: { version: 1, format: "hook", trimStartMs: 1000, trimEndMs: 6000, originalVolume: .8, musicVolume: .2, text: null },
      addedAudio: { url: "blob:demo-audio", volume: .2, playback: "once" } }];
  const props = { segments, backgroundAudio: { url: "blob:background", volume: .3, playback: "repeat" }, ...extra };
  const component = exports.WorkflowSequencePreview(props);
  const players = new Map(); let tree;
  function nodes(node = tree) {
    if (!node || typeof node !== "object") return [];
    return [node, ...[node.props?.children].flat(2).flatMap(child => nodes(child ?? null))];
  }
  function render() {
    cursor = 0; tree = component.type(component.props);
    const bind = (ref, value) => { if (typeof ref === "function") ref(value); else if (ref) ref.current = value; };
    for (const node of nodes()) {
      if (node.type === "video" || node.type === "audio") {
        let player = players.get(node.props.src);
        if (!player) { player = { currentTime: 0, duration: 10, readyState: 4, paused: true, ended: false, volume: 1, muted: false,
          plays: 0, pauses: 0, play() { this.plays++; this.paused = false; return Promise.resolve(); }, pause() { this.pauses++; this.paused = true; }, load() {} }; players.set(node.props.src, player); }
        bind(node.props.ref, player);
      } else if (node.props?.ref) bind(node.props.ref, { style: {}, requestFullscreen: () => Promise.resolve() });
    }
    return tree;
  }
  render();
  function metadata() { for (const node of nodes().filter(node => node.type === "video" || node.type === "audio")) node.props.onLoadedMetadata?.({ currentTarget: players.get(node.props.src) }); render(); }
  return { nodes, players, doc, render, metadata, get frames() { return frames; },
    button(label) { return nodes().find(node => node.type === "Button" && node.props["aria-label"] === label); },
    range() { return nodes().find(node => node.type === "input"); },
    tick() { const [id, fn] = frames.entries().next().value ?? []; if (fn) { frames.delete(id); fn(); } },
    hide() { doc.hidden = true; listeners.get("visibilitychange")?.(); },
    cleanup() { for (const fn of cleanups) fn?.(); },
  };
}

test("mount preloads both sources but plays nothing; first click and exact trim transition share one clock", async () => {
  let starts = 0; const h = harness({ onPlaybackStart: () => starts++ }); h.metadata();
  assert.equal(h.nodes().filter(node => node.type === "video").every(node => node.props.preload === "auto" && !node.props.autoPlay), true);
  assert.equal([...h.players.values()].every(player => player.plays === 0), true);
  h.button("Play combined preview").props.onClick(); await settled(); h.render();
  assert.equal(h.players.get("blob:hook").currentTime, 2);
  assert.equal(h.players.get("blob:hook").volume, .4);
  assert.equal(h.players.get("blob:demo-audio").plays, 0);
  assert.equal(h.frames.size, 1, "playing schedules its transition clock");
  h.players.get("blob:hook").currentTime = 7; h.tick(); await settled(); h.render();
  assert.equal(h.players.get("blob:hook").paused, true);
  assert.equal(h.players.get("blob:demo").paused, false);
  assert.equal(h.players.get("blob:demo").currentTime, 1);
  assert.equal(h.players.get("blob:background").currentTime, 5);
  assert.equal(h.players.get("blob:demo-audio").currentTime, 0);
  assert.equal(h.nodes().filter(node => node.type === "TextOverlay").length, 0);
  assert.equal(starts, 2);
  h.cleanup();
});
test("seeking across clips, buffering, hiding, and unmount all stop the appropriate audio", async () => {
  const h = harness(); h.metadata(); h.button("Play combined preview").props.onClick(); await settled(); h.render();
  h.range().props.onChange({ target: { value: "6500" } }); await settled(); h.render();
  assert.equal(h.players.get("blob:demo").currentTime, 2.5);
  assert.equal(h.players.get("blob:background").currentTime, 6.5);
  assert.equal(h.players.get("blob:demo-audio").currentTime, 1.5);
  const demo = h.nodes().find(node => node.type === "video" && node.props.src === "blob:demo");
  demo.props.onWaiting(); h.tick();
  assert.equal(h.players.get("blob:background").paused, true);
  assert.equal(h.players.get("blob:demo-audio").paused, true);
  demo.props.onPlaying(); h.hide(); h.render();
  assert.equal([...h.players.values()].every(player => player.paused), true);
  assert.equal(h.frames.size, 0);
  h.cleanup(); assert.equal(h.frames.size, 0);
});
test("default track loading blocks Play without hiding the preview or creating an export", () => {
  const h = harness({ playbackDisabledReason: "Loading background music…" }); h.metadata();
  assert.equal(h.button("Play combined preview").props.disabled, true);
  h.button("Play combined preview").props.onClick();
  assert.equal([...h.players.values()].every(player => player.plays === 0), true);
  assert.equal(h.nodes().some(node => node.props?.role === "status" && node.props.children === "Loading background music…"), true);
  h.cleanup();
});
test("a stale rejected play cannot report an error or resume sound after unmount", async () => {
  const h = harness(); h.metadata(); let reject;
  h.players.get("blob:hook").play = function () { this.plays++; return new Promise((_, failure) => { reject = failure; }); };
  h.button("Play combined preview").props.onClick(); h.cleanup(); reject(new Error("Interrupted")); await settled(); h.render();
  assert.equal(h.nodes().some(node => node.props?.role === "alert"), false);
  assert.equal([...h.players.values()].every(player => player.paused), true);
  assert.equal(h.frames.size, 0);
});
test("Demo reference and user-added audio use independent local clocks, then pause together", async () => {
  const pairedSegments = [{ id: "opening", label: "Hook", url: "blob:hook", durationSeconds: 5, width: 1080, height: 1920 },
    { id: "demo", label: "Demo", url: "blob:clean-demo", durationSeconds: 10, width: 1080, height: 1920,
      editing: { version: 1, format: "hook", trimStartMs: 2000, trimEndMs: 7000, originalVolume: .7, musicVolume: .6, text: null },
      addedAudio: { url: "blob:demo-custom", volume: .6, playback: "once" },
      referenceAudio: { url: "blob:demo-reference", volume: .2, playback: "repeat" } }];
  const h = harness({ segments: pairedSegments }); h.metadata();
  h.range().props.onChange({ target: { value: "6500" } }); h.render();
  assert.equal(h.players.get("blob:clean-demo").currentTime, 3.5);
  assert.equal(h.players.get("blob:demo-custom").currentTime, 1.5);
  assert.equal(h.players.get("blob:demo-reference").currentTime, 1.5);
  h.button("Play combined preview").props.onClick(); await settled(); h.render();
  assert.equal(h.players.get("blob:demo-custom").paused, false);
  assert.equal(h.players.get("blob:demo-reference").paused, false);
  assert.equal(h.players.get("blob:demo-custom").volume, .6);
  assert.equal(h.players.get("blob:demo-reference").volume, .2);
  h.hide(); assert.equal([...h.players.values()].every(player => player.paused), true); h.cleanup();
});


test("export-only text warning keeps Play enabled and visible, without changing the clip", async () => {
  const warning = "Your text does not fit. Reduce its size or move it higher.";
  const h = harness({ playbackWarning: warning }); h.metadata();
  assert.equal(h.button("Play combined preview").props.disabled, false);
  assert.ok(h.button("Play combined preview").props["aria-describedby"]);
  assert.equal(h.nodes().some(node => node.props?.role === "status" && node.props.children === warning), true);
  h.button("Play combined preview").props.onClick(); await settled(); h.render();
  assert.equal(h.players.get("blob:hook").paused, false);
  assert.equal(h.players.get("blob:hook").currentTime, 2);
  h.cleanup();
});
test("required audio and inactive previews still block playback with an accessible reason", () => {
  for (const props of [{ playbackDisabledReason: "Loading your selected audio…", playbackWarning: "Text needs review." }, { active: false }]) {
    const h = harness(props); h.metadata();
    const button = h.button("Play combined preview");
    assert.equal(button.props.disabled, true);
    assert.ok(h.nodes().some(node => node.props?.id === button.props["aria-describedby"] && node.props.role === "status"));
    button.props.onClick(); assert.equal([...h.players.values()].every(player => player.plays === 0), true);
    h.cleanup();
  }
});
