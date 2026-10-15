import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../components/explore/workflow-saved-audio-choices.tsx", import.meta.url), "utf8");
const mediaSource = readFileSync(new URL("../components/explore/use-local-workflow-media.ts", import.meta.url), "utf8");
const voice = { id: "bIHbv24MWmeRgasZH58o", name: "Will - Relaxed Optimist", labels: { accent: "american" }, previewUrl: "https://storage.googleapis.com/eleven-public-prod/sample.mp3" };
const element = (type, props = {}) => typeof type === "function" ? type(props) : { type, props };
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join(" ") : node && typeof node === "object" ? text(node.props?.children) : !node || typeof node === "boolean" ? "" : String(node);

function harness({ paid = true, owner = "owner", user = "owner", maxDuration = 30, assets = [], metadataDuration = 5, mediaKind = "audio", response = () => new Response(new Uint8Array([1,2,3]), { headers: { "Content-Type": "audio/mpeg" } }) } = {}) {
  let cursor = 0, referenced = 0;
  const slots = [], calls = [], choices = [];
  let mediaCursor = 0, nextUrl = 0;
  const mediaSlots = [{ name: "previous.mp3", url: "blob:previous", duration: 5, file: new File(["previous"], "previous.mp3", { type: "audio/mpeg" }) }];
  const revoked = [];
  const mediaModule = {};
  vm.runInNewContext(ts.transpileModule(mediaSource, { fileName: "media.ts", compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: mediaModule,
    require: name => { assert.equal(name, "react"); return {
      useState: initial => { const index = mediaCursor++; if (!(index in mediaSlots)) mediaSlots[index] = initial; return [mediaSlots[index], value => { mediaSlots[index] = typeof value === "function" ? value(mediaSlots[index]) : value; }]; },
      useRef: initial => { const index = mediaCursor++; return mediaSlots[index] ??= { current: initial }; },
      useEffect() {},
    }; },
    Error, setTimeout, clearTimeout,
    URL: { createObjectURL: () => `blob:selected-${++nextUrl}`, revokeObjectURL: url => revoked.push(url) },
    document: { createElement: () => ({ duration: metadataDuration, removeAttribute() {}, load() {}, set src(_) { queueMicrotask(() => this.onloadedmetadata?.()); } }) },
  });
  function attachment() {
    mediaCursor = 0;
    const audio = mediaModule.useLocalWorkflowMedia(mediaKind);
    return { ...audio, chooseRemote: (read, options, acceptFile) => audio.chooseRemote(read, { ...options, onRead: media => { choices.push({ file: media.file, options }); options?.onRead?.(media); } }, acceptFile) };
  }
  const imports = {
    react: {
      useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
      useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
      useMemo: create => create(), useEffect() {},
    },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "@tanstack/react-query": { useQuery: () => ({ data: { voices: [voice], assets, account: { paid } }, isSuccess: true }) },
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
  return { calls, choices, revoked, get audio() { return attachment(); }, referenced: () => referenced, render() { cursor = 0; return exported.WorkflowSavedAudioChoices({ownerId:owner, audio: attachment(), maxDuration, onVoiceReference: () => referenced++}); } };
}

test("saved choices and transferred files follow WAN's 15-second limit and Seedance's 30-second limit", async () => {
  const assets = [10, 20].map(duration => ({ id: `recording-${duration}`, name: `${duration} second recording`, duration, purpose: "exact", status: "ready", testOnly: false }));
  for (const maxDuration of [15, 30]) {
    const actual = harness({ maxDuration, assets });
    const choices = nodes(actual.render()).filter(node => node.type === "button" && node.props["aria-label"]?.startsWith("Choose saved audio"));
    assert.equal(choices.length, maxDuration === 15 ? 1 : 2);
    choices[0].props.onClick();
    await new Promise(setImmediate);
    assert.equal(actual.choices[0].options.maxDuration, maxDuration);
  }
  const staleDuration = harness({ maxDuration: 15, assets: [assets[0]], metadataDuration: 20 });
  nodes(staleDuration.render()).find(node => node.props["aria-label"] === "Choose saved audio 10 second recording").props.onClick();
  await new Promise(setImmediate);
  assert.match(staleDuration.audio.error, /up to 15 seconds/);
  assert.equal(staleDuration.audio.asset.url, "blob:previous");
  assert.equal(staleDuration.choices.length, 0);
});

test("WAN video selection rejects files over 32 MB immediately while demo selection keeps its existing limit", async () => {
  const actual = harness({ mediaKind: "video" });
  const video = { name: "large.mp4", type: "video/mp4", size: 40 * 1024 ** 2 };
  assert.equal(await actual.audio.choose(video, { maxDuration: 15, maxBytes: 32 * 1024 ** 2 }), false);
  assert.match(actual.audio.error, /32 MB/);
  assert.equal(actual.audio.asset.url, "blob:previous");
  assert.equal(await actual.audio.choose(video), true);
  assert.equal(actual.audio.asset.name, "large.mp4");
});

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
    assert.match(actual.audio.error, /complete audio recording|Sample unavailable/);
    assert.equal(actual.audio.asset.url, "blob:previous");
    assert.equal(actual.choices.length, 0);
    assert.equal(actual.referenced(), 0);
  }
});

