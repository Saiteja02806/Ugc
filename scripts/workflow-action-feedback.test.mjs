import assert from "node:assert/strict";
import test from "node:test";
import { actionLayoutFixture, composerProps, element, nodes, text } from "./workflow-action-feedback-fixture.mjs";

const { WorkflowCreationPanel, AiStudioComposer, feedbackHost } = actionLayoutFixture();
const inlineNodes = node => Array.isArray(node) ? node.flatMap(inlineNodes) : node && typeof node === "object" ? [node, ...(node.type === "portal" ? [] : inlineNodes(node.props?.children))] : [];
const getFooter = tree => nodes(tree).find(node => node.type === "footer");
const getSettings = tree => nodes(tree).find(node => node.props?.["data-workflow-section-content"] !== undefined);
const errors = ["This prompt is too long for the selected model. Shorten it and try again.", "Unknown request. ".repeat(300), "Credits could not be confirmed. Refresh access."];

for (const kind of ["hook", "phone"]) for (const error of errors) test(`${kind}: generation failures and pending notices never add content to the fixed primary footer (${error.slice(0, 18)})`, () => {
  let generates = 0, refreshes = 0;
  const child = element("textarea", { value: "My authored instructions" });
  const generation = { error, notice: "Your earlier request is saved.", message: "The previous request must be confirmed before another generation.", disabled: true, busy: false, onGenerate() { generates++; }, refreshStatus() { refreshes++; } };
  const tree = WorkflowCreationPanel({ kind, section: "create", children: child, generation });
  const footer = getFooter(tree), settings = getSettings(tree);
  assert.equal(text(footer).trim(), "Generate video");
  assert.equal(nodes(footer).filter(n => n.type === "button").length, 1);
  assert.ok(!nodes(footer).some(n => n.props?.role === "alert" || n.props?.role === "status"));
  assert.ok(text(settings).includes(error)); assert.ok(text(settings).includes(generation.message)); assert.ok(text(settings).includes(generation.notice));
  assert.ok(nodes(settings).includes(child), "same editable child stays mounted");
  assert.equal(inlineNodes(settings).some(n => n.props?.["data-workflow-feedback"] !== undefined), false, "no message stack occupies the form flow");
  assert.ok(nodes(settings).some(n => n.type === "portal" && n.props.target === feedbackHost));
  assert.equal(nodes(tree).filter(n => n.props?.role === "alert").length, 1);
  const button = nodes(footer).find(n => n.type === "button");
  assert.equal(button.props.disabled, true); assert.equal(button.props["aria-busy"], false);
  assert.ok(nodes(settings).some(n => n.props?.id === button.props["aria-describedby"]));
  nodes(settings).find(n => n.type === "button" && text(n) === "Refresh status").props.onClick();
  assert.equal(refreshes, 1); assert.equal(generates, 0);
  const ready = WorkflowCreationPanel({ kind, section: "create", children: child, generation: { ...generation, error: null, notice: null, disabled: false } });
  const readyButton = nodes(getFooter(ready)).find(n => n.type === "button"); readyButton.props.onClick(); assert.equal(generates, 1);
  assert.equal(text(getFooter(ready)).trim(), text(footer).trim());
});

for (const kind of ["hook", "phone"]) for (const section of ["edit", "schedule"]) test(`${kind}/${section}: finishing feedback and recovery stay in scrollable settings with unchanged callbacks`, () => {
  let refreshes = 0, calls = 0;
  const action = { disabled: true, busy: true, processing: true, message: "Preparing saved work.", error: "The save response was lost.", recoveryAvailable: true, refresh() { refreshes++; }, onAction() { calls++; } };
  const tree = WorkflowCreationPanel({ kind, section, children: element("input", { value: "21:30" }), [section]: action, generation: { error: "Wrong section error", notice: "Wrong section notice" } });
  const footer = getFooter(tree), settings = getSettings(tree);
  assert.equal(nodes(footer).filter(n => n.type === "button").length, 1);
  assert.doesNotMatch(text(footer), /Preparing saved work|response was lost|Refresh/);
  assert.doesNotMatch(text(settings), /Wrong section/);
  assert.match(text(settings), /save response was lost/);
  const primary = nodes(footer).find(n => n.type === "button"); assert.equal(primary.props.disabled, true); assert.equal(primary.props["aria-busy"], true);
  const refresh = nodes(settings).find(n => n.type === "button" && text(n) === "Refresh status"); assert.equal(refresh.props.disabled, true); refresh.props.onClick(); assert.equal(refreshes, 1); assert.equal(calls, 0);
  const recover = WorkflowCreationPanel({ kind, section, children: "Existing settings", [section]: { ...action, busy: false, error: null } });
  const check = nodes(getSettings(recover)).find(n => n.type === "button" && text(n) === "Check saved requests");
  check.props.onClick(); assert.equal(refreshes, 2); assert.equal(nodes(getFooter(recover)).filter(n => n.type === "button").length, 1);
});

