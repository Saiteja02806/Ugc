import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";
import { SchedulingRequestError } from "../scheduling/errors.ts";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const assignmentId = "10000000-0000-4000-8000-000000000001";
const creativeId = "20000000-0000-4000-8000-000000000002";
const owner = "verified-owner";
let state = "active", signedIn = true, available = true, selectionFails = false, saveFails = false;
const calls = [], continuations = [];
class AuthError extends Error { status = 401; }
mock.module("next/server", { namedExports: {
  NextResponse: { json: (body, options) => Response.json(body, options) },
  after: callback => continuations.push(callback),
} });
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError: AuthError,
  requireFirebaseUser: async () => { if (!signedIn) throw new AuthError("Sign in first."); return { uid: owner }; },
} });
mock.module("./wall-text-db.ts", { namedExports: {
  getWallTextSchedulingAssignment: async params => {
    assert.deepEqual(params, { assignmentId, userId: owner });
    calls.push("scope");
    return available ? { assignmentId, creativeId } : null;
  },
  getSelectedWallTextDraft: async params => {
    assert.deepEqual(params, { assignmentId, userId: owner });
    calls.push("draft");
    return state === "selected" ? { assignmentId, id: creativeId, text: { fullText: "The previous Wall of Text" } } : null;
  },
} });
mock.module("./creative-decisions.ts", { namedExports: {
  acceptTrendingCreativeForScheduling: async params => {
    assert.deepEqual(params, { assignmentId, creativeId, format: "wall_text", userId: owner });
    calls.push("select");
    if (selectionFails) throw new Error("Storage unavailable");
    state = "selected";
  },
} });
mock.module("./unified-daily-feed-db.ts", { namedExports: {
  markDailyTrendingSlotDecided: async params => {
    assert.deepEqual(params, { assignmentId, format: "wall_text", userId: owner });
    calls.push("slot");
  },
} });
mock.module("../scheduling/service.ts", { namedExports: {
  SchedulingRequestError,
  createUserSchedule: async params => {
    calls.push("save");
    assert.equal(state, "selected");
    assert.equal(params.userId, owner);
    assert.equal(params.input.metadata.wallTextAssignmentId, assignmentId);
    assert.equal(params.input.metadata.wallTextCreativeId, creativeId);
    if (saveFails) throw new SchedulingRequestError("Reconnect your account.", 409, "provider_permission_missing");
    return { schedule: { id: "saved-schedule", status: "draft" } };
  },
} });
mock.module("../scheduling/wall-text-render-start.ts", { namedExports: {
  startWallTextScheduleRender: async () => calls.push("render"),
} });
const { POST } = await import("../../app/api/trending/wall-text/schedules/route.ts");
const body = { assignmentId, targets: [{ connectionId: "30000000-0000-4000-8000-000000000003" }], timezone: "Asia/Kolkata", useDefaultScheduleTime: true };
const request = (value = body) => new Request("https://www.getugcpilot.com/api/trending/wall-text/schedules", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
});

for (const initialState of ["active", "completed_skipped", "selected"]) {
  test(`Wall of Text scheduling selects the exact ${initialState} assignment before loading its draft`, async () => {
    state = initialState; calls.length = 0; continuations.length = 0;
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.deepEqual(calls, ["scope", "select", "slot", "draft", "save"]);
    assert.equal(continuations.length, 1);
    await continuations[0]();
    assert.equal(calls.at(-1), "render");
  });
}
test("foreign or missing Wall assignments cannot be selected, saved or rendered", async () => {
  available = false; calls.length = 0; continuations.length = 0;
  try {
    assert.equal((await POST(request())).status, 404);
    assert.deepEqual(calls, ["scope"]);
    assert.equal(continuations.length, 0);
  } finally { available = true; }
});
test("a failed selection cannot save a schedule or start rendering", async () => {
  selectionFails = true; calls.length = 0; continuations.length = 0;
  const logger = mock.method(console, "error", () => {});
  try {
    const response = await POST(request());
    assert.equal(response.status, 500);
    assert.equal((await response.json()).ok, false);
    assert.deepEqual(calls, ["scope", "select"]);
    assert.equal(continuations.length, 0);
  } finally { selectionFails = false; logger.mock.restore(); }
});
test("a failed account save remains retryable using the same selected Wall assignment", async () => {
  state = "completed_skipped"; saveFails = true; continuations.length = 0;
  try {
    const failed = await POST(request());
    assert.equal(failed.status, 409);
    assert.equal((await failed.json()).ok, false);
    assert.equal(continuations.length, 0);
    assert.equal(state, "selected");
    saveFails = false;
    assert.equal((await POST(request())).status, 200);
    assert.equal(continuations.length, 1);
  } finally { saveFails = false; }
});
test("authentication and strict payload validation precede all selection writes", async () => {
  calls.length = 0; signedIn = false;
  try { assert.equal((await POST(request())).status, 401); } finally { signedIn = true; }
  assert.equal((await POST(request({ ...body, userId: "forged-owner" }))).status, 400);
  assert.deepEqual(calls, []);
});
