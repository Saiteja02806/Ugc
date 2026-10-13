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
      create: async params => {
        if (params.generation_config?.video_config?.task === "edit") {
          assert.equal(params.response_format.aspect_ratio, undefined, "Google edit requests must inherit source framing");
          assert.equal(params.response_format.duration, undefined, "Google edit requests must inherit source timing");
        }
        requests.push({ type: "create", ...params }); return result;
      },
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
function clip(seconds) {
  const bytes = Buffer.alloc(60);
  bytes.writeUInt32BE(24, 0); bytes.write("ftypmp42", 4);
  bytes.writeUInt32BE(36, 24); bytes.write("moov", 28);
  bytes.writeUInt32BE(28, 32); bytes.write("mvhd", 36);
  bytes.writeUInt32BE(1000, 52); bytes.writeUInt32BE(seconds * 1000, 56);
  return bytes;
}

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
    assert.equal(submitted.response_format.aspect_ratio, "9:16");
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

test("video edits submit actual video bytes and the identity image, with explicit source and reference roles", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => new Response(Buffer.from(url.endsWith(".mp4") ? "source-video" : "identity-image"), {
    headers: { "Content-Type": url.endsWith(".mp4") ? "video/mp4" : "image/png" },
  });
  try {
    await generateGeminiOmniVideoBuffer({ ...params("Remove text and swap the face. Copy the actions."),
      referenceVideoUrl: "https://owned-media.example.test/source.mp4", referenceVideoDurationSeconds: 5, referenceVideoMode: "edit",
      referenceImageUrl: "https://owned-media.example.test/identity.png" });
    const submitted = requests.at(-1);
    assert.equal(submitted.input[0].type, "video"); assert.equal(Buffer.from(submitted.input[0].data, "base64").toString(), "source-video");
    assert.equal(submitted.input[1].type, "image"); assert.equal(Buffer.from(submitted.input[1].data, "base64").toString(), "identity-image");
    assert.match(submitted.input[2].text, /Sources <VIDEO_0>@Video1/);
    assert.match(submitted.input[2].text, /References <IMAGE_REF_0>@Image1/);
    assert.ok(submitted.input[2].text.endsWith("Remove text and swap the face. Copy the actions."));
    assert.equal(submitted.generation_config.video_config.task, "edit");
    assert.equal(submitted.response_format.duration, undefined, "Editing must not shorten or extend the source timeline");
    assert.equal(submitted.response_format.aspect_ratio, undefined, "Editing preserves the source aspect ratio");
    const count = requests.findLast(request => request.type === "count");
    assert.ok(count.contents.some(part => part.inlineData?.mimeType === "video/mp4"));
    assert.ok(count.contents.some(part => part.inlineData?.mimeType === "image/png"));
  } finally { globalThis.fetch = originalFetch; }
});

test("a missing, long or inaccessible source video never falls back to image-only generation", async () => {
  const before = creates(); const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Missing", { status: 404 });
  try {
    for (const source of [
      { referenceVideoMode: "edit" },
      { referenceVideoMode: "edit", referenceVideoUrl: "https://owned.test/missing.mp4", referenceVideoDurationSeconds: 11 },
      { referenceVideoMode: "edit", referenceVideoUrl: "https://owned.test/missing.mp4", referenceVideoDurationSeconds: 5 },
    ]) await assert.rejects(generateGeminiOmniVideoBuffer({ ...params("Copy the actions."), ...source }), ProviderRequestNotSubmittedError);
    assert.equal(creates(), before);
  } finally { globalThis.fetch = originalFetch; }
});

test("video edits preserve every selected appearance image in model input and token counting", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => new Response(Buffer.from(url.endsWith(".mp4") ? "reference-video" : url), {
    headers: { "Content-Type": url.endsWith(".mp4") ? "video/mp4" : "image/png" },
  });
  try {
    const images = ["https://owned.test/person.png", "https://owned.test/product.png", "https://owned.test/setting.png"];
    await generateGeminiOmniVideoBuffer({ ...params("Keep the actions and use the supplied person and product."), referenceVideoUrl: "https://owned.test/source.mp4", referenceVideoDurationSeconds: 5, referenceVideoMode: "edit", referenceImageUrls: images });
    const submitted = requests.at(-1);
    assert.equal(submitted.input[0].type, "video");
    assert.deepEqual(submitted.input.filter(part => part.type === "image").map(part => Buffer.from(part.data, "base64").toString()), images);
    assert.match(submitted.input.at(-1).text, /<IMAGE_REF_2>@Image3/);
    const count = requests.findLast(request => request.type === "count");
    assert.equal(count.contents.filter(part => part.inlineData?.mimeType === "image/png").length, images.length);
  } finally { globalThis.fetch = originalFetch; }
});

test("a ten-second MP4 is sent intact with its image, and false source-duration metadata cannot submit a paid edit", async () => {
  const originalFetch = globalThis.fetch;
  let source = clip(10);
  globalThis.fetch = async url => new Response(url.endsWith(".mp4") ? source : Buffer.from("appearance"), {
    headers: { "Content-Type": url.endsWith(".mp4") ? "video/mp4" : "image/png" },
  });
  try {
    const input = { ...params("Change the appearance and preserve all ten seconds."), referenceVideoUrl: "https://owned.test/source.mp4",
      referenceVideoDurationSeconds: 10, referenceVideoMode: "edit", referenceImageUrl: "https://owned.test/image.png" };
    await generateGeminiOmniVideoBuffer(input);
    const submitted = requests.at(-1);
    assert.deepEqual(Buffer.from(submitted.input[0].data, "base64"), source);
    assert.equal(submitted.input[1].type, "image");
    assert.equal(submitted.generation_config.video_config.task, "edit");
    const before = creates();
    for (const seconds of [3, 11]) {
      source = clip(seconds);
      await assert.rejects(generateGeminiOmniVideoBuffer(input), ProviderRequestNotSubmittedError);
    }
    assert.equal(creates(), before);
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
