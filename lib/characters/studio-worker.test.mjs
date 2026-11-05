import assert from "node:assert/strict";
import "../../scripts/worker-source-test-loader.mjs";
import { mock, test } from "node:test";
import sharp from "sharp";
import { compileStudioSelection } from "./studio-selection.ts";
import { DEFAULT_INFLUENCER_SELECTION } from "./influencer-registry.ts";

// Exercise the actual worker with provider/storage stubs; no paid requests occur.
const received = [];
const image = Buffer.from("fixture-image");
const objects = new Map();
let stagedImages;
const provider = async (model, prompt, ratio, reference) => {
  received.push({ model, prompt, ratio, reference });
  return { buffer: image, model, requestId: "fixture-request" };
};
mock.module(new URL("../../worker/src/lib/openai-image.ts", import.meta.url), { namedExports: {
  SLIDESHOW_IMAGE_MODEL: "gpt-image-2.5-sunburst",
  SLIDESHOW_FLARE_IMAGE_MODEL: "gpt-image-2.5-flare",
  generateOpenAiImageBuffer: (prompt, ratio, reference, override) => {
    if (override !== undefined) assert.equal(override, "gpt-image-2.5-sunburst");
    return provider(override ? "gpt_image_2_5" : "gpt_image", prompt, ratio, reference);
  },
} });
mock.module(new URL("../../worker/src/lib/seedream-image.ts", import.meta.url), { namedExports: {
  SEEDREAM_5_PRO_IMAGE_MODEL: "seedream5_pro",
  generateSeedreamImageBuffer: async params => {
    await provider("seedream_5_pro", params.prompt, params.aspectRatio, params.referenceImageUrl);
    await params.onOperationCreated("fixture-request");
    await params.onOperationSucceeded("fixture-request");
    return image;
  },
} });
mock.module(new URL("../../worker/src/lib/gemini-image.ts", import.meta.url), { namedExports: {
  GEMINI_3_PRO_IMAGE_MODEL: "gemini-3-pro-image",
  generateGeminiImageBuffer: (prompt, ratio, reference) => provider("nano_banana_2", prompt, ratio, reference),
  generateGemini3ProImageBuffer: async params => {
    await provider("gemini_3_pro", params.prompt, params.aspectRatio, params.referenceImageUrl);
    await params.onOperationCreated("fixture-request");
    await params.onOperationSucceeded("fixture-request");
    return image;
  },
} });
mock.module(new URL("../../worker/src/lib/image-output.ts", import.meta.url), { namedExports: {
  AI_STUDIO_IMAGE_RATIO: "9:16", AI_STUDIO_IMAGE_RATIOS: ["4:5", "1:1", "9:16", "16:9"],
  getAIStudioImageDimensions: () => ({ width: 720, height: 1280 }),
  prepareAIStudioImageOutput: async buffer => buffer,
  assertImageOutputAspectRatio: async () => {},
} });
mock.module(new URL("../../worker/src/lib/storage.ts", import.meta.url), { namedExports: {
  getStoredObject: async key => objects.get(key) ?? null,
  downloadStoredObjectBuffer: async key => {
    assert.ok(objects.has(key), `Unexpected recovery read: ${key}`);
    return objects.get(key).buffer;
  },
  uploadBufferToStorage: async ({ key, buffer }) => {
    const object = { key, url: `https://media.example.test/${key}`, buffer };
    objects.set(key, object);
    return object;
  },
} });
mock.module(new URL("../../worker/src/lib/private-media.ts", import.meta.url), { namedExports: {
  resolveOwnedPrivateMediaUrl: async url => url,
  workerMediaReadUrl: async () => assert.fail("Character generation must not invoke slideshow media resolution"),
} });
mock.module(new URL("../../worker/src/lib/reference-image-download.ts", import.meta.url), { namedExports: {
  downloadReferenceImageContext: async urls => urls.map(url => ({ buffer: Buffer.from(url), contentType: "image/png" })),
} });
mock.module(new URL("../../worker/src/lib/openrouter-gemini-image.ts", import.meta.url), { namedExports: {
  generateOpenRouterGeminiImage: async params => {
    await provider("gemini_3_pro", params.prompt, params.aspectRatio,
      params.referenceImages.map(ref => Buffer.from(ref.data, "base64").toString("latin1")));
    if (stagedImages) {
      assert.equal(params.imageSize, "2K");
    }
    return {
      buffer: stagedImages ? stagedImages[params.prompt.startsWith("CHARACTER STAGE 2") ? "identity" : "scene"] : image,
      model: "google/gemini-3-pro-image",
    };
  },
  generateOpenRouterGeminiHookKeyframe: async () => assert.fail("Unexpected Hook call"),
  performOpenRouterFaceSwap: async () => assert.fail("Unexpected face swap"),
} });
mock.method(globalThis, "fetch", async () => assert.fail("No network or paid provider calls allowed"));
const { runGenerateImageJob } = await import("../../worker/src/jobs/generate-image.ts");
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

