import assert from "node:assert/strict";
import { mock, test } from "node:test";

let authenticated = true, calls = [], existingDraft = null;
class FirebaseAuthRequestError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }
mock.module(new URL("../firebase/server-auth.ts", import.meta.url).href, { namedExports: {
  FirebaseAuthRequestError, requireFirebaseUser: async () => { if (!authenticated) throw new FirebaseAuthRequestError("Sign in."); return { uid: "verified-owner" }; },
} });
mock.module(new URL("./clip-draft-store.ts", import.meta.url).href, { namedExports: { ExploreClipDraftStore: class {
  async read(...args) { calls.push(["read", ...args]); return existingDraft; }
  async initialContent(...args) { calls.push(["initial", ...args]); return null; }
  async save(...args) { calls.push(["save", ...args]); return { draft: { revision: 1 }, requestId: args[1].requestId, replayed: false }; }
} } });
const { handleClipDraftRead, handleClipDraftSave } = await import("./clip-draft-api.ts");
const source = "11111111-1111-4111-8111-111111111111", requestId = "44444444-4444-4444-8444-444444444444";
const content = { version: 1, sourceAssetId: source, editing: { version: 1, format: "hook", trimStartMs: 0, trimEndMs: 5000,
  originalVolume: 1, musicVolume: .2, text: null }, backgroundAssetId: null, backgroundPlayback: "once" };
const input = { requestId, scope: "hook", expectedRevision: 0, content };
const post = (body = input, headers = {}) => new Request("https://test.invalid/api/explore/clip-drafts", {
  method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestId, ...headers }, body: JSON.stringify(body),
});

test("draft APIs bind every call to verified owner and do no rendering", async () => {
  calls = []; authenticated = true;
  const response = await handleClipDraftSave(post()); assert.equal(response.status, 200);
  assert.deepEqual(calls, [["save", "verified-owner", input]]);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const loaded = await handleClipDraftRead(new Request(`https://test.invalid/api/explore/clip-drafts?sourceAssetId=${source}&scope=hook`));
  assert.deepEqual(await loaded.json(), { ok: true, draft: null, initialContent: null });
  assert.deepEqual(calls[1], ["read", "verified-owner", source, "hook"]);
});
test("auth, duplicate query identities, malformed edits, missing replay key and huge bodies fail before persistence", async () => {
  calls = []; authenticated = false;
  assert.equal((await handleClipDraftSave(post())).status, 401); authenticated = true;
  assert.equal((await handleClipDraftRead(new Request(`https://test.invalid/?sourceAssetId=${source}&scope=hook&scope=wall_text`))).status, 400);
  assert.equal((await handleClipDraftSave(post(input, { "Idempotency-Key": "wrong" }))).status, 428);
  assert.equal((await handleClipDraftSave(post({ ...input, userId: "spoofed-owner" }))).status, 428);
  assert.equal((await handleClipDraftSave(post({ ...input, content: { ...content, backgroundPlayback: "repeat" } }))).status, 400);
  assert.equal((await handleClipDraftSave(post(input, { "Content-Length": "999999" }))).status, 413);
  assert.equal((await handleClipDraftSave(post({ ...input, padding: "x".repeat(140000) }))).status, 413);
  assert.deepEqual(calls, []);
});

test("an existing saved empty draft takes priority without reading generation defaults", async () => {
  calls = []; existingDraft = { revision: 4, content: { ...content, editing: { ...content.editing, text: null, textOverlays: [] } } };
  try {
    const response = await handleClipDraftRead(new Request(`https://test.invalid/api/explore/clip-drafts?sourceAssetId=${source}&scope=hook`));
    assert.deepEqual(await response.json(), { ok: true, draft: existingDraft, initialContent: null });
    assert.deepEqual(calls, [["read", "verified-owner", source, "hook"]]);
  } finally { existingDraft = null; }
});


test("draft reads expose only safe stage durations for latency diagnosis",async()=>{
 authenticated=true;existingDraft=null;const r=await handleClipDraftRead(new Request(`https://test.invalid/api/explore/clip-drafts?sourceAssetId=${source}&scope=hook`));
 assert.equal(r.status,200);const timing=r.headers.get("Server-Timing");for(const name of ["clip_auth","clip_read","clip_initial","clip_total"])assert.match(timing,new RegExp(name+";dur=\\d+\\.\\d"));
 assert.doesNotMatch(timing,/verified-owner|Bearer|token|11111111/);assert.equal(r.headers.get("Cache-Control"),"no-store");
});
