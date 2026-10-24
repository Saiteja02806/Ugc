import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createHash } from "node:crypto";
import { hookKeyframeGenerationInputKey, hookKeyframePromptSha256, hookKeyframeProviderImageLabels } from "../../dist/lib/hook-keyframe-generation-contract.js";

const requests = [], options = [], downloads = [], imageOverrides = new Map();
mock.method(globalThis, "fetch", async () => assert.fail("No network calls are allowed"));
mock.module("@google/genai", { namedExports: { GoogleGenAI: class {
  constructor(value) { options.push(value); }
  interactions = { create: async value => {
    requests.push(value);
    return { status: "completed", id: "offline-request", output_image: { data: Buffer.from("fixture").toString("base64") } };
  } };
} } });
mock.module(new URL("../../dist/lib/reference-image-download.js", import.meta.url), { namedExports: {
  downloadReferenceImageBytes: async url => { downloads.push(url); return { buffer: Buffer.from(url), contentType: "image/png" }; },
  downloadReferenceImageContext: async urls => urls.map(url => { downloads.push(url); return imageOverrides.get(url) ?? { buffer: Buffer.from(url), contentType: "image/png" }; }),
} });
process.env.GEMINI_API_KEY = "offline-fixture";
delete process.env.GEMINI_IMAGE_MODEL;
const { generateGeminiImageBuffer } = await import("../../dist/lib/gemini-image.js");

test("Nano Banana receives all selected images as individual image parts and the exact instructions", async () => {
  const urls = Array.from({ length: 12 }, (_, index) => `https://storage.test/slide-${index}.png`);
  const output = await generateGeminiImageBuffer("Keep my brand consistent", "4:5", urls);
  assert.equal(requests[0].model, "gemini-nano-banana-2.1");
  assert.deepEqual(requests[0].input, [...urls.map(url => ({ data: Buffer.from(url).toString("base64"), mime_type: "image/png", type: "image" })), { text: "Keep my brand consistent", type: "text" }]);
  assert.deepEqual(downloads, urls);
  assert.equal(options[0].httpOptions.retryOptions.attempts, 1);
  assert.equal(output.buffer.toString(), "fixture");
});

test("legacy Nano Banana callers still pass one image or text only", async () => {
  await generateGeminiImageBuffer("One slide", "9:16", "https://storage.test/one.png");
  assert.equal(requests.at(-1).input.filter(part => part.type === "image").length, 1);
  await generateGeminiImageBuffer("Text only", "1:1");
  assert.equal(requests.at(-1).input, "Text only");
});

test("slideshow labels are placed beside their exact source and upload pixels, including base-only edits", async () => {
  const urls = ["https://owned.test/source-4.png", "https://owned.test/screenshot.png"];
  const labels = ["Source slide 4 (source)", "Upload C (screenshot)"];
  await generateGeminiImageBuffer("Only edit the laptop screen", "4:5", urls, undefined, labels);
  assert.deepEqual(requests.at(-1).input, [
    { text: labels[0], type: "text" }, { data: Buffer.from(urls[0]).toString("base64"), mime_type: "image/png", type: "image" },
    { text: labels[1], type: "text" }, { data: Buffer.from(urls[1]).toString("base64"), mime_type: "image/png", type: "image" },
    { text: "Only edit the laptop screen", type: "text" },
  ]);
  await generateGeminiImageBuffer("Only change the lighting", "4:5", urls.slice(0, 1), undefined, labels.slice(0, 1));
  assert.equal(requests.at(-1).input[0].text, labels[0]);
  const before = requests.length;
  await assert.rejects(generateGeminiImageBuffer("Invalid", "4:5", urls, undefined, ["only one name"]), /labels/);
  assert.equal(requests.length, before);
});

