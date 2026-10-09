import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { parsePublishingPreferences } from "./publishing-preferences.ts";

let owner = "owner-a", unavailable = false;
const rows = new Map(), accesses = [];
class FirebaseAuthRequestError extends Error { constructor(message, status) { super(message); this.status = status; } }
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError,
  requireFirebaseUser: async () => { if (!owner) throw new FirebaseAuthRequestError("Sign in", 401); return { uid: owner }; },
} });
mock.module("./publishing-preferences-db.ts", { namedExports: {
  getPublishingPreferences: async (id) => { accesses.push(id); if (unavailable) throw new Error("private DB details"); return rows.get(id) ?? { containsSyntheticMedia: true }; },
  savePublishingPreferences: async (id, value) => { accesses.push(id); if (unavailable) throw new Error("private DB details"); rows.set(id, value); return value; },
} });
const { GET, PUT } = await import("../../app/api/account/publishing-preferences/route.ts");
const request = (body) => new Request("https://example.com/api/account/publishing-preferences", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) });

test("preferences reject malformed values and client-supplied account identities", async () => {
  for (const body of [null, [], {}, { containsSyntheticMedia: "false" }, { containsSyntheticMedia: false, userId: "owner-b" }]) {
    assert.throws(() => parsePublishingPreferences(body));
    assert.equal((await PUT(request(body))).status, 400);
  }
  assert.equal((await PUT(request("bad JSON"))).status, 400);
  assert.deepEqual(accesses, []);
});

test("account defaults persist independently and both responses prohibit caching", async () => {
  const first = await GET(new Request("https://example.com"));
  assert.equal(first.headers.get("Cache-Control"), "no-store");
  assert.equal((await first.json()).preferences.containsSyntheticMedia, true);
  const saved = await PUT(request({ containsSyntheticMedia: false }));
  assert.equal(saved.status, 200); assert.equal(saved.headers.get("Cache-Control"), "no-store");
  owner = "owner-b";
  assert.equal((await (await GET(new Request("https://example.com"))).json()).preferences.containsSyntheticMedia, true);
  owner = "owner-a";
  assert.equal((await (await GET(new Request("https://example.com"))).json()).preferences.containsSyntheticMedia, false);
});

test("authentication and database failures never report a successful save or expose internals", async () => {
  owner = null;
  assert.equal((await PUT(request({ containsSyntheticMedia: true }))).status, 401);
  owner = "owner-a"; unavailable = true;
  const failed = await PUT(request({ containsSyntheticMedia: true }));
  assert.equal(failed.status, 503); assert.doesNotMatch(JSON.stringify(await failed.json()), /private DB details/);
  assert.equal(rows.get("owner-a").containsSyntheticMedia, false);
});
