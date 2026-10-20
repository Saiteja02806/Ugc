import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let identity;
let persisted;
let calls;
class FirebaseAuthRequestError extends Error {
  constructor(message, status = 401) { super(message); this.status = status; }
}
mock.module("@/lib/firebase/server-auth", { namedExports: {
  FirebaseAuthRequestError,
  requireFirebaseUser: async () => {
    if (identity instanceof Error) throw identity;
    return identity;
  },
} });
mock.module("@/lib/scheduling/account-timezone-db", { namedExports: {
  initializeAccountTimeZone: async (...args) => { calls.push(args); return persisted; },
} });
const { POST } = await import("../../app/api/account/timezone/route.ts");
beforeEach(() => { identity = { uid: "verified-owner" }; persisted = "America/New_York"; calls = []; });
function request(body) { return new Request("https://www.getugcpilot.com/api/account/timezone", { method: "POST", body: JSON.stringify(body) }); }

test("uses the verified owner instead of a user id submitted by the browser", async () => {
  const response = await POST(request({ timezone: "Asia/Kolkata", userId: "another-owner" }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [["verified-owner", "Asia/Kolkata"]]);
  assert.deepEqual(await response.json(), { ok: true, timezone: "America/New_York" });
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("rejects invalid zones without writing a preference", async () => {
  assert.equal((await POST(request({ timezone: "invalid/zone" }))).status, 400);
  assert.equal((await POST(request({ timezone: 5 }))).status, 400);
  assert.deepEqual(calls, []);
});
test("requires authentication before accepting a timezone", async () => {
  identity = new FirebaseAuthRequestError("Sign in.", 401);
  assert.equal((await POST(request({ timezone: "UTC" }))).status, 401);
  assert.deepEqual(calls, []);
});
test("requires email verification before accepting a timezone", async () => {
  identity = new FirebaseAuthRequestError("Verify your email.", 403);
  assert.equal((await POST(request({ timezone: "UTC" }))).status, 403);
  assert.deepEqual(calls, []);
});
