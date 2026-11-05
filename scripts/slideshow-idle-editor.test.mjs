import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

// Execute the actual effect body with each lifecycle state; no bundle or paid IO.
const source = ts.createSourceFile("workspace.tsx", readFileSync("components/workspace/ugc-chat-workspace.tsx", "utf8"), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
let callback, dependencies;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect" && node.arguments[0]?.getText(source).includes("onIdleEmpty?.()")) { callback = node.arguments[0].getText(source); dependencies = node.arguments[1].getText(source); }
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(callback);
const base = { workflowFormat: "slideshow", active: true, resultsLoading: false, recoveringJobs: false, isGenerating: false, isSubmitting: false, pendingSubmission: null, resultsErrorMessage: null, visibleImages: [], resolvingImageJobIds: [] };
function run(patch = {}) {
  let calls = 0;
  vm.runInNewContext(`(${callback})()`, { ...base, ...patch, onIdleEmpty() { calls++; } });
  return calls;
}
test("settled empty slideshow shows editor, including a saved clarification without generated images", () => {
  assert.equal(run(), 1);
  assert.equal(run({ planningQuestions: { questions: ["Clarify input"] } }), 1);
});
test("late clarification restoration reevaluates idle fallback, while ordinary view toggles do not", () => {
  const context = { ...base, planningQuestions: null, onIdleEmpty() {} };
  const before = vm.runInNewContext(dependencies, context);
  const unchanged = vm.runInNewContext(dependencies, context);
  assert.equal(unchanged.some((value, index) => value !== before[index]), false, "Manual Generated slides navigation does not retrigger the fallback");
  context.planningQuestions = { questions: ["Saved clarification"] };
  const restored = vm.runInNewContext(dependencies, context);
  assert.equal(restored.some((value, index) => value !== before[index]), true, "Asynchronous clarification restoration rechecks actual empty state");
});
for (const patch of [{ resultsLoading: true }, { recoveringJobs: true }, { resultsErrorMessage: "Generation failed" }, { isGenerating: true }, { isSubmitting: true }, { pendingSubmission: { requestKey: "unconfirmed" } }, { visibleImages: [{ id: "ready" }] }, { resolvingImageJobIds: ["job"] }, { active: false }, { workflowFormat: "hook" }, { workflowFormat: "wall_text" }]) {
  test(`idle redirect preserves ${JSON.stringify(patch)}`, () => assert.equal(run(patch), 0));
}
