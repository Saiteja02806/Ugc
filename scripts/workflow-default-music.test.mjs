import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { loadWorkflowDefaultMusic } from "../lib/explore/workflow-default-music-client.ts";

const id = "approved-track", url = "https://storage.googleapis.com/our-media/music.mp3";
class AuthError extends Error { status = 401; }
function harness({ configured = true, track = { id, audioUrl: url, durationSeconds: 20, loopable: true }, authError = false, upstream } = {}) {
  const calls = [], exported = {};
  const imports = {
    "server-only": {},
    "@/lib/ai-studio/server-access": { requireAIStudioProUser: async () => { calls.push("auth"); if (authError) throw new AuthError("Sign in"); return { uid: "owner" }; } },
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError },
    "@/lib/storage/storage": { isTrustedStorageUrl: value => value === url },
    "@/lib/trending/hook-audio-db": { getApprovedHookAudioAsset: async value => { calls.push("catalogue"); assert.equal(value, id); return track; } },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/explore/workflow-default-music-api.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: exported, require(name) { assert.ok(name in imports); return imports[name]; }, URL, Response, Buffer, AbortSignal,
    process: { env: configured ? { EXPLORE_DEFAULT_BACKGROUND_AUDIO_ID: id } : {} },
    fetch: async (target, options) => { calls.push("gcp-read"); assert.equal(target.href, url); assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store"); return upstream?.() ?? new Response("approved-bytes", { headers: { "Content-Type": "audio/mpeg" } }); },
  });
  return { calls, read: (query = "") => exported.handleWorkflowDefaultMusic(new Request(`https://www.getugcpilot.com/api/explore/default-music${query}`)) };
}

test("music requires owner access, explicit configuration and human-approved GCP catalogue input", async () => {
  for (const options of [{ authError: true }, { configured: false }, { track: null },
    { track: { id, audioUrl: "https://other.example/music.mp3", durationSeconds: 20 } },
    { track: { id, audioUrl: url, durationSeconds: 601 } }]) {
    const h = harness(options), result = await h.read(); assert.ok(result.status >= 400);
    assert.equal(h.calls.includes("gcp-read"), false);
    assert.doesNotMatch(JSON.stringify(await result.json()), /storage\.googleapis|service_role|private|approved-track/);
  }
});

test("clients cannot override the selected track or proxy arbitrary URLs", async () => {
  for (const query of ["?id=other", "?url=https://other.example", "?download=1"]) {
    const h = harness(); assert.equal((await h.read(query)).status, 400); assert.deepEqual(h.calls, ["auth"]);
  }
});

test("approved music is a bounded authenticated no-store read with an explicit loop policy", async () => {
  const h = harness(), result = await h.read(); assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "no-store"); assert.equal(result.headers.get("Vary"), "Authorization");
  assert.equal(result.headers.get("X-Explore-Music-Loopable"), "true");
  assert.equal(await result.text(), "approved-bytes"); assert.deepEqual(h.calls, ["auth", "catalogue", "gcp-read"]);
});

test("invalid, empty, oversized or misleading storage responses never produce a music download", async () => {
  const upstream = [() => new Response("oops", { status: 403 }), () => new Response("not-audio", { headers: { "Content-Type": "text/html" } }),
    () => new Response("", { headers: { "Content-Type": "audio/mpeg" } }),
    () => new Response("bad", { headers: { "Content-Type": "audio/mpeg", "Content-Length": "26214401" } }),
    () => new Response(new Uint8Array(26214401), { headers: { "Content-Type": "audio/mpeg" } })];
  for (const response of upstream) assert.equal((await harness({ upstream: response }).read()).status, 503);
});

test("client obtains a local File only from the authenticated approved-music route", async () => {
  const h = harness(), calls = [];
  const result = await loadWorkflowDefaultMusic({ token: async () => "owner-token", assertActive() {}, fetch: async (target, options) => {
    calls.push(target); assert.equal(options.headers.Authorization, "Bearer owner-token"); return h.read();
  } });
  assert.deepEqual(calls, ["/api/explore/default-music"]); assert.equal(result.file.name, "default-background.mp3");
  assert.equal(result.file.type, "audio/mpeg"); assert.equal(result.playback, "repeat");
});

test("a missing approved default is an actionable client error, not a silent original-sound render", async () => {
  await assert.rejects(loadWorkflowDefaultMusic({ token: async () => "owner-token", assertActive() {}, fetch: async () => harness({ configured: false }).read() }), /not configured/);
  await assert.rejects(loadWorkflowDefaultMusic({ token: async () => null, assertActive() {}, fetch: async () => { throw Error("Must not fetch"); } }), /Sign in/);
});
