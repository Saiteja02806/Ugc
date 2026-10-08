import assert from "node:assert/strict";
import { mock, test } from "node:test";

const requests = [], options = [], downloads = [];
mock.method(globalThis, "fetch", async () => assert.fail("No network calls are allowed"));
mock.module("openai", {
  defaultExport: class {
    constructor(value) { options.push(value); }
    images = {
      edit: async value => { requests.push({ kind: "edit", ...value }); return { data: [{ b64_json: Buffer.from("fixture").toString("base64") }], _request_id: "offline" }; },
      generate: async value => { requests.push({ kind: "generate", ...value }); return { data: [{ b64_json: Buffer.from("fixture").toString("base64") }] }; },
    };
  },
  namedExports: { toFile: async (bytes, name, metadata) => ({ bytes, name, metadata }) },
});
mock.module(new URL("../../dist/lib/reference-image-download.js", import.meta.url), {
  namedExports: {
    downloadReferenceImageBytes: async url => { downloads.push(url); return { buffer: Buffer.from("reference"), contentType: "image/png" }; },
    downloadReferenceImageContext: async urls => urls.map(url => { downloads.push(url); return { buffer: Buffer.from(url), contentType: url.endsWith(".jpg") ? "image/jpeg" : "image/png" }; }),
  },
});
process.env.OPENAI_API_KEY = "offline-fixture";
process.env.OPENAI_IMAGE_MODEL = "gpt-image-2";
const { generateOpenAiImageBuffer, SLIDESHOW_IMAGE_MODEL } = await import("../../dist/lib/openai-image.js");

test("Sunburst edits explicitly override the legacy environment model without unsupported fidelity parameters or SDK retries", async () => {
  const output = await generateOpenAiImageBuffer("My instructions", "9:16", "https://storage.test/reference.png", SLIDESHOW_IMAGE_MODEL);
  assert.equal(requests.at(-1).kind, "edit");
  assert.equal(requests.at(-1).model, "gpt-image-2.5-sunburst");
  assert.equal(requests.at(-1).prompt, "My instructions");
  assert.equal(requests.at(-1).size, "1024x1536");
  assert.equal("input_fidelity" in requests.at(-1), false);
  assert.deepEqual(downloads, ["https://storage.test/reference.png"]);
  assert.equal(options[0].maxRetries, 0);
  assert.equal(output.model, SLIDESHOW_IMAGE_MODEL);
  assert.equal(output.requestId, "offline");
  assert.equal(output.buffer.toString(), "fixture");
});

test("Sunburst sends every selected image as an ordered file array alongside the instructions", async () => {
  const urls = ["https://storage.test/slide-4.jpg", "https://storage.test/slide-1.png", "https://storage.test/slide-6.png"];
  await generateOpenAiImageBuffer("My brand and instructions", "9:16", urls, SLIDESHOW_IMAGE_MODEL);
  const request = requests.at(-1);
  assert.equal(request.kind, "edit");
  assert.equal(request.model, SLIDESHOW_IMAGE_MODEL);
  assert.equal(request.prompt, "My brand and instructions");
  assert.deepEqual(request.image.map(image => image.bytes.toString()), urls);
  assert.deepEqual(request.image.map(image => image.name), ["reference-1.jpg", "reference-2.png", "reference-3.png"]);
});

test("Sunburst text generation uses the same explicit model, while older callers retain their configured model", async () => {
  await generateOpenAiImageBuffer("Landscape", "16:9", undefined, SLIDESHOW_IMAGE_MODEL);
  assert.equal(requests.at(-1).kind, "generate");
  assert.equal(requests.at(-1).model, SLIDESHOW_IMAGE_MODEL);
  assert.equal(requests.at(-1).size, "1536x1024");
  await generateOpenAiImageBuffer("Legacy", "1:1");
  assert.equal(requests.at(-1).model, "gpt-image-2");
});
