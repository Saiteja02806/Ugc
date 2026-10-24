import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createHash } from "node:crypto";
import type { GoogleGenAI } from "@google/genai";

import { buildGeminiImageRequest, generateGemini3ProImageBuffer } from "./gemini-image.js";
import { ProviderOperationPollingError, ProviderOperationTerminalError, ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { hookKeyframeGenerationInputKey, hookKeyframePromptSha256, type HookKeyframeGenerationReceipt } from "./hook-keyframe-generation-contract.js";

test("builds a supported Gemini image response format", () => {
  const request = buildGeminiImageRequest({
    aspectRatio: "9:16",
    model: "gemini-nano-banana-2.1",
    prompt: "A bright product photograph.",
    referenceImage: null,
  });

  assert.deepEqual(request, {
    input: "A bright product photograph.",
    model: "gemini-nano-banana-2.1",
    response_format: {
      aspect_ratio: "9:16",
      image_size: "1K",
      type: "image",
    },
  });
  assert.equal("delivery" in request.response_format, false);
});

const base = { aspectRatio: "9:16" as const, prompt: "A cup on a table." };
const image = Buffer.from("generated-image").toString("base64");
function fakeClient(events: string[], status = "completed", data: string | undefined = image) {
  return { interactions: {
    create: async (request: unknown) => {
      events.push("create");
      assert.deepEqual(request, buildGeminiImageRequest({ ...base, model: "gemini-3-pro-image", referenceImage: null, imageSize: "2K" }));
      return { id: "google-interaction", status, output_image: data ? { data } : undefined };
    },
    get: async (id: string) => { events.push(`get:${id}`); return { id, status, output_image: data ? { data } : undefined }; },
  } } as unknown as GoogleGenAI;
}
function callbacks(events: string[]) {
  return {
    onOperationCreated: async (id: string) => { assert.equal(id, "google-interaction"); events.push("persist-id"); },
    onOperationSucceeded: async () => { events.push("persist-success"); },
  };
}

test("Gemini 3 Pro uses the exact Google model and 2K output even with a legacy Flash override", async () => {
  const previous = process.env.GEMINI_IMAGE_MODEL;
  process.env.GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";
  const events: string[] = [];
  try {
    const buffer = await generateGemini3ProImageBuffer({ ...base, ...callbacks(events) }, fakeClient(events));
    assert.equal(buffer.toString(), "generated-image");
    assert.deepEqual(events, ["create", "persist-id", "persist-success"]);
  } finally { if (previous === undefined) delete process.env.GEMINI_IMAGE_MODEL; else process.env.GEMINI_IMAGE_MODEL = previous; }
});

test("Gemini 3 Pro keeps a reference image alongside the full prompt and selected ratio", async () => {
  const events: string[] = [];
  const client = fakeClient(events);
  const createMock = mock.method(client.interactions, "create", async (request: unknown) => {
    assert.deepEqual(request, buildGeminiImageRequest({ ...base, aspectRatio: "4:5", model: "gemini-3-pro-image", imageSize: "2K", referenceImage: { data: Buffer.from("reference-image").toString("base64"), mimeType: "image/jpeg" } }));
    return { id: "google-interaction", status: "completed", output_image: { data: image } };
  });
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response("reference-image", { headers: { "Content-Type": "image/jpeg" } }));
  try {
    await generateGemini3ProImageBuffer({ ...base, aspectRatio: "4:5", referenceImageUrl: "https://storage.example.com/reference.jpg", ...callbacks(events) }, client);
    assert.equal(createMock.mock.callCount(), 1);
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally { createMock.mock.restore(); fetchMock.mock.restore(); }
});

test("Gemini 3 Pro sends the full ordered reference list beside the unchanged prompt", async () => {
  const events: string[] = [];
  const client = fakeClient(events);
  const urls = ["https://storage.example.com/person.jpg", "https://storage.example.com/room.jpg"];
  const createMock = mock.method(client.interactions, "create", async (request: unknown) => {
    assert.deepEqual(request, buildGeminiImageRequest({ ...base, model: "gemini-3-pro-image", imageSize: "2K", referenceImage: null,
      referenceImages: urls.map(url => ({ data: Buffer.from(url).toString("base64"), mimeType: "image/jpeg" })) }));
    return { id: "google-interaction", status: "completed", output_image: { data: image } };
  });
  const fetchMock = mock.method(globalThis, "fetch", async (url: string | URL | Request) => new Response(String(url), { headers: { "Content-Type": "image/jpeg" } }));
  try {
    await generateGemini3ProImageBuffer({ ...base, referenceImageUrls: urls, ...callbacks(events) }, client);
    assert.equal(createMock.mock.callCount(), 1);
    assert.equal(fetchMock.mock.callCount(), 2);
  } finally { createMock.mock.restore(); fetchMock.mock.restore(); }
});

test("accepted Google interactions recover without creating again or downloading the original reference", async () => {
  const events: string[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new Error("The saved interaction must be reused"); });
  try {
    await generateGemini3ProImageBuffer({ ...base, referenceImageUrl: "https://storage.example.com/ref.png", providerOperationId: "saved-interaction", ...callbacks(events) }, fakeClient(events));
    assert.deepEqual(events, ["get:saved-interaction", "persist-success"]);
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally { fetchMock.mock.restore(); }
});

test("Google status retrieval failures retain the interaction for recovery", async () => {
  const events: string[] = [];
  const client = fakeClient(events);
  const getMock = mock.method(client.interactions, "get", async () => { throw new Error("Temporary Google outage"); });
  try {
    await assert.rejects(generateGemini3ProImageBuffer({ ...base, providerOperationId: "saved-interaction", ...callbacks(events) }, client), ProviderOperationPollingError);
    assert.deepEqual(events, []);
  } finally { getMock.mock.restore(); }
});

test("Google terminal failures and missing image data cannot trigger another paid submission", async () => {
  for (const status of ["failed", "completed"]) {
    const events: string[] = [];
    await assert.rejects(generateGemini3ProImageBuffer({ ...base, providerOperationId: "saved-interaction", ...callbacks(events) }, fakeClient(events, status, "")), ProviderOperationTerminalError);
    assert.deepEqual(events, ["get:saved-interaction"]);
  }
});

test("blank Pro prompts are rejected before calling Google", async () => {
  const events: string[] = [];
  for (const prompt of ["", " \n\t "]) {
    await assert.rejects(generateGemini3ProImageBuffer({ ...base, prompt, ...callbacks(events) }, fakeClient(events)), ProviderRequestNotSubmittedError);
  }
  assert.deepEqual(events, []);
});

test("long Pro instructions reach Google without an app character cap or truncation", async () => {
  const events: string[] = [];
  const client = fakeClient(events);
  const prompt = `Composition details.\n${"Preserve the natural light. ".repeat(800)}\nKeep the ending instruction.`;
  const createMock = mock.method(client.interactions, "create", async (request: ReturnType<typeof buildGeminiImageRequest>) => {
    assert.equal(request.input, prompt);
    events.push("create");
    return { id: "google-interaction", status: "completed", output_image: { data: Buffer.from("image").toString("base64") } };
  });
  try {
    await generateGemini3ProImageBuffer({ ...base, prompt, ...callbacks(events) }, client);
    assert.equal(createMock.mock.callCount(), 1);
    assert.deepEqual(events, ["create", "persist-id", "persist-success"]);
  } finally { createMock.mock.restore(); }
});

test("preserves a reference image in the Gemini image request", () => {
  const request = buildGeminiImageRequest({
    aspectRatio: "1:1",
    model: "gemini-nano-banana-2.1",
    prompt: "Restyle this image.",
    referenceImage: { data: "aW1hZ2U=", mimeType: "image/png" },
  });

  assert.deepEqual(request.input, [
    { data: "aW1hZ2U=", mime_type: "image/png", type: "image" },
    { text: "Restyle this image.", type: "text" },
  ]);
});

test("Hook Pro uses explicit Pro/2K with bound image labels and verified scene, and recovery reads its accepted interaction without resubmission", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV8AAAAASUVORK5CYII=", "base64");
  const prompt = "Edit the base scene using only the main face identity.";
  const partial = { version: 2 as const, imageModel: "gemini_3_pro" as const, ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: "hook-fixture", sourceSha256: "a".repeat(64),
    sourceFrame: { index: 0 as const, timeSeconds: 0 as const, width: 1, height: 1, sha256: createHash("sha256").update(png).digest("hex") },
    personImageAssetIds: ["22222222-2222-4222-8222-222222222222"], instructions: "" };
  const receipt: HookKeyframeGenerationReceipt = { ...partial, purpose: "hook_starting_frame", promptVersion: 2,
    inputKey: hookKeyframeGenerationInputKey(partial), promptSha256: hookKeyframePromptSha256(prompt) };
  const events: string[] = [], client = fakeClient(events);
  const createMock = mock.method(client.interactions, "create", async (request: ReturnType<typeof buildGeminiImageRequest>) => {
    assert.equal(request.model, "gemini-3-pro-image"); assert.equal(request.response_format.image_size, "2K");
    const input = request.input as { type: string; text?: string; data?: string }[];
    assert.match(input[0].text!, /BASE_SCENE_TO_EDIT/); assert.equal(input[1].data, png.toString("base64"));
    assert.match(input[2].text!, /MAIN_FACE_IDENTITY/); assert.equal(input[3].data, Buffer.from("portrait").toString("base64"));
    assert.equal(input[4].text, prompt);
    return { id: "google-interaction", status: "completed", output_image: { data: image } };
  });
  const fetchMock = mock.method(globalThis, "fetch", async (url: string | URL | Request) => new Response(String(url).endsWith("scene.png") ? png : "portrait", { headers: { "content-type": "image/png" } }));
  const old = process.env.GEMINI_IMAGE_MODEL; process.env.GEMINI_IMAGE_MODEL = "must-not-override-pro";
  try {
    await generateGemini3ProImageBuffer({ aspectRatio: "1:1", prompt, referenceImageUrls: ["https://media.test/scene.png", "https://media.test/portrait.png"], hookKeyframe: receipt, ...callbacks(events) }, client);
    assert.equal(createMock.mock.callCount(), 1);
    const downloads = fetchMock.mock.callCount();
    await generateGemini3ProImageBuffer({ aspectRatio: "1:1", prompt, referenceImageUrls: ["https://unavailable.test/scene.png"], hookKeyframe: receipt, providerOperationId: "saved-interaction", ...callbacks(events) }, client);
    assert.equal(createMock.mock.callCount(), 1); assert.equal(fetchMock.mock.callCount(), downloads);
    const tampered = { ...receipt, sourceFrame: { ...receipt.sourceFrame, sha256: "f".repeat(64) } };
    tampered.inputKey = hookKeyframeGenerationInputKey(tampered);
    await assert.rejects(generateGemini3ProImageBuffer({ aspectRatio: "1:1", prompt, referenceImageUrls: ["https://media.test/scene.png", "https://media.test/portrait.png"], hookKeyframe: tampered, ...callbacks(events) }, client), ProviderRequestNotSubmittedError);
    assert.equal(createMock.mock.callCount(), 1);
  } finally { createMock.mock.restore(); fetchMock.mock.restore(); if (old === undefined) delete process.env.GEMINI_IMAGE_MODEL; else process.env.GEMINI_IMAGE_MODEL = old; }
});
