import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as settings from "../lib/ai-studio/generation-settings.ts";
import * as durations from "../lib/explore/workflow-duration.ts";

const nodes = node => node == null ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
const element = (type, props) => ({ type, props });
function control(model = "seedance_2_5", initial = 5) {
  let cursor = 0, value = initial;
  const state = [], changes = [], exported = {};
  const imports = {
    react: { useId: () => "duration-input", useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = next; }]; } },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
    "@/components/generation/ai-studio-composer": { AiStudioSettingSelect: "select" },
    "@/components/ui/button": { Button: "button" }, "@/components/ui/input": { Input: "input" },
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle"].map(name => [name, name])),
    "@/lib/ai-studio/generation-settings": settings, "@/lib/explore/workflow-duration": durations,
  };
  const source = readFileSync(new URL("../components/explore/workflow-duration-control.tsx", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: exported, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  const render = () => { cursor = 0; return nodes(exported.WorkflowDurationControl({ model, value, ariaLabel: "Hook duration", onChange(next) { value = next; changes.push(next); } })); };
  const find = (type, label) => render().find(node => node.type === type && (!label || node.props.children === label));
  return { changes, render, find, choose: next => find("select").props.onChange(next), enter: raw => find("input").props.onChange({ target: { value: raw } }) };
}

test("actual duration menu is six compact choices, with fewer presets for shorter models", () => {
  for (const [model, expected] of [["seedance_2_5", ["5", "10", "15", "20", "30", "custom"]], ["kling_3_0", ["5", "10", "15", "custom"]], ["google_omni", ["5", "10", "custom"]]]) {
    assert.deepEqual(Array.from(control(model).find("select").props.options, option => option.value), expected);
  }
});

test("Custom validates before Apply or Enter and announces the confirmed seconds", () => {
  const actual = control();
  actual.choose("custom");
  assert.equal(actual.find("Dialog").props.open, true);
  actual.enter("31");
  assert.equal(actual.find("button", "Apply duration").props.disabled, true);
  actual.find("input").props.onKeyDown({ key: "Enter", preventDefault() {} });
  assert.deepEqual(actual.changes, []);
  actual.enter("12");
  assert.equal(actual.find("button", "Apply duration").props.disabled, false);
  actual.find("button", "Apply duration").props.onClick();
  assert.deepEqual(actual.changes, [12]);
  assert.equal(actual.find("Dialog").props.open, false);
  assert.equal(actual.find("select").props.value, "custom");
  assert.match(actual.find("select").props.ariaLabel, /12 seconds/);
  assert.equal(actual.find("select").props.options.at(-1).triggerLabel, "12 sec · Custom");
});

test("Cancel keeps the confirmed duration and reopening discards an unconfirmed entry", () => {
  const actual = control();
  actual.choose("custom"); actual.enter("17");
  actual.find("button", "Cancel").props.onClick();
  assert.deepEqual(actual.changes, []);
  assert.equal(actual.find("select").props.value, "5");
  actual.choose("custom");
  assert.equal(actual.find("input").props.value, "5");
});

test("Custom respects a model's discrete durations, and presets cannot bypass limits", () => {
  const actual = control("kling_3_0");
  actual.choose("custom"); actual.enter("11");
  assert.equal(actual.find("button", "Apply duration").props.disabled, true);
  actual.choose("30");
  assert.deepEqual(actual.changes, []);
  actual.enter("15");
  actual.find("input").props.onKeyDown({ key: "Enter", preventDefault() {} });
  assert.deepEqual(actual.changes, [15]);
  assert.equal(actual.find("select").props.value, "15");
});
