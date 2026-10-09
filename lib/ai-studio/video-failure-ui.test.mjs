import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const icon = () => React.createElement("span", { "aria-hidden": "true" });
const primitive = (tag) => function Primitive({ children, ...props }) {
  delete props.variant;
  delete props.size;
  return React.createElement(tag, props, children);
};

// Render the actual components. Only UI primitives/icons are substituted so
// unrelated client-only dependencies do not affect these state contracts.
function loadComponent(path, name, dependencies) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const componentModule = { exports: {} };
  new Function("require", "module", "exports", "React", compiled)(
    (id) => {
      if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
      return dependencies[id];
    }, componentModule, componentModule.exports, React,
  );
  return componentModule.exports[name];
}

const Failure = loadComponent("components/video/video-generation-failure.tsx", "VideoGenerationFailure", {
  react: React,
  "lucide-react": { AlertCircle: icon, ArrowDown: icon, RotateCcw: icon },
  "@/components/ui/button": { Button: primitive("button") },
});
const Results = loadComponent("components/generation/ai-studio-results.tsx", "AiStudioResults", {
  react: React,
  "react-dom": { createPortal: child => child },
  "lucide-react": { AlertCircle: icon, Loader2: icon },
  "@/components/ui/badge": { Badge: primitive("span") },
  "@/components/ui/empty": Object.fromEntries(
    ["Empty", "EmptyDescription", "EmptyHeader", "EmptyMedia", "EmptyTitle"].map((name) => [name, primitive("div")]),
  ),
  "@/components/ui/skeleton": { Skeleton: primitive("div") },
  "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
});
const reason = "The model provider blocked this generation through content moderation. Review your prompt and reference media before starting a new generation.";
const failureProps = {
  title: "Generation blocked", message: reason, jobId: "job-123",
  onEditPrompt: () => {}, onDismiss: () => {},
};
const renderFailure = (props = {}) => renderToStaticMarkup(React.createElement(Failure, { ...failureProps, ...props }));
const renderResults = (props = {}) => renderToStaticMarkup(React.createElement(Results, {
  ariaLabel: "Generated videos", hasResults: false, status: { tone: "error", label: reason },
  failure: React.createElement(Failure, failureProps), ...props,
}, React.createElement("div", null, "Existing video")));

test("moderation shows an accessible readable reason with edit/dismiss, not retry", () => {
  const html = renderFailure();
  assert.match(html, /role="alert"[^>]*aria-labelledby="[^"]+"[^>]*aria-describedby="[^"]+"/);
  assert.match(html, /Generation blocked/);
  assert.match(html, /Review your prompt and reference media/);
  assert.match(html, /Edit prompt/);
  assert.match(html, /Dismiss/);
  assert.match(html, /Job ID[\s\S]*job-123/);
  assert.doesNotMatch(html, /Retry generation|Retrying/);
});

test("retry is opt-in and disabled while pending; recovery actions never submit", () => {
  assert.match(renderFailure({ onRetry: () => {} }), /Retry generation/);
  const pending = renderFailure({ onRetry: () => {}, retrying: true });
  assert.match(pending, /<button[^>]*type="button"[^>]*disabled=""[^>]*>[\s\S]*?Retrying/);
  assert.doesNotMatch(pending, /type="submit"/);
});

test("long reasons and job IDs wrap instead of forcing viewport overflow", () => {
  const html = renderFailure({ message: "x".repeat(1000), jobId: "y".repeat(200) });
  assert.match(html, /min-w-0/);
  assert.match(html, /\[overflow-wrap:anywhere\]/);
  assert.match(html, /break-all/);
  assert.match(html, /flex-wrap/);
});

