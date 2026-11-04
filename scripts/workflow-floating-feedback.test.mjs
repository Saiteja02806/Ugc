import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { element, nodes, text } from "./workflow-action-feedback-fixture.mjs";

function fixture(server = false) {
  const host = { id: "body" };
  let state = false;
  const imports = {
    react: { Children: { toArray: value => [value].flat(Infinity).filter(Boolean) }, isValidElement: value => value && typeof value === "object" && "type" in value,
      useSyncExternalStore: (_subscribe, client, ssr) => server ? ssr() : client(), useState: () => [state, value => { state = value; }] },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
    "react-dom": { createPortal: (children, target) => element("portal", { children, target }) },
    "lucide-react": { ChevronDown: "icon", X: "icon" },
    "./workflow-feedback.module.css": { default: new Proxy({}, { get: (_target, key) => String(key) }) },
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("components/explore/workflow-feedback.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports: exported, document: { body: host }, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return { render: props => exported.WorkflowFeedback({ id: "feedback", ...props }), host };
}

test("complete feedback and recovery are portaled to body without an editor-flow wrapper", () => {
  let calls = 0;
  const f = fixture();
  const message = "Very long failure. ".repeat(500);
  const tree = f.render({ children: [element("p", { role: "alert", children: message }), element("button", { children: "Refresh status", onClick() { calls++; } })] });
  const portal = nodes(tree).find(n => n.type === "portal");
  assert.equal(portal.props.target, f.host);
  assert.ok(text(portal).includes(message));
  const description = nodes(tree).find(n => n.props?.id === "feedback");
  assert.equal(description.props.className, "sr-only");
  nodes(portal).find(n => n.type === "button" && text(n) === "Refresh status").props.onClick();
  assert.equal(calls, 1);
});

test("issues show immediately with a close mark and no status/collapse/reopen button", () => {
  const f = fixture();
  const props = { children: element("p", { role: "alert", children: "First error" }) };
  let tree = f.render(props);
  assert.ok(text(tree).includes("First error"));
  assert.deepEqual(nodes(tree).filter(n => n.type === "button").map(n => n.props["aria-label"]), ["Dismiss workflow notification"]);
  tree = f.render({ children: element("p", { role: "alert", children: "Different error" }) });
  assert.equal(nodes(tree).some(n => n.type === "button" && text(n).includes("Generation status")), false);
  assert.ok(text(tree).includes("Different error"));
});

test("the close mark removes the notice completely without a replacement pill", () => {
  const f = fixture();
  const props = { children: element("p", { role: "alert", children: "Unresolved request" }) };
  const tree = f.render(props);
  nodes(tree).find(n => n.props?.["aria-label"] === "Dismiss workflow notification").props.onClick();
  const closed = f.render(props);
  assert.equal(nodes(closed).some(n => n.props?.["data-workflow-feedback"] !== undefined), false);
  assert.equal(nodes(closed).some(n => n.type === "button"), false);
  assert.ok(text(closed).includes("Unresolved request"), "accessible explanation remains; no request is cleared");
});

test("server, inactive and empty feedback never create floating notices", () => {
  for (const tree of [fixture(true).render({ children: "Error" }), fixture().render({ active: false, children: "Error" }), fixture().render({ children: element("fragment", {}) })]) {
    assert.equal(nodes(tree).some(n => n.type === "portal"), false);
  }
});
