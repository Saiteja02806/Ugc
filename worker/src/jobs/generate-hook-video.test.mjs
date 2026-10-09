import assert from "node:assert/strict";
import { mock, test } from "node:test";

const received = [];
const buffer = Buffer.from("fixture-video");
let providerError;
const generate = provider => async params => {
  received.push({ provider, ...params });
  if (providerError) throw providerError;
  await params.onOperationCreated?.("fixture-operation");
  await params.onOperationSucceeded?.("fixture-operation");
  return buffer;
};
for (const [file, name, provider] of [
  ["runway-seedance-video", "generateRunwaySeedanceVideoBuffer", "runway"],
  ["openrouter-seedance-video", "generateOpenRouterSeedanceVideoBuffer", "openrouter"],
  ["openrouter-wan-video", "generateOpenRouterWanVideoBuffer", "openrouter"],
  ["kling-video", "generateKlingVideoBuffer", "kling"],
  ["gemini-omni-video", "generateGeminiOmniVideoBuffer", "gemini"],
  ["runway-video", "generateRunwayHookVideoBuffer", "runway"],
  ["higgsfield-video", "resumeLegacyHiggsfieldVideoBuffer", "higgsfield"],
  ["veo-video", "generateVeoHookVideoBuffer", "veo"],
]) {
  mock.module(new URL(`../../dist/lib/${file}.js`, import.meta.url), { namedExports: { [name]: generate(provider) } });
}
mock.module(new URL("../../dist/logger.js", import.meta.url), { namedExports: { logger: { info() {}, warn() {} } } });
mock.module(new URL("../../dist/lib/storage.js", import.meta.url), { namedExports: {
  getStoredObject: async () => null,
  uploadBufferToStorage: async params => ({ key: params.key, url: "https://owned-media.example.test/video.mp4" }),
} });
mock.module(new URL("../../dist/lib/video-output.js", import.meta.url), { namedExports: { assertGeneratedMp4: value => value } });
const { ProviderRequestNotSubmittedError, ProviderSubmissionUncertainError } = await import("../../dist/lib/generation-provider.js");
const { runGenerateHookVideoJob } = await import("../../dist/jobs/generate-hook-video.js");

function fixture(input = {}, shouldSubmit = true) {
  const events = [];
  const record = name => async value => { events.push({ name, ...value }); };
  return {
    events,
    job: { id: "fixture-job", input_json: {
      aspectRatio: "9:16", durationSeconds: 5, hookIdea: "A creator smiles.",
      model: "google_omni", projectId: "ai-studio", userId: "fixture-user",
      videoId: "fixture-video", promptMode: "direct", ...input,
    } },
    context: { checkpoint: async () => {}, store: {
      reserveGenerationProviderOperation: async value => {
        events.push({ name: "reserve", ...value });
        return { shouldSubmit, operation: { status: "reserved", provider_operation_id: null } };
      },
      markGenerationProviderSubmitted: record("submitted"),
      markGenerationProviderSucceeded: record("succeeded"),
      markGenerationProviderFailed: record("failed"),
      markGenerationProviderSubmissionUncertain: record("uncertain"),
      markGenerationOutputPersisted: record("persisted"),
    } },
  };
}

test("the actual worker preserves long Omni prompts and their final narration", async () => {
  const prompt = "Describe the complete cinematic scene. ".repeat(500) + 'The creator says: "Keep the final dialogue."';
  for (const avatarImageUrl of [undefined, "https://owned-media.example.test/image.png"]) {
    const f = fixture({ hookIdea: prompt, avatarImageUrl });
    const output = await runGenerateHookVideoJob(f.job, f.context);
    assert.equal(output.provider, "gemini");
    assert.equal(received.at(-1).prompt, prompt);
    assert.equal(received.at(-1).referenceImageUrl, avatarImageUrl);
    assert.equal(f.events.find(event => event.name === "submitted").providerOperationId, "fixture-operation");
    assert.equal(f.events.at(-1).name, "persisted");
  }
});

test("other direct paths reject excess text before reserving a provider operation", async () => {
  const before = received.length;
  for (const input of [
    { model: "seedance_2_5", hookIdea: "x".repeat(10001) },
    { referenceVideoUrl: "https://owned-media.example.test/video.mp4", referenceVideoDurationSeconds: 2.8 },
  ]) {
    const f = fixture({ hookIdea: "x".repeat(1001), ...input });
    await assert.rejects(runGenerateHookVideoJob(f.job, f.context), /too long for the selected model/);
    assert.deepEqual(f.events, []);
  }
  assert.equal(received.length, before);
});

test("valid video guidance keeps the complete prompt and routes to Runway", async () => {
  const prompt = "x".repeat(1000);
  const f = fixture({ hookIdea: prompt, referenceVideoUrl: "https://owned-media.example.test/video.mp4", referenceVideoDurationSeconds: 2.8 });
  const output = await runGenerateHookVideoJob(f.job, f.context);
  assert.equal(output.provider, "runway");
  assert.equal(received.at(-1).prompt, prompt);
});

test("Omni over-limit rejection is recorded as a known failure, not an uncertain paid request", async () => {
  const f = fixture();
  providerError = new ProviderRequestNotSubmittedError("Shorten your prompt.");
  try {
    await assert.rejects(runGenerateHookVideoJob(f.job, f.context), ProviderRequestNotSubmittedError);
    assert.equal(f.events.find(event => event.name === "failed").retryAllowed, false);
    assert.equal(f.events.some(event => event.name === "uncertain" || event.name === "submitted"), false);
  } finally { providerError = undefined; }
});

test("uncertain provider operations still cannot submit duplicate videos", async () => {
  const f = fixture({}, false);
  const before = received.length;
  await assert.rejects(runGenerateHookVideoJob(f.job, f.context), ProviderSubmissionUncertainError);
  assert.equal(received.length, before);
});
