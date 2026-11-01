import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHookKeyframeStage2Prompt,
  buildOpenRouterGeminiImagePayload,
  generateOpenRouterGeminiHookKeyframe,
  generateOpenRouterGeminiImage,
  performOpenRouterFaceSwap,
  OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL,
} from "./openrouter-gemini-image.js";
import { ProviderRequestNotSubmittedError } from "./generation-provider.js";

const apiKey = "test-openrouter-key";
const testPrompt = "A photorealistic starting frame recreation with influencer identity.";
const dummyBase64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("buildOpenRouterGeminiImagePayload constructs valid multimodal image request", () => {
  const payload = buildOpenRouterGeminiImagePayload({
    prompt: testPrompt,
    aspectRatio: "9:16",
    referenceImages: [
      { data: dummyBase64Image, mimeType: "image/png" },
    ],
  });

  assert.equal(payload.model, OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL);
  assert.equal(payload.messages[0].role, "user");
  assert.equal(payload.messages[0].content[0].type, "text");
  assert.equal(payload.messages[0].content[0].text, testPrompt);
  assert.equal(payload.messages[0].content[1].type, "image_url");
  assert.equal(payload.messages[0].content[1].image_url.url, `data:image/png;base64,${dummyBase64Image}`);
  assert.deepEqual(payload.modalities, ["image"]);
});

test("buildOpenRouterGeminiImagePayload rejects empty prompt or invalid aspect ratio", () => {
  assert.throws(
    () => buildOpenRouterGeminiImagePayload({ prompt: "   ", aspectRatio: "9:16" }),
    ProviderRequestNotSubmittedError,
  );
  assert.throws(
    () => buildOpenRouterGeminiImagePayload({ prompt: "valid", aspectRatio: "invalid" as any }),
    ProviderRequestNotSubmittedError,
  );
});

test("generateOpenRouterGeminiImage returns buffer on HTTP 200 with base64 image", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        id: "gen-12345",
        model: OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL,
        choices: [
          {
            message: {
              images: [
                {
                  url: `data:image/png;base64,${dummyBase64Image}`,
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  const result = await generateOpenRouterGeminiImage(
    {
      prompt: testPrompt,
      aspectRatio: "9:16",
    },
    {
      apiKey,
      fetchImpl: mockFetch,
    },
  );

  assert.equal(result.requestId, "gen-12345");
  assert.equal(result.model, OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL);
  assert(result.buffer instanceof Buffer);
  assert.equal(result.buffer.toString("base64"), dummyBase64Image);
});

test("generateOpenRouterGeminiImage rejects when upstream returns error", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response("Rate limit exceeded", { status: 429 });

  await assert.rejects(
    generateOpenRouterGeminiImage(
      {
        prompt: testPrompt,
        aspectRatio: "9:16",
      },
      {
        apiKey,
        fetchImpl: mockFetch,
      },
    ),
    /OpenRouter image generation failed with HTTP 429/,
  );
});

test("performOpenRouterFaceSwap sends two images to Stage 2 prompt and returns harmonized buffer", async () => {
  const mockFetch: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL);
    // 1 text instruction + 2 images
    assert.equal(body.messages[0].content.length, 3);
    assert.match(body.messages[0].content[0].text, /STAGE 2 IDENTITY LOCK/);
    assert.doesNotMatch(body.messages[0].content[0].text, /dark-brown|pillowy|bridge freckles|compact forehead/);
    return new Response(
      JSON.stringify({
        id: "swap-12345",
        model: OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL,
        choices: [
          {
            message: {
              images: [{ url: `data:image/png;base64,${dummyBase64Image}` }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const result = await performOpenRouterFaceSwap(
    {
      baseImage: { data: dummyBase64Image, mimeType: "image/png" },
      influencerImage: { data: dummyBase64Image, mimeType: "image/png" },
      aspectRatio: "4:5",
      instructions: "Match hair color exactly.",
      apiKey,
      fetchImpl: mockFetch,
    },
  );

  assert.equal(result.requestId, "swap-12345");
  assert(result.buffer instanceof Buffer);
  assert(result.buffer.byteLength > 0);
});

test("stage 2 prompt copies the influencer photo instead of a fixed face", () => {
  const prompt = buildHookKeyframeStage2Prompt({ supportingImageCount: 2, instructions: "Keep the glasses." });
  assert.match(prompt, /STAGE 2 IDENTITY LOCK/);
  assert.match(prompt, /Copy the features that photo actually shows/);
  assert.match(prompt, /Images 3 through 4 are other photos of the same person/);
  assert.match(prompt, /Keep the glasses/);
  assert.doesNotMatch(prompt, /dark-brown|pillowy|bridge freckles|compact forehead|hazel/);
  assert.match(buildHookKeyframeStage2Prompt(), /Image 2 is the only identity photo/);
});

test("generateOpenRouterGeminiHookKeyframe sends supporting photos to stage 2", async () => {
  const bodies: Array<{ messages: Array<{ content: Array<{ type: string; text?: string }> }> }> = [];
  const mockFetch: typeof fetch = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        id: bodies.length === 1 ? "stage-1" : "stage-2",
        model: OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL,
        choices: [{ message: { images: [{ url: `data:image/png;base64,${dummyBase64Image}` }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const result = await generateOpenRouterGeminiHookKeyframe({
    prompt: "Stage 1 scene prompt",
    aspectRatio: "9:16",
    referenceImages: [
      { data: dummyBase64Image, mimeType: "image/png" },
      { data: dummyBase64Image, mimeType: "image/png" },
      { data: dummyBase64Image, mimeType: "image/png" },
      { data: dummyBase64Image, mimeType: "image/png" },
    ],
    apiKey,
    fetchImpl: mockFetch,
  });

  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].messages[0].content.length, 5);
  assert.equal(bodies[0].messages[0].content[0].text, "Stage 1 scene prompt");
  assert.equal(bodies[1].messages[0].content.length, 5);
  assert.match(bodies[1].messages[0].content[0].text ?? "", /Images 3 through 4/);
  assert.doesNotMatch(bodies[1].messages[0].content[0].text ?? "", /dark-brown|pillowy|bridge freckles/);
  assert.equal(result.requestId, "stage-2");
});
