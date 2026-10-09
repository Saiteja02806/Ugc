import assert from "node:assert/strict";
import { mock, test } from "node:test";

const requests = [];
let tokenCount = 1200;
let modelLimit = 131072;
let countError;
const result = {
  id: "omni-operation", status: "completed",
  output_video: { data: Buffer.from("fixture-video").toString("base64") },
};
mock.module("@google/genai", { namedExports: {
  GoogleGenAI: class {
    models = {
      get: async params => { requests.push({ type: "model", ...params }); return { inputTokenLimit: modelLimit }; },
      countTokens: async params => {
        requests.push({ type: "count", ...params });
        if (countError) throw countError;
        return { totalTokens: tokenCount };
      },
    };
    interactions = {
      create: async params => { requests.push({ type: "create", ...params }); return result; },
      get: async id => { requests.push({ type: "resume", id }); return result; },
    };
  },
} });
mock.module(new URL("../../dist/lib/provider-env.js", import.meta.url), { namedExports: {
  getRequiredProviderEnv: () => "fixture-api-key",
} });
const { ProviderRequestNotSubmittedError } = await import("../../dist/lib/generation-provider.js");
const { generateGeminiOmniVideoBuffer } = await import("../../dist/lib/gemini-omni-video.js");
const params = prompt => ({ aspectRatio: "9:16", durationSeconds: 5, prompt });
const creates = () => requests.filter(request => request.type === "create").length;

test("long prompts reach Omni intact and use the configured model's live input limit", async () => {
  const previousModel = process.env.GEMINI_OMNI_MODEL;
  process.env.GEMINI_OMNI_MODEL = "gemini-omni-1.1-flash";
  try {
    const prompt = "Precise character, dialogue and camera details. ".repeat(300) + "Final line: keep this detail.";
    await generateGeminiOmniVideoBuffer(params(prompt));
    const count = requests.findLast(request => request.type === "count");
    assert.equal(count.contents, prompt);
    assert.equal(count.model, "gemini-omni-1.1-flash");
    const submitted = requests.at(-1);
    assert.equal(submitted.type, "create");
    assert.equal(submitted.input, prompt);
    assert.equal(submitted.model, count.model);
  } finally {
    if (previousModel === undefined) delete process.env.GEMINI_OMNI_MODEL;
    else process.env.GEMINI_OMNI_MODEL = previousModel;
  }
});

test("reference images are included in token counting and the complete generation input", async () => {
  const originalFetch = globalThis.fetch;
  const data = Buffer.from("fixture-image");
  globalThis.fetch = async () => new Response(data, { headers: { "Content-Type": "image/png" } });
  try {
    await generateGeminiOmniVideoBuffer({ ...params("A creator smiles."), referenceImageUrl: "https://owned-media.example.test/image.png" });
    const count = requests.findLast(request => request.type === "count");
    assert.deepEqual(count.contents, [{ inlineData: { data: data.toString("base64"), mimeType: "image/png" } }, { text: "A creator smiles." }]);
    assert.deepEqual(requests.at(-1).input, [{ type: "image", data: data.toString("base64"), mime_type: "image/png" }, { type: "text", text: "A creator smiles." }]);
  } finally { globalThis.fetch = originalFetch; }
});

test("the current API limit is accepted exactly and an excess token prevents a paid submission", async () => {
  tokenCount = modelLimit;
  await generateGeminiOmniVideoBuffer(params("Exactly at the limit."));
  const before = creates();
  tokenCount += 1;
  try {
    await assert.rejects(generateGeminiOmniVideoBuffer(params("Above the limit.")), error => {
      assert.ok(error instanceof ProviderRequestNotSubmittedError);
      assert.equal(error.retryable, false);
      assert.match(error.message, /131,072 input tokens/);
      return true;
    });
    assert.equal(creates(), before);
  } finally { tokenCount = 1200; }
});

test("model metadata changes are respected without a hard-coded token or character ceiling", async () => {
  modelLimit = 1048576;
  tokenCount = 131073;
  try { await generateGeminiOmniVideoBuffer(params("A prompt within the updated model window.")); }
  finally { modelLimit = 131072; tokenCount = 1200; }
});

test("a token-count outage is safely retryable and does not submit a video", async () => {
  const before = creates();
  countError = new Error("Provider unavailable");
  try {
    await assert.rejects(generateGeminiOmniVideoBuffer(params("A creator smiles.")), error => error instanceof ProviderRequestNotSubmittedError && error.retryable);
    assert.equal(creates(), before);
  } finally { countError = undefined; }
});

test("missing token metadata prevents submission instead of guessing the model limit", async () => {
  const before = creates();
  modelLimit = undefined;
  try {
    await assert.rejects(generateGeminiOmniVideoBuffer(params("A creator smiles.")), ProviderRequestNotSubmittedError);
    assert.equal(creates(), before);
  } finally { modelLimit = 131072; }
});

test("resuming an existing video operation skips preflight and cannot submit a duplicate", async () => {
  const before = requests.length;
  countError = new Error("Preflight unavailable");
  try {
    await generateGeminiOmniVideoBuffer({ ...params("Saved prompt."), providerOperationId: "saved-operation" });
    assert.deepEqual(requests.slice(before), [{ type: "resume", id: "saved-operation" }]);
  } finally { countError = undefined; }
});
