import assert from "node:assert/strict";
import test from "node:test";

import { buildGeminiImageRequest } from "./gemini-image.js";

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
