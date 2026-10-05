import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://character-reservation.example.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-key";

const { characterChildIdempotencyKey, hasUnusedFreeCharacterGeneration, reserveCharacterGenerationBatch } = await import("./generation-service.ts");
const owner = "firebase-owner";
const batchId = "a".repeat(64);
const fingerprint = "b".repeat(64);
let rpcError = null;
let rpcBody = null;
let allowanceUsed = false;
let rows = [];
let lookups = [];

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  if (url.pathname.endsWith("/rpc/character_create_reserved_generation_batch")) {
    assert.equal(method, "POST");
    rpcBody = JSON.parse(init.body);
    return rpcError ? Response.json({ code: "P0001", message: rpcError }, { status: 400 }) : Response.json(rows);
  }
  if (url.pathname.endsWith("/background_jobs")) {
    assert.equal(method, "GET");
    assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
    lookups.push(url.searchParams.get("id"));
    const row = rows.find((entry) => `eq.${entry.job.id}` === url.searchParams.get("id"));
    return Response.json(row?.job ?? null);
  }
  if (url.pathname.endsWith("/character_free_generation_allowances")) {
    assert.equal(method, "GET");
    assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
    assert.equal(url.searchParams.get("select"), "user_id");
    return Response.json(allowanceUsed ? { user_id: owner } : null);
  }
  throw new Error(`Unexpected test request: ${url.pathname}`);
};

function input(count, free) {
  const inputs = Array.from({ length: count }, (_, index) => ({
    batchId, batchSize: count, candidateIndex: index + 1,
    characterSource: "ugc-pilot-characters", characterVersion: 1,
    characterRequestFingerprint: fingerprint, generationId: `generation-${index + 1}`,
  }));
  rows = inputs.map((candidate, index) => ({ created: true, job: {
    id: `11111111-1111-4111-8111-${(index + 1).toString(16).padStart(12, "0")}`,
    user_id: owner, job_type: "generate_image", status: "queued", input_json: candidate,
    idempotency_key: characterChildIdempotencyKey(batchId, index + 1),
  } }));
  rpcError = null;
  lookups = [];
  return { userId: owner, batchId, fingerprint, amountPerImage: free ? 0 : 5, inputs, useFreeAllowance: free };
}

test("reservation adapter sends exactly the atomic paid/free RPC contract and reads only owned results", async () => {
  for (const [count, free] of [[1, false], [2, false], [3, false], [1, true]]) {
    const parameters = input(count, free);
    const jobs = await reserveCharacterGenerationBatch(parameters);
    assert.equal(jobs.length, count);
    assert.equal(lookups.length, count);
    assert.deepEqual(rpcBody, {
      p_user_id: owner, p_idempotency_key: batchId, p_fingerprint: fingerprint,
      p_amount_per_image: free ? 0 : 5, p_inputs_json: parameters.inputs,
      p_queue_name: "ai-generation", p_use_free_allowance: free,
    });
    assert.ok(jobs.every((job) => job.userId === owner && job.jobType === "generate_image"));
  }
});

test("atomic reservation failures map to safe credit, conflict, free and unavailable responses", async () => {
  for (const [message, code, status] of [
    ["insufficient_billing_credits", "INSUFFICIENT_CREDITS", 402],
    ["paid_subscription_required", "PLAN_REQUIRED", 403],
    ["character_free_generation_already_used", "FREE_ALLOWANCE_USED", 403],
    ["character_generation_idempotency_conflict", "IDEMPOTENCY_CONFLICT", 409],
    ["character_generation_reservation_conflict", "IDEMPOTENCY_CONFLICT", 409],
    ["PRIVATE database internal diagnostics", "GENERATION_UNAVAILABLE", 503],
  ]) {
    const parameters = input(3, false);
    rpcError = message;
    await assert.rejects(reserveCharacterGenerationBatch(parameters), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.status, status);
      assert.equal(error.message.includes("PRIVATE"), false);
      return true;
    });
    assert.equal(lookups.length, 0);
  }
});

test("incomplete RPC results cannot be returned as an accepted batch", async () => {
  const parameters = input(3, false);
  rows.pop();
  await assert.rejects(reserveCharacterGenerationBatch(parameters), { code: "GENERATION_UNAVAILABLE", status: 503 });
});

test("free eligibility reads the one-time account ledger without mutating it", async () => {
  allowanceUsed = false;
  assert.equal(await hasUnusedFreeCharacterGeneration(owner), true);
  allowanceUsed = true;
  assert.equal(await hasUnusedFreeCharacterGeneration(owner), false);
});
