import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { SchedulingRequestError } from "../lib/scheduling/errors.ts";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = { post: { user_id: "owner-a", metadata: {}, idempotency_key: "request" }, requestHash: "a".repeat(64), queueName: "publish-test",
  targets: [{ platform: "instagram", settings: { shareToFeed: true }, social_connection_id: id(2) }] };
function fixture(reply) {
  const calls = [];
  const imports = { "server-only": {}, "@supabase/supabase-js": { createClient: () => ({ rpc: async (name, input) => { calls.push({ name, input }); return reply; } }) },
    "@/lib/billing/free-trial-policy": { FREE_TRIAL_CONTENT_DAYS: 3 }, "@/lib/scheduling/errors": { SchedulingRequestError } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/scheduling/db.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => imports[name] ?? {}, process: { env: { SUPABASE_URL: "https://test.invalid", SUPABASE_SERVICE_ROLE_KEY: "fake-test-key" } }, Error, Date });
  return { calls, run: () => exports.insertDirectScheduledPost(params) };
}
test("missing atomic migration fails closed without split-write fallback", async () => {
  for (const code of ["42883", "PGRST202"]) {
    const h = fixture({ data: null, error: { code, message: "function missing" } });
    await assert.rejects(h.run(), error => error.status === 503 && error.code === "schedule_atomic_storage_unavailable");
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].name, "create_direct_scheduled_post");
  }
});
test("billing rejections and idempotency conflicts retain their explicit API codes", async () => {
  for (const [message, status, code] of [["free_trial_schedule_limit_reached", 402, "free_trial_schedule_limit_reached"],
    ["free_trial_schedule_expired", 402, "free_trial_schedule_expired"], ["schedule_idempotency_conflict", 409, "schedule_idempotency_conflict"],
    ["schedule_time_too_soon", 409, "schedule_time_too_soon"]]) {
    const h = fixture({ data: null, error: { code: "P0001", message } }); await assert.rejects(h.run(), error => error.status === status && error.code === code);
  }
});
test("invalid transaction acknowledgement cannot claim that the destinations or jobs were saved", async () => {
  for (const targets of [[], [{ user_id: "other-owner", scheduled_post_id: id(1), publish_job_id: id(3) }],
    [{ user_id: "owner-a", scheduled_post_id: id(1), publish_job_id: null }]]) {
    const h = fixture({ error: null, data: { created: true, post: { id: id(1), user_id: "owner-a" }, targets } });
    await assert.rejects(h.run(), error => error.code === "schedule_creation_unconfirmed");
  }
});
