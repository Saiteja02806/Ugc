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

test("a failed Stage 2 cannot return the Stage 1 image as success", async () => {
  let calls = 0;
  await assert.rejects(generateOpenRouterGeminiHookKeyframe({
    prompt: testPrompt, aspectRatio: "9:16", apiKey,
    referenceImages: [1, 2].map(() => ({ data: dummyBase64Image, mimeType: "image/png" })),
    fetchImpl: async () => {
      calls++;
      if (calls === 2) return new Response("rejected", { status: 429 });
      return Response.json({ id: "scene", choices: [{ message: { images: [{ url: `data:image/png;base64,${dummyBase64Image}` }] } }] });
    },
  }), /HTTP 429/);
  assert.equal(calls, 2);
});

test("historical opening-plus-clarity references select the first person photo for Stage 2", async () => {
  const bodies: Array<{ messages: Array<{ content: Array<{ image_url?: { url: string } }> }> }> = [];
  await generateOpenRouterGeminiHookKeyframe({
    prompt: testPrompt, aspectRatio: "9:16", apiKey, identityReferenceStartIndex: 2,
    referenceImages: ["opening", "clarity", "person", "support"].map(data => ({ data, mimeType: "image/png" })),
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({ id: `stage-${bodies.length}`, choices: [{ message: { images: [{ url: `data:image/png;base64,${dummyBase64Image}` }] } }] });
    },
  });
  assert.equal(bodies[1].messages[0].content[2].image_url?.url, "data:image/png;base64,person");
  assert.equal(bodies[1].messages[0].content[3].image_url?.url, "data:image/png;base64,support");
});

test("standalone face swap cannot return raw output when harmonization fails", async () => {
  await assert.rejects(performOpenRouterFaceSwap({
    baseImage: { data: dummyBase64Image, mimeType: "image/png" },
    influencerImage: { data: dummyBase64Image, mimeType: "image/png" },
    aspectRatio: "9:16", apiKey,
    fetchImpl: async () => Response.json({ choices: [{ message: { images: [{ url: "data:image/png;base64,bm90LWEtcG5n" }] } }] }),
  }));
});

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
    () => buildOpenRouterGeminiImagePayload({ prompt: "valid", aspectRatio: "invalid" as "9:16" }),
    ProviderRequestNotSubmittedError,
  );
});

test("character image configuration explicitly requests 2K and the selected ratio without changing older payloads", () => {
  assert.deepEqual(buildOpenRouterGeminiImagePayload({ prompt: testPrompt, aspectRatio: "9:16", imageSize: "2K" }).image_config,
    { aspect_ratio: "9:16", image_size: "2K" });
  assert.equal(buildOpenRouterGeminiImagePayload({ prompt: testPrompt, aspectRatio: "9:16" }).image_config, undefined);
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

test("new starting-frame jobs enforce text cleanup in both paid stages without changing historical prompts", async () => {
  for (const enabled of [undefined, true]) {
    const bodies: Array<{ messages: Array<{ content: Array<{ text?: string }> }> }> = [];
    await generateOpenRouterGeminiHookKeyframe({
      prompt: "Custom scene instructions", aspectRatio: "9:16", apiKey,
      startingFrameTextCleanup: enabled,
      referenceImages: [1, 2].map(() => ({ data: dummyBase64Image, mimeType: "image/png" })),
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ choices: [{ message: { images: [{ url: `data:image/png;base64,${dummyBase64Image}` }] } }] });
      },
    });
    assert.equal(bodies.length, 2);
    for (const body of bodies) {
      const prompt = body.messages[0].content[0].text ?? "";
      if (enabled) {
        assert.match(prompt, /STARTING-FRAME TEXT CLEANUP/);
        assert.match(prompt, /caption, subtitle, hook word/);
        assert.match(prompt, /outlines, shadows and fragments/);
        assert.match(prompt, /Reconstruct the actual fabric, skin or scene material/);
        assert.match(prompt, /Keep the source room/);
      } else assert.doesNotMatch(prompt, /STARTING-FRAME TEXT CLEANUP/);
    }
    if (!enabled) assert.equal(bodies[0].messages[0].content[0].text, "Custom scene instructions");
  }
  assert.doesNotMatch(buildHookKeyframeStage2Prompt(), /STARTING-FRAME TEXT CLEANUP/);
});

test("custom outfit requests survive caption cleanup and identity replacement without importing the identity room", async () => {
  for (const custom of ["Use Image 2's gray shirt for the outfit.", "Keep the source video's outfit."]) {
    const bodies: Array<{ messages: Array<{ content: Array<{ text?: string }> }> }> = [];
    await generateOpenRouterGeminiHookKeyframe({
      prompt: custom, startingFrameOutfitPrompt: custom, startingFrameTextCleanup: true,
      aspectRatio: "9:16", apiKey, referenceImages: [1, 2].map(() => ({ data: dummyBase64Image, mimeType: "image/png" })),
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ choices: [{ message: { images: [{ url: `data:image/png;base64,${dummyBase64Image}` }] } }] });
      },
    });
    assert.equal(bodies.length, 2);
    for (const body of bodies) {
      const prompt = body.messages[0].content[0].text ?? "";
      assert(prompt.includes(custom));
      assert.match(prompt, /explicit outfit request.*overrides the default source wardrobe/);
      assert.match(prompt, /Otherwise retain Image 1's outfit/);
      assert.match(prompt, /do not override the source room, camera, pose or lighting/);
      assert.match(prompt, /Preserve the user's explicitly requested outfit while removing its lettering/);
      assert.match(prompt, /caption, subtitle, hook word/);
      assert.doesNotMatch(prompt, /Keep the source room, objects, clothing/);
    }
  }
});

test("independent background and outfit roles reach both stages with caption cleanup", async () => {
  for (const background of ["source", "photo"] as const) for (const outfit of ["source", "photo"] as const) {
    const bodies: Array<{ messages: Array<{ content: Array<{ text?: string }> }> }> = [];
    await generateOpenRouterGeminiHookKeyframe({
      prompt: "Keep source wardrobe and source room by default.", aspectRatio: "9:16", apiKey,
      referenceOptions: { background, outfit }, startingFrameTextCleanup: true,
      referenceImages: [1, 2].map(() => ({ data: dummyBase64Image, mimeType: "image/png" })),
      fetchImpl: async (_url, init) => { bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ choices: [{ message: { images: [{ url: `data:image/png;base64,${dummyBase64Image}` }] } }] }); },
    });
    for (const body of bodies) {
      const text = body.messages[0].content[0].text ?? "";
      assert.match(text, background === "photo" ? /BACKGROUND: Use the environment visible in the main influencer photo/ : /BACKGROUND: Keep the source starting frame's environment/);
      assert.match(text, outfit === "photo" ? /OUTFIT: Use the clothing visibly worn in the main influencer photo/ : /OUTFIT: Keep the source starting frame's clothing/);
      assert.match(text, /Preserve the background and outfit selected/);
      assert.match(text, /caption, subtitle, hook word/);
      assert.match(text, /original source t=0 pose/);
    }
  }
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
