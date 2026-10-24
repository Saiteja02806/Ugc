import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { mock, test } from "node:test";
import publicFrames from "../../dist/lib/hook-curated-frames.json" with { type: "json" };
import creatorFrames from "../../dist/lib/creator-source-frames.json" with { type: "json" };
import { hookKeyframeGenerationInputKey, hookKeyframePromptSha256 } from "../../dist/lib/hook-keyframe-generation-contract.js";
import { ProviderRequestNotSubmittedError } from "../../dist/lib/generation-provider.js";

// Exercise the real image adapter and its byte/receipt checks. Only the remote
// image download and Google's transport are replaced; no paid request is made.
const requests = [];
const output = Buffer.from("fixture output");
mock.module("@google/genai", { namedExports: { GoogleGenAI: class {
  interactions = { create: async request => {
    requests.push(request);
    return { id: "fixture-interaction", status: "completed", output_image: { data: output.toString("base64") } };
  }, get: async () => assert.fail("A fresh fixture must not poll Google") };
} } });
const { generateGemini3ProImageBuffer, generateGeminiImageBuffer } = await import("../../dist/lib/gemini-image.js");
const callbacks = { onOperationCreated: async () => {}, onOperationSucceeded: async () => {} };
const prompt = "Photograph my influencer in the supplied scene. Preserve its composition and remove on-screen captions.";
const publicPath = frame => new URL(`../../../public${frame.publicPath}`, import.meta.url);
const privatePath = frame => new URL(`../../../lib/explore/creator-account-media/${frame.sha256}.png`, import.meta.url);

function receipt(frame, model) {
  const partial = { version: 3, imageModel: model, ownerId: "fixture-owner", draftId: "11111111-1111-4111-8111-111111111111",
    referenceId: frame.referenceId, sourceSha256: frame.sourceSha256,
    sourceFrame: { index: frame.index, timeSeconds: frame.timeSeconds, width: frame.width, height: frame.height, sha256: frame.sha256 },
    personImageAssetIds: ["22222222-2222-4222-8222-222222222222"], instructions: "" };
  return { ...partial, purpose: "hook_starting_frame", promptVersion: 4,
    inputKey: hookKeyframeGenerationInputKey(partial), promptSha256: hookKeyframePromptSha256(prompt) };
}
async function generate(frame, model, png, mutate = value => value) {
  const bound = mutate(receipt(frame, model));
  const urls = ["https://fixtures.test/scene.png", "https://fixtures.test/person.png"];
  const download = mock.method(globalThis, "fetch", async url => new Response(String(url) === urls[0] ? png : "fixture portrait", { headers: { "Content-Type": "image/png" } }));
  const previous = { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_IMAGE_MODEL };
  process.env.GEMINI_API_KEY = "non-secret-fixture-key";
  process.env.GEMINI_IMAGE_MODEL = "legacy-override-must-not-select-curated-model";
  try {
    if (model === "gemini_3_pro") await generateGemini3ProImageBuffer({ aspectRatio: "9:16", prompt, referenceImageUrls: urls, hookKeyframe: bound, ...callbacks });
    else await generateGeminiImageBuffer(prompt, "9:16", urls, bound);
  } finally {
    download.mock.restore();
    for (const [key, value] of [["GEMINI_API_KEY", previous.key], ["GEMINI_IMAGE_MODEL", previous.model]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
for (const model of ["gemini_3_pro", "nano_banana_2"]) {
  for (const frame of publicFrames.frames) test(`curated ${frame.referenceId} uses its selected ${model} model and verified pixels`, async () => {
    requests.length = 0;
    const png = readFileSync(publicPath(frame));
    await generate(frame, model, png);
    assert.equal(requests.length, 1);
    const request = requests[0];
    assert.equal(request.model, model === "gemini_3_pro" ? "gemini-3-pro-image" : "gemini-3.1-flash-image");
    assert.equal(request.response_format.image_size, model === "gemini_3_pro" ? "2K" : "1K");
    assert.match(request.input[0].text, /VISUAL_REFERENCE/);
    assert.equal(request.input[1].data, png.toString("base64"));
    assert.match(request.input[2].text, /MY_INFLUENCER/);
  });
  for (const frame of creatorFrames.frames) test(`private curated ${frame.referenceId} reaches the real ${model} adapter`, { skip: !existsSync(privatePath(frame)) && "Local private fixture is intentionally absent from public clones" }, async () => {
    requests.length = 0;
    const png = readFileSync(privatePath(frame));
    await generate(frame, model, png);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].input[1].data, png.toString("base64"));
    assert.equal(requests[0].model, model === "gemini_3_pro" ? "gemini-3-pro-image" : "gemini-3.1-flash-image");
  });
}
test("curated receipts still reject wrong models and changed source bytes before Google submission", async () => {
  const frame = publicFrames.frames[0], png = readFileSync(publicPath(frame));
  requests.length = 0;
  await assert.rejects(generate(frame, "gemini_3_pro", png, value => {
    value.imageModel = "nano_banana_2"; value.inputKey = hookKeyframeGenerationInputKey(value); return value;
  }), error => error instanceof ProviderRequestNotSubmittedError && /model or reference inputs/.test(error.message));
  await assert.rejects(generate(frame, "nano_banana_2", png, value => {
    value.imageModel = "gemini_3_pro"; value.inputKey = hookKeyframeGenerationInputKey(value); return value;
  }), ProviderRequestNotSubmittedError);
  const changed = Buffer.from(png); changed[changed.length - 1] ^= 1;
  await assert.rejects(generate(frame, "gemini_3_pro", changed), error => error instanceof ProviderRequestNotSubmittedError && /downloaded source image/.test(error.message));
  assert.equal(requests.length, 0);
});

for (const [version, model] of [[1, "nano_banana_2"], [2, "nano_banana_2"], [2, "gemini_3_pro"]]) {
  test(`legacy v${version} ${model} keeps its existing model and reference behavior`, async () => {
    const frame = publicFrames.frames[0], png = readFileSync(publicPath(frame));
    requests.length = 0;
    await generate(frame, model, png, value => {
      value.version = version; value.promptVersion = 2;
      value.sourceFrame.index = 0; value.sourceFrame.timeSeconds = 0;
      if (version === 1) delete value.imageModel;
      value.inputKey = hookKeyframeGenerationInputKey(value); return value;
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].model, version === 1 ? "legacy-override-must-not-select-curated-model" : model === "gemini_3_pro" ? "gemini-3-pro-image" : "gemini-3.1-flash-image");
    assert.match(requests[0].input[0].text, /BASE_SCENE_TO_EDIT/);
  });
}
