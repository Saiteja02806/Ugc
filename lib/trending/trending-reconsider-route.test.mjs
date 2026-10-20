import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const calls = [];
let signedIn = true;
let selectionFails = false;
class AuthError extends Error { status = 401; }
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError: AuthError,
  requireFirebaseUser: async () => { if (!signedIn) throw new AuthError("Sign in first."); return { uid: "verified-owner" }; },
} });
mock.module("./creative-decisions.ts", { namedExports: {
  reconsiderSkippedTrendingCreative: async params => {
    calls.push(["select", params]);
    if (selectionFails) throw new Error("Selection failed");
    return { assignmentId: params.assignmentId, decision: "accepted" };
  },
} });
mock.module("./unified-daily-feed-db.ts", { namedExports: {
  markDailyTrendingSlotDecided: async params => { calls.push(["slot", params]); return null; },
} });
const { POST } = await import("../../app/api/trending/feed/reconsider/route.ts");
const valid = { assignmentId: "10000000-0000-4000-8000-000000000001", creativeId: "20000000-0000-4000-8000-000000000002", format: "reaction" };
const request = body => new Request("http://localhost/api/trending/feed/reconsider", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("reconsideration derives the owner from authentication and safely accepts an already retired slot", async () => {
  for (const format of ["carousel", "hook_video", "wall_text", "reaction"]) {
    calls.length = 0;
    const response = await POST(request({ ...valid, format }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).decision.decision, "accepted");
    assert.deepEqual(calls, [["select", { ...valid, format, userId: "verified-owner" }],
      ["slot", { assignmentId: valid.assignmentId, format, userId: "verified-owner" }]]);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
test("unsigned requests and forged owner, creative or format fields cannot select a post", async () => {
  calls.length = 0;
  signedIn = false;
  assert.equal((await POST(request(valid))).status, 401);
  signedIn = true;
  for (const input of [{ ...valid, userId: "forged" }, { ...valid, creativeId: "invalid" }, { ...valid, format: "other" }]) {
    assert.equal((await POST(request(input))).status, 400);
  }
  assert.deepEqual(calls, []);
});
test("a failed selection returns a retryable error before retiring a slot", async () => {
  calls.length = 0;
  selectionFails = true;
  const logger = mock.method(console, "error", () => {});
  try {
    const response = await POST(request(valid));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).ok, false);
    assert.equal(calls.length, 1);
  } finally { selectionFails = false; logger.mock.restore(); }
});
