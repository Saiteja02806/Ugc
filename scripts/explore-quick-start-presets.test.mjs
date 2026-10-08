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
const expected = [["studio","/ai-studio",null],["trending","/dashboard",null],["library","/library",null],["video","/ai-studio","videos"],["image","/ai-studio","images"],["schedule","/scheduling",null]];
test("all six quick starts open the approved destinations and preserve preview", () => {
  assert.equal(presets.EXPLORE_QUICK_STARTS.length,6);
  for (const [id,pathname,mode] of expected) {
    const shortcut=presets.EXPLORE_QUICK_STARTS.find(item=>item.id===id);
    for (const preview of [false,true]) {
      const url=new URL(preview ? presets.getQuickStartPreviewHref(shortcut) : shortcut.destination,"https://www.getugcpilot.com");
      assert.equal(url.pathname,pathname);assert.equal(url.searchParams.get("mode"),mode);assert.equal(url.searchParams.get("preview"),preview ? "1" : null);
      assert.equal(url.searchParams.has("model"),false);assert.equal(url.searchParams.has("duration"),false);
    }
  }
});
test("the old workflow routes remain hidden under every launch setting", () => {
  for (const file of ["create-hook","creator-phone"]) {
    const route=load("app/explore/"+file+"/page.tsx",{"next/navigation":{notFound(){throw Error("NOT_FOUND")}}},{NODE_ENV:"production",EXPLORE_GENERATION_ENABLED:"true"});
    assert.throws(()=>route.default({searchParams:Promise.resolve({model:"kling_3_0",duration:"10",preview:"1"})}),/NOT_FOUND/);
  }
});
test("legacy Recreate links redirect to the matching format and preserve job recovery", async () => {
  const route=load("app/explore/recreate/page.tsx",{"next/navigation":{redirect(url){throw Error(url)}},"@/worker/src/lib/explore-finishing-contract":{isExploreUuid:value=>typeof value==="string" && /^[0-9a-f-]{36}$/.test(value)}}).default;
  for (const [type,destination] of [["hook","hook-video"],["wall_text","wall-of-text"],["slideshow","slideshows"]]) {
    await assert.rejects(route({searchParams:Promise.resolve({refType:type,refId:"reference"})}),error=>error.message.startsWith("/explore/"+destination+"?") && error.message.includes("refId=reference"));
  }
  await assert.rejects(route({searchParams:Promise.resolve({videoJob:"11111111-1111-4111-8111-111111111111"})}),error=>error.message.startsWith("/ai-studio?") && error.message.includes("mode=videos"));
});
test("workflow video generation initializes Omni without changing ordinary Studio defaults", () => {
  const source=read("components/video/video-generation-workspace.tsx"),ast=ts.createSourceFile("video.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let initializer;function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==="[model, setModel]")initializer=node.initializer.getText(ast);ts.forEachChild(node,visit)}visit(ast);
  assert.ok(initializer);const code=ts.transpileModule("exports.model = "+initializer+";",{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  for (const workflowFormat of ["hook","wall_text",undefined]) {const exported={};vm.runInNewContext(code,{exports:exported,workflow:workflowFormat ? {format:workflowFormat} : undefined,workflowFormat,searchParams:new URLSearchParams(),useState:initial=>[initial()],...generation});assert.equal(exported.model[0],workflowFormat ? "google_omni" : generation.parseAIStudioVideoModel(null))}
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
