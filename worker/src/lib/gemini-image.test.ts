import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { GoogleGenAI } from "@google/genai";

import { buildGeminiImageRequest, generateGemini3ProImageBuffer } from "./gemini-image.js";
import { ProviderOperationPollingError, ProviderOperationTerminalError, ProviderRequestNotSubmittedError } from "./generation-provider.js";

test("builds a supported Gemini image response format", () => {
  const request = buildGeminiImageRequest({
    aspectRatio: "9:16",
    model: "gemini-3.1-flash-image",
    prompt: "A bright product photograph.",
    referenceImage: null,
  });

  assert.deepEqual(request, {
    input: "A bright product photograph.",
    model: "gemini-3.1-flash-image",
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
    model: "gemini-3.1-flash-image",
    prompt: "Restyle this image.",
    referenceImage: { data: "aW1hZ2U=", mimeType: "image/png" },
  });

  assert.deepEqual(request.input, [
    { data: "aW1hZ2U=", mime_type: "image/png", type: "image" },
    { text: "Restyle this image.", type: "text" },
  ]);
});
