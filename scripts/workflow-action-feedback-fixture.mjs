import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

export const element = (type, props = {}) => typeof type === "function" ? type(props) : ({ type, props });
export const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
export const text = node => Array.isArray(node) ? node.map(text).join(" ") : node && typeof node === "object" ? text(node.props?.children) : typeof node === "string" ? node : "";

/** Render the actual shared components without external services or requests. */
export function actionLayoutFixture(sourceOverrides = {}) {
  let nextId = 0;
  const feedbackHost = { id: "document-body" };
  const styles = prefix => new Proxy({}, { get: (_target, name) => `${prefix}-${String(name)}` });
  const imports = {
    react: { useEffect() {}, useId: () => `fixture-${++nextId}`, useRef: () => ({ current: null }), useState: initial => [initial, () => {}], useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
      Children: { toArray: children => [children].flat(Infinity).filter(Boolean) }, Fragment: "fragment", isValidElement: value => Boolean(value && typeof value === "object" && "type" in value) },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
    "react-dom": { createPortal: (children, target) => element("portal", { target, children }) },
    "lucide-react": Object.fromEntries(["Check", "ChevronDown", "Loader2", "SlidersHorizontal", "X"].map(name => [name, "icon"])),
    "@/components/ui/button": { Button: "button" },
    "@/components/generation/composer-settings-rail": { ComposerSettingsRail: "div" },
    "@/components/ui/field": Object.fromEntries(["Field", "FieldGroup"].map(name => [name, "div"]).concat([["FieldLabel", "label"], ["FieldDescription", "p"]])),
    "@/components/ui/popover": Object.fromEntries(["Popover", "PopoverContent", "PopoverTitle", "PopoverTrigger"].map(name => [name, "div"])),
    "@/components/explore/workflow-creation.module.css": { default: styles("creation") },
    "@/components/explore/workflow-section-layout.module.css": { default: styles("sections") },
    "@/components/explore/workflow-focused-composer.module.css": { default: styles("focused") },
    "./workflow-feedback.module.css": { default: styles("feedback") },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  function load(file) {
    const exported = {};
    vm.runInNewContext(ts.transpileModule(sourceOverrides[file] ?? readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
      { exports: exported, document: { body: feedbackHost }, process: { env: { NODE_ENV: "test" } }, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
    return exported;
  }
  const feedback = load("components/explore/workflow-feedback.tsx");
  imports["./workflow-feedback"] = imports["@/components/explore/workflow-feedback"] = feedback;
  return { ...feedback, feedbackHost, ...load("components/explore/workflow-creation-panel.tsx"), ...load("components/generation/ai-studio-composer.tsx") };
}

export function composerProps(overrides = {}) {
  return { active: true, layout: "workflow", workflowDesign: "classic", ariaLabel: "Video instructions", name: "instructions", prompt: "Keep the source scene and use my own script.", placeholder: "Your instructions", generateLabel: "Generate video", generateDisabled: false, generationLocked: false, isGenerating: false,
    settings: element("div", { children: "Model and output settings" }), onPromptChange() {}, onSubmit() {}, onTextareaKeyDown() {}, ...overrides };
}
