import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const image = read("components/workspace/ugc-chat-workspace.tsx");
const video = read("components/video/video-generation-workspace.tsx");
const composer = read("components/generation/ai-studio-composer.tsx");
const results = read("components/generation/ai-studio-results.tsx");

function functionBody(source, name) {
  const tree = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let body;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) body = node.body?.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(body, "Missing function: " + name);
  return body;
}

test("Recreate previews cannot inherit or submit live jobs even with paid access", () => {
  for (const [source, handler] of [[image, "generateFromPrompt"], [video, "handleSubmit"]]) {
    assert.match(source, /const activeJobIds = recreateView\?\.preview \? \[\] : Array\.from/);
    assert.match(source, /const generationLocked = recreateView\?\.preview === true \|\| accessState !== "pro"/);
    assert.match(source, /toolbar=\{recreateView\?\.preview \? undefined/);
    const submit = functionBody(source, handler);
    assert.ok(submit.indexOf("generationLocked") < submit.indexOf("await fetch("));
  }
  for (const [source, name] of [[image, "loadResults"], [video, "loadGeneratedVideos"]]) {
    const load = functionBody(source, name);
    const guard = load.slice(load.indexOf("if (recreateView?.preview)"), load.indexOf("return;", load.indexOf("if (recreateView?.preview)")));
    assert.match(guard, /setResultsLoading\(false\)/);
    assert.match(guard, /setStoredJobIds\(\[\]\)/);
    assert.ok(load.indexOf("return;", load.indexOf("recreateView?.preview")) < load.indexOf("await getCurrentUserIdToken("));
  }
});

test("newer main session, history and uploaded-reference recovery remain present", () => {
  for (const source of [image, video]) {
    assert.match(source, /foregroundEpochRef/);
    assert.match(source, /foregroundAutoResumeRef/);
    assert.match(source, /historyOwnerIdRef/);
    assert.match(source, /appendAIStudioSessionResultIds/);
    assert.match(source, /activeUserIdRef\.current !== user\.uid/);
  }
  assert.match(image, /mergeAIStudioImageHistory/);
  assert.match(image, /getVisibleAIStudioImages/);
  assert.match(image, /<ImagePreviewDialog/);
  assert.match(image, /value === "gemini_3_pro" \? "Gemini 3 Pro"/);
  assert.match(video, /<ReferenceFilesUpload/);
  assert.match(video, /isAIStudioVideoResolutionSupported/);
  assert.match(video, /getAIStudioVideoDurations/);
  for (const field of ["referenceImageUrls", "referenceAudioUrls", "referenceAudioAssetIds", "resolution", "referenceVideoUrl"]) {
    assert.match(functionBody(video, "handleSubmit"), new RegExp("\\b" + field + "\\b"));
  }
});

test("compact presentation is opt-in and keeps newer default composer controls", () => {
  for (const pattern of [/compact = false/, /hasAttachments = true/, /showPromptHint = true/,
    /unifiedMaxWidthClassName/, /compact \? 96 : layout === "unified" \? 64 : 128/,
    /!compact && layout === "unified" && leadingControl && !hasAttachments/,
    /leadingControl && \(!compact \|\| hasAttachments\)/,
    /\{!hasAttachments \? leadingControl : null\}/]) assert.match(composer, pattern);
  assert.match(composer, /disabled=\{generateDisabled \|\| promptTooLong\}/);
  assert.match(composer, /onSubmit=\{onSubmit\}/);
  assert.match(composer, /motion-reduce:transition-none/);
});

test("custom Recreate empty content cannot replace progress, loading or failure output", () => {
  const empty = results.indexOf(") : emptyContent ? (");
  assert.ok(empty > results.indexOf(") : showFailure ? ("));
  assert.ok(empty > results.indexOf(') : status?.tone === "progress" ? ('));
  assert.match(results, /showFailure && hasResults/);
  assert.match(results, /scrollToLatestKey/);
  assert.match(results, /aria-busy=\{loading \|\| status\?\.tone === "progress"\}/);
});

test("selected image references use the existing trusted storage API contract", () => {
  assert.match(image, /referenceImageUrl: referenceImage\?\.asset\.url \?\? recreateView\?\.referenceImageUrl \?\? null/);
  assert.match(image, /submissionKeyRef\.current = null;\s*\}, \[recreateView\?\.referenceImageUrl\]\)/);
  const api = read("lib/ai-studio/image-generation-api.ts");
  assert.match(api, /cleanTrustedHttpsUrl\(body\?\.referenceImageUrl\)/);
  assert.match(api, /isTrustedStorageUrl/);
  assert.match(api, /reserveBillingCredits/);
});

test("navigation retires Create Content, keeps other main routes and exposes the now-integrated Audio shortcut", () => {
  const sidebar = read("components/layout/app-sidebar.tsx");
  assert.doesNotMatch(sidebar, /key: "create-content"|href: "\/create-content"/);
  for (const path of ["/dashboard", "/ai-studio?mode=images", "/avatars", "/analytics", "/library?tab=posts", "/scheduling"]) {
    assert.ok(sidebar.includes(`href: "${path}"`));
  }
  assert.match(sidebar, /href: "\/explore",\s+icon: "explore"/);
  assert.doesNotMatch(read("components/explore/explore-workspace.tsx"), /shortcut\.id !== "audio"/);
  assert.match(read("lib/explore/launch-presets.ts"), /id: "audio"[^\n]*destination: "\/audio-generation"/);
  assert.match(read("app/audio-generation/page.tsx"), /AudioGenerationWorkspace/);
  assert.match(read("worker/src/jobs/index.ts"), /job.job_type === "generate_audio"/);
  assert.match(read("proxy.ts"), /"\/explore"/);
  assert.match(read("proxy.ts"), /"\/audio-generation"/);
  assert.match(read("proxy.ts"), /shouldBlockDeploymentRoute/);
});

test("both retired Create Content routes stop rendering in every environment without a loading flash", () => {
  for (const file of ["app/create-content/page.tsx", "app/e2e/create-content-preview/page.tsx"]) {
    for (const environment of ["development", "test", "production"]) {
      const exported = {};
      const source = read(file);
      vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
        exports: exported,
        process: { env: { NODE_ENV: environment } },
        require(name) { assert.equal(name, "next/navigation"); return { notFound() { throw new Error("NOT_FOUND"); } }; },
      });
      assert.throws(() => exported.default(), /NOT_FOUND/);
      assert.doesNotMatch(source, /CreateContentWorkspace/);
    }
  }
  assert.match(read("app/create-content/loading.tsx"), /return null/);
  assert.doesNotMatch(read("app/create-content/loading.tsx"), /WorkspaceContentLoading/);
});