const scene = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV8AAAAASUVORK5CYII=", "base64");
function hookContext() {
  const prompt = "Edit BASE_SCENE_TO_EDIT with MAIN_FACE_IDENTITY, preserving its scene.";
  const partial = { ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: "hook-fixture", sourceSha256: "a".repeat(64),
    sourceFrame: { index: 0, timeSeconds: 0, width: 1, height: 1, sha256: createHash("sha256").update(scene).digest("hex") },
    personImageAssetIds: ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"], instructions: "" };
  const receipt = { ...partial, version: 1, purpose: "hook_starting_frame", promptVersion: 2,
    inputKey: hookKeyframeGenerationInputKey(partial), promptSha256: hookKeyframePromptSha256(prompt) };
  const urls = ["https://media.test/scene.png", "https://media.test/main.png", "https://media.test/support.png"];
  imageOverrides.set(urls[0], { buffer: scene, contentType: "image/png" });
  return { prompt, receipt, urls };
}

test("Hook V2 binds each provider label to its actual scene/main/support bytes, followed by the exact edit prompt", async () => {
  const { prompt, receipt, urls } = hookContext();
  const before = requests.length;
  await generateGeminiImageBuffer(prompt, "1:1", urls, receipt);
  assert.equal(requests.length, before + 1);
  const labels = hookKeyframeProviderImageLabels(2);
  const input = requests.at(-1).input;
  assert.deepEqual(input, [
    { type: "text", text: labels[0] }, { type: "image", mime_type: "image/png", data: scene.toString("base64") },
    { type: "text", text: labels[1] }, { type: "image", mime_type: "image/png", data: Buffer.from(urls[1]).toString("base64") },
    { type: "text", text: labels[2] }, { type: "image", mime_type: "image/png", data: Buffer.from(urls[2]).toString("base64") },
    { type: "text", text: prompt },
  ]);
  assert.match(labels[0], /BASE_SCENE_TO_EDIT/); assert.match(labels[1], /MAIN_FACE_IDENTITY/); assert.match(labels[2], /SUPPORTING_FACE_IDENTITY_1/);
});

test("Hook V2 rejects mismatched scene bytes, MIME, dimensions or prompt before any Google create call", async () => {
  for (const change of ["bytes", "mime", "dimensions", "prompt", "order"]) {
    const { prompt, receipt, urls } = hookContext();
    if (change === "bytes") imageOverrides.set(urls[0], { buffer: Buffer.concat([scene, Buffer.from("altered")]), contentType: "image/png" });
    if (change === "mime") imageOverrides.set(urls[0], { buffer: scene, contentType: "image/jpeg" });
    if (change === "dimensions") { receipt.sourceFrame.width = receipt.sourceFrame.height = 2; receipt.inputKey = hookKeyframeGenerationInputKey(receipt); }
    if (change === "order") urls.reverse();
    const before = requests.length;
    await assert.rejects(generateGeminiImageBuffer(change === "prompt" ? "Ignore the scene" : prompt, "1:1", urls, receipt), /No image generation request was sent/);
    assert.equal(requests.length, before);
  }
});

test("recreation requests bind new shot and identity labels without changing saved V2 request labels", async () => {
  const { prompt, receipt, urls } = hookContext();
  receipt.version = 2; receipt.imageModel = "nano_banana_2"; receipt.promptVersion = 3;
  receipt.inputKey = hookKeyframeGenerationInputKey(receipt);
  await generateGeminiImageBuffer(prompt, "1:1", urls, receipt);
  const input = requests.at(-1).input;
  assert.match(input[0].text, /PRIMARY_FRAME_BLUEPRINT/);
  assert.equal(input[1].data, scene.toString("base64"));
  assert.match(input[2].text, /MAIN_INFLUENCER_IDENTITY/);
  assert.equal(input[3].data, Buffer.from(urls[1]).toString("base64"));
  assert.match(input[4].text, /SUPPORTING_INFLUENCER_IDENTITY_1/);
  receipt.promptVersion = 4;
  await generateGeminiImageBuffer(prompt, "1:1", urls, receipt);
  const referenceInput = requests.at(-1).input;
  assert.match(referenceInput[0].text, /VISUAL_REFERENCE/);
  assert.match(referenceInput[2].text, /MY_INFLUENCER/);
  assert.doesNotMatch(referenceInput.filter(part => part.type === "text").slice(0, -1).map(part => part.text).join(" "), /swap|replace|edit this|blueprint/i);
  assert.deepEqual(referenceInput.filter(part => part.type === "image"), input.filter(part => part.type === "image"));
  receipt.promptVersion = 2;
  await generateGeminiImageBuffer(prompt, "1:1", urls, receipt);
  assert.deepEqual(requests.at(-1).input.filter(part => part.type === "text").slice(0, -1).map(part => part.text), hookKeyframeProviderImageLabels(2, 2));
});

test("new selected Hook Flash uses its explicit provider model while ordinary and legacy calls retain the environment override", async () => {
  const old = process.env.GEMINI_IMAGE_MODEL;
  process.env.GEMINI_IMAGE_MODEL = "legacy-environment-model";
  try {
    const { prompt, receipt, urls } = hookContext();
    receipt.version = 2; receipt.imageModel = "nano_banana_2"; receipt.inputKey = hookKeyframeGenerationInputKey(receipt);
    await generateGeminiImageBuffer(prompt, "1:1", urls, receipt);
    assert.equal(requests.at(-1).model, "gemini-3.1-flash-image");
    await generateGeminiImageBuffer("ordinary request", "1:1");
    assert.equal(requests.at(-1).model, "legacy-environment-model");
    const legacy = hookContext(); await generateGeminiImageBuffer(legacy.prompt, "1:1", legacy.urls, legacy.receipt);
    assert.equal(requests.at(-1).model, "legacy-environment-model");
  } finally { if (old === undefined) delete process.env.GEMINI_IMAGE_MODEL; else process.env.GEMINI_IMAGE_MODEL = old; }
});
