import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as settings from "../lib/ai-studio/generation-settings.ts";
import * as durations from "../lib/explore/workflow-duration.ts";

const nodes = node => node == null ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
const element = (type, props) => ({ type, props });
function control(model = "seedance_2_5", initial = 5, props = {}) {
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
  const render = () => { cursor = 0; return nodes(exported.WorkflowDurationControl({ ...props, model, value, ariaLabel: "Hook duration", onChange(next) { value = next; changes.push(next); } })); };
  const find = (type, label) => render().find(node => node.type === type && (!label || node.props.children === label));
  return { changes, render, find, choose: next => find("select").props.onChange(next), enter: raw => find("input").props.onChange({ target: { value: raw } }) };
}

test("duration presets include 3 before 5 seconds only for models that support it", () => {
  for (const [model, expected] of [["wan_3_0", ["3", "5", "10", "15", "20", "30", "custom"]], ["seedance_2_5", ["5", "10", "15", "20", "30", "custom"]], ["kling_3_0", ["3", "5", "10", "15", "custom"]], ["google_omni", ["3", "5", "10", "custom"]]]) {
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

test("WAN custom durations accept whole seconds from 2 through 30 and reject values outside that range", () => {
  const actual = control("wan_3_0");
  actual.choose("custom");
  assert.equal(actual.find("input").props.min, 2);
  assert.equal(actual.find("input").props.max, 30);
  for (const raw of ["", "1", "31", "2.5", "1e1", "-2"]) {
    actual.enter(raw);
    assert.equal(actual.find("button", "Apply duration").props.disabled, true);
    actual.find("input").props.onKeyDown({ key: "Enter", preventDefault() {} });
  }
  assert.deepEqual(actual.changes, []);
  for (const seconds of [2, 17, 30]) {
    actual.choose("custom");
    actual.enter(String(seconds));
    actual.find("button", "Apply duration").props.onClick();
  }
  assert.deepEqual(actual.changes, [2, 17, 30]);
});

test("workflow duration keeps compact triggers and shows preset and custom credit costs", () => {
  const actual = control("wan_3_0", 5, { creditsPerSecond: 4, fieldLabel: "Duration", fieldLayout: "classic", size: "sm" });
  const select = actual.find("select").props;
  assert.equal(select.fieldLabel, "Duration");
  assert.equal(select.fieldLayout, "classic");
  assert.equal(select.size, "sm");
  assert.equal(select.options[0].label, "3 sec · 12 credits");
  assert.equal(select.options[0].triggerLabel, "3 sec");
  assert.equal(select.options[1].label, "5 sec · 20 credits");
  actual.choose("3");
  assert.deepEqual(actual.changes, [3]);
  assert.equal(actual.find("select").props.value, "3");
  actual.choose("custom");
  actual.enter("17");
  assert.ok(actual.render().some(node => node.props?.children === "17 seconds · 68 credits per video."));
  actual.find("button", "Apply duration").props.onClick();
  assert.equal(actual.find("select").props.options.at(-1).triggerLabel, "17 sec");
});

test("a locked workflow cannot change a preset or apply a pending custom duration", () => {
  const props = { disabled: false };
  const actual = control("wan_3_0", 5, props);
  actual.choose("custom");
  actual.enter("17");
  props.disabled = true;
  assert.equal(actual.find("select").props.disabled, true);
  assert.equal(actual.find("input").props.disabled, true);
  assert.equal(actual.find("button", "Apply duration").props.disabled, true);
  actual.choose("30");
  actual.find("button", "Apply duration").props.onClick();
  actual.find("input").props.onKeyDown({ key: "Enter", preventDefault() {} });
  assert.deepEqual(actual.changes, []);
});
