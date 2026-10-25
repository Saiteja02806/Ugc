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

function workspaceCode(name, path, bindings) {
  let target;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) target = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) target = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const key of path) target = target.properties.find(p => p.name?.getText(source) === key).initializer;
  const code = ts.isFunctionDeclaration(target) ? `(${target.getText(source)})` : target.getText(source);
  const context = vm.createContext(bindings);
  vm.runInContext(ts.transpileModule(`globalThis.result = ${code}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.result;
}

test("Recreate opens inside Edit and routes only that image into the existing generation panel", () => {
  const image = { id: "selected", url: "https://media.test/slide.png" }, actions = [];
  const bindings = { generating: false, slideshowSaving: false,
    setRegenerationSlideNumber: n => actions.push(["slide", n]), setSlideshowRegenerationImage: value => actions.push(["image", value]), setStep: value => actions.push(["step", value]) };
  workspaceCode("regenerateSlide", [], bindings)(2, image);
  assert.deepEqual(actions, [["slide", 3], ["image", image], ["step", "edit"]]);
  const state = { slideshowRegenerationImage: image, format: "slideshow", step: "edit", regenerationControls: "inside-editor", regenerationResults: "replacement-options" };
  assert.equal(workspaceCode("recreateView", ["referenceImageUrls"], state), undefined);
  assert.equal(workspaceCode("recreateView", ["slideshowSources"], state), undefined);
  assert.equal(workspaceCode("recreateView", ["slideshowSlideCount"], state), undefined);
  assert.equal(workspaceCode("recreateView", ["workflow", "controlsTarget"], state), "inside-editor");
  assert.equal(workspaceCode("recreateView", ["workflow", "resultsTarget"], state), "replacement-options");
  assert.equal(workspaceCode("recreateView", ["workflow", "controlsActive"], state), true);
  workspaceCode("recreateView", ["workflow", "onGenerationStart"], state)();
  assert.equal(workspaceCode("recreateView", ["workflow", "onGeneratedSlideshow"], state)([image]), false);
  assert.equal(workspaceCode("recreateView", ["workflow", "onSelectSlideshow"], state)([image]), false);
});

test("closing recreation clears the replacement target without changing the slideshow", () => {
  const actions = [];
  const close = expression("Dialog", "onOpenChange", { setSlideshowRegenerationImage: value => actions.push(value), slideshowEditor: { current: { startNewSlide: () => actions.push("clear-target") } } });
  close(false); assert.deepEqual(actions, [null, "clear-target"]);
});
