import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import sharp from "sharp";
import { ProviderOperationPollingError, ProviderOperationTerminalError, ProviderSubmissionUncertainError } from "../../dist/lib/generation-provider.js";
import { RetryableJobError } from "../../dist/retryable-job-error.js";

const source = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#cca077" } }).png().toBuffer();
let events;
let providerError;
let accepted;
let storedOutput;
let failTaskPersistence;

mock.module("../../dist/lib/gemini-image.js", { namedExports: {
  GEMINI_3_PRO_IMAGE_MODEL: "gemini-3-pro-image",
  generateGemini3ProImageBuffer: async (params) => {
    events.push(["google-pro", params]);
    if (!params.providerOperationId) {
      accepted = true;
      await params.onOperationCreated("google-image-interaction");
    }
    if (providerError) throw providerError;
    await params.onOperationSucceeded(params.providerOperationId ?? "google-image-interaction");
    return source;
  },
  generateGeminiImageBuffer: async () => { events.push(["legacy-gemini"]); return { buffer: source, model: "gemini-3.1-flash-image", requestId: "legacy-task" }; },
} });
mock.module("../../dist/lib/openai-image.js", { namedExports: {
  generateOpenAiImageBuffer: async () => { events.push(["openai"]); return { buffer: source, model: "gpt-image", requestId: "gpt-task" }; },
} });
mock.module("../../dist/lib/storage.js", { namedExports: {
  getStoredObject: async () => storedOutput,
  downloadStoredObjectBuffer: async (key) => { events.push(["read-staging", key]); return source; },
  uploadBufferToStorage: async (params) => {
    events.push(["upload", params]);
    return { key: params.key, url: `https://storage.example.com/${params.key}` };
  },
} });
const { runGenerateImageJob } = await import("../../dist/jobs/generate-image.js");

beforeEach(() => {
  events = []; providerError = null; accepted = false; storedOutput = null; failTaskPersistence = false;
});
function job(model = "gemini_3_pro") {
  return { id: "job-one", user_id: "user-one", project_id: "ai-studio", input_json: {
    model, aspectRatio: "9:16", generationId: "generation-one", prompt: "A cup on a table.",
    referenceImageUrl: "https://storage.example.com/reference.png",
  } };
}
function context(operation = { status: "reserved", metadata: {}, provider_operation_id: null, output_url: null }) {
  return {
    checkpoint: async () => {},
    store: {
      reserveGenerationProviderOperation: async (params) => { events.push(["reserve", params]); return { operation, shouldSubmit: operation.status === "reserved" }; },
      markGenerationProviderSubmitted: async (params) => {
        if (failTaskPersistence) throw new Error("Database unavailable");
        events.push(["submitted", params]);
      },
      markGenerationProviderSucceeded: async (params) => { events.push(["succeeded", params]); },
      markGenerationProviderFailed: async (params) => { events.push(["failed", params]); },
      markGenerationProviderSubmissionUncertain: async (params) => { events.push(["uncertain", params]); },
      markGenerationOutputPersisted: async (params) => { events.push(["output", params]); },
    },
  };
}

test("Gemini 3 Pro goes through Google and produces the existing exact image output", async () => {
  const output = await runGenerateImageJob(job(), context());
  assert.equal(accepted, true);
  assert.equal(output.provider, "gemini");
  assert.equal(output.model, "gemini_3_pro");
  assert.equal(output.width, 720);
  assert.equal(output.height, 1280);
  assert.equal(events[0][1].provider, "gemini");
  const params = events.find(([event]) => event === "google-pro")[1];
  assert.equal(params.prompt, "A cup on a table.");
  assert.equal(params.referenceImageUrl, job().input_json.referenceImageUrl);
  const uploads = events.filter(([event]) => event === "upload").map(([, value]) => value);
  assert.equal(uploads[0].cacheControl, "private, max-age=86400");
  assert.equal(uploads[1].key, "images/generated/user-one/ai-studio/generation-one.png");
  const dimensions = await sharp(uploads[1].buffer).metadata();
  assert.equal(dimensions.width, 720);
  assert.equal(dimensions.height, 1280);
  const saved = events.filter(([event]) => event === "succeeded").at(-1)[1];
  assert.equal(saved.providerOperationId, "google-image-interaction");
  assert.equal(saved.metadata.model, "gemini-3-pro-image");
});

