import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../components/explore/workflow-saved-audio-choices.tsx", import.meta.url), "utf8");
const voice = { id: "bIHbv24MWmeRgasZH58o", name: "Will - Relaxed Optimist", labels: { accent: "american" }, previewUrl: "https://storage.googleapis.com/eleven-public-prod/sample.mp3" };
const element = (type, props = {}) => typeof type === "function" ? type(props) : { type, props };
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join(" ") : node && typeof node === "object" ? text(node.props?.children) : !node || typeof node === "boolean" ? "" : String(node);

function harness({ paid = true, owner = "owner", user = "owner", response = () => new Response(new Uint8Array([1,2,3]), { headers: { "Content-Type": "audio/mpeg" } }) } = {}) {
  let cursor = 0, referenced = 0;
  const slots = [], calls = [], choices = [];
  const audio = { asset: null, loading: false, error: null, choose: async (file, options) => { choices.push({file, options}); return true; } };
  const imports = {
    react: {
      useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
      useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
      useMemo: create => create(), useEffect() {},
    },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "@tanstack/react-query": { useQuery: () => ({ data: { voices: [voice], assets: [], account: { paid } }, isSuccess: true }) },
    "lucide-react": Object.fromEntries(["AudioLines", "Bookmark", "Check", "LoaderCircle", "Pause", "Play", "RefreshCw"].map(name => [name,name])),
    "next/link": { default: "a" },
    "@/contexts/auth-context": { useAuth: () => ({ user: user ? {uid:user} : null, loading:false }) },
    "@/lib/audio/client": {
      createAudioApi: () => () => { throw new Error("Unexpected API write or generation"); },
      createAudioFetch: uid => async (path, init) => { calls.push({uid, path, init}); return response(); },
    },
    "@/lib/audio/library-query": { audioLibraryQueryOptions: options => options },
    "@/components/audio/use-audio-bookmarks": { useAudioBookmarks: () => ({ ids: new Set([voice.id]), loading:false }) },
    "@/components/audio/use-audio-voice-selection": { useAudioVoiceSelection: () => ({voiceId:null}) },
    "@/components/audio/voice-orb": { VoiceOrb: "orb" },
    "@/components/ui/button": { Button:"button" },
    "./workflow-saved-audio.module.css": { default: new Proxy({}, {get: (_,key) => key}) },
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(source, {fileName:"choices.tsx", compilerOptions:{ target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX }}).outputText, {
    exports: exported, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, File, AbortController, Error,
  });
  return { calls, choices, referenced: () => referenced, render() { cursor = 0; return exported.WorkflowSavedAudioChoices({ownerId:owner, audio, onVoiceReference: () => referenced++}); } };
}

test("Use sample passes the authenticated normalized MP3 to the voice-reference attachment only", async () => {
  const actual = harness();
  const first = actual.render();
  const useSample = nodes(first).find(node => node.props["aria-label"] === `Use ${voice.name} sample as voice reference`);
  assert.equal(useSample.props.disabled, false);
  assert.doesNotMatch(text(first), /Use sample attaches|does not generate speech|Your recordings up to/);
  useSample.props.onClick(); useSample.props.onClick();
  await new Promise(setImmediate);
  assert.equal(actual.calls.length, 1, "Repeated clicks must not fetch twice");
  assert.equal(actual.calls[0].uid, "owner");
  assert.equal(actual.calls[0].path, `/api/audio/voices/${voice.id}/sample`);
  assert.ok(actual.calls[0].init.signal instanceof AbortSignal);
  assert.equal(actual.choices.length, 1);
  assert.equal(actual.choices[0].file.type, "audio/mpeg");
  assert.equal(actual.choices[0].file.name, `${voice.name} voice sample.mp3`);
  assert.equal(actual.choices[0].options.maxDuration, 30);
  assert.equal(actual.referenced(), 1);
});

test("failed or non-audio responses display an error without replacing the attachment", async () => {
  for (const response of [() => new Response("not audio", {headers:{"Content-Type":"text/plain"}}), () => { throw new Error("Sample unavailable."); }]) {
    const actual = harness({response});
    nodes(actual.render()).find(node => node.props["aria-label"] === `Use ${voice.name} sample as voice reference`).props.onClick();
    await new Promise(setImmediate);
    const error = nodes(actual.render()).find(node => node.props.role === "alert");
    assert.match(text(error), /complete audio recording|Sample unavailable/);
    assert.equal(actual.choices.length, 0);
    assert.equal(actual.referenced(), 0);
  }
});

test("preview-only voices and another owner's bookmarks cannot be attached", () => {
  const preview = harness({paid:false});
  assert.equal(nodes(preview.render()).find(node => node.props["aria-label"] === `Use ${voice.name} sample as voice reference`).props.disabled, true);
  for (const user of [null, "other-owner"]) {
    const actual = harness({user});
    assert.equal(nodes(actual.render()).filter(node => node.type === "button").length, 0);
    assert.equal(actual.calls.length, 0);
  }
});
