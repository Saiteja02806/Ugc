import assert from "node:assert/strict";
import { mock, test } from "node:test";

// Exercise the actual worker with provider/storage stubs; no paid requests occur.
const received = [];
const image = Buffer.from("fixture-image");
const provider = async (model, prompt, ratio, reference) => {
  received.push({ model, prompt, ratio, reference });
  return { buffer: image, model, requestId: "fixture-request" };
};
mock.module(new URL("../../dist/lib/openai-image.js", import.meta.url), { namedExports: {
  SLIDESHOW_IMAGE_MODEL: "gpt-image-2.5-sunburst",
  generateOpenAiImageBuffer: (prompt, ratio, reference, override) => {
    if (override !== undefined) assert.equal(override, "gpt-image-2.5-sunburst");
    return provider(override ? "gpt_image_2_5" : "gpt_image", prompt, ratio, reference);
  },
} });
mock.module(new URL("../../dist/lib/seedream-image.js", import.meta.url), { namedExports: {
  SEEDREAM_5_PRO_IMAGE_MODEL: "seedream5_pro",
  generateSeedreamImageBuffer: async params => {
    await provider("seedream_5_pro", params.prompt, params.aspectRatio, params.referenceImageUrl);
    await params.onOperationCreated("fixture-request");
    await params.onOperationSucceeded("fixture-request");
    return image;
  },
} });
mock.module(new URL("../../dist/lib/gemini-image.js", import.meta.url), { namedExports: {
  GEMINI_3_PRO_IMAGE_MODEL: "gemini-3-pro-image",
  generateGeminiImageBuffer: (prompt, ratio, reference) => provider("nano_banana_2", prompt, ratio, reference),
  generateGemini3ProImageBuffer: async params => {
    await provider("gemini_3_pro", params.prompt, params.aspectRatio, params.referenceImageUrl);
    await params.onOperationCreated("fixture-request");
    await params.onOperationSucceeded("fixture-request");
    return image;
  },
} });
mock.module(new URL("../../dist/lib/image-output.js", import.meta.url), { namedExports: {
  AI_STUDIO_IMAGE_RATIO: "9:16", AI_STUDIO_IMAGE_RATIOS: ["4:5", "1:1", "9:16", "16:9"],
  getAIStudioImageDimensions: () => ({ width: 720, height: 1280 }),
  prepareAIStudioImageOutput: async buffer => buffer,
} });
mock.module(new URL("../../dist/lib/storage.js", import.meta.url), { namedExports: {
  getStoredObject: async () => null,
  downloadStoredObjectBuffer: async () => { throw new Error("Unexpected recovery read"); },
  uploadBufferToStorage: async ({ key }) => ({ key, url: `https://media.example.test/${key}` }),
} });
const { runGenerateImageJob } = await import("../../dist/jobs/generate-image.js");
const context = {
  checkpoint: async () => {},
  store: {
    reserveGenerationProviderOperation: async () => ({ shouldSubmit: true, operation: { status: "reserved", metadata: {} } }),
    markGenerationProviderSucceeded: async () => {},
    markGenerationProviderSubmitted: async () => {},
    markGenerationOutputPersisted: async () => {},
  },
};
const job = (model, prompt) => ({
  id: "fixture-job", user_id: "fixture-user", project_id: "ai-studio",
  input_json: {
    model, prompt, generationId: "fixture-generation", aspectRatio: "9:16",
    characterSource: "ugc-pilot-characters", characterVersion: 2, mode: "custom", promptSource: "user",
    referenceImageUrl: "https://media.example.test/owned-reference.png",
  },
});

test("all influencer models route the exact character prompt and owned reference to their provider", async () => {
  const prompt = "An adult fashion creator with glossy makeup in a clean studio.\nHands outside frame. Pink satin dress.";
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2", "seedream_5_pro", "gpt_image_2_5"]) {
    const output = await runGenerateImageJob(job(model, prompt), context);
    assert.equal(output.model, model);
    assert.equal(output.provider, model === "seedream_5_pro" ? "runway" : model.startsWith("gpt_image") ? "openai" : "gemini");
    assert.deepEqual(received.at(-1), { model, prompt, ratio: "9:16", reference: "https://media.example.test/owned-reference.png" });
  }
});

test("long character descriptions reach every provider without summaries or truncation", async () => {
  const prompt = "Precise requested styling and studio composition. ".repeat(300) + "Final detail: no desk, no props.";
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2", "gpt_image_2_5"]) {
    await runGenerateImageJob(job(model, prompt), context);
    assert.equal(received.at(-1).prompt, prompt);
  }
});

test("prompt limits are enforced before any provider call without changing other image generators", async () => {
  const before = received.length;
  await assert.rejects(runGenerateImageJob(job("gpt_image", "x".repeat(32001)), context), /32000 characters/);
  const generic = job("gpt_image", "x".repeat(2001));
  delete generic.input_json.characterSource;
  await runGenerateImageJob(generic, context);
  assert.equal(received.at(-1).prompt, generic.input_json.prompt);
  assert.equal(received.length, before + 1);
});
