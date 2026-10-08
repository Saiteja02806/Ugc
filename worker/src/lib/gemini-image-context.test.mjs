import assert from "node:assert/strict";
import { mock, test } from "node:test";

const requests = [], options = [], downloads = [];
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
  downloadReferenceImageContext: async urls => urls.map(url => { downloads.push(url); return { buffer: Buffer.from(url), contentType: "image/png" }; }),
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
