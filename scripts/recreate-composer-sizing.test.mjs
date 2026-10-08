import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const element = (type, props) => ({ type, props });
const nodes = node => node == null ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];

function renderComposer(overrides = {}, scrollHeight = 20) {
  const effects = [], exported = {}, changes = [], submissions = [];
  const imports = {
    react: { useEffect: effect => effects.push(effect), useId: () => "test-prompt", useRef: () => ({ current: null }), useState: initial => [initial, () => {}] },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "react-dom": { createPortal: children => children },
    "@/components/explore/workflow-creation.module.css": { default: {} },
    "lucide-react": Object.fromEntries(["Check", "ChevronDown", "Loader2", "SlidersHorizontal"].map(name => [name, name])),
    "@/components/ui/button": { Button: "button" },
    "@/components/generation/composer-settings-rail": { ComposerSettingsRail: "rail" },
    "@/components/ui/field": Object.fromEntries(["Field", "FieldDescription", "FieldGroup", "FieldLabel"].map(name => [name, name])),
    "@/components/ui/popover": Object.fromEntries(["Popover", "PopoverContent", "PopoverTitle", "PopoverTrigger"].map(name => [name, name])),
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  const source = readFileSync(new URL("../components/generation/ai-studio-composer.tsx", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: exported, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  const tree = nodes(exported.AiStudioComposer({
    active: true, compact: true, layout: "unified", ariaLabel: "Image prompt", name: "prompt", prompt: "", placeholder: "What would you like to change?",
    generateLabel: "Generate image", generateDisabled: false, generationLocked: false, isGenerating: false, settings: "settings",
    onPromptChange: value => changes.push(value), onSubmit: event => submissions.push(event), onTextareaKeyDown: () => {}, ...overrides,
  }));
  const textarea = tree.find(node => node.type === "textarea");
  const measured = { style: { height: "99px" }, scrollHeight };
  textarea.props.ref.current = measured;
  for (const effect of effects) effect();
  return { tree, textarea, measured, changes, submissions };
}

test("actual compact textarea grows from 40 to 72px and leaves standard sizing unchanged", () => {
  assert.equal(renderComposer({}, 20).measured.style.height, "40px");
  assert.equal(renderComposer({ prompt: "First line\nSecond line" }, 60).measured.style.height, "60px");
  assert.equal(renderComposer({ prompt: "Long multiline prompt" }, 140).measured.style.height, "72px");
  assert.equal(renderComposer({ compact: false }, 20).measured.style.height, "40px");
  assert.equal(renderComposer({ compact: false }, 140).measured.style.height, "64px");
  assert.equal(renderComposer({ compact: false, layout: "standard" }, 20).measured.style.height, "64px");
  assert.equal(renderComposer({ compact: false, layout: "standard" }, 140).measured.style.height, "128px");
  assert.equal(renderComposer({ active: false }, 140).measured.style.height, "99px");
});

test("compact sizing preserves prompt changes, submission and selected reference context", () => {
  const actual = renderComposer({ contextBanner: element("selected-reference", { children: "Selected slideshow" }) });
  actual.textarea.props.onChange({ target: { value: "Keep the style, change the subject" } });
  assert.deepEqual(actual.changes, ["Keep the style, change the subject"]);
  const form = actual.tree.find(node => node.type === "form");
  form.props.onSubmit("test-event");
  assert.deepEqual(actual.submissions, ["test-event"]);
  assert.ok(actual.tree.some(node => node.type === "selected-reference"));
  assert.ok(actual.tree.some(node => node.type === "rail" && node.props.children === "settings"));
  assert.equal(actual.tree.find(node => node.type === "button" && node.props.type === "submit").props["aria-label"], "Generate image");
});

test("the smaller composer does not bypass access locking or hide prompt validation", () => {
  const locked = renderComposer({ generationLocked: true, generateDisabled: true, accessMessage: "Generation unavailable" });
  assert.equal(locked.tree.find(node => node.type === "button" && node.props.type === "submit").props.disabled, true);
  const invalid = renderComposer({ maxLength: 5, prompt: "Too long", showPromptHint: false });
  assert.equal(invalid.textarea.props["aria-invalid"], true);
  assert.equal(invalid.tree.find(node => node.type === "button" && node.props.type === "submit").props.disabled, true);
  assert.ok(invalid.tree.some(node => node.type === "FieldDescription" && node.props.role === "alert"));
});
