import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { getPublicBackgroundJob } from "../lib/jobs/background-job-contract.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function load(path, imports) {
  const exported = {};
  vm.runInNewContext(ts.transpileModule(read(path), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports: exported, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  return exported;
}

const failedJob = {
  id: "fixture-job", userId: "fixture-owner", jobType: "generate_hook_video", projectId: "ai-studio",
  status: "failed", attemptCount: 1, maxAttempts: 3, errorCode: "JOB_FAILED",
  errorMessage: `HTTP 400: ${JSON.stringify({ error: {
    code: "InputImageSensitiveContentDetected.PrivacyInformation",
    message: "Input image may contain real person. token=private-secret request-private",
  } })}`,
};

test("the authenticated job-status API returns the safe portrait reason for an existing failed job", async () => {
  const { GET } = load("app/api/jobs/[jobId]/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@/lib/firebase/server-auth": { requireFirebaseUser: async () => ({ uid: "fixture-owner" }) },
    "@/lib/jobs/background-job-contract": { getPublicBackgroundJob },
    "@/lib/jobs/background-jobs": { getBackgroundJobForUser: async (scope) => {
      assert.equal(scope.jobId, failedJob.id);
      assert.equal(scope.userId, failedJob.userId);
      return failedJob;
    } },
  });
  const response = await GET(new Request(`https://www.getugcpilot.com/api/jobs/${failedJob.id}`), {
    params: Promise.resolve({ jobId: failedJob.id }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json();
  assert.equal(body.job.error.code, "PROVIDER_REFERENCE_IMAGE_REJECTED");
  assert.equal(body.job.error.retryable, false);
  assert.match(body.job.error.message, /reference image.*may contain a real person's face/);
  assert.doesNotMatch(JSON.stringify(body), /private-secret|request-private|InputImageSensitiveContentDetected|cause could not be identified/);
});

test("both Explore workflows render the actual public rejection as an alert instead of an empty workspace", () => {
  const { WorkflowPreviewCanvas } = load("components/explore/workflow-preview-canvas.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "@/components/explore/hook-workflow-media-controls": { WorkflowMediaPlayer() { throw new Error("No video exists for this failed request"); } },
    "@/components/ui/button": {},
    "@/components/explore/workflow-creation.module.css": { default: {} },
  });
  const generation = { busy: false, results: [], error: getPublicBackgroundJob(failedJob).error.message };
  for (const kind of ["hook", "phone"]) {
    const html = renderToStaticMarkup(createElement(WorkflowPreviewCanvas, { kind, generation }));
    assert.match(html, /role="alert"/);
    assert.match(html, /reference image was rejected/);
    assert.match(html, /may contain a real person/);
    assert.match(html, /No video was generated/);
    assert.doesNotMatch(html, /<video|Create your first|private-secret|request-private|cause could not be identified/);
  }
});
