import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, URL, Response, Request, Buffer, AbortSignal, ...globals });
  return exports;
}
const url = "https://storage.googleapis.com/our-media/music.mp3";
const row = { id: "hook_audio_001", audio_url: url, duration_seconds: "28.578", moods: ["curious", "serious"], energy: "medium", loopable: false,
  status: "active", review_status: "approved", storage_provider: "gcp", selection_scope: "matcher_pool" };
function catalogue({ rows = { hook_audio_assets: [row], wall_audio_assets: [{ ...row, id: "audio_002_segment_03", loopable: true }] }, fail = false } = {}) {
  const queries = [];
  const createClient = () => ({ from(table) {
    const filters = []; const query = { table, filters, range: null }; queries.push(query);
    const data = () => (rows[table] ?? []).filter(item => filters.every(([key, value]) => item[key] === value));
    const builder = {
      select(columns) { query.columns = columns; return builder; }, eq(key, value) { filters.push([key, value]); return builder; },
      order() { return builder; }, range(start, end) { query.range = [start, end]; return Promise.resolve({ data: data().slice(start, end + 1), error: fail ? Error("database detail") : null }); },
      maybeSingle() { return Promise.resolve({ data: data()[0] ?? null, error: fail ? Error("database detail") : null }); },
    }; return builder;
  } });
  return { ...load("lib/explore/background-audio-library.ts", { "server-only": {}, "@supabase/supabase-js": { createClient }, "@/lib/storage/storage": { isTrustedStorageUrl: value => value === url } },
    { process: { env: { SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_ROLE_KEY: "server-key" } } }), queries };
}
test("music catalogue returns both backend libraries, with safe names and no storage or user speech data", async () => {
  const h = catalogue(), tracks = await h.listBackgroundAudioTracks();
  assert.equal(tracks.length, 2); assert.equal(tracks[0].name, "Hook track 01"); assert.equal(tracks[1].name, "Wall track 02 · Segment 3");
  assert.equal(tracks[0].durationSeconds, 28.578); assert.equal(tracks[1].loopable, true);
  assert.doesNotMatch(JSON.stringify(tracks), /storage|music.mp3|server-key/);
  assert.deepEqual(h.queries.map(q => q.table).sort(), ["hook_audio_assets", "wall_audio_assets"]);
});
test("inactive, unreviewed, non-GCP and reference-locked tracks are excluded from both listing and selection", async () => {
  for (const update of [{ status: "inactive" }, { review_status: "pending" }, { storage_provider: "other" }]) {
    const h = catalogue({ rows: { hook_audio_assets: [{ ...row, ...update }], wall_audio_assets: [] } });
    assert.equal((await h.listBackgroundAudioTracks()).length, 0);
    assert.equal(await h.getBackgroundAudioTrack("hook", row.id), null);
  }
  const h = catalogue({ rows: { hook_audio_assets: [], wall_audio_assets: [{ ...row, selection_scope: "instagram_reel_locked" }] } });
  assert.equal((await h.listBackgroundAudioTracks()).length, 0); assert.equal(await h.getBackgroundAudioTrack("wall", row.id), null);
});
test("untrusted URLs and invalid duration, identifiers or loop policy never become selectable", async () => {
  for (const update of [{ audio_url: "https://elsewhere.example/music.mp3" }, { audio_url: "invalid" }, { duration_seconds: 601 },
    { duration_seconds: "NaN" }, { duration_seconds: 0 }, { loopable: null }, { id: "../secret" }, { energy: "invalid" }]) {
    const h = catalogue({ rows: { hook_audio_assets: [{ ...row, ...update }], wall_audio_assets: [] } });
    assert.equal((await h.listBackgroundAudioTracks()).length, 0); assert.equal(await h.getBackgroundAudioTrack("hook", (update.id ?? row.id)), null);
  }
});
test("catalogue pages past 200 tracks and fails visibly when a backend library fails", async () => {
  const h = catalogue({ rows: { hook_audio_assets: Array.from({ length: 450 }, (_, i) => ({ ...row, id: `hook_audio_${i}` })), wall_audio_assets: [] } });
  assert.equal((await h.listBackgroundAudioTracks()).length, 450);
  assert.deepEqual(h.queries.filter(q => q.table === "hook_audio_assets").map(q => q.range), [[0,199],[200,399],[400,599]]);
  await assert.rejects(catalogue({ fail: true }).listBackgroundAudioTracks(), /Could not load/);
});

