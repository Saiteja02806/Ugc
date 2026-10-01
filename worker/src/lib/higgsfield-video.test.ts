import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { resumeLegacyHiggsfieldVideoBuffer } from "./higgsfield-video.js";

test("refuses all fresh Higgsfield requests before credential or network access", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new Error("No network allowed"); });
  try {
    await assert.rejects(resumeLegacyHiggsfieldVideoBuffer({ onOperationSucceeded: async () => {} }), /generation is disabled/);
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally { fetchMock.mock.restore(); }
});

test("recovers a saved output without Higgsfield credentials or new generation", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    assert.equal(String(url), "https://storage.example.com/old.mp4");
    return new Response("saved video", { headers: { "Content-Type": "video/mp4" } });
  });
  try {
    const buffer = await resumeLegacyHiggsfieldVideoBuffer({
      providerOperationId: "old-task", providerOutputUrl: "https://storage.example.com/old.mp4",
      onOperationSucceeded: async () => { throw new Error("Already succeeded"); },
    });
    assert.equal(buffer.toString(), "saved video");
  } finally { fetchMock.mock.restore(); }
});
