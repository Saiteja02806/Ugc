import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const element = (type, props = {}) => typeof type === "function" ? type(props) : ({ type, props });

const hookTrack = { id: "hook_audio_001", source: "hook", name: "Hook track 01", durationSeconds: 28.578, moods: ["curious", "serious"], energy: "medium", loopable: false };
const wallTrack = { id: "audio_002_segment_03", source: "wall", name: "Wall track 02 · Segment 3", durationSeconds: 61, moods: ["urgent"], energy: "high", loopable: true };

function harness({ tracks = [hookTrack, wallTrack], fetchError = null } = {}) {
  let cursor = 0;
  const slots = [];
  const imports = {
    react: {
      useState(initial) { const i = cursor++; slots[i] ??= initial; return [slots[i], value => { slots[i] = value; }]; },
      useEffect() {},
      useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
    "@/components/explore/workflow-secondary-action.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
    "@tanstack/react-query": {
      useQuery() {
        return { data: fetchError ? undefined : { tracks }, isPending: fetchError ? false : false, isFetching: false, isError: Boolean(fetchError), error: fetchError, refetch() {} };
      },
    },
    "lucide-react": Object.fromEntries(["Music2", "Pause", "Play"].map(name => [name, name])),
    "@/components/ui/blocks-spinner": { BlocksSpinner: "spinner" },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/popover": Object.fromEntries(["Popover", "PopoverContent", "PopoverTitle", "PopoverTrigger"].map(name => [name, name])),
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "token" },
    "@/lib/http/read-deadline": { withReadDeadline: (fn, signal) => fn(signal ?? { throwIfAborted() {} }) },
    "@/lib/explore/background-audio-client": { readBackgroundAudioFile: async () => ({ file: new File([], "a.mp3"), playback: "once" }) },
    "@/components/ui/quiet-scrollbar.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(read("components/explore/workflow-background-audio-picker.tsx"), {
    fileName: "picker.tsx", compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports: exported, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  const attachment = { loading: false, error: null, clearError() {}, choose: async () => true, chooseRemote: async () => true };
  return {
    attachment,
    render(props = {}) { cursor = 0; slots.length = 0; return exported.WorkflowBackgroundAudioPicker({ ownerId: "owner", attachment, onChoose: async () => true, ...props }); },
  };
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (node === 0) return "0";
  if (Array.isArray(node)) return node.map(text).join(" ").replace(/\s+/g, " ").trim();
  if (!node || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  return text(node.props?.children);
}
const openLibrary = tree => nodes(tree).find(node => node.type === "PopoverContent");

test("the shared library keeps listing both reviewed catalogues when no source filter is set", () => {
  const tree = harness().render();
  const panel = openLibrary(tree);
  assert.match(text(panel), /2 tracks/);
  assert.match(text(panel), /Hook track 01/);
  assert.match(text(panel), /Wall track 02 · Segment 3/);
});

test("Hook Video and Talking Head pass the curated Hook catalogue so Wall segments stay out of their library", () => {
  for (const sources of [["hook"], hookList()]) {
    const tree = harness().render({ sources });
    const panel = openLibrary(tree);
    assert.match(text(panel), /1 track/);
    assert.match(text(panel), /Hook track 01/);
    assert.doesNotMatch(text(panel), /Wall track 02/);
  }
  const wallOnly = openLibrary(harness().render({ sources: ["wall"] }));
  assert.match(text(wallOnly), /Wall track 02 · Segment 3/);
  assert.doesNotMatch(text(wallOnly), /Hook track 01/);
});

function hookList() { return ["hook"]; }

test("the library shows Hook-only wording when the filtered catalogue is empty", () => {
  const tree = harness({ tracks: [wallTrack] }).render({ sources: ["hook"] });
  const panel = openLibrary(tree);
  assert.match(text(panel), /0 tracks/);
  assert.match(text(panel), /No background tracks are available right now/);
});

test("each track renders as a polished card with cover, preview action, chips and a labelled Use action", () => {
  const tree = harness({ tracks: [hookTrack, wallTrack] }).render();
  const rows = nodes(tree).filter(node => node.type === "li");
  assert.equal(rows.length, 2);
  for (const row of rows) {
    const cover = nodes(row).find(node => node.type === "span" && node.props["aria-hidden"] === "true" && node.props.style);
    assert.ok(cover, "row has a decorative cover tile");
    assert.match(cover.props.style.background, /^linear-gradient/);
    const play = nodes(row).find(node => node.type === "button" && /Preview |Stop /.test(node.props["aria-label"] ?? ""));
    assert.ok(play, "row has a labelled preview action");
    const use = nodes(row).find(node => node.type === "button" && (node.props["aria-label"] ?? "").startsWith("Use "));
    assert.ok(use, "row has a labelled Use action");
    const chips = nodes(row).filter(node => typeof node.type === "string" && node.type === "span" && typeof node.props.className === "string" && node.props.className.includes("rounded-full"));
    assert.ok(chips.length >= 3, `row shows duration, mood and energy chips (${chips.length})`);
  }
  const hookRow = rows[0];
  assert.match(text(hookRow), /29\s*s/);
  assert.match(text(hookRow), /curious/);
  assert.match(text(hookRow), /serious/);
  assert.match(text(hookRow), /medium energy/);
  assert.equal(nodes(hookRow).some(node => typeof node.type === "string" && node.type === "span" && text(node) === "Loopable"), false);
  const wallRow = rows[1];
  assert.match(text(wallRow), /Loopable/);
});

test("preview and stop labels keep their accessible names and the trigger stays Audio Library", () => {
  const tree = harness().render();
  const trigger = nodes(tree).find(node => node.type === "PopoverTrigger");
  assert.equal(text(trigger), "Audio Library");
  const play = nodes(tree).find(node => node.type === "button" && node.props["aria-label"] === "Preview Hook track 01");
  assert.ok(play, "preview button keeps its name");
  const search = nodes(tree).find(node => node.type === "input" && node.props.type === "search");
  assert.equal(search.props.placeholder, "Search tracks, moods or energy…");
});
