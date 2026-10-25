import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as captions from "../lib/scheduling/saved-captions.ts";

const nodes = value => !value ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
const text = value => !value ? "" : Array.isArray(value) ? value.map(text).join("") : typeof value === "object" ? text(value.props?.children) : String(value);

// Exercise the real field handlers; the dialog primitive and account service are
// isolated here. Focus trapping and viewport geometry still need browser checks.
function fixture(initialLibrary = { revision: 0, captions: [], defaultId: null }) {
  let cursor = 0, tree;
  const slots = [], effects = [], writes = [];
  const react = {
    useId: () => "caption",
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useEffect(effect, deps) { const i = cursor++; if (!slots[i] || deps.some((value, n) => !Object.is(value, slots[i][n]))) { slots[i] = deps; effects.push(effect); } },
  };
  const saved = { available: true, loading: false, pending: false, error: null, library: initialLibrary,
    async change(update) { saved.library = update(saved.library); writes.push(saved.library); return true; }, retry() {} };
  const imports = {
    react, "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "lucide-react": Object.fromEntries(["Bookmark", "Check", "Star", "Trash2", "X"].map(key => [key, key])),
    "@base-ui/react/dialog": { Dialog: Object.fromEntries(["Root", "Trigger", "Portal", "Backdrop", "Popup", "Title", "Description", "Close"].map(key => [key, `Dialog.${key}`])) },
    "./use-saved-captions": { useSavedCaptions: () => saved }, "@/lib/scheduling/saved-captions": captions,
    "./post-caption-field.module.css": { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/scheduling/post-caption-field.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; }, crypto: { randomUUID } });
  const props = { ownerId: "owner-a", value: "", initialized: false, onChange(value) { props.value = value; props.initialized = true; } };
  const h = { props, saved, writes, render() { cursor = 0; tree = exports.PostCaptionField(props); effects.splice(0).forEach(fn => fn()); return tree; },
    find(type) { return nodes(tree).find(node => node.type === type); }, button(label) { return nodes(tree).find(node => node.type === "button" && text(node) === label); },
    open() { h.find("Dialog.Root").props.onOpenChange(true); h.render(); } };
  h.render(); return h;
}

test("saving a caption leaves the library closed and the scheduling form compact", async () => {
  const h = fixture(); h.props.value = "Founder story\nhttps://example.com\n#BuildInPublic"; h.render();
  await h.button("Save caption").props.onClick(); await new Promise(setImmediate); h.render();
  assert.equal(h.writes.length, 1);
  assert.equal(h.saved.library.captions[0].text, h.props.value);
  assert.equal(h.find("Dialog.Root").props.open, false);
  assert.ok(!nodes(h.find("section")).some(node => node.props?.className === "saved"));
  assert.match(text(h.find("section")), /Caption saved as your default/);
});

test("using a saved caption closes the library, applies exact text and returns focus to the field", () => {
  const h = fixture(), exact = "Line one\n\n#SaaS 😀";
  h.saved.library = { revision: 1, defaultId: null, captions: [{ id: randomUUID(), text: exact }] }; h.render(); h.open();
  assert.equal(h.find("Dialog.Root").props.open, true);
  const textarea = {}; h.find("textarea").props.ref.current = textarea;
  h.button("Use caption").props.onClick(); h.render();
  assert.equal(h.props.value, exact); assert.equal(h.props.initialized, true);
  assert.equal(h.find("Dialog.Root").props.open, false);
  assert.equal(h.find("Dialog.Popup").props.finalFocus(), textarea);
  assert.equal(h.writes.length, 0);
});

test("defaults cannot refill a cleared caption and library failure does not disable typing", () => {
  const id = randomUUID(), h = fixture({ revision: 1, defaultId: id, captions: [{ id, text: "My default" }] }); h.render();
  assert.equal(h.props.value, "My default");
  h.find("textarea").props.onChange({ target: { value: "" } }); h.render();
  assert.equal(h.props.value, "");
  h.saved.error = "Saved captions could not load."; h.saved.available = false; h.render();
  assert.equal(h.find("textarea").props.disabled, false);
  h.find("textarea").props.onChange({ target: { value: "Typed caption still works" } }); h.render();
  assert.equal(h.props.value, "Typed caption still works");
});
