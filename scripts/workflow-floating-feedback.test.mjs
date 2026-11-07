import assert from "node:assert/strict";
import test from "node:test";
import { actionLayoutFixture, element, nodes, text } from "./workflow-action-feedback-fixture.mjs";

const { WorkflowFeedback } = actionLayoutFixture();

test("real workflow errors and changed errors never create a floating notice", () => {
  for (const message of ["Could not check ongoing generations. Refresh to try again.", "A different request failed."]) {
    let calls = 0;
    const tree = WorkflowFeedback({ id: "feedback", children: [
      element("p", { role: "alert", className: "sr-only", children: message }),
      element("button", { children: "Refresh status", onClick() { calls++; } }),
    ] });
    assert.equal(tree.props.id, "feedback");
    assert.equal(tree.props.hidden, false);
    assert.equal(nodes(tree).some(node => node.type === "portal" || node.type === "aside"), false);
    const error = nodes(tree).find(node => node.props?.role === "alert");
    assert.equal(error.props.className, "sr-only");
    assert.equal(text(error), message);
    nodes(tree).find(node => node.type === "button").props.onClick();
    assert.equal(calls, 1);
  }
});

test("inactive workflow feedback hides its recovery controls", () => {
  const tree = WorkflowFeedback({ id: "inactive", active: false, children: element("button", { children: "Refresh status" }) });
  assert.equal(tree.props.hidden, true);
});
