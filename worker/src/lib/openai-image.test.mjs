import assert from "node:assert/strict";
import { mock, test } from "node:test";

const requests = [], options = [];
const image = Buffer.from("image-fixture").toString("base64");
mock.method(globalThis, "fetch", async () => assert.fail("Provider tests must not access the network"));
mock.module("openai", { defaultExport: class {
  constructor(value) { options.push(value); }
  images = {
    generate: async request => { requests.push({ operation: "generate", request }); return { data: [{ b64_json: image }], _request_id: "fixture-request" }; },
    edit: async request => { requests.push({ operation: "edit", request }); return { data: [{ b64_json: image }], _request_id: "fixture-request" }; },
  };
}, namedExports: { toFile: async (buffer, name, metadata) => ({ buffer, name, metadata }) } });
mock.module(new URL("../../dist/lib/reference-image-download.js", import.meta.url), { namedExports: {
  downloadReferenceImageContext: async urls => urls.map(url => ({ buffer: Buffer.from(url), contentType: "image/png" })),
  downloadReferenceImageBytes: async url => ({ buffer: Buffer.from(url), contentType: "image/png" }),
} });

const { generateOpenAiImageBuffer, SLIDESHOW_IMAGE_MODEL, SLIDESHOW_FLARE_IMAGE_MODEL } = await import("../../dist/lib/openai-image.js");

test("Flare and Sunburst generation uses the exact selected model with no hidden retry or environment override", async () => {
  const previousKey = process.env.OPENAI_API_KEY, previousModel = process.env.OPENAI_IMAGE_MODEL;
  process.env.OPENAI_API_KEY = "test-fixture-only";
  process.env.OPENAI_IMAGE_MODEL = "legacy-env-model";
  try {
    for (const model of [SLIDESHOW_FLARE_IMAGE_MODEL, SLIDESHOW_IMAGE_MODEL]) {
      const output = await generateOpenAiImageBuffer("Approved business context", "4:5", undefined, model, true);
      assert.deepEqual(requests.at(-1), { operation: "generate", request: { model, prompt: "Approved business context", size: "1024x1280" } });
      assert.equal(output.model, model);
      assert.equal(output.buffer.toString(), "image-fixture");
    }
    assert.equal(SLIDESHOW_FLARE_IMAGE_MODEL, "gpt-image-2.5-flare");
    assert.equal(SLIDESHOW_IMAGE_MODEL, "gpt-image-2.5-sunburst");
    assert.equal(options[0].maxRetries, 0);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_IMAGE_MODEL; else process.env.OPENAI_IMAGE_MODEL = previousModel;
  }
});

test("both slideshow models edit with all selected references and the complete business prompt", async () => {
  const references = ["https://media.example.test/slide-1.png", "https://media.example.test/slide-2.png"];
  for (const model of [SLIDESHOW_FLARE_IMAGE_MODEL, SLIDESHOW_IMAGE_MODEL]) {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-fixture-only";
    try {
      await generateOpenAiImageBuffer("Business facts plus slide 2 instructions", "9:16", references, model, true);
      const { operation, request } = requests.at(-1);
      assert.equal(operation, "edit");
      assert.equal(request.model, model);
      assert.equal(request.size, "720x1280");
      assert.equal(request.prompt, "Business facts plus slide 2 instructions");
      assert.deepEqual(request.image.map(file => file.buffer.toString()), references);
      assert.equal("input_fidelity" in request, false);
    } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
  }
});

test("named slide inputs keep source 4 first and the screenshot bytes paired with its upload name", async () => {
  process.env.OPENAI_API_KEY = "test-fixture-only";
  const references = ["https://owned.test/source-4.png", "https://owned.test/screenshot.png"];
  await generateOpenAiImageBuffer("Only change this laptop screen", "4:5", references, SLIDESHOW_IMAGE_MODEL, true, ["Source slide 4 (source)", "Upload C (screenshot)"]);
  const files = requests.at(-1).request.image;
  assert.deepEqual(files.map(file => file.buffer.toString()), references);
  assert.match(files[0].name, /^image-1-Source-slide-4-source/);
  assert.match(files[1].name, /^image-2-Upload-C-screenshot/);
  const before = requests.length;
  await assert.rejects(generateOpenAiImageBuffer("Invalid names", "4:5", references, SLIDESHOW_IMAGE_MODEL, true, ["only one name"]), /names/);
  assert.equal(requests.length, before);
});