test("a video failure replaces the empty placeholder and duplicate badge", () => {
  const html = renderResults();
  assert.equal((html.match(/role="alert"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /No generations yet|Existing video/);
  assert.match(html, /Generation blocked/);
});

test("partial batch failures preserve existing successful results", () => {
  const html = renderResults({ hasResults: true });
  assert.match(html, /Generation blocked/);
  assert.match(html, /Existing video/);
  assert.match(read("components/generation/ai-studio-results.tsx"), /my-auto w-full max-w-xl shrink-0 self-center/);
});

test("results without the opt-in panel retain image, loading and progress behavior", () => {
  const legacy = renderResults({ failure: undefined });
  assert.match(legacy, /No generations yet/);
  assert.match(legacy, /role="alert"/);
  const loading = renderResults({ loading: true });
  assert.match(loading, /Loading generated videos/);
  assert.doesNotMatch(loading, /Generation blocked/);
  const progress = renderResults({ status: { tone: "progress", label: "Creating your video…" } });
  assert.match(progress, /Creating your video/);
  assert.doesNotMatch(progress, /Generation blocked|No generations yet/);
});

test("inline generation progress appears once while results retain busy and error semantics", () => {
  const html = renderToStaticMarkup(React.createElement(Results, {
    ariaLabel: "Generated images", hasResults: true, statusPlacement: "inline",
    status: { tone: "progress", label: "Creating your image" },
  }, React.createElement("div", { role: "status" }, "Creating your image")));
  assert.equal((html.match(/Creating your image/g) ?? []).length, 1);
  assert.equal((html.match(/role="status"/g) ?? []).length, 1);
  assert.match(html, /aria-busy="true"/);
  const failed = renderResults({ hasResults: true, statusPlacement: "inline" });
  assert.match(failed, /Generation blocked/);
  assert.match(failed, /Existing video/);
});

test("workspace retries the displayed eligible job, preserves prompt editing and model routing", () => {
  const workspace = read("components/video/video-generation-workspace.tsx");
  assert.match(workspace, /job\.id === jobId && job\.status === "failed" && Boolean\(job\.error\?\.retryable\)/);
  assert.match(workspace, /failedJob\.error\?\.retryable && !generationLocked/);
  assert.match(workspace, /handleRetryGeneration\(failedJob\.id\)/);
  assert.match(workspace, /querySelector<HTMLTextAreaElement>[\s\S]*?textarea\[name="videoPrompt"\][\s\S]*?\?\.focus\(\)/);
  const composerActions = workspace.split("secondaryActions={")[1].split("settings={")[0];
  assert.doesNotMatch(composerActions, /Dismiss error|handleRetryGeneration/);
  assert.match(composerActions, /handleCancelGeneration/);
  assert.match(workspace, /getAIStudioVideoModelLabel\(value\)/);
  assert.doesNotMatch(workspace, /Runway · Seedance/);
  const preview = read("app/e2e/video-failure-preview/page.tsx");
  assert.match(preview, /process\.env\.NODE_ENV === "production"[\s\S]*?notFound\(\)/);
});

// Exercise the actual workspace's failure JSX with representative job states,
// rather than importing unrelated authenticated workspace hooks.
const workspaceAst = ts.createSourceFile("workspace.tsx", read("components/video/video-generation-workspace.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let failureExpression;
function visit(node) {
  if (ts.isJsxOpeningElement(node) && node.tagName.getText(workspaceAst) === "AiStudioResults") {
    const prop = node.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(workspaceAst) === "failure");
    failureExpression = prop?.initializer?.expression?.getText(workspaceAst);
  }
  ts.forEachChild(node, visit);
}
visit(workspaceAst);
assert.ok(failureExpression);
const failureJsx = ts.transpileModule(`function WorkspaceFailure() { return (${failureExpression}); }`, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
function renderWorkspaceFailures(jobs, options = {}) {
  const context = {
    resultsErrorMessage: jobs[0]?.error?.message ?? "Could not load generation status.",
    isGenerating: false, displayedFailedJobs: jobs, jobQueryError: null, resultsError: null,
    generationLocked: false, retryJob: { isPending: false, variables: undefined },
    focusVideoPrompt: () => {}, dismissFinishedGeneration: () => {}, handleRetryGeneration: () => {},
    ...options,
  };
  const Component = new Function("React", "VideoGenerationFailure", ...Object.keys(context), `${failureJsx}\nreturn WorkspaceFailure;`)(React, Failure, ...Object.values(context));
  return renderToStaticMarkup(React.createElement(Component));
}
const blocked = { id: "blocked-job", error: { code: "PROVIDER_CONTENT_MODERATION", message: reason, retryable: false } };
const recoverable = { id: "recoverable-job", error: { code: "DOWNLOAD_FAILED", message: "Your video could not be downloaded. Try again.", retryable: true } };

test("mixed batch failures show each reason and keep the recoverable sibling's retry", () => {
  const html = renderWorkspaceFailures([blocked, recoverable]);
  assert.equal((html.match(/role="alert"/g) ?? []).length, 2);
  assert.equal((html.match(/Retry generation/g) ?? []).length, 1);
  assert.match(html, /Generation blocked[\s\S]*blocked-job/);
  assert.match(html, /Your video could not be downloaded[\s\S]*Retry generation[\s\S]*recoverable-job/);
  assert.equal((html.match(/Dismiss all/g) ?? []).length, 1);
});

test("locked access, active generation and pending retries preserve recovery guards", () => {
  assert.doesNotMatch(renderWorkspaceFailures([recoverable], { generationLocked: true }), /Retry generation/);
  assert.equal(renderWorkspaceFailures([blocked, recoverable], { isGenerating: true }), "");
  const pending = renderWorkspaceFailures([blocked, recoverable], { retryJob: { isPending: true, variables: recoverable.id } });
  assert.match(pending, /<button[^>]*disabled=""[^>]*>[\s\S]*?Retrying/);
  assert.doesNotMatch(pending, /Retry generation/);
});
