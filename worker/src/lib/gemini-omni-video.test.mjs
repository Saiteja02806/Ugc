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

test("approved starting images use explicit first-frame binding and image-to-video without a source clip", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(Buffer.from("approved-scene"), { headers: { "Content-Type": "image/png" } });
  try {
    await generateGeminiOmniVideoBuffer({ ...params("Raise the eyebrows."), durationSeconds: 8, resolution: "720p",
      startingFrameImageUrl: "https://owned-media.example.test/approved.png" });
    const submitted = requests.at(-1);
    assert.equal(submitted.generation_config.video_config.task, "image_to_video");
    assert.equal(submitted.input.length, 2); assert.equal(submitted.input[0].type, "image");
    assert.equal(Buffer.from(submitted.input[0].data, "base64").toString(), "approved-scene");
    assert.match(submitted.input[1].text, /^\[# Sources <FIRST_FRAME>@Image1\]/);
    assert.equal(submitted.response_format.duration, "8s");
    const before = creates();
    for (const patch of [{ durationSeconds: 11 }, { referenceImageUrl: "https://owned-media.example.test/person.png" }, { referenceVideoMode: "edit" }]) {
      await assert.rejects(generateGeminiOmniVideoBuffer({ ...params("Smile."), startingFrameImageUrl: "https://owned-media.example.test/approved.png", ...patch }), ProviderRequestNotSubmittedError);
    }
    assert.equal(creates(), before);
    await generateGeminiOmniVideoBuffer({ ...params("Smile."), startingFrameImageUrl: "expired-url", providerOperationId: "already-accepted" });
    assert.equal(requests.at(-1).type, "resume"); assert.equal(creates(), before);
  } finally { globalThis.fetch = originalFetch; }
});

test("three-second Omni animation keeps the literal first frame and every optional face in separate roles", async () => {
  const originalFetch = globalThis.fetch;
  let downloads = 0;
  globalThis.fetch = async url => { downloads++; return new Response(Buffer.from(url), { headers: { "Content-Type": "image/png" } }); };
  const frame = "https://owned.test/start.png", faces = ["https://owned.test/main.png", "https://owned.test/support.png"];
  try {
    await generateGeminiOmniVideoBuffer({ ...params("Turn the head naturally."), durationSeconds: 3, resolution: "720p", startingFrameImageUrl: frame, referenceImageUrls: faces });
    const submitted = requests.at(-1), prompt = submitted.input.at(-1).text;
    assert.equal(submitted.response_format.duration, "3s"); assert.equal(submitted.generation_config.video_config.task, "image_to_video");
    assert.deepEqual(submitted.input.filter(part => part.type === "image").map(part => Buffer.from(part.data, "base64").toString()), [frame, ...faces]);
    assert.match(prompt, /^\[# Sources <FIRST_FRAME>@Image1\] \[# References <IMAGE_REF_0>@Image2 <IMAGE_REF_1>@Image3\]/);
    assert.match(prompt, /only as facial appearance guidance/); assert.match(prompt, /not starting or ending frames/);
    assert.equal(requests.findLast(request => request.type === "count").contents.filter(part => part.inlineData).length, 3);
    const before = creates(), beforeDownloads = downloads;
    for (const referenceImageUrls of [[frame], [faces[0], faces[0]], Array.from({ length: 6 }, (_, i) => `https://owned.test/${i}.png`)]) {
      await assert.rejects(generateGeminiOmniVideoBuffer({ ...params("Smile."), startingFrameImageUrl: frame, referenceImageUrls }), ProviderRequestNotSubmittedError);
    }
    assert.equal(creates(), before); assert.equal(downloads, beforeDownloads);
    await generateGeminiOmniVideoBuffer({ ...params("Smile."), startingFrameImageUrl: "expired-frame", referenceImageUrls: ["expired-face"], providerOperationId: "already-accepted-faces" });
    assert.equal(requests.at(-1).type, "resume"); assert.equal(creates(), before); assert.equal(downloads, beforeDownloads);
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

test("ten Omni images reach the model intact with or without a source; eleven never submit", async () => {
  // These are mocked transport boundary checks. The ten-image cap follows the
  // official Enterprise model-family specification, not paid direct-route QA.
  const originalFetch = globalThis.fetch;
  const images = Array.from({ length: 10 }, (_, index) => `https://owned.test/identity-${index}.png`);
  let downloads = 0;
  globalThis.fetch = async url => {
    downloads += 1;
    return new Response(url.endsWith(".mp4") ? clip(5) : Buffer.from(url), {
      headers: { "Content-Type": url.endsWith(".mp4") ? "video/mp4" : "image/png" },
    });
  };
  try {
    for (const source of [{}, { referenceVideoUrl: "https://owned.test/source.mp4", referenceVideoDurationSeconds: 5, referenceVideoMode: "edit" }]) {
      await generateGeminiOmniVideoBuffer({ ...params("Preserve the scene and use these identity references."), ...source, referenceImageUrls: images });
      const submitted = requests.at(-1);
      assert.deepEqual(submitted.input.filter(part => part.type === "image").map(part => Buffer.from(part.data, "base64").toString()), images);
      const count = requests.findLast(request => request.type === "count");
      assert.equal(count.contents.filter(part => part.inlineData?.mimeType === "image/png").length, 10);
      if (source.referenceVideoUrl) {
        assert.equal(submitted.input[0].type, "video");
        assert.match(submitted.input.at(-1).text, /<IMAGE_REF_9>@Image10/);
      }
      const before = creates(), beforeDownloads = downloads;
      await assert.rejects(generateGeminiOmniVideoBuffer({ ...params("Too many images."), ...source,
        referenceImageUrls: [...images, "https://owned.test/excess.png"] }),
        error => error instanceof ProviderRequestNotSubmittedError && /up to 10/.test(error.message));
      assert.equal(creates(), before);
      assert.equal(downloads, beforeDownloads, "excess fails before downloading or submitting media");
    }
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

test("decimal 3.7-second Hook and 6.7-second Wall edits send source bytes and both instructions without a forced rounded output duration", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const seconds of [3.7, 6.7]) {
      const bytes = clip(seconds);
      globalThis.fetch = async url => new Response(url.endsWith('.mp4') ? bytes : Buffer.from('appearance'), { headers: { 'Content-Type': url.endsWith('.mp4') ? 'video/mp4' : 'image/png' } });
      const prompt = 'Reference instruction: preserve gestures.\n\nUser instruction: warmer lighting.';
      await generateGeminiOmniVideoBuffer({ ...params(prompt), durationSeconds: Math.ceil(seconds), referenceVideoDurationSeconds: seconds,
        referenceVideoMode: 'edit', referenceVideoUrl: 'https://owned.test/source.mp4', referenceImageUrl: 'https://owned.test/identity.png' });
      const request = requests.at(-1);
      assert.deepEqual(Buffer.from(request.input[0].data, 'base64'), bytes);
      assert.ok(request.input.at(-1).text.endsWith(prompt));
      assert.equal(request.generation_config.video_config.task, 'edit');
      assert.equal(request.response_format.duration, undefined);
    }
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