test("upload/asset readiness moves out of footer and custom edit actions retain their existing placement", () => {
  let continued = 0;
  const create = { disabled: false, busy: false, message: "Your selected video is ready.", onAction() { continued++; } };
  const tree = WorkflowCreationPanel({ kind: "hook", section: "create", children: "Existing upload", create });
  assert.equal(text(getFooter(tree)).trim(), "Continue"); assert.match(text(getSettings(tree)), /selected video is ready/);
  nodes(getFooter(tree)).find(n => n.type === "button").props.onClick(); assert.equal(continued, 1);
  const edit = WorkflowCreationPanel({ kind: "hook", section: "edit", children: "Existing tools", actionContent: element("button", { children: "Save edits" }) });
  assert.equal(getFooter(edit), undefined); assert.equal(nodes(edit).filter(n => n.props?.["data-workflow-feedback"] !== undefined).length, 0);
});

for (const design of ["classic", "focused", undefined]) for (const portaled of [true, false]) test(`shared ${design ?? "default"} composer: feedback never enters the action slot (portaled=${portaled})`, () => {
  let refreshed = 0, cancelled = 0, submits = 0;
  const target = { id: "footer" }, controls = { id: "scroll-controls" };
  const secondaryActions = element("fragment", { children: [element("span", { role: "alert", children: errors[1] }), element("button", { type: "button", children: "Refresh access", onClick() { refreshed++; } }), element("button", { type: "button", children: "Cancel", onClick() { cancelled++; } })] });
  const tree = AiStudioComposer(composerProps({ workflowDesign: design, actionsTarget: portaled ? target : null, portalTarget: portaled ? controls : null, accessMessage: "The previous request is not confirmed.", secondaryActions, estimatedCredits: 7, generateDisabled: true, onSubmit() { submits++; } }));
  const content = nodes(tree).find(n => n.type === "form");
  const feedback = nodes(content).find(n => n.props?.["data-workflow-feedback"] !== undefined);
  assert.ok(feedback); assert.match(text(feedback), /previous request is not confirmed/); assert.match(text(feedback), /Unknown request/);
  const primary = nodes(tree).find(n => n.type === "button" && n.props.type === "submit");
  assert.equal(primary.props.disabled, true); assert.equal(primary.props.form, content.props.id);
  assert.ok(inlineNodes(content).some(n => n.props?.id === primary.props["aria-describedby"] && n.props.className === "sr-only"));
  assert.equal(inlineNodes(content).some(n => n.props?.["data-workflow-feedback"] !== undefined), false);
  assert.ok(nodes(content).some(n => n.type === "portal" && n.props.target === feedbackHost));
  const actionTree = portaled ? nodes(tree).find(n => n.type === "portal" && n.props.target === target).props.children : content.props.children.at(-1);
  assert.doesNotMatch(text(actionTree), /Unknown request|previous request|Refresh access|Cancel/);
  assert.equal(nodes(actionTree).filter(n => n.props?.role === "alert" || n.props?.role === "status").length, 0);
  nodes(feedback).find(n => n.type === "button" && text(n) === "Refresh access").props.onClick();
  nodes(feedback).find(n => n.type === "button" && text(n) === "Cancel").props.onClick();
  assert.equal(refreshed, 1); assert.equal(cancelled, 1); assert.equal(submits, 0);
  content.props.onSubmit(); assert.equal(submits, 1, "original form submit is still attached");
});

test("workflow prompt-length validation remains beside prompt and blocks submission even with no access message", () => {
  for (const design of ["classic", "focused", undefined]) {
    const tree = AiStudioComposer(composerProps({ workflowDesign: design, prompt: "too long", maxLength: 2, generateDisabled: false }));
    assert.equal(nodes(tree).find(n => n.type === "textarea").props["aria-invalid"], true);
    assert.ok(nodes(tree).find(n => n.type === "p" && n.props.role === "alert"));
    assert.equal(nodes(tree).find(n => n.type === "button" && n.props.type === "submit").props.disabled, true);
  }
});

test("standard and unified AI Studio layouts retain their existing feedback behavior", () => {
  for (const layout of ["standard", "unified"]) {
    const tree = AiStudioComposer(composerProps({ layout, accessMessage: "Keep this message", generationLocked: true, generateDisabled: true, secondaryActions: element("button", { children: "Refresh" }) }));
    assert.equal(nodes(tree).some(n => n.props?.["data-workflow-feedback"] !== undefined), false);
    assert.match(text(tree), /Keep this message/); assert.match(text(tree), /Refresh/);
    assert.equal(nodes(tree).find(n => n.type === "button" && n.props.type === "submit").props.disabled, true);
  }
});

test("inactive workflow composers never portal feedback over the active section", () => {
  const tree = AiStudioComposer(composerProps({ active: false, accessMessage: "Hidden section failure", secondaryActions: element("button", { children: "Refresh" }) }));
  assert.equal(nodes(tree).some(n => n.props?.["data-workflow-feedback"] !== undefined), false);
});
