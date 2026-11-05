import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as uploadContract from "../lib/explore/uploaded-starting-frame.ts";
import { validateReferenceImageFiles } from "../lib/explore/reference-image-batch.ts";

const asset = {
  id: "11111111-1111-4111-8111-111111111111", collection: "image", status: "ready", sourceType: "upload",
  mimeType: "image/png", projectId: "explore-starting-frame", width: 720, height: 1280,
  url: "https://owned.example/opening.png", fileName: "opening.png",
};
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
const nodes = root => !root || typeof root !== "object" ? []
  : [root, ...[root.props?.children].flat(Infinity).flatMap(nodes)];

function harness(upload = async () => ({ kind: "image", asset })) {
  const slots = [], effects = [], selected = [], pending = [], errors = [], calls = [];
  const cache = new Map();
  let cursor = 0, ownerId = "owner", disabled = false;
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: {
      useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
      useState(value) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = value;
        return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
      },
      useEffect(run, dependencies) {
        const index = cursor++, previous = slots[index];
        if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
          const next = { dependencies };
          slots[index] = next;
          effects.push(() => { previous?.cleanup?.(); next.cleanup = run(); });
        }
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "lucide-react": { Plus: "Plus", Check: "Check", RefreshCw: "RefreshCw" },
    "@base-ui/react/tabs": { Tabs: { Root: "Tabs", List: "TabsList", Tab: "Tab", Panel: "Panel" } },
    "@/components/ui/button": { Button: "Button" },
    "@/lib/explore/uploaded-starting-frame": uploadContract,
    "@/lib/explore/reference-image-batch": { validateReferenceImageFiles },
    "@/lib/media/image-picker": { imagePickerThumbnailUrl: url => url },
    "@/lib/characters/history": { mergeCharacterHistoryPages: () => [] },
    "@/lib/characters/photo-library-client": {},
    "@/lib/explore/hook-starting-frame-history-client": {},
    "./format-person-image-picker.module.css": { default: {} },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async (...args) => { calls.push(args); return upload(...args); } },
    "@/lib/explore/format-reference-images": {
      fetchUploadedStartingFrames: async () => [asset],
      fetchUploadedStartingFrame: async (id, owner) => {
        calls.push({ id, owner });
        return uploadContract.uploadedStartingFrameSelection(asset, owner);
      },
    },
    "@tanstack/react-query": {
      useQuery: options => ({ data: options.queryKey[0] === "uploaded-starting-frames" ? [asset] : [], isPending: false, refetch() {} }),
      useInfiniteQuery: () => ({ data: { pages: [] }, refetch() {} }),
      useQueryClient: () => ({
        setQueryData(key, update) { cache.set(JSON.stringify(key), update(cache.get(JSON.stringify(key)))); },
        invalidateQueries: async () => {},
      }),
    },
  };
  function load(path) {
    const exports = {};
    const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    });
    vm.runInNewContext(outputText, { exports, AbortController, Error, require: name => {
      assert.ok(name in modules, name);
      return modules[name];
    } });
    return exports;
  }
  modules["./use-starting-frame-uploads"] = load("../components/explore/use-starting-frame-uploads.tsx");
  const { TalkingHeadPhotoLibrary } = load("../components/explore/talking-head-photo-library.tsx");
  function render() {
    cursor = 0;
    const result = TalkingHeadPhotoLibrary({ ownerId, disabled, selectedIds: [], limitReached: true, section: "person",
      onSectionChange() {}, onSelectStartingFrame: frame => { selected.push(frame); },
      onStartingFramePendingChange: value => pending.push(value), onStartingFrameErrorChange: value => errors.push(value),
      uploadControl: "Person photo uploader",
    });
    effects.splice(0).forEach(run => run());
    return result;
  }
  function open() {
    nodes(render()).find(node => node.type === "Tabs").props.onValueChange("starting");
    return render();
  }
  function choose() {
    const input = nodes(render()).find(node => node.type === "input" && node.props["aria-label"] === "Choose a starting frame to upload");
    input.props.onChange({ currentTarget: { value: "selected", files: [new File(["image"], "opening.png", { type: "image/png" })] } });
  }
  return { render, open, choose, calls, selected, pending, errors,
    changeOwner(next) { ownerId = next; render(); },
    disable() { disabled = true; },
  };
}

test("Talking Head exposes the shared starting-frame uploader even at person-photo capacity", async () => {
  const h = harness();
  const tree = h.open();
  const input = nodes(tree).find(node => node.type === "input");
  assert.equal(input.props.disabled, false);
  h.choose();
  await settle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][3], "owner");
  assert.equal(h.calls[0][4].purpose, "explore-starting-frame");
  assert.equal(h.selected[0].assetId, asset.id);
  assert.equal(h.selected[0].jobId, undefined);
  assert.deepEqual(h.pending, [true, false]);
});

test("upload failure is reported to the generation owner without selecting a replacement", async () => {
  const h = harness(async () => { throw new Error("Upload interrupted"); });
  h.open(); h.choose(); await settle();
  assert.deepEqual(h.selected, []);
  assert.equal(h.errors.at(-1), "Upload interrupted");
  assert.equal(h.pending.at(-1), false);
});

test("a late uploaded starting frame cannot select into a different account", async () => {
  let resolve;
  const h = harness(() => new Promise(done => { resolve = done; }));
  h.open(); h.choose(); h.changeOwner("other");
  resolve({ kind: "image", asset }); await settle();
  assert.deepEqual(h.selected, []);
  assert.equal(h.pending.at(-1), false);
});

test("the starting-frame library resolves saved owned IDs without another upload", async () => {
  const h = harness();
  const tree = h.open();
  nodes(tree).find(node => node.props?.["aria-label"] === "Use uploaded starting frame opening.png").props.onClick();
  await settle();
  assert.deepEqual(h.calls, [{ id: asset.id, owner: "owner" }]);
  assert.equal(h.selected[0].assetId, asset.id);
});