class AuthError extends Error { status = 401; }
function api({ auth = true, found = true, upstream, loopable = false } = {}) {
  const calls = [];
  const exports = load("lib/explore/background-audio-api.ts", {
    "server-only": {}, "@/lib/ai-studio/server-access": { requireAIStudioProUser: async () => { calls.push("auth"); if (!auth) throw new AuthError("Sign in"); } },
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError },
    "./background-audio-library": { listBackgroundAudioTracks: async () => { calls.push("list"); return [{ id: row.id }]; },
      getBackgroundAudioTrack: async (source, id) => { calls.push([source, id]); return found ? { audioUrl: url, track: { loopable } } : null; } },
  }, { fetch: async (target, options) => { calls.push("storage"); assert.equal(target, url); assert.equal(options.redirect, "error"); return upstream?.() ?? new Response("music", { headers: { "Content-Type": "audio/mpeg" } }); } });
  return { calls, list: (query = "") => exports.handleBackgroundAudioLibrary(new Request(`https://www.getugcpilot.com/api/explore/background-audio${query}`)),
    file: (query = `?source=hook&id=${row.id}`) => exports.handleBackgroundAudioFile(new Request(`https://www.getugcpilot.com/api/explore/background-audio/file${query}`)) };
}
test("music reads require authenticated generation access before catalogue or storage reads", async () => {
  for (const action of ["list", "file"]) { const h = api({ auth: false }); assert.equal((await h[action]()).status, 401); assert.deepEqual(h.calls, ["auth"]); }
});
test("metadata is a no-store authenticated response and rejects unsupported inputs", async () => {
  const h = api(), result = await h.list(); assert.equal(result.status, 200); assert.deepEqual(await result.json(), { tracks: [{ id: row.id }] });
  assert.equal(result.headers.get("Cache-Control"), "no-store"); assert.equal(result.headers.get("Vary"), "Authorization");
  assert.equal((await api().list("?url=https://evil.example")).status, 400);
});
test("file selection accepts only an explicit catalogue identity, never a URL or ambiguous input", async () => {
  for (const query of ["", "?source=other&id=a", "?source=hook&id=..%2Fsecret", "?source=hook&id=a&url=https://evil.example", "?source=hook&id=a&id=b"]) {
    const h = api(); assert.equal((await h.file(query)).status, 400); assert.deepEqual(h.calls, ["auth"]);
  }
  const h = api({ found: false }); assert.equal((await h.file()).status, 404); assert.equal(h.calls.includes("storage"), false);
});
test("approved music file carries its loop policy and does not write, generate or render", async () => {
  for (const loopable of [true, false]) {
    const h = api({ loopable }), result = await h.file(); assert.equal(result.status, 200); assert.equal(await result.text(), "music");
    assert.equal(result.headers.get("X-Explore-Music-Loopable"), String(loopable)); assert.equal(result.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(h.calls, ["auth", ["hook", row.id], "storage"]);
  }
});
test("missing, misleading, empty and oversized storage responses show errors instead of attaching audio", async () => {
  for (const upstream of [() => new Response("missing", { status: 404 }), () => new Response("html", { headers: { "Content-Type": "text/html" } }),
    () => new Response("", { headers: { "Content-Type": "audio/mpeg" } }),
    () => new Response("music", { headers: { "Content-Type": "audio/mpeg", "Content-Length": "26214401" } }),
    () => new Response(new Uint8Array(26214401), { headers: { "Content-Type": "audio/mpeg" } })]) {
    const response = await api({ upstream }).file(); assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(await response.json()), /storage.googleapis/);
  }
});

function fileClient(upstream) {
  return load("lib/explore/background-audio-client.ts", {}, { File, URLSearchParams, fetch: async (target, options) => {
    assert.equal(target, "/api/explore/background-audio/file?source=hook&id=hook_audio_001");
    assert.equal(options.headers.Authorization, "Bearer owner-token"); assert.equal(options.cache, "no-store"); return upstream();
  } }).readBackgroundAudioFile({ id: row.id, source: "hook", name: "Hook track 01" }, "owner-token", new AbortController().signal);
}
test("client verifies server playback policy and gives attached music a useful filename", async () => {
  for (const loopable of [true, false]) {
    const result = await fileClient(() => new Response("music", { headers: { "Content-Type": "audio/mpeg", "X-Explore-Music-Loopable": String(loopable) } }));
    assert.equal(result.file.name, "Hook track 01.mp3"); assert.equal(result.file.type, "audio/mpeg"); assert.equal(result.playback, loopable ? "repeat" : "once");
  }
});
test("client does not attach malformed files or guess a missing playback policy", async () => {
  for (const response of [() => Response.json({ error: "Unavailable track" }, { status: 404 }),
    () => new Response("html", { headers: { "Content-Type": "text/html" } }),
    () => new Response("music", { headers: { "Content-Type": "audio/mpeg" } }),
    () => new Response("", { headers: { "Content-Type": "audio/mpeg" } }),
    () => new Response("music", { headers: { "Content-Type": "audio/mpeg", "Content-Length": "26214401" } })]) {
    await assert.rejects(fileClient(response), /Unavailable track|verified|complete background/);
  }
});
