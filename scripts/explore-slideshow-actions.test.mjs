import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const path = "components/explore/format-workspace.tsx";
const source = ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);

// Run the actual workspace navigation callback and pending-source expression.
// Only their unrelated React/network boundaries are replaced with local values.
function expression(component, attribute, bindings) {
  let match;
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === component) {
      const attr = node.attributes.properties.find(value => ts.isJsxAttribute(value) && value.name.getText(source) === attribute);
      if (attr && ts.isJsxExpression(attr.initializer)) match = attr.initializer.expression;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(match, `${component}.${attribute} must remain connected`);
  const context = vm.createContext(bindings);
  const code = ts.transpileModule(`globalThis.result = ${match.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInContext(code, context);
  return context.result;
}

function scheduleNavigation(slideshowSaving, slideshowUploadBusy) {
  const actions = [];
  const callback = expression("Tabs.Root", "onValueChange", {
    step: "edit", format: "slideshow", slideshowSaving, slideshowUploadBusy,
    setEditExpanded: value => actions.push(["expanded", value]),
    setStep: value => actions.push(["step", value]),
    revealOnMobile: value => actions.push(["pane", value]),
    requestSchedule: () => { throw new Error("Slideshow navigation cannot prepare a video"); },
  });
  callback("schedule");
  return actions;
}

for (const state of [{ slideshowSaving: true, slideshowUploadBusy: false }, { slideshowSaving: false, slideshowUploadBusy: true }]) {
  test(`slideshow ${state.slideshowSaving ? "output upload/save" : "reference upload"} blocks direct Schedule navigation and review`, () => {
    assert.deepEqual(scheduleNavigation(state.slideshowSaving, state.slideshowUploadBusy), []);
    assert.equal(expression("FormatSchedulePanel", "pendingSource", { source: { busy: false }, format: "slideshow", ...state }), true);
  });
}

test("a settled slideshow can enter Schedule without invoking video preparation", () => {
  assert.deepEqual(scheduleNavigation(false, false), [["expanded", false], ["step", "schedule"], ["pane", "controls"]]);
  assert.equal(expression("FormatSchedulePanel", "pendingSource", { source: { busy: false }, format: "slideshow", slideshowSaving: false, slideshowUploadBusy: false }), false);
});

test("video scheduling continues to use its source-upload state", () => {
  for (const format of ["hook", "wall_text"]) for (const busy of [false, true]) {
    assert.equal(expression("FormatSchedulePanel", "pendingSource", { source: { busy }, format, slideshowSaving: true, slideshowUploadBusy: true }), busy);
  }
});
