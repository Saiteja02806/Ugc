import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { requestVideoDownload } from "./video-download-client.ts";

function signedUrl(fileName = "my-video.mp4") {
  const url = new URL("https://storage.googleapis.com/fixture/video.mp4");
  url.searchParams.set("response-content-disposition", `attachment; filename="${fileName}"`);
  return url.href;
}

test("sends credentials only to the authenticated app endpoint and accepts an attachment URL", async () => {
  const signal = new AbortController().signal;
  const fetch = mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/media/owned-id/download");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer fixture-token");
    assert.equal(options.signal, signal);
    assert.equal(options.cache, "no-store");
    return Response.json({ ok: true, url: signedUrl(), fileName: "my-video.mp4" });
  });
  try { assert.deepEqual(await requestVideoDownload("owned-id", "fixture-token", signal), { url: signedUrl(), fileName: "my-video.mp4" }); }
  finally { fetch.mock.restore(); }
});

test("shows server failures and rejects responses that could navigate to a storage preview or another site", async () => {
  for (const [body, status, error] of [
    [{ ok: false, error: "Sign in to continue." }, 401, /Sign in/],
    [{ ok: false, error: "Video is no longer available." }, 404, /no longer available/],
    [{ ok: true, url: "https://storage.googleapis.com/fixture/video.mp4", fileName: "my-video.mp4" }, 200, /prepare/],
    [{ ok: true, url: "https://evil.test/video.mp4", fileName: "my-video.mp4" }, 200, /prepare/],
    [{ ok: true, url: "not-a-url", fileName: "my-video.mp4" }, 200, /prepare/],
    [{ ok: true, url: signedUrl(), fileName: '../video.mp4' }, 200, /prepare/],
    [null, 503, /prepare/],
  ]) {
    const fetch = mock.method(globalThis, "fetch", async () => Response.json(body, { status }));
    try { await assert.rejects(requestVideoDownload("owned-id", "token", new AbortController().signal), error); }
    finally { fetch.mock.restore(); }
  }
});
