import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  buildHookKeyframeStage2Prompt,
  buildOpenRouterGeminiImagePayload,
  generateOpenRouterGeminiHookKeyframe,
  generateOpenRouterGeminiImage,
  performOpenRouterFaceSwap,
  OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL,
} from "./openrouter-gemini-image.js";
import { ProviderRequestNotSubmittedError, ProviderImageResponseError } from "./generation-provider.js";

const apiKey = "test-openrouter-key";
const testPrompt = "A photorealistic starting frame recreation with influencer identity.";
const dummyBase64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("versioned starting frames explicitly configure both paid stages while legacy stages stay unchanged", async () => {
  const png = await sharp({ create: { width: 32, height: 18, channels: 3, background: "#987654" } }).png().toBuffer();
  for (const imageSize of [undefined, "2K"] as const) {
    const payloads: Array<Record<string, unknown>> = [];
    await generateOpenRouterGeminiHookKeyframe({
      prompt: testPrompt, aspectRatio: "16:9", apiKey, ...(imageSize ? { imageSize } : {}),
      referenceImages: [1, 2].map(() => ({ data: dummyBase64Image, mimeType: "image/png" })),
      fetchImpl: async (_url, init) => {
        payloads.push(JSON.parse(String(init?.body)));
        return Response.json({ choices: [{ message: { images: [{ url: `data:image/png;base64,${png.toString("base64")}` }] } }] });
      },
      runStage: async (stage, _input, action) => stage === "harmonize" ? { buffer: Buffer.from(dummyBase64Image, "base64"), model: "test" } : action(),
    });
    assert.equal(payloads.length, 2);
    for (const payload of payloads) assert.deepEqual(payload.image_config, imageSize ? { aspect_ratio: "16:9", image_size: "2K" } : undefined);
  }
});

test("versioned scene shape drift stops before another paid stage", async () => {
  let calls = 0;
  await assert.rejects(generateOpenRouterGeminiHookKeyframe({ prompt: testPrompt, aspectRatio: "9:16", imageSize: "2K", apiKey,
    referenceImages: [1, 2].map(() => ({ data: dummyBase64Image, mimeType: "image/png" })),
    fetchImpl: async () => { calls++; return Response.json({ choices: [{ message: { images: [{ url: `data:image/png;base64,${dummyBase64Image}` }] } }] }); },
  }), error => error instanceof Error && "code" in error && error.code === "image_aspect_ratio_mismatch");
  assert.equal(calls, 1);
});

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

test("empty image responses distinguish completed outcomes from incomplete responses without leaking response text", async () => {
  for (const finish_reason of ["stop", "content_filter", "length", "error", undefined, "tool_calls"]) {
    await assert.rejects(generateOpenRouterGeminiImage({ prompt: testPrompt, aspectRatio: "9:16" }, {
      apiKey, fetchImpl: async () => Response.json({ id: "gen-test-123", choices: [{ finish_reason,
        message: { content: "PRIVATE RESPONSE TEXT", refusal: "PRIVATE REFUSAL" } }] }),
    }), error => {
      assert(error instanceof ProviderImageResponseError);
      assert.equal(error.completed, ["stop", "content_filter", "length", "error"].includes(finish_reason ?? ""));
      assert.equal(error.requestId, "gen-test-123");
      assert.doesNotMatch(error.message, /PRIVATE/);
      return true;
    });
  }
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
  for (const background of ["source", "photo"] as const) for (const outfit of ["source", "photo"] as const) for (const hairstyle of ["source", "photo"] as const) {
    const bodies: Array<{ messages: Array<{ content: Array<{ text?: string }> }> }> = [];
    await generateOpenRouterGeminiHookKeyframe({
      prompt: "Keep source wardrobe and source room by default.", aspectRatio: "9:16", apiKey,
      referenceOptions: { background, outfit, hairstyle }, startingFrameTextCleanup: true,
      referenceImages: [1, 2].map(() => ({ data: dummyBase64Image, mimeType: "image/png" })),
      fetchImpl: async (_url, init) => { bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ choices: [{ message: { images: [{ url: `data:image/png;base64,${dummyBase64Image}` }] } }] }); },
    });
    assert.equal(bodies.length, 2);
    for (const body of bodies) {
      const text = body.messages[0].content[0].text ?? "";
      assert.match(text, background === "photo" ? /BACKGROUND: Use Image2's environment/ : /BACKGROUND: Keep Image1's environment/);
      assert.match(text, outfit === "photo" ? /OUTFIT: Use Image2's clothing/ : /OUTFIT: Keep Image1's clothing/);
      assert.match(text, /Preserve the background, outfit and hairstyle selected/);
      assert.match(text, hairstyle === "photo" ? /HAIRSTYLE: Use Image2's hairstyle, hair color, length, texture, parting and volume/ : /HAIRSTYLE: Keep Image1's hairstyle/);
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

test("face swap forwards primary and supporting same-person photos without changing scene authority", async () => {
  const refs = ["scene", "primary", "support-1", "support-2", "support-3"].map(data => ({ data: Buffer.from(data).toString("base64"), mimeType: "image/png" }));
  let calls = 0;
  let identityInput: unknown;
  await performOpenRouterFaceSwap({ baseImage: refs[0], influencerImage: refs[1], supportingIdentityImages: refs.slice(2), aspectRatio: "4:5", apiKey,
    runStage: async (stage, input, action) => { if (stage === "identity") { identityInput = input; return action(); } return { buffer: Buffer.from(dummyBase64Image, "base64"), model: "test" }; },
    fetchImpl: async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      const content = body.messages[0].content;
      assert.equal(content.length, 6);
      assert.match(content[0].text, /SAME person/);
      assert.match(content[0].text, /Preserve Image 1 scene, clothing, composition and pose/);
      for (let index = 0; index < refs.length; index++) assert.equal(content[index + 1].image_url.url, `data:image/png;base64,${refs[index].data}`);
      return Response.json({ choices: [{ message: { images: [{ url: `data:image/png;base64,${dummyBase64Image}` }] } }] });
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual((identityInput as { referenceImages: unknown[] }).referenceImages, refs);
});


test("legacy two-role canonical data, image labels and identity-stage prompt remain byte-identical", async () => {
  const { createHash } = await import("node:crypto");
  const { canonicalStartingFrameReferenceOptions, startingFrameReferenceInstructions } = await import("./starting-frame-reference-options.js");
  const { hookKeyframeProviderImageLabels } = await import("./hook-keyframe-image-labels.js");
  const expected = {
    "source/source": "abb107c438a2a97673bd1928909a8dadf33b81fc8a4b750c7bba1c9d38391212",
    "source/photo": "c3a671e243ba83dfc15c029721a24abe0389bd9b7ee2d1e074027468ecc08f34",
    "photo/source": "17d0784e92d3cdac2c31add1f10ae3679e4aeed4be9e774c354c9c646481103b",
    "photo/photo": "103c2a3ce7c4edd89f9652ea99d82a228022a1ac68b5e67b31c504b6182dd4d7",
  };
  for (const background of ["source", "photo"] as const) for (const outfit of ["source", "photo"] as const) {
    const referenceOptions = { background, outfit };
    const digest = createHash("sha256").update(JSON.stringify([canonicalStartingFrameReferenceOptions(referenceOptions), startingFrameReferenceInstructions(referenceOptions), hookKeyframeProviderImageLabels(2,7,referenceOptions), buildHookKeyframeStage2Prompt({referenceOptions,startingFrameTextCleanup:true})])).digest("hex");
    assert.equal(digest,expected[`${background}/${outfit}`]);
  }
});
