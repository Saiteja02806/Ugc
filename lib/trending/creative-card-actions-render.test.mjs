import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArrowDown, Check, Heart, X } from "lucide-react";
import ts from "typescript";

// Render the real shared decisions to catch changes leaking into other screens.
const source = readFileSync(new URL("../../components/trending/creative-card-actions.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("actions.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "CreativeDecisionActions");
assert.ok(declaration);
const code = ts.transpileModule(declaration.getText(ast).replace(/^export /, ""), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const Button = props => {
  const nativeProps = { ...props };
  delete nativeProps.variant;
  delete nativeProps.size;
  return React.createElement("button", nativeProps);
};
const Actions = new Function("React", "Button", "ArrowDown", "Check", "Heart", "X", "reviewLayout", "LAPTOP_AND_DESKTOP_DECISION_BUTTON_CLASS", `${code}\nreturn CreativeDecisionActions;`)(
  React, Button, ArrowDown, Check, Heart, X, {}, "",
);
const callbacks = { onAccept() {}, onReject() {} };
const render = props => renderToStaticMarkup(React.createElement(Actions, { ...callbacks, ...props }));

test("default decision controls keep their icons and left/right shortcut labels", () => {
  const html = render({ acceptAriaLabel: "Create copy", acceptCaption: "Create copy", acceptTitle: "Create copy", rejectAriaLabel: "Skip this video", rejectCaption: "Skip", rejectTitle: "Skip this video" });
  assert.match(html, /lucide-check/);
  assert.match(html, /lucide-x/);
  assert.match(html, />←<\/kbd>/);
  assert.match(html, />→<\/kbd>/);
  assert.match(html, /aria-label="Create copy"/);
  assert.doesNotMatch(html, /lucide-heart|lucide-arrow-down|↓|↵/);
});

test("Trending explicitly opts into heart/down-arrow controls and their scheduling labels", () => {
  const html = render({ interaction: "post" });
  assert.match(html, /lucide-heart/);
  assert.match(html, /lucide-arrow-down/);
  assert.match(html, />↓<\/kbd>/);
  assert.match(html, />↵<\/kbd>/);
  assert.match(html, /aria-label="Like and schedule this post"/);
  assert.match(html, /aria-label="Skip to the next post"/);
  assert.doesNotMatch(html, /lucide-check|lucide-x/);
});

test("both control appearances keep the callbacks and disabled guards", () => {
  for (const interaction of ["swipe", "post"]) {
    const calls = [];
    const tree = Actions({ interaction, onAccept: () => calls.push("accept"), onReject: () => calls.push("reject"), disabled: true });
    const [reject, accept] = tree.props.children.map(group => group.props.children[0]);
    assert.equal(reject.props.disabled, true);
    assert.equal(accept.props.disabled, true);
    reject.props.onClick(); accept.props.onClick();
    assert.deepEqual(calls, ["reject", "accept"]);
  }
});
