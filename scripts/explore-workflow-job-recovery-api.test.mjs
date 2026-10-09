import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, URL, console, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }, ...globals });
  return exports;
}
function harness(format = "hook") {
  const requests = [];
  const jobType = format === "slideshow" ? "generate_image" : "generate_hook_video";
  const target = { id: "wanted-job", user_id: "owner", job_type: jobType, input_json: { exploreFormat: format },
    status: "processing", created_at: "2026-10-01T00:00:00Z" };
  const unrelated = Array.from({ length: 140 }, (_, i) => ({ ...target, id: `unrelated-${i}`,
    created_at: "2026-10-09T00:00:00Z", input_json: { exploreFormat: format === "hook" ? "wall_text" : "hook" } }));
  const rows = [...unrelated, target, { ...target, id: "another-account", user_id: "other-owner" },
    { ...target, id: "finished-job", status: "completed" }, { ...target, id: "wrong-generation-type", job_type: "generate_audio" }];
  // Use the real Supabase query builder with a fixture HTTP transport. This
  // verifies the generated REST filters rather than mirroring call order.
  const queryFetch = async (input, init) => {
    const url = new URL(input); requests.push(url);
    assert.equal(init.method, "GET");
    let selected = rows.filter(row => `eq.${row.user_id}` === url.searchParams.get("user_id"));
    const type = url.searchParams.get("job_type"); if (type) selected = selected.filter(row => `eq.${row.job_type}` === type);
    const workflow = url.searchParams.get("input_json->>exploreFormat");
    if (workflow) selected = selected.filter(row => `eq.${row.input_json.exploreFormat}` === workflow);
    const status = url.searchParams.get("status"); if (status?.startsWith("in.")) selected = selected.filter(row => row.status === "processing");
    assert.equal(url.searchParams.get("order"), "created_at.desc");
    selected.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    selected = selected.slice(0, Number(url.searchParams.get("limit")));
    return Response.json(selected);
  };
  const jobs = load("lib/jobs/background-jobs.ts", {
    "server-only": {}, "@/lib/billing/subscription-db": { BillingAccessError: class extends Error {} },
    "@supabase/supabase-js": { createClient: (_, __, options) => createClient("https://fixture.supabase.co", "fixture-key", {
      ...options, global: { fetch: queryFetch },
    }) },
  }, { process: { env: { SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture-key" } } });
  const contract = load("lib/jobs/background-job-contract.ts");
  class FirebaseAuthRequestError extends Error { constructor(status) { super("Sign in required"); this.status = status; } }
  const route = load("app/api/jobs/route.ts", {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/jobs/background-job-contract": contract,
    "@/lib/jobs/background-job-service": {}, "@/lib/jobs/gcp-cloud-tasks": {},
    "@/lib/jobs/background-jobs": jobs,
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError, requireFirebaseUser: async request => {
      if (request.headers.get("Authorization") !== "Bearer owner-token") throw new FirebaseAuthRequestError(401);
      return { uid: "owner" };
    } },
  });
  return { requests, get: (query, signedIn = true) => route.GET(new Request(`https://example.test/api/jobs?${query}`, {
    headers: signedIn ? { Authorization: "Bearer owner-token" } : {},
  })) };
}

for (const format of ["hook", "wall_text", "slideshow"]) {
  test(`${format}: account and workflow filters recover an older job beyond 140 unrelated tasks`, async () => {
    const h = harness(format); const response = await h.get(`status=active&limit=100&exploreFormat=${format}&userId=other-owner`);
    assert.equal(response.status, 200);
    const result = await response.json(); assert.deepEqual(result.jobs.map(job => job.id), ["wanted-job"]);
    assert.equal(result.jobs[0].exploreFormat, format);
    assert.equal(result.jobs[0].jobType, format === "slideshow" ? "image_generation" : "video_generation");
    assert.equal("userId" in result.jobs[0], false);
    assert.equal(h.requests[0].searchParams.get("user_id"), "eq.owner");
    assert.equal(h.requests[0].searchParams.get("input_json->>exploreFormat"), `eq.${format}`);
    assert.equal(h.requests[0].searchParams.get("limit"), "100");
  });
}
test("unsupported workflow is rejected without querying stored tasks", async () => {
  const h = harness(); const response = await h.get("exploreFormat=unsupported&status=active");
  assert.equal(response.status, 400); assert.deepEqual(h.requests, []);
});
test("signed-out callers cannot list workflow tasks", async () => {
  const h = harness(); const response = await h.get("exploreFormat=hook&status=active", false);
  assert.equal(response.status, 401); assert.deepEqual(h.requests, []);
});
test("existing unscoped job listing retains its original behavior and limit", async () => {
  const h = harness(); const response = await h.get("status=active&limit=999");
  assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.jobs.length, 100);
  assert.equal(h.requests[0].searchParams.has("input_json->>exploreFormat"), false);
  assert.equal(h.requests[0].searchParams.has("job_type"), false);
});
