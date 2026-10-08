import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, URL, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  return exports;
}
const requests = [], operations = [], stored = [];
const buffer = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50]);
const provider = name => async params => { requests.push({ provider: name, ...params }); await params.onOperationCreated("operation-fixture"); await params.onOperationSucceeded("operation-fixture", "https://output.test/video.mp4"); return buffer; };
const { runGenerateHookVideoJob } = load("worker/src/jobs/generate-hook-video.ts", {
  "../lib/private-media.js": { resolveOwnedPrivateMediaUrl: async url => url },
  "../logger.js": { logger: { info() {} } },
  "../lib/generation-provider.js": { assertProviderOperationCanContinue: () => "submit", createGenerationRequestFingerprint: value => JSON.stringify(value),
    persistProviderSubmissionFailure: () => assert.fail("Unexpected provider failure"), toProviderPollingRetry: error => error,
    ProviderOperationTerminalError: class extends Error {}, ProviderRequestNotSubmittedError: class extends Error {}, ProviderSubmissionUncertainError: class extends Error {}, },
  "../lib/hook-video-provider.js": { resolveHookVideoProvider: () => "gemini" },
  "../lib/runway-seedance-video.js": { generateRunwaySeedanceVideoBuffer: provider("runway-seedance") },
  "../lib/openrouter-seedance-video.js": { generateOpenRouterSeedanceVideoBuffer: provider("openrouter") },
  "../lib/kling-video.js": { generateKlingVideoBuffer: provider("kling") },
  "../lib/runway-video.js": { generateRunwayHookVideoBuffer: provider("runway") },
  "../lib/gemini-omni-video.js": { generateGeminiOmniVideoBuffer: provider("gemini") },
  "../lib/higgsfield-video.js": { resumeLegacyHiggsfieldVideoBuffer: provider("higgsfield") },
  "../lib/veo-video.js": { generateVeoHookVideoBuffer: provider("veo") },
  "../lib/storage.js": { getStoredObject: async () => null, uploadBufferToStorage: async input => { stored.push(input); return { key: input.key, url: "https://owned.test/final.mp4" }; } },
  "../lib/ugc-video-prompt.js": load("worker/src/lib/ugc-video-prompt.ts"),
  "../lib/video-output.js": load("worker/src/lib/video-output.ts"),
  "../lib/video-provider-fallback.js": { shouldFallbackToRunway: () => false },
  "../retryable-job-error.js": { RetryableJobError: class extends Error {} },
});
const context = { checkpoint: async () => {}, store: {
  getGenerationProviderOperation: async () => null,
  reserveGenerationProviderOperation: async input => { operations.push(input); return {}; },
  markGenerationProviderSubmitted: async () => {}, markGenerationProviderSucceeded: async () => {},
  markGenerationOutputPersisted: async () => {},
} };

test("Hook and Wall generation use the selected provider and preserve direct dialogue and background instructions", async () => {
  for (const exploreFormat of ["hook", "wall_text"]) for (const kind of ["prompt", "image", "video"]) {
    const prompt = exploreFormat === "hook" ? 'The creator says “This is my exact line.”' : "A slow sunset pan. Do not add text, captions, subtitles, letters, or logos.";
    const input = { exploreFormat, aspectRatio: "16:9", durationSeconds: kind === "video" ? 3 : 5, hookIdea: prompt, model: "google_omni", promptMode: "direct",
      projectId: "ai-studio", userId: "owner", videoId: `${exploreFormat}-${kind}`,
      ...(kind === "image" ? { avatarImageUrl: "https://owned.test/reference.png" } : {}),
      ...(kind === "video" ? { referenceVideoUrl: "https://owned.test/reference.mp4", referenceVideoDurationSeconds: 2.8 } : {}),
    };
    const output = await runGenerateHookVideoJob({ id: `${exploreFormat}-${kind}`, input_json: input }, context);
    const request = requests.at(-1);
    assert.equal(request.provider, kind === "video" ? "runway" : "gemini");
    assert.equal(request.prompt, prompt);
    assert.equal(request.aspectRatio, "16:9");
    assert.equal(request.referenceImageUrl, input.avatarImageUrl);
    assert.equal(request.referenceVideoUrl, input.referenceVideoUrl);
    assert.equal(output.durationSeconds, kind === "video" ? 2.8 : 5);
    assert.equal(output.ratio, "16:9"); assert.equal(output.ok, true);
    assert.equal(operations.at(-1).provider, request.provider);
    assert.equal(stored.at(-1).contentType, "video/mp4");
  }
});
