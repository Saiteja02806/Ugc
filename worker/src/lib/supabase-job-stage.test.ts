import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseJobStore } from "./supabase.js";

test("small checkpoint response retains claim/status guards, heartbeat and cancellation fallback", async () => {
  const calls: Array<[string, ...unknown[]]> = [];
  let result: { data: { id: string } | null; error: { message: string } | null } = { data: { id: "job" }, error: null };
  const chain = {
    update(patch: Record<string, unknown>) { calls.push(["update", patch]); return this; },
    eq(column: string, value: unknown) { calls.push(["eq", column, value]); return this; },
    in(column: string, value: unknown) { calls.push(["in", column, value]); return this; },
    select(columns: string) { calls.push(["select", columns]); return this; },
    async maybeSingle() { return result; },
  };
  const store = new SupabaseJobStore({ from(table: string) { calls.push(["from", table]); return chain; } } as never);
  const params = { claimToken: "claim", jobId: "job", progress: 50, stage: "Rendering slide 5", status: "rendering" as const };
  assert.deepEqual(await store.updateJobStage(params), { id: "job" });
  assert.ok(calls.some(call => call[0] === "select" && call[1] === "id"));
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "claim_token" && call[2] === "claim"));
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "id" && call[2] === "job"));
  const allowed = calls.find(call => call[0] === "in")?.[2] as string[];
  assert.deepEqual(allowed, ["processing", "waiting_external_service", "rendering", "uploading_output"]);
  const patch = calls.find(call => call[0] === "update")?.[1] as Record<string, unknown>;
  assert.equal(patch.progress, 50); assert.ok(patch.last_heartbeat_at); assert.equal(patch.updated_at, patch.last_heartbeat_at);
  result = { data: null, error: null };
  assert.equal(await store.updateJobStage(params), null, "lost claim/cancellation still returns null to the processor");
  result = { data: null, error: { message: "timeout" } };
  await assert.rejects(store.updateJobStage(params), /Could not update background job stage: timeout/);
});
