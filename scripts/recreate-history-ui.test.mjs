import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const element = (type, props) => ({ type, props });
const nodes = node => node == null ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
const text = node => node == null ? "" : typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);

// Evaluate the actual JSX toolbar/drawer visibility expressions, without loading
// the authentication, network, or paid-generation dependencies of either panel.
function extractPresentation(file, drawer) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let sessionActions, toolbar, drawerOpen;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "hasSessionActions") sessionActions = node.initializer.getText(ast);
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "toolbar") toolbar = node.initializer.expression.getText(ast);
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === drawer) {
      drawerOpen = node.attributes.properties.find(attribute => attribute.name?.getText(ast) === "open").initializer.expression.getText(ast);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(sessionActions && toolbar && drawerOpen, `Missing presentation expression in ${file}`);
  return ts.transpileModule(`const hasSessionActions = ${sessionActions}; exports.toolbar = (${toolbar}); exports.drawerOpen = ${drawerOpen};`, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

for (const [mode, file, drawer] of [
  ["Image", "components/workspace/ugc-chat-workspace.tsx", "ImageGenerationHistory"],
  ["Video", "components/video/video-generation-workspace.tsx", "VideoHistoryDrawer"],
]) {
  const compiled = extractPresentation(file, drawer);
  const render = (recreateView, { completed = false, generating = false } = {}) => {
    const exported = {}, calls = [], assets = completed ? [{}] : [];
    vm.runInNewContext(compiled, {
      exports: exported, require: name => { assert.equal(name, "react/jsx-runtime"); return { jsx: element, jsxs: element }; },
      recreateView, visibleImages: assets, visibleVideos: assets, generatedAssets: [{}], generatedVideos: [{}],
      selectedHistoryImageId: null, selectedHistoryVideo: null, isGenerating: generating, resultsLoading: false,
      historyOpen: true, active: true, Button: "button", Plus: "plus", History: "history-icon",
      startNewImage: () => calls.push("new"), startNewVideoSession: () => calls.push("new"),
      setSelectedHistoryImageId() {}, setSelectedHistoryVideoId() {}, setHistoryNow() {}, setHistoryOpen() {},
    });
    return { ...exported, calls, buttons: nodes(exported.toolbar).filter(node => node.type === "button") };
  };

  test(`${mode} Recreate has no History button, drawer or empty toolbar space`, () => {
    const empty = render({ preview: false });
    assert.equal(empty.toolbar, undefined);
    assert.equal(empty.drawerOpen, false);
    const complete = render({ preview: false }, { completed: true });
    assert.equal(complete.buttons.length, 1);
    assert.match(text(complete.buttons[0]), /New session/);
    assert.doesNotMatch(text(complete.toolbar), /History/);
    complete.buttons[0].props.onClick();
    assert.deepEqual(complete.calls, ["new"]);
    assert.equal(render({ preview: false }, { completed: true, generating: true }).toolbar, undefined);
    assert.equal(render({ preview: true }, { completed: true }).toolbar, undefined);
  });

  test(`${mode} History remains available outside Recreate`, () => {
    const ordinary = render(undefined);
    assert.ok(ordinary.buttons.some(button => /History/.test(text(button))));
    assert.equal(ordinary.drawerOpen, true);
  });
}