test("the image worker passes long instructions to Gemini without truncation", async () => {
  const inputJob = job();
  const prompt = `Scene details.\n${"Keep the creator identity and natural daylight. ".repeat(500)}\nUse the final composition instruction.`;
  inputJob.input_json.prompt = prompt;
  await runGenerateImageJob(inputJob, context());
  assert.equal(events.find(([event]) => event === "google-pro")[1].prompt, prompt);
});

test("accepted operations resume with their saved interaction rather than paying again", async () => {
  await runGenerateImageJob(job(), context({ status: "provider_succeeded", metadata: {}, provider_operation_id: "saved-task", output_url: null }));
  assert.equal(accepted, false);
  const params = events.find(([event]) => event === "google-pro")[1];
  assert.equal(params.providerOperationId, "saved-task");
  assert.equal(events.some(([event]) => event === "submitted"), false);
});

test("staged images recover without calling any provider", async () => {
  await runGenerateImageJob(job(), context({ status: "provider_succeeded", metadata: { stagingKey: "saved-source.png" }, provider_operation_id: "saved-task", output_url: null }));
  assert.equal(events.some(([event]) => event === "google-pro"), false);
  assert.deepEqual(events.find(([event]) => event === "read-staging"), ["read-staging", "saved-source.png"]);
});

test("moderated generations are recorded as terminal without enabling retry", async () => {
  providerError = new ProviderOperationTerminalError("Blocked by provider", { failureCode: "INPUT_PREPROCESSING.SAFETY.THIRD_PARTY" });
  await assert.rejects(runGenerateImageJob(job(), context()), ProviderOperationTerminalError);
  const failure = events.find(([event]) => event === "failed")[1];
  assert.equal(failure.errorCode, "PROVIDER_CONTENT_MODERATION");
  assert.equal(failure.retryAllowed, false);
  assert.equal(events.some(([event]) => event === "upload"), false);
});

test("download and polling failures after acceptance preserve a recoverable paid request", async () => {
  providerError = new ProviderOperationPollingError("Temporary output download failure");
  await assert.rejects(runGenerateImageJob(job(), context()), (error) => {
    assert.ok(error instanceof RetryableJobError);
    assert.equal(error.code, "provider_operation_pending");
    return true;
  });
  assert.equal(events.some(([event]) => event === "submitted"), true);
  assert.equal(events.some(([event]) => event === "uncertain" || event === "failed"), false);
});

test("loss of task-ID persistence stops an uncertain request instead of submitting it again", async () => {
  failTaskPersistence = true;
  await assert.rejects(runGenerateImageJob(job(), context()), ProviderSubmissionUncertainError);
  assert.equal(events.some(([event]) => event === "uncertain"), true);
  assert.equal(events.filter(([event]) => event === "google-pro").length, 1);
});

test("existing final output returns without another reservation or provider request", async () => {
  storedOutput = { key: "saved.png", url: "https://storage.example.com/saved.png" };
  const output = await runGenerateImageJob(job(), context());
  assert.equal(output.provider, "gemini");
  assert.equal(output.url, storedOutput.url);
  assert.deepEqual(events, []);
});

test("previous Nano Banana jobs keep Gemini and GPT Image jobs keep OpenAI", async () => {
  const legacy = await runGenerateImageJob(job("nano_banana_2"), context());
  assert.equal(legacy.provider, "gemini");
  assert.equal(events.some(([event]) => event === "legacy-gemini"), true);
  assert.equal(events.some(([event]) => event === "google-pro"), false);
  const gpt = await runGenerateImageJob(job("gpt_image"), context());
  assert.equal(gpt.provider, "openai");
  assert.equal(events.some(([event]) => event === "openai"), true);
});

test("unrecognized models fail before reservation or billing a provider", async () => {
  await assert.rejects(runGenerateImageJob(job("unsupported-model"), context()), /unsupported image model/);
  assert.deepEqual(events, []);
});
