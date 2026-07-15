import assert from "node:assert/strict";
import test from "node:test";

import { publishYouTubeVideo } from "./youtube-publisher.js";

const MEDIA_URL = "https://cdn.example.com/video.mp4";
const UPLOAD_URL = "https://upload.example.com/session-existing";

test("returns the completed video from a saved resumable session", async () => {
  const requests: Array<{ method: string; url: string }> = [];

  await withMockFetch(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({ method, url });

    if (url === MEDIA_URL) {
      return videoResponse();
    }

    assert.equal(url, UPLOAD_URL);
    assert.equal(new Headers(init?.headers).get("content-range"), "bytes */4");
    return Response.json({ id: "youtube-video-existing" }, { status: 201 });
  }, async () => {
    const result = await publishYouTubeVideo({
      accessToken: "access-token",
      caption: "Caption",
      mimeType: "video/mp4",
      title: "Title",
      uploadUrl: UPLOAD_URL,
      videoUrl: MEDIA_URL,
    });

    assert.equal(result.videoId, "youtube-video-existing");
  });

  assert.deepEqual(requests, [
    { method: "GET", url: MEDIA_URL },
    { method: "PUT", url: UPLOAD_URL },
  ]);
});

test("continues a saved YouTube session from the accepted byte range", async () => {
  let uploadBody: Buffer | null = null;
  let uploadContentRange: string | null = null;

  await withMockFetch(async (input, init) => {
    const url = String(input);

    if (url === MEDIA_URL) {
      return videoResponse();
    }

    assert.equal(url, UPLOAD_URL);
    const headers = new Headers(init?.headers);

    if (headers.get("content-range") === "bytes */4") {
      return new Response(null, {
        headers: { Range: "bytes=0-1" },
        status: 308,
      });
    }

    uploadContentRange = headers.get("content-range");
    uploadBody = Buffer.from(init?.body as ArrayBuffer);
    return Response.json({ id: "youtube-video-resumed" }, { status: 201 });
  }, async () => {
    const result = await publishYouTubeVideo({
      accessToken: "access-token",
      caption: "Caption",
      mimeType: "video/mp4",
      title: "Title",
      uploadUrl: UPLOAD_URL,
      videoUrl: MEDIA_URL,
    });

    assert.equal(result.videoId, "youtube-video-resumed");
  });

  assert.equal(uploadContentRange, "bytes 2-3/4");
  assert.deepEqual(uploadBody, Buffer.from([3, 4]));
});

test("replaces an expired YouTube resumable session", async () => {
  const replacementUrl = "https://upload.example.com/session-replacement";
  let persistedUrl: string | null = null;

  await withMockFetch(async (input, init) => {
    const url = String(input);

    if (url === MEDIA_URL) {
      return videoResponse();
    }

    if (url === UPLOAD_URL) {
      return new Response(null, { status: 404 });
    }

    if (url.includes("/upload/youtube/v3/videos")) {
      assert.equal(init?.method, "POST");
      return new Response(null, {
        headers: { Location: replacementUrl },
        status: 200,
      });
    }

    assert.equal(url, replacementUrl);
    return Response.json({ id: "youtube-video-replacement" }, { status: 201 });
  }, async () => {
    const result = await publishYouTubeVideo({
      accessToken: "access-token",
      caption: "Caption",
      mimeType: "video/mp4",
      onUploadSessionCreated: async (uploadUrl) => {
        persistedUrl = uploadUrl;
      },
      title: "Title",
      uploadUrl: UPLOAD_URL,
      videoUrl: MEDIA_URL,
    });

    assert.equal(result.videoId, "youtube-video-replacement");
  });

  assert.equal(persistedUrl, replacementUrl);
});

function videoResponse() {
  return new Response(Uint8Array.from([1, 2, 3, 4]), {
    headers: {
      "Content-Length": "4",
      "Content-Type": "video/mp4",
    },
    status: 200,
  });
}

async function withMockFetch(
  mockFetch: typeof fetch,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
