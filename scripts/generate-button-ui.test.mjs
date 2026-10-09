import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Loader2, RefreshCw } from "lucide-react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const helpers = {
  Button: (props) => React.createElement("button", Object.fromEntries(Object.entries(props).filter(([name]) => name !== "size"))),
  cn: (...classes) => classes.filter(Boolean).join(" "),
  buttonClassName: ({ className }) => className,
  Loader2,
  RefreshCw,
};

// Render the real JSX of each Generate button, without mounting its API-owning workspace.
function buttonFixture(path, tag, marker, props) {
  const source = read(path);
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(parsed) === tag && node.getText(parsed).includes(marker)) {
      matches.push(node.getText(parsed));
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.equal(matches.length, 1, `Find exactly one ${marker} button`);
  const fixture = `const { Button, cn, buttonClassName, Loader2, RefreshCw } = helpers;
    module.exports = function Fixture(props) {
      const { ${Object.keys(props).join(", ")} } = props;
      return (${matches[0]});
    };`;
  const compiled = ts.transpileModule(fixture, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { module: { exports: {} }, exports: {}, require, helpers };
  runInNewContext(compiled, context);
  return {
    markup: renderToStaticMarkup(React.createElement(context.module.exports, props)),
    source,
    button: matches[0],
  };
}

const composerPath = "components/generation/ai-studio-composer.tsx";
const composerProps = {
  compact: false,
  generateLabel: "Generate image",
  generateDisabled: false,
  promptTooLong: false,
  generationLocked: false,
  accessMessage: null,
  isGenerating: false,
  layout: "unified",
};

test("shared Image and Video Generate buttons are text-only, including compact Recreate", () => {
  for (const generateLabel of ["Generate image", "Generate video", "Generate"]) {
    for (const compact of [false, true]) {
      const { markup } = buttonFixture(composerPath, "Button", "aria-label={generateLabel}", { ...composerProps, generateLabel, compact });
      assert.doesNotMatch(markup, /<svg|lucide-sparkles/);
      assert.ok(markup.endsWith(`${compact ? "Generate" : generateLabel}</button>`));
      assert.ok(markup.includes(`aria-label="${generateLabel}"`));
      assert.match(markup, /type="submit"/);
    }
  }
});

test("shared Generate button still enforces disabled and overlength states", () => {
  for (const state of [{ generateDisabled: true }, { promptTooLong: true }]) {
    const { markup, source } = buttonFixture(composerPath, "Button", "aria-label={generateLabel}", { ...composerProps, ...state });
    assert.match(markup, /disabled=""/);
    assert.match(source, /onSubmit=\{onSubmit\}/);
    assert.match(source, /onKeyDown=\{onTextareaKeyDown\}/);
  }
});

test("shared Generate button retains its loading spinner and label", () => {
  const { markup } = buttonFixture(composerPath, "Button", "aria-label={generateLabel}", { ...composerProps, isGenerating: true });
  assert.match(markup, /<svg/);
  assert.match(markup, /animate-spin/);
  assert.match(markup, /Generating…/);
  assert.doesNotMatch(markup, /lucide-sparkles/);
});

test("workflow 1 and 3 share a text-only Generate button without enabling preview generation", () => {
  for (const kind of ["hook", "phone"]) {
    const { markup } = buttonFixture("components/explore/workflow-creation-panel.tsx", "Button", "Generate video", {
      kind,
      creation: { primaryAction: "primary-action" },
    });
    assert.doesNotMatch(markup, /<svg/);
    assert.match(markup, /disabled=""/);
    assert.match(markup, /Generate video<\/button>/);
    assert.ok(markup.includes(`aria-label="${kind === "hook" ? "Generate hook" : "Generate phone video"}"`));
  }
});

test("avatar Generate button drops only the sparkle, keeping loading and regeneration indicators", () => {
  const path = "components/avatar/avatar-generation-workspace.tsx";
  const props = { isWorking: false, imageUrl: null, handleGenerate: () => {} };
  const idle = buttonFixture(path, "button", "onClick={handleGenerate}", props);
  assert.doesNotMatch(idle.markup, /<svg/);
  assert.match(idle.markup, /Generate avatar<\/button>/);
  assert.match(idle.button, /onClick=\{handleGenerate\}/);
  const loading = buttonFixture(path, "button", "onClick={handleGenerate}", { ...props, isWorking: true });
  assert.match(loading.markup, /disabled=""/);
  assert.match(loading.markup, /animate-spin/);
  const repeat = buttonFixture(path, "button", "onClick={handleGenerate}", { ...props, imageUrl: "existing-image" });
  assert.match(repeat.markup, /<svg/);
  assert.match(repeat.markup, /Generate another avatar/);
});