test("a saved voice is pending in the parent attachment from the click until download succeeds", async () => {
  let finish;
  const actual = harness({ response: () => new Promise(resolve => { finish = resolve; }) });
  nodes(actual.render()).find(node => node.props["aria-label"] === `Use ${voice.name} sample as voice reference`).props.onClick();
  assert.equal(actual.audio.loading, true, "Generate must see pending state before the file download finishes");
  assert.equal(actual.audio.asset.url, "blob:previous");
  assert.equal(actual.choices.length, 0);
  finish(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } }));
  await new Promise(setImmediate);
  assert.equal(actual.audio.loading, false);
  assert.equal(actual.audio.error, null);
  assert.equal(actual.choices.length, 1);
});

test("removing audio while a saved choice downloads prevents a late replacement", async () => {
  let finish;
  const actual = harness({ response: () => new Promise(resolve => { finish = resolve; }) });
  nodes(actual.render()).find(node => node.props["aria-label"] === `Use ${voice.name} sample as voice reference`).props.onClick();
  actual.audio.remove();
  finish(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } }));
  await new Promise(setImmediate);
  assert.equal(actual.choices.length, 0);
  assert.equal(actual.audio.asset, null);
  assert.equal(actual.audio.loading, false);
});

test("cancelling a pending audio choice preserves the accepted track and ignores its late response", async () => {
  const actual = harness();
  let finish;
  const pending = actual.audio.chooseRemote(() => new Promise(resolve => { finish = resolve; }));
  assert.equal(actual.audio.loading, true);
  actual.audio.cancelPending();
  assert.equal(actual.audio.loading, false);
  assert.equal(actual.audio.asset.url, "blob:previous");
  finish(new File(["late"], "late.mp3", { type: "audio/mpeg" }));
  assert.equal(await pending, false);
  assert.equal(actual.audio.asset.url, "blob:previous");
  assert.equal(actual.audio.error, null);
  assert.equal(actual.choices.length, 0);
});

test("failed local replacements retain the prior preview and clear only after removal or a successful choice", async () => {
  const actual = harness();
  assert.equal(await actual.audio.choose(new File(["invalid"], "wrong.png", { type: "image/png" })), false);
  assert.equal(actual.audio.asset.url, "blob:previous");
  assert.match(actual.audio.error, /Choose an audio file/);
  assert.equal(await actual.audio.choose(new File(["valid"], "selected.mp3", { type: "audio/mpeg" })), true);
  assert.equal(actual.audio.error, null);
  assert.equal(actual.audio.asset.name, "selected.mp3");
  actual.audio.remove();
  assert.equal(actual.audio.asset, null);
  assert.equal(actual.audio.error, null);
});

test("closing an interrupted saved selection keeps a visible error; choosing a newer file wins over its late response", async () => {
  const actual = harness();
  const controller = new AbortController();
  let finish;
  const pending = actual.audio.chooseRemote(() => new Promise(resolve => { finish = resolve; }), { signal: controller.signal });
  assert.equal(actual.audio.loading, true);
  controller.abort();
  finish(new File(["valid"], "cancelled.mp3", { type: "audio/mpeg" }));
  assert.equal(await pending, false);
  assert.match(actual.audio.error, /selection was interrupted/);
  assert.equal(actual.audio.asset.url, "blob:previous");
  const late = actual.audio.chooseRemote(() => new Promise(resolve => { finish = resolve; }));
  assert.equal(await actual.audio.choose(new File(["new"], "newer.mp3", { type: "audio/mpeg" })), true);
  finish(new File(["late"], "late.mp3", { type: "audio/mpeg" }));
  assert.equal(await late, false);
  assert.equal(actual.audio.asset.name, "newer.mp3");
  assert.equal(actual.audio.error, null);
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

test("remote soundtrack selection stays pending through download and hands off to the caller's upload callback", async () => {
  const actual = harness();
  let download;
  const acceptedFiles = [];
  // The shared controller's callback form must preserve editor-specific uploads.
  // Use the real controller directly so its acceptance callback is observable.
  const raw = actual.audio;
  const pending = raw.chooseRemote(() => new Promise(resolve => { download = resolve; }), {}, async file => { acceptedFiles.push(file.name); return true; });
  assert.equal(actual.audio.loading, true);
  download(new File(["saved"], "saved.mp3", { type: "audio/mpeg" }));
  assert.equal(await pending, true);
  assert.deepEqual(acceptedFiles, ["saved.mp3"]);
  assert.equal(actual.audio.asset.url, "blob:previous", "The acceptance callback controls persistence; the download must not replace it with a preview-only source");
  assert.equal(actual.audio.loading, false);
});
