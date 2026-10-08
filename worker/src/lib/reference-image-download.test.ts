import assert from "node:assert/strict";
import test from "node:test";

import { downloadReferenceImageBytes, downloadReferenceImageContext } from "./reference-image-download.js";

test("downloads exactly the selected context in order with a combined byte limit", async () => {
  const originalFetch = globalThis.fetch;
  const urls = ["https://storage.test/one.png", "https://storage.test/four.png", "https://storage.test/six.png"];
  const reads: string[] = [];
  globalThis.fetch = async url => { reads.push(String(url)); return new Response(Uint8Array.from([1, 2]), { headers: { "content-type": "image/png" } }); };
  try {
    assert.equal((await downloadReferenceImageContext(urls.slice(0, 2), 4)).length, 2);
    assert.deepEqual(reads, urls.slice(0, 2));
    reads.length = 0;
    await assert.rejects(downloadReferenceImageContext(urls, 4), /combined/);
    assert.deepEqual(reads, urls.slice(0, 2));
  } finally { globalThis.fetch = originalFetch; }
});

test("invalid image context stops before provider submission", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not an image", { headers: { "content-type": "text/html" } });
  try { await assert.rejects(downloadReferenceImageContext(["https://storage.test/image.png"]), /JPG, PNG or WebP/); }
  finally { globalThis.fetch = originalFetch; }
});

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
