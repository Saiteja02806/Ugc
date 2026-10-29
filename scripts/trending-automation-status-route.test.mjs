import assert from "node:assert/strict";
import { mock, test } from "node:test";

let owner = "owner-a", status = "active", reads = [], fullReads = 0;
class FirebaseAuthRequestError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError, requireFirebaseUser: async () => { if (!owner) throw new FirebaseAuthRequestError("Unauthenticated"); return { uid: owner }; } } });
mock.module("@/lib/trending/slideshow-automation-service", { namedExports: {
  SlideshowAutomationError: class extends Error {},
  getExistingAutomationRecord: async input => { reads.push(input.userId); return status === null ? null : {status}; },
  loadSlideshowAutomationWorkspaceState: async () => { fullReads++; return {}; },
  saveAutomationDraftOrSettings: async () => { throw Error("unexpected mutation"); },
} });
const { GET } = await import("../app/api/trending/slideshow-automation/route.ts");
test("status-only requests are owner-scoped reads and do not prepare or create slots", async () => {
  for (const expected of ["active", "paused", "needs_attention", "draft", null]) {
    status = expected; const result = await GET(new Request("https://fixture.test/api/trending/slideshow-automation?statusOnly=1"));
    assert.equal(result.status, 200); assert.equal((await result.json()).status, expected);
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
  assert.deepEqual(reads, Array(5).fill("owner-a")); assert.equal(fullReads, 0);
  owner = null; const denied = await GET(new Request("https://fixture.test/api/trending/slideshow-automation?statusOnly=1"));
  assert.equal(denied.status, 401); assert.equal(reads.length, 5); assert.equal(fullReads, 0);
});