test("current worker forwards full studio choices and restrictions unchanged to Gemini OpenRouter", async () => {
  for (const framing of ["full", "half"]) {
    const compiled = compileStudioSelection({ ...DEFAULT_INFLUENCER_SELECTION, framing }, "red glasses");
    const input = job("gemini_3_pro", compiled.prompt);
    input.id = `fixture-character-${framing}`;
    input.input_json.generationId = input.id;
    input.input_json.provider = "openrouter";
    input.input_json.referenceImageUrls = compiled.references.map(ref => `https://media.example.test/${ref.id}.png`);
    input.input_json.referenceImageUrl = input.input_json.referenceImageUrls[0];
    const result = await runGenerateImageJob(input, context);
    assert.equal(result.provider, "openrouter");
    assert.equal(received.at(-1).prompt, compiled.prompt);
    assert.match(received.at(-1).prompt, /No accessories required/);
    assert.match(received.at(-1).prompt, /Negative constraints: Avoid .*red glasses/);
    assert.deepEqual(received.at(-1).reference, input.input_json.referenceImageUrls);
  }
});

test("the current durable character job passes every selected reference to scene, only the primary to identity, and reuses saved stages", async t => {
  const png = background => sharp({ create: { width: 36, height: 64, channels: 3, background } }).png().toBuffer();
  stagedImages = { scene: await png("navy"), identity: await png("maroon") };
  t.after(() => { stagedImages = undefined; });
  const input = job("gemini_3_pro", "The selected haircut, jacket and location.");
  input.id = "fixture-character-v4";
  input.input_json.generationId = input.id;
  const references = ["face-b", "background", "haircut", "jacket"].map(role => `https://media.example.test/${role}.png`);
  Object.assign(input.input_json, {
    provider: "openrouter",
    referenceImageUrls: references,
    referenceImageUrl: references[0],
    characterIdentityPipeline: {
      version: 4, identityReferenceIndex: 0, instructions: "Keep the selected blue eyes.", negativePrompt: "extra jewelry",
    },
  });
  const operations = new Map();
  const durableContext = { ...context, store: {
    ...context.store,
    reserveGenerationProviderOperation: async ({ operationKey, metadata, requestFingerprint }) => {
      const existing = operations.get(operationKey);
      if (existing) {
        assert.equal(existing.fingerprint, requestFingerprint);
        return { shouldSubmit: false, operation: existing };
      }
      const operation = { metadata, fingerprint: requestFingerprint };
      operations.set(operationKey, operation);
      return { shouldSubmit: true, operation };
    },
    markGenerationOutputPersisted: async ({ operationKey, metadata, outputReference }) => {
      Object.assign(operations.get(operationKey), { metadata, outputReference });
    },
  } };
  const firstCall = received.length;
  const result = await runGenerateImageJob(input, durableContext);
  const [scene, identity] = received.slice(firstCall);
  assert.equal(received.length, firstCall + 2);
  assert.equal(scene.prompt, input.input_json.prompt);
  assert.deepEqual(scene.reference, references);
  assert.equal(identity.reference.length, 2);
  const stage = role => operations.get(`openrouter-image-${role}-v1`).outputReference;
  assert.deepEqual(Buffer.from(identity.reference[0], "latin1"), objects.get(stage("scene")).buffer);
  assert.equal(identity.reference[1], references[0]);
  assert.match(identity.prompt, /selected blue eyes/);
  assert.match(identity.prompt, /Avoid extra jewelry/);
  assert.deepEqual(objects.get(result.key).buffer, objects.get(stage("harmonize")).buffer);
  assert.equal(result.generationId, input.input_json.generationId);

  objects.delete(result.key);
  const recovered = await runGenerateImageJob(input, durableContext);
  assert.equal(recovered.key, result.key);
  assert.deepEqual(objects.get(recovered.key).buffer, objects.get(stage("harmonize")).buffer);
  assert.equal(received.length, firstCall + 2, "recovering the same job must not invoke either model stage again");
});
