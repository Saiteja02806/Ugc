import assert from "node:assert/strict";
import test from "node:test";

import { downloadReferenceImageBytes } from "./reference-image-download.js";

test("accepts a reference at the byte limit", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(Uint8Array.from([1, 2, 3, 4]), {
    headers: { "content-type": "image/png", "content-length": "4" },
  });
  try {
    const result = await downloadReferenceImageBytes("https://example.test/ref.png", 4);
    assert.deepEqual(result.buffer, Buffer.from([1, 2, 3, 4]));
    assert.equal(result.contentType, "image/png");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an excessive declared length before reading", async () => {
  const originalFetch = globalThis.fetch;
  let canceled = false;
  globalThis.fetch = async () => new Response(new ReadableStream<Uint8Array>({
    cancel: () => { canceled = true; },
  }), { headers: { "content-length": "5" } });
  try {
    await assert.rejects(downloadReferenceImageBytes("https://example.test/ref.png", 4), /too large/);
    assert.equal(canceled, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stops a stream that exceeds the limit without Content-Length", async () => {
  const originalFetch = globalThis.fetch;
  let canceled = false;
  globalThis.fetch = async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Uint8Array.from([1, 2, 3]));
      controller.enqueue(Uint8Array.from([4, 5, 6]));
    },
    cancel: () => { canceled = true; },
  }), { headers: { "content-type": "image/png" } });
  try {
    await assert.rejects(downloadReferenceImageBytes("https://example.test/ref.png", 4), /too large/);
    assert.equal(canceled, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
