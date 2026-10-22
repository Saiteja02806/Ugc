import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let profiles, lookups, requests, responder, authError, pictureError;
class FirebaseAuthRequestError extends Error { constructor(status) { super("Unauthorized"); this.status = status; } }
mock.module("./oauth.ts", { namedExports: {
  getSocialConnectionProfileForOwner: async params => {
    lookups.push(params);
    if (pictureError) throw pictureError;
    return profiles[Math.min(lookups.length - 1, profiles.length - 1)] ?? null;
  },
} });
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError,
  requireFirebaseUser: async () => { if (authError) throw authError; return { uid: "owner" }; },
} });
const { getSocialProfilePictureForOwner } = await import("./profile-picture.ts");
const { GET } = await import("../../app/api/social/connections/[connectionId]/picture/route.ts");
const params = { connectionId: "connection-1", userId: "owner" };
const profile = (url = "https://p16.tiktokcdn.com/photo.jpg", platform = "tiktok") => ({ platform, profilePictureUrl: url });
beforeEach(() => { profiles = [profile()]; lookups = []; requests = []; authError = null; pictureError = null; responder = () => new Response("photo-bytes", { headers: { "Content-Type": "image/jpeg" } }); });
async function withFetch(run) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push(String(url));
    assert.equal(init.redirect, "manual");
    assert.ok(init.signal);
    assert.equal(init.headers, undefined, "no provider or application tokens go to image hosts");
    return responder(String(url));
  };
  try { await run(); } finally { globalThis.fetch = original; }
}
test("returns raster bytes from owned TikTok and Instagram CDN URLs", async () => {
  await withFetch(async () => {
    for (const p of [profile(), profile("https://scontent.xx.fbcdn.net/photo.jpg", "instagram")]) {
      profiles = [p];
      const image = await getSocialProfilePictureForOwner(params);
      assert.equal(image.bytes.toString(), "photo-bytes");
      assert.equal(image.contentType, "image/jpeg");
    }
    assert.ok(lookups.every(lookup => lookup.userId === "owner"));
  });
});
test("renews a broken signed URL exactly once and reads the replacement", async () => {
  profiles.push(profile("https://p16.tiktokcdn.com/renewed.jpg"));
  responder = url => url.endsWith("/photo.jpg") ? new Response(null, { status: 403 }) : new Response("new-photo", { headers: { "Content-Type": "image/webp" } });
  await withFetch(async () => {
    const image = await getSocialProfilePictureForOwner(params);
    assert.equal(image.bytes.toString(), "new-photo");
    assert.deepEqual(lookups, [params, { ...params, force: true }]);
    assert.equal(requests.length, 2);
  });
});
test("failed renewal preserves fallback and stops without looping", async () => {
  responder = () => new Response(null, { status: 403 });
  await withFetch(async () => {
    assert.equal(await getSocialProfilePictureForOwner(params), null);
    assert.equal(requests.length, 1);
    assert.equal(lookups.length, 2);
  });
});
test("missing and inaccessible accounts produce no image requests", async () => {
  profiles = [null];
  await withFetch(async () => {
    assert.equal(await getSocialProfilePictureForOwner(params), null);
    assert.equal(requests.length, 0);
  });
});
test("foreign hosts, credentials and redirects to internal addresses are never fetched", async () => {
  await withFetch(async () => {
    for (const url of ["https://127.0.0.1/photo", "https://tiktokcdn.com.evil.example/photo", "http://p16.tiktokcdn.com/photo", "https://token@p16.tiktokcdn.com/photo", "https://p16.tiktokcdn.com:8443/photo"]) {
      profiles = [profile(url)];
      assert.equal(await getSocialProfilePictureForOwner(params), null);
    }
    assert.equal(requests.length, 0);
    profiles = [profile()];
    responder = () => new Response(null, { status: 302, headers: { Location: "https://169.254.169.254/metadata" } });
    assert.equal(await getSocialProfilePictureForOwner(params), null);
    assert.equal(requests.length, 1);
  });
});
test("only bounded raster images are accepted, including chunked responses", async () => {
  await withFetch(async () => {
    for (const response of [
      () => new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } }),
      () => new Response("<html/>", { headers: { "Content-Type": "text/html" } }),
      () => new Response("x", { headers: { "Content-Type": "image/jpeg", "Content-Length": "1048577" } }),
      () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1_048_577)); c.close(); } }), { headers: { "Content-Type": "image/jpeg" } }),
    ]) {
      responder = response;
      assert.equal(await getSocialProfilePictureForOwner(params), null);
    }
  });
});
const routeRequest = () => new Request("https://www.getugcpilot.com/api/social/connections/connection-1/picture?userId=foreign");
const context = id => ({ params: Promise.resolve({ connectionId: id }) });
test("photo route uses verified ownership and private no-store image responses", async () => {
  await withFetch(async () => {
    const response = await GET(routeRequest(), context("connection-1"));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "photo-bytes");
    assert.equal(response.headers.get("Content-Type"), "image/jpeg");
    assert.match(response.headers.get("Cache-Control"), /private, no-store/);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepEqual(lookups, [params]);
  });
});
test("photo route rejects unauthenticated, invalid and inaccessible connections without details", async () => {
  for (const status of [401, 403]) {
    authError = new FirebaseAuthRequestError(status);
    assert.equal((await GET(routeRequest(), context("connection-1"))).status, status);
  }
  authError = null;
  assert.equal((await GET(routeRequest(), context("../foreign"))).status, 400);
  assert.equal(lookups.length, 0);
  profiles = [null];
  assert.equal((await GET(routeRequest(), context("connection-1"))).status, 404);
  pictureError = Error("private credential detail");
  const response = await GET(routeRequest(), context("connection-1"));
  assert.equal(response.status, 502);
  assert.equal(await response.text(), "");
});
