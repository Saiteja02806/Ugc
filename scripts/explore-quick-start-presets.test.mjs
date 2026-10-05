import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const element = (type, props, key) => ({ type, props, key });
function load(path, imports = {}, env = {}) {
  const exported = {};
  vm.runInNewContext(ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports: exported, process: { env }, URLSearchParams,
    require: name => {
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency ${name}`);
      return imports[name];
    },
  });
  return exported;
}

const generation = load("lib/ai-studio/generation-settings.ts", {}, { NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE: "true" });
const presets = load("lib/explore/launch-presets.ts", { "../ai-studio/generation-settings": generation });
const rollout = load("lib/explore/workflow-generation-rollout.ts");
const expected = [
  ["seedance", "/explore/create-hook", "seedance_2_5", null],
  ["omni", "/explore/recreate", "google_omni", null],
  ["trending", "/dashboard", null, null],
  ["audio", "/audio-generation", null, null],
  ["kling", "/explore/create-hook", "kling_3_0", "10"],
  ["app-demo", "/explore/creator-phone", null, null],
];

test("all six shortcuts encode their approved workflow/model/duration in live and preview links", () => {
  assert.equal(presets.EXPLORE_QUICK_STARTS.length, expected.length);
  for (const [id, destination, model, duration] of expected) {
    const shortcut = presets.EXPLORE_QUICK_STARTS.find(item => item.id === id);
    for (const preview of [false, true]) {
      const url = new URL(presets.getQuickStartHref(shortcut, preview), "https://getugcpilot.com");
      assert.equal(url.pathname, destination);
      assert.equal(url.searchParams.get("model"), model);
      assert.equal(url.searchParams.get("duration"), duration);
      assert.equal(url.searchParams.get("preview"), preview ? "1" : null);
      if (preview) assert.equal(presets.getQuickStartPreviewHref(shortcut), url.pathname + url.search);
    }
  }
});

test("only allowlisted model IDs are accepted; missing, duplicate and malformed inputs preserve normal defaults", () => {
  for (const model of generation.AI_STUDIO_VIDEO_MODELS) assert.equal(presets.parseWorkflowModel(model), model);
  for (const value of [undefined, "", "unknown", "Seedance 2.5", ["google_omni"], ["seedance_2_5", "kling_3_0"], "javascript:alert(1)"]) {
    assert.equal(presets.parseWorkflowModel(value), undefined);
  }
});

function hookPage(env = { NODE_ENV: "production", EXPLORE_GENERATION_ENABLED: "true" }) {
  return load("app/explore/create-hook/page.tsx", {
    "next/navigation": { notFound() { throw new Error("NOT_FOUND"); } },
    "@/components/explore/hook-workflow-preview": { HookWorkflowPreview: "hook-workspace" },
    "@/lib/explore/launch-presets": presets,
    "@/lib/explore/workflow-generation-rollout": rollout,
  }, env).default;
}

test("the actual Hook route passes Seedance or Kling with the expected duration, and distinguishes launches", async () => {
  const route = hookPage();
  const results = [];
  for (const id of ["seedance", "kling"]) {
    const shortcut = presets.EXPLORE_QUICK_STARTS.find(item => item.id === id);
    const query = Object.fromEntries(new URL(presets.getQuickStartHref(shortcut), "https://getugcpilot.com").searchParams);
    const tree = await route({ searchParams: Promise.resolve(query) });
    assert.equal(tree.type, "hook-workspace");
    assert.equal(tree.props.initialModel, shortcut.model);
    assert.equal(tree.props.initialDuration, id === "kling" ? 10 : 5);
    assert.equal(tree.props.generationEnabled, true);
    results.push(tree);
  }
  assert.notEqual(results[0].key, results[1].key, "Another named quick start must not inherit the old initialized model");
  const ordinary = await route({ searchParams: Promise.resolve({}) });
  assert.equal(ordinary.props.initialModel, undefined);
  assert.equal(ordinary.props.initialDuration, 5);
});

test("model presets do not enable spending or bypass workflow rollout/preview controls", async () => {
  for (const [env, query] of [
    [{ NODE_ENV: "production" }, { model: "seedance_2_5" }],
    [{ NODE_ENV: "production", EXPLORE_GENERATION_ENABLED: "true" }, { model: "kling_3_0", duration: "10", preview: "1" }],
  ]) {
    assert.equal((await hookPage(env)({ searchParams: Promise.resolve(query) })).props.generationEnabled, false);
  }
});

test("Omni quick start opens Recreate in Video mode, while ordinary and invalid-model links keep Image mode", async () => {
  const page = load("app/explore/recreate/page.tsx", {
    "@/components/explore/recreate-workspace": { RecreateWorkspace: "recreate-workspace" },
    "@/lib/explore/recreate-catalog": { getLocalRecreateReferences: () => [] },
    "@/lib/explore/launch-presets": presets,
  }, { NODE_ENV: "production" }).default;
  for (const [model, mode] of [["google_omni", "videos"], [undefined, "images"], ["unknown", "images"], [["google_omni"], "images"]]) {
    const tree = await page({ searchParams: Promise.resolve({ model }) });
    assert.equal(tree.props.initialGenerationMode, mode);
    assert.equal(tree.props.previewReferences, undefined, "Live requests still use the authenticated catalogue");
  }
  // Execute the actual generation-mode initializer, not a reimplementation.
  const source = read("components/explore/recreate-workspace.tsx");
  const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "[generationMode, setGenerationMode]") initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(initializer);
  const compiled = ts.transpileModule(`exports.mode = ${initializer};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported = {};
  vm.runInNewContext(compiled, { exports: exported, initialGenerationMode: "videos", useState: initial => [initial] });
  assert.equal(exported.mode[0], "videos");
});

test("Recreate's actual Video model initializer consumes OmniFlash from the quick-start URL", () => {
  const source = read("components/video/video-generation-workspace.tsx");
  const ast = ts.createSourceFile("video.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "[model, setModel]") initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(initializer);
  const exported = {};
  const compiled = ts.transpileModule(`exports.model = ${initializer};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const omni = presets.EXPLORE_QUICK_STARTS.find(item => item.id === "omni");
  const searchParams = new URL(presets.getQuickStartHref(omni), "https://getugcpilot.com").searchParams;
  vm.runInNewContext(compiled, { exports: exported, searchParams, useState: initial => [initial()], ...generation });
  assert.equal(exported.model[0], "google_omni");
});

test("the real settings hook starts with Kling/10 seconds and preserves manual changes on rerender", () => {
  const settings = load("lib/explore/workflow-generation-settings.ts", { "../ai-studio/generation-settings": generation });
  let current;
  const hook = load("components/explore/use-workflow-generation-settings.ts", {
    react: { useState(initial) { current ??= initial(); return [current, update => { current = update(current); }]; } },
    "@/lib/explore/workflow-generation-settings": settings,
  }).useWorkflowGenerationSettings;
  let actual = hook(10, "kling_3_0");
  assert.equal(actual.settings.model, "kling_3_0");
  assert.equal(actual.settings.duration, 10);
  assert.equal(actual.dirty, false);
  actual.changeSettings({ model: "google_omni", quantity: 2 });
  actual = hook(10, "kling_3_0");
  assert.equal(actual.settings.model, "google_omni");
  assert.equal(actual.settings.quantity, 2);
  assert.equal(actual.dirty, true);
});

test("named defaults retain existing model availability and duration normalization", () => {
  for (const enabled of [false, true]) {
    const settings = load("lib/explore/workflow-generation-settings.ts", { "../ai-studio/generation-settings": generation }, { NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE: String(enabled) });
    assert.equal(settings.createWorkflowGenerationSettings(5, "seedance_2_5").model, enabled ? "seedance_2_5" : "kling_3_0");
    assert.equal(settings.createWorkflowGenerationSettings(10, "kling_3_0").model, "kling_3_0");
    assert.equal(settings.createWorkflowGenerationSettings(30, "google_omni").duration, 5);
    assert.equal(settings.createWorkflowGenerationSettings().model, enabled ? "seedance_2_5" : "kling_3_0");
  }
});
