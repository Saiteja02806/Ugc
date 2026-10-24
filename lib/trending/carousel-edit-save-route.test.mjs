import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { registerHooks } from "node:module";
registerHooks({ resolve(specifier, context, next) { return next(specifier === "next/server" ? "next/server.js" : specifier, context); } });
const assignmentId = "10000000-0000-4000-8000-000000000001";
const creativeId = "20000000-0000-4000-8000-000000000002";
const slideId = "30000000-0000-4000-8000-000000000003";
const calls = [];
let failDispatch = false;
class AccessError extends Error {}
mock.module("next/server", { namedExports: { NextResponse: { json: (body, options) => Response.json(body, options) } } });
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError: AccessError, requireFirebaseUser: async () => ({ uid: "owner" }) } });
mock.module("./creative-edit-service.ts", { namedExports: {
  loadTrendingCreativeEditor: () => assert.fail("Carousel save must not reload the full editor before or after dispatch"),
  loadTrendingCreativeReadView: () => assert.fail(), loadTrendingCarouselEditStatus: () => assert.fail(),
  saveTrendingCreativeEditor: async input => { calls.push(["save", input]); return { id: "edit", creativeId, assignmentId, format: "carousel", revision: 2, renderState: "draft" }; },
} });
mock.module("./creative-edits.ts", { namedExports: {
  TrendingCreativeEditAccessError: AccessError, getMissingTrendingCreativeEditEnvVars: () => [],
  attachTrendingCreativeEditRenderJob: async input => { calls.push(["attach", input]); return { render_status: "queued", render_job_id: "job", render_error: null, updated_at: "now" }; },
  markTrendingCreativeEditRenderFailed: async input => { calls.push(["failed", input]); },
} });
mock.module("@/lib/jobs/background-job-service", { namedExports: { createAndDispatchBackgroundJob: async (input, options) => {
  calls.push(["dispatch", input]); await options.beforeDispatch({ id: "job" });
  if (failDispatch) throw new Error("Dispatch unavailable");
} } });
const { PATCH } = await import("../../app/api/trending/creatives/[format]/[creativeId]/edit/route.ts");
const request = () => PATCH(new Request("http://fixture/edit", { method: "PATCH", body: JSON.stringify({ assignmentId, expectedRevision: 1, slides: [{ slideId, slideNumber: 1, backgroundAssetId: null, headline: "Useful work", subtext: "", ctaText: "", textPosition: { x: .5, y: .5 } }] }) }), { params: Promise.resolve({ creativeId, format: "carousel" }) });

test("accepted Carousel save returns the durable queued record without another full read or false failure", async () => {
  const response = await request();
  assert.equal(response.status, 200);
  const { edit } = await response.json();
  assert.equal(edit.renderState, "queued"); assert.equal(edit.renderJobId, "job");
  assert.deepEqual(calls.map(call => call[0]), ["save", "dispatch", "attach"]);
  assert.equal(calls[0][1].userId, "owner");
  assert.equal(calls[1][1].idempotencyKey, "trending-carousel-edit:edit:2");
});
test("a real dispatch failure is still recorded against the correct owner and revision", async () => {
  calls.length = 0; failDispatch = true;
  assert.equal((await request()).status, 500);
  assert.deepEqual(calls.map(call => call[0]), ["save", "dispatch", "attach", "failed"]);
  assert.equal(calls[3][1].userId, "owner"); assert.equal(calls[3][1].revision, 2);
});
