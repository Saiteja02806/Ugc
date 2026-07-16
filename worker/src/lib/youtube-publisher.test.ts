import assert from "node:assert/strict";
import test from "node:test";

import {
  publishYouTubeVideo,
  YouTubePublishError,
} from "./youtube-publisher.js";

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

test("sends the selected YouTube visibility and audience settings", async () => {
  const sessionUrl = "https://upload.example.com/session-settings";
  const sessionBodies: Array<Record<string, unknown>> = [];
  const notifySubscriberValues: Array<string | null> = [];

  await withMockFetch(async (input, init) => {
    const url = String(input);

    if (url === MEDIA_URL) {
      return videoResponse();
    }

    if (url.includes("/upload/youtube/v3/videos")) {
      const uploadUrl = new URL(url);
      notifySubscriberValues.push(
        uploadUrl.searchParams.get("notifySubscribers"),
      );
      sessionBodies.push(
        JSON.parse(String(init?.body)) as Record<string, unknown>,
      );
      return new Response(null, {
        headers: { Location: sessionUrl },
        status: 200,
      });
    }

    assert.equal(url, sessionUrl);
    return Response.json({ id: "youtube-video-settings" }, { status: 201 });
  }, async () => {
    await publishYouTubeVideo({
      accessToken: "access-token",
      caption: "Caption",
      mimeType: "video/mp4",
      settings: {
        containsSyntheticMedia: false,
        madeForKids: true,
        notifySubscribers: true,
        privacyStatus: "unlisted",
      },
      title: "Title",
      videoUrl: MEDIA_URL,
    });
  });

  assert.equal(notifySubscriberValues[0], "true");
  assert.deepEqual(sessionBodies[0]?.status, {
    containsSyntheticMedia: false,
    privacyStatus: "unlisted",
    selfDeclaredMadeForKids: true,
  });
});

test("classifies invalid YouTube credentials as a reconnect requirement", async () => {
  await assertYouTubeSessionError(
    {
      error: {
        code: 401,
        errors: [{ reason: "invalidCredentials" }],
        message: "Invalid Credentials",
      },
    },
    401,
    (error) => {
      assert.equal(error.code, "access_token_invalid");
      assert.equal(error.actionRequired, true);
      assert.equal(error.retryable, false);
      assert.equal(error.userMessage, "Reconnect YouTube to continue publishing.");
    },
  );
});

test("classifies missing YouTube permissions as reconnectable", async () => {
  await assertYouTubeSessionError(
    {
      error: {
        code: 403,
        errors: [{ reason: "insufficientPermissions" }],
        message: "Insufficient Permission",
      },
    },
    403,
    (error) => {
      assert.equal(error.code, "permission_missing");
      assert.equal(error.actionRequired, true);
      assert.equal(error.userMessage, "Reconnect YouTube to allow video uploads.");
    },
  );
});

test("classifies YouTube rate limits as retryable and honors Retry-After", async () => {
  await assertYouTubeSessionError(
    {
      error: {
        code: 429,
        errors: [{ reason: "userRateLimitExceeded" }],
        message: "Rate limit exceeded",
      },
    },
    429,
    (error) => {
      assert.equal(error.code, "rate_limited");
      assert.equal(error.retryable, true);
      assert.equal(error.retryAfterSeconds, 90);
    },
    { "Retry-After": "90" },
  );
});

test("classifies transient YouTube backend failures for automatic retry", async () => {
  await assertYouTubeSessionError(
    {
      error: {
        code: 503,
        errors: [{ reason: "backendError" }],
        message: "Backend Error",
      },
    },
    503,
    (error) => {
      assert.equal(error.code, "provider_unavailable");
      assert.equal(error.retryable, true);
      assert.equal(error.actionRequired, false);
    },
  );
});

test("does not automatically retry an exhausted YouTube daily quota", async () => {
  await assertYouTubeSessionError(
    {
      error: {
        code: 403,
        errors: [{ reason: "quotaExceeded" }],
        message: "The request cannot be completed because the quota was exceeded.",
      },
    },
    403,
    (error) => {
      assert.equal(error.code, "quota_exceeded");
      assert.equal(error.retryable, false);
      assert.equal(error.actionRequired, false);
      assert.match(error.userMessage, /quota/i);
    },
  );
});

test("keeps technical YouTube validation details out of the user message", async () => {
  await assertYouTubeSessionError(
    {
      error: {
        code: 400,
        errors: [{ reason: "invalidValue" }],
        message: "snippet.title contains an invalid control character at index 7",
      },
    },
    400,
    (error) => {
      assert.equal(error.code, "invalid_video");
      assert.doesNotMatch(error.userMessage, /control character/i);
      assert.match(error.message, /control character/i);
    },
  );
});

async function assertYouTubeSessionError(
  payload: Record<string, unknown>,
  status: number,
  verify: (error: YouTubePublishError) => void,
  headers?: Record<string, string>,
) {
  await withMockFetch(async (input) => {
    const url = String(input);

    if (url === MEDIA_URL) {
      return videoResponse();
    }

    assert.match(url, /\/upload\/youtube\/v3\/videos/);
    return Response.json(payload, { headers, status });
  }, async () => {
    await assert.rejects(
      publishYouTubeVideo({
        accessToken: "access-token",
        caption: "Caption",
        mimeType: "video/mp4",
        title: "Title",
        videoUrl: MEDIA_URL,
      }),
      (error) => {
        assert.ok(error instanceof YouTubePublishError);
        verify(error);
        return true;
      },
    );
  });
}

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
