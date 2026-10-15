import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { ProviderOperationTerminalError, ProviderSubmissionUncertainError } from "../../dist/lib/generation-provider.js";

// Exercise the actual worker with provider/storage stubs; no paid requests occur.
const received = [];
const resolvedReferences = [], fingerprints = [], outputOptions = [];
mock.method(globalThis, "fetch", async () => assert.fail("No network calls are allowed"));
mock.module(new URL("../../dist/lib/private-media.js", import.meta.url), { namedExports: {
  resolveOwnedPrivateMediaUrl: async (url, owner) => { resolvedReferences.push({ url, owner }); return url; },
} });
const seedreamCalls = [];
let seedreamError;
const image = Buffer.from("fixture-image");
const provider = async (model, prompt, ratio, reference, nativeAspectRatio = false) => {
  received.push({ model, prompt, ratio, reference, nativeAspectRatio });
  return { buffer: image, model, requestId: "fixture-request" };
};
mock.module(new URL("../../dist/lib/openai-image.js", import.meta.url), { namedExports: {
  SLIDESHOW_IMAGE_MODEL: "gpt-image-2.5-sunburst",
  SLIDESHOW_FLARE_IMAGE_MODEL: "gpt-image-2.5-flare",
  generateOpenAiImageBuffer: (prompt, ratio, reference, model, nativeAspectRatio) => provider(model ?? "gpt_image", prompt, ratio, reference, nativeAspectRatio),
} });
mock.module(new URL("../../dist/lib/gemini-image.js", import.meta.url), { namedExports: {
  GEMINI_3_PRO_IMAGE_MODEL: "gemini-3-pro-image",
  generateGeminiImageBuffer: (prompt, ratio, reference) => provider("nano_banana_2", prompt, ratio, reference),
  generateGemini3ProImageBuffer: async params => {
    await provider("gemini_3_pro", params.prompt, params.aspectRatio, params.referenceImageUrls ?? params.referenceImageUrl);
    await params.onOperationCreated("fixture-request");
    await params.onOperationSucceeded("fixture-request");
    return image;
  },
} });
mock.module(new URL("../../dist/lib/seedream-image.js", import.meta.url), { namedExports: {
  SEEDREAM_5_PRO_IMAGE_MODEL: "seedream5_pro",
  generateSeedreamImageBuffer: async params => {
    seedreamCalls.push(params);
    if (!params.providerOperationId) await params.onOperationCreated("saved-seedream-task");
    if (seedreamError) throw seedreamError;
    await params.onOperationSucceeded(params.providerOperationId ?? "saved-seedream-task");
    return image;
  },
} });
mock.module(new URL("../../dist/lib/image-output.js", import.meta.url), { namedExports: {
  AI_STUDIO_IMAGE_RATIO: "9:16", AI_STUDIO_IMAGE_RATIOS: ["4:5", "1:1", "9:16", "16:9"],
  getAIStudioImageDimensions: () => ({ width: 720, height: 1280 }),
  prepareAIStudioImageOutput: async (buffer, ratio, options) => { outputOptions.push(options); return buffer; },
} });
mock.module(new URL("../../dist/lib/storage.js", import.meta.url), { namedExports: {
  getStoredObject: async () => null,
  downloadStoredObjectBuffer: async key => { assert.equal(key, "saved-seedream-source.png"); return image; },
  uploadBufferToStorage: async ({ key }) => ({ key, url: `https://media.example.test/${key}` }),
} });
const { runGenerateImageJob } = await import("../../dist/jobs/generate-image.js");
const context = {
  checkpoint: async () => {},
  store: {
    reserveGenerationProviderOperation: async input => { fingerprints.push(input.requestFingerprint); return { shouldSubmit: true, operation: { status: "reserved", metadata: {} } }; },
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

test("Flare slide jobs carry business instructions and their exact version position through worker output", async () => {
  const imageJob = job("gpt_image_2_5_flare", "Make this slide for UGC Pilot. Business context: content creation for small businesses.");
  const slot = { version: 1, batchKey: "fixture-batch", slideIndex: 3, slideCount: 5, versionIndex: 2, versionCount: 2 };
  Object.assign(imageJob.input_json, { exploreFormat: "slideshow", slideshowReferenceContract: { version: 2, styleReferenceIndices: [1], attachmentReferenceIndices: [] }, slideshowGeneration: slot,
    slideshowBusinessContext: { businessProfileId: "profile", businessProfileVersion: 1, businessContext: { businessName: "UGC Pilot", productSummary: "Content for small businesses", category: null, mainProblem: null, mainPromise: null, brandTone: null, targetAudience: ["small businesses"], valueProps: [], painPoints: [], differentiators: [], visualKeywords: [], ctaIdeas: [], claimsToAvoid: [] } } });
  const output = await runGenerateImageJob(imageJob, context);
  assert.equal(received.at(-1).model, "gpt-image-2.5-flare"); assert.match(received.at(-1).prompt, /Business context \(saved in Settings\)/); assert.match(received.at(-1).prompt, /version 2 of 2, slide 3 of 5/);
  assert.deepEqual(output.slideshowGeneration, slot); assert.equal(received.at(-1).nativeAspectRatio, true);
});

test("slideshow context and version position survive all legacy reference-role paths", async () => {
  for (const role of [{}, { additionalReferenceStartIndex: 2 }, { subjectReferenceIndex: 2 }]) {
    const imageJob = job("gpt_image_2_5_flare", "Keep the layout and explain our product");
    Object.assign(imageJob.input_json, {
      exploreFormat: "slideshow", referenceImageUrls: [imageJob.input_json.referenceImageUrl, "https://media.example.test/product.png"], ...role,
      slideshowGeneration: { version: 1, batchKey: "context-fixture", slideIndex: 2, slideCount: 5, versionIndex: 1, versionCount: 2 },
      slideshowBusinessContext: { businessProfileId: "profile", businessProfileVersion: 1, businessContext: { businessName: "UGC Pilot", productSummary: "Content for small businesses", category: null, mainProblem: null, mainPromise: null, brandTone: null, targetAudience: ["small businesses"], valueProps: [], painPoints: [], differentiators: [], visualKeywords: [], ctaIdeas: [], claimsToAvoid: [] } },
    });
    await runGenerateImageJob(imageJob, context);
    assert.match(received.at(-1).prompt, /Business context \(saved in Settings\)/);
    assert.match(received.at(-1).prompt, /Content for small businesses/);
    assert.match(received.at(-1).prompt, /version 1 of 2, slide 2 of 5/);
  }
});

test("slideshow workers resolve every chosen image for its owner and include the complete list in the paid-operation fingerprint", async () => {
  for (const model of ["gpt_image_2_5", "nano_banana_2"]) {
    const imageJob = job(model, "Use these slides as context");
    const urls = [imageJob.input_json.referenceImageUrl, "https://media.example.test/fourth.png", "https://media.example.test/sixth.png"];
    Object.assign(imageJob.input_json, { exploreFormat: "slideshow", referenceImageUrls: urls });
    const before = resolvedReferences.length;
    await runGenerateImageJob(imageJob, context);
    assert.deepEqual(received.at(-1).reference, urls);
    assert.deepEqual(resolvedReferences.slice(before), urls.map(url => ({ url, owner: "fixture-user" })));
    const completeFingerprint = fingerprints.at(-1);
    imageJob.input_json.referenceImageUrls = urls.slice(0, 1);
    await runGenerateImageJob(imageJob, context);
    assert.notEqual(fingerprints.at(-1), completeFingerprint);
  }
});

test("influencer jobs send all ordered references to every supported model without changing the user prompt", async () => {
  const prompt = "Use image 1 for the person and images 2 and 3 for the setting.";
  for (const model of ["gpt_image", "gpt_image_2_5", "nano_banana_2", "gemini_3_pro", "seedream_5_pro"]) {
    const imageJob = job(model, prompt);
    const urls = [imageJob.input_json.referenceImageUrl, "https://media.example.test/room.png", "https://media.example.test/lighting.png"];
    imageJob.input_json.referenceImageUrls = urls;
    const before = resolvedReferences.length;
    await runGenerateImageJob(imageJob, context);
    if (model === "seedream_5_pro") {
      assert.deepEqual(seedreamCalls.at(-1).referenceImageUrls, urls);
      assert.equal(seedreamCalls.at(-1).prompt, prompt);
    } else {
      assert.deepEqual(received.at(-1).reference, urls);
      assert.equal(received.at(-1).prompt, prompt);
    }
    assert.deepEqual(resolvedReferences.slice(before), urls.map(url => ({ url, owner: "fixture-user" })));
  }
});

test("influencer context rejects over-limit and non-character arrays before reserving a provider operation", async () => {
  const before = fingerprints.length;
  const tooMany = job("seedream_5_pro", "Use these");
  tooMany.input_json.referenceImageUrls = [tooMany.input_json.referenceImageUrl, ...Array.from({ length: 10 }, (_, i) => `https://media.example.test/${i}.png`)];
  await assert.rejects(runGenerateImageJob(tooMany, context), /up to 10/);
  const ordinary = job("gpt_image", "Use these");
  delete ordinary.input_json.characterSource;
  ordinary.input_json.referenceImageUrls = [ordinary.input_json.referenceImageUrl];
  await assert.rejects(runGenerateImageJob(ordinary, context));
  assert.equal(fingerprints.length, before);
});

test("unsupported, empty or mismatched context fails without reaching a provider", async () => {
  const before = received.length, reserved = fingerprints.length;
  for (const input of [{ referenceImageUrls: [] }, { referenceImageUrls: ["https://media.example.test/excluded.png"] }, { model: "seedream_5_pro", referenceImageUrls: ["https://media.example.test/owned-reference.png"] }]) {
    const imageJob = job("gpt_image_2_5", "Instructions");
    Object.assign(imageJob.input_json, { exploreFormat: "slideshow", ...input });
    await assert.rejects(runGenerateImageJob(imageJob, context));
  }
  assert.equal(received.length, before);
  assert.equal(fingerprints.length, reserved);
});

test("versioned jobs send both providers explicit style, attachment and recreation roles with the intact user prompt", async () => {
  for (const model of ["gpt_image_2_5", "nano_banana_2"]) {
    const prompt = 'Use my second attached image for the product. Include "My headline" in the middle.';
    const imageJob = job(model, prompt);
    const urls = [imageJob.input_json.referenceImageUrl, "https://media.example.test/style-2.png", "https://media.example.test/person.png", "https://media.example.test/product.png", "https://media.example.test/current-slide.png"];
    Object.assign(imageJob.input_json, { exploreFormat: "slideshow", aspectRatio: "4:5", referenceImageUrls: urls, slideshowReferenceContract: { version: 2, styleReferenceIndices: [1, 2], attachmentReferenceIndices: [3, 4], regenerationReferenceIndex: 5 } });
    await runGenerateImageJob(imageJob, context);
    const result = received.at(-1);
    assert.deepEqual(result.reference, urls);
    assert.match(result.prompt, /4:5 aspect ratio/);
    assert.match(result.prompt, /style references: image 1, image 2/);
    assert.match(result.prompt, /attachment 1 = image 3; attachment 2 = image 4/);
    assert.match(result.prompt, /Image 5 is the existing slide being edited and is the main edit target/);
    assert.match(result.prompt, /without reproducing reference captions/);
    assert.match(result.prompt, /explicitly request visible text.*near the middle/s);
    assert.ok(result.prompt.endsWith(prompt));
    assert.equal(result.nativeAspectRatio, model === "gpt_image_2_5");
    assert.equal(outputOptions.at(-1).preserveComposition, true);
    const fingerprint = fingerprints.at(-1);
    imageJob.input_json.slideshowReferenceContract.attachmentReferenceIndices.reverse();
    await runGenerateImageJob(imageJob, context);
    assert.notEqual(fingerprints.at(-1), fingerprint);
  }
});

test("layout-only and attachment-free recreation requests have explicit roles while legacy jobs stay unchanged", async () => {
  const imageJob = job("gpt_image_2_5", "Change the background");
  Object.assign(imageJob.input_json, { exploreFormat: "slideshow", slideshowReferenceContract: { version: 2, styleReferenceIndices: [1], attachmentReferenceIndices: [] } });
  await runGenerateImageJob(imageJob, context);
  assert.match(received.at(-1).prompt, /Image 1 is the selected slide/);
  imageJob.input_json.slideshowReferenceContract = { version: 2, styleReferenceIndices: [], attachmentReferenceIndices: [], regenerationReferenceIndex: 1 };
  await runGenerateImageJob(imageJob, context);
  assert.match(received.at(-1).prompt, /Image 1 is the existing slide being edited/);
  delete imageJob.input_json.slideshowReferenceContract;
  await runGenerateImageJob(imageJob, context);
  assert.equal(received.at(-1).prompt, imageJob.input_json.prompt);
  assert.equal(received.at(-1).nativeAspectRatio, false);
  assert.equal(outputOptions.at(-1).preserveComposition, false);
});

test("invalid or oversized versioned contracts fail before reserving or contacting a provider", async () => {
  const before = received.length, reserved = fingerprints.length;
  for (const roles of [{ version: 3, styleReferenceIndices: [1], attachmentReferenceIndices: [] }, { version: 2, styleReferenceIndices: [], attachmentReferenceIndices: [] }, { version: 2, styleReferenceIndices: [2], attachmentReferenceIndices: [] }, { version: 2, styleReferenceIndices: [1], attachmentReferenceIndices: [], regenerationReferenceIndex: "1" }]) {
    const imageJob = job("gpt_image_2_5", "Use the reference");
    Object.assign(imageJob.input_json, { exploreFormat: "slideshow", slideshowReferenceContract: roles });
    await assert.rejects(runGenerateImageJob(imageJob, context), /references/);
  }
  const imageJob = job("gpt_image_2_5", "x".repeat(32_000));
  Object.assign(imageJob.input_json, { exploreFormat: "slideshow", slideshowReferenceContract: { version: 2, styleReferenceIndices: [1], attachmentReferenceIndices: [] } });
  await assert.rejects(runGenerateImageJob(imageJob, context), /32,000/);
  assert.equal(received.length, before);
  assert.equal(fingerprints.length, reserved);
});

test("new Instructions attachment jobs distinguish layout images from subject/style without changing legacy contexts", async () => {
  for (const model of ["gpt_image_2_5", "nano_banana_2"]) {
    const imageJob = job(model, "Keep the layout and use my product");
    const urls = [imageJob.input_json.referenceImageUrl, "https://media.example.test/layout-2.png", "https://media.example.test/product.png"];
    Object.assign(imageJob.input_json, { exploreFormat: "slideshow", referenceImageUrls: urls });
    await runGenerateImageJob(imageJob, context);
    const legacyFingerprint = fingerprints.at(-1);
    assert.equal(received.at(-1).prompt, imageJob.input_json.prompt);
    imageJob.input_json.subjectReferenceIndex = 3;
    await runGenerateImageJob(imageJob, context);
    assert.match(received.at(-1).prompt, /Use images 1 through 2.*Use image 3/s);
    assert.ok(received.at(-1).prompt.endsWith(imageJob.input_json.prompt));
    assert.deepEqual(received.at(-1).reference, urls);
    assert.notEqual(fingerprints.at(-1), legacyFingerprint);
    imageJob.input_json.subjectReferenceIndex = 2;
    await assert.rejects(runGenerateImageJob(imageJob, context), /reference roles/);
  }
});

test("new multi-image jobs pass all six layouts and both user references to either provider", async () => {
  for (const model of ["gpt_image_2_5", "nano_banana_2"]) {
    const imageJob = job(model, "Use my first image for the product and my second for the style.");
    const urls = [imageJob.input_json.referenceImageUrl, ...Array.from({ length: 7 }, (_, index) => `https://media.example.test/reference-${index + 2}.png`)];
    Object.assign(imageJob.input_json, { exploreFormat: "slideshow", referenceImageUrls: urls, additionalReferenceStartIndex: 7 });
    const before = resolvedReferences.length;
    await runGenerateImageJob(imageJob, context);
    assert.deepEqual(received.at(-1).reference, urls);
    assert.deepEqual(resolvedReferences.slice(before), urls.map(url => ({ url, owner: "fixture-user" })));
    assert.match(received.at(-1).prompt, /image 1 as the primary slideshow layout.*images 2 through 6 as additional slideshow layout context.*images 7 through 8 as the user's additional image references/s);
    assert.ok(received.at(-1).prompt.endsWith(imageJob.input_json.prompt));
    const completeFingerprint = fingerprints.at(-1);
    imageJob.input_json.additionalReferenceStartIndex = 1;
    await runGenerateImageJob(imageJob, context);
    assert.match(received.at(-1).prompt, /^Use images 1 through 8 as the user's image references/);
    assert.doesNotMatch(received.at(-1).prompt, /slideshow layout/);
    assert.notEqual(fingerprints.at(-1), completeFingerprint);
  }
});

test("invalid multi-reference roles fail before reserving or invoking a provider", async () => {
  const before = received.length, reserved = fingerprints.length;
  for (const input of [{ additionalReferenceStartIndex: 0 }, { additionalReferenceStartIndex: 3 }, { additionalReferenceStartIndex: 1.5 }, { additionalReferenceStartIndex: "1" }, { additionalReferenceStartIndex: 1, subjectReferenceIndex: 2 }, { additionalReferenceStartIndex: 1, referenceImageUrls: undefined }]) {
    const imageJob = job("gpt_image_2_5", "Use references");
    Object.assign(imageJob.input_json, { exploreFormat: "slideshow", referenceImageUrls: [imageJob.input_json.referenceImageUrl, "https://media.example.test/extra.png"], ...input });
    await assert.rejects(runGenerateImageJob(imageJob, context), /reference roles/);
  }
  assert.equal(received.length, before);
  assert.equal(fingerprints.length, reserved);
});

test("regeneration target stays after the user's ordered references and receives a separate prompt role", async () => {
  const imageJob = job("gpt_image_2_5", "Use my first attached image for the product.");
  const urls = [imageJob.input_json.referenceImageUrl, "https://media.example.test/product.png", "https://media.example.test/style.png", "https://media.example.test/slide-being-edited.png"];
  Object.assign(imageJob.input_json, { exploreFormat: "slideshow", referenceImageUrls: urls, additionalReferenceStartIndex: 2, regenerationReferenceIndex: 4 });
  await runGenerateImageJob(imageJob, context);
  assert.deepEqual(received.at(-1).reference, urls);
  assert.match(received.at(-1).prompt, /images 2 through 3 as the user's additional image references.*selected order.*image 4 as the existing slide being edited/s);
  const fingerprint = fingerprints.at(-1);
  delete imageJob.input_json.regenerationReferenceIndex;
  await runGenerateImageJob(imageJob, context);
  assert.notEqual(fingerprints.at(-1), fingerprint);
  for (const input of [{ regenerationReferenceIndex: 0 }, { regenerationReferenceIndex: 2 }, { regenerationReferenceIndex: "4" }, { regenerationReferenceIndex: 4, additionalReferenceStartIndex: undefined }]) {
    Object.assign(imageJob.input_json, { additionalReferenceStartIndex: 2, ...input });
    await assert.rejects(runGenerateImageJob(imageJob, context), /regeneration reference roles/);
  }
});

test("all three image providers receive the exact character prompt and chosen reference", async () => {
  const prompt = "An adult fashion creator with glossy makeup in a clean studio.\nHands outside frame. Pink satin dress.";
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2"]) {
    await runGenerateImageJob(job(model, prompt), context);
    assert.deepEqual(received.at(-1), { model, prompt, ratio: "9:16", reference: "https://media.example.test/owned-reference.png", nativeAspectRatio: false });
  }
});

test("slideshow GPT Image 2.5 jobs select Sunburst explicitly and retain the image input", async () => {
  const prompt = "Preserve this composition and replace the product";
  const output = await runGenerateImageJob(job("gpt_image_2_5", prompt), context);
  assert.deepEqual(received.at(-1), {
    model: "gpt-image-2.5-sunburst", prompt, ratio: "9:16",
    reference: "https://media.example.test/owned-reference.png",
    nativeAspectRatio: false,
  });
  assert.equal(output.model, "gpt_image_2_5");
  assert.equal(output.provider, "openai");
});

test("long character descriptions reach every provider without summaries or truncation", async () => {
  const prompt = "Precise requested styling and studio composition. ".repeat(300) + "Final detail: no desk, no props.";
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2"]) {
    await runGenerateImageJob(job(model, prompt), context);
    assert.equal(received.at(-1).prompt, prompt);
  }
});

test("character prompt limits are enforced while other image generators preserve long instructions", async () => {
  const before = received.length;
  await assert.rejects(runGenerateImageJob(job("gpt_image", "x".repeat(32001)), context), /32000 characters/);
  const generic = job("gpt_image", "x".repeat(2001));
  delete generic.input_json.characterSource;
  assert.equal(received.length, before);
  await runGenerateImageJob(generic, context);
  assert.equal(received.at(-1).prompt, generic.input_json.prompt);
});

function seedreamFixture({ shouldSubmit = true, status = "reserved", operationId = null, metadata = {} } = {}) {
  const events = [];
  const record = name => async input => { events.push({ name, ...input }); };
  const imageJob = job("seedream_5_pro", "A candid adult portrait with natural skin texture.");
  delete imageJob.input_json.characterSource;
  return { imageJob, events, context: { checkpoint: async () => {}, store: {
    reserveGenerationProviderOperation: async input => {
      events.push({ name: "reserve", ...input });
      return { shouldSubmit, operation: { status, provider_operation_id: operationId, metadata } };
    },
    markGenerationProviderSubmitted: record("submitted"),
    markGenerationProviderSucceeded: record("succeeded"),
    markGenerationOutputPersisted: record("persisted"),
    markGenerationProviderFailed: record("failed"),
    markGenerationProviderSubmissionUncertain: record("uncertain"),
  } } };
}

test("Seedream selection routes through Runway, preserves the reference and persists the provider task", async () => {
  const f = seedreamFixture();
  const output = await runGenerateImageJob(f.imageJob, f.context);
  assert.equal(output.model, "seedream_5_pro");
  assert.equal(output.provider, "runway");
  assert.equal(seedreamCalls.at(-1).referenceImageUrl, f.imageJob.input_json.referenceImageUrl);
  assert.equal(seedreamCalls.at(-1).prompt, f.imageJob.input_json.prompt);
  assert.equal(f.events[0].provider, "runway");
  assert.equal(f.events[0].operationKey, "runway-image");
  assert.equal(f.events.find(event => event.name === "submitted").providerOperationId, "saved-seedream-task");
  assert.deepEqual(f.events.findLast(event => event.name === "succeeded").metadata, {
    model: "seedream5_pro", stagingKey: "generation-staging/fixture-job/runway-image-source.png",
  });
  assert.equal(f.events.at(-1).name, "persisted");
});

test("Seedream retries resume the saved task and reuse staged images", async () => {
  const f = seedreamFixture({ shouldSubmit: false, status: "submitted", operationId: "existing-seedream-task" });
  await runGenerateImageJob(f.imageJob, f.context);
  assert.equal(seedreamCalls.at(-1).providerOperationId, "existing-seedream-task");
  assert.equal(f.events.some(event => event.name === "submitted"), false);
  const staged = seedreamFixture({ shouldSubmit: false, status: "provider_succeeded", operationId: "existing-seedream-task", metadata: { stagingKey: "saved-seedream-source.png" } });
  const before = seedreamCalls.length;
  await runGenerateImageJob(staged.imageJob, staged.context);
  assert.equal(seedreamCalls.length, before);
});

test("an uncertain Seedream reservation cannot submit a duplicate generation", async () => {
  const f = seedreamFixture({ shouldSubmit: false });
  const before = seedreamCalls.length;
  await assert.rejects(runGenerateImageJob(f.imageJob, f.context), ProviderSubmissionUncertainError);
  assert.equal(seedreamCalls.length, before);
});

test("Seedream polling failures retain the task and terminal failures disable resubmission", async () => {
  try {
    seedreamError = new Error("Temporary polling outage");
    const pending = seedreamFixture();
    await assert.rejects(runGenerateImageJob(pending.imageJob, pending.context), error => error.code === "provider_operation_pending");
    assert.equal(pending.events.find(event => event.name === "submitted").providerOperationId, "saved-seedream-task");
    assert.equal(pending.events.some(event => event.name === "uncertain" || event.name === "failed"), false);
    seedreamError = new ProviderOperationTerminalError("Provider rejected the image");
    const failed = seedreamFixture({ shouldSubmit: false, status: "submitted", operationId: "failed-task" });
    await assert.rejects(runGenerateImageJob(failed.imageJob, failed.context), ProviderOperationTerminalError);
    assert.equal(failed.events.find(event => event.name === "failed").retryAllowed, false);
  } finally {
    seedreamError = undefined;
  }
});
