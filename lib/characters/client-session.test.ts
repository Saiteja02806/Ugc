import assert from "node:assert/strict";
import test from "node:test";
import { appendCharacterSessionJobs, CHARACTER_SESSION_IDLE_TIMEOUT_MS, characterSessionStorageKey, EMPTY_CHARACTER_SESSION,
  isCharacterSessionIdle, parseCharacterClientSession } from "./client-session.ts";

test("uncertain uploaded-reference requests restore the exact attachment ID without a signed URL", () => {
  const pendingRequest = { mode: "custom", model: "gpt_image", imageCount: 1, prompt: "Make an influencer in this style", idempotencyKey: "same-key", referenceImageAssetId: "11111111-1111-4111-8111-111111111111" };
  const restored = parseCharacterClientSession(JSON.stringify({ ...EMPTY_CHARACTER_SESSION, pendingRequest }));
  assert.deepEqual(restored.pendingRequest, pendingRequest);
});

test("uncertain skill requests restore the original IDs and authored text without applying instructions twice", () => {
  const pendingRequest = { mode: "custom", model: "gpt_image", imageCount: 1, prompt: "My portrait", skillIds: ["realistic-skin"], idempotencyKey: "same-skill-request" };
  const restored = parseCharacterClientSession(JSON.stringify({ ...EMPTY_CHARACTER_SESSION, pendingRequest }));
  assert.deepEqual(restored.pendingRequest, pendingRequest);
});

test("multiple references and uncertain generation retain their exact order across refresh", () => {
  const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  const session = { ...EMPTY_CHARACTER_SESSION, selectedCharacterId: ids[0], selectedCharacterIds: ids,
    pendingRequest: { mode: "custom", model: "seedream_5_pro", prompt: "Use both images", referenceCharacterIds: ids, idempotencyKey: "same-ordered-images" } };
  assert.deepEqual(parseCharacterClientSession(JSON.stringify(session)), session);
});

test("session restore rejects corrupted, obsolete and untrusted data", () => {
  for (const value of [null, "{", "null", JSON.stringify({ ...EMPTY_CHARACTER_SESSION, version: 2 }),
    JSON.stringify({ ...EMPTY_CHARACTER_SESSION, privateBrief: "not part of the client session" }),
    JSON.stringify({ ...EMPTY_CHARACTER_SESSION, jobs: [{ jobId: "bad", generationId: "value" }] }),
    JSON.stringify({ ...EMPTY_CHARACTER_SESSION, pendingRequest: { mode: "assisted", gender: "female", model: "gpt_image", idempotencyKey: "request", referenceImageUrl: "https://untrusted.test/image.png" } }),
  ]) assert.deepEqual(parseCharacterClientSession(value), EMPTY_CHARACTER_SESSION);
});

test("uncertain pasted-image lists restore the exact ordered IDs", () => {
  const pendingRequest = { mode: "custom", model: "gemini_3_pro", imageCount: 1, prompt: "Use both images", idempotencyKey: "same-pasted-images", referenceImageAssetIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"] };
  const restored = parseCharacterClientSession(JSON.stringify({ ...EMPTY_CHARACTER_SESSION, pendingRequest }));
  assert.deepEqual(restored.pendingRequest, pendingRequest);
  const mixed = { ...pendingRequest, referenceCharacterIds: ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"] };
  assert.deepEqual(parseCharacterClientSession(JSON.stringify({ ...EMPTY_CHARACTER_SESSION, pendingRequest: mixed })).pendingRequest, mixed);
});

test("receipts and uncertain requests survive restore without requiring private server data", () => {
  const session = {
    ...EMPTY_CHARACTER_SESSION,
    jobs: [{ jobId: "11111111-1111-4111-8111-111111111111", generationId: "22222222-2222-4222-8222-222222222222" }],
    selectedCharacterId: "33333333-3333-4333-8333-333333333333",
    pendingRequest: { mode: "custom", prompt: "An adult creator", model: "gpt_image", idempotencyKey: "original-request" },
  };
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2", "seedream_5_pro", "gpt_image_2_5"]) {
    for (const imageCount of [undefined, 1, 2, 3]) {
      const selectedSession = { ...session, pendingRequest: { ...session.pendingRequest, model, ...(imageCount ? { imageCount } : {}) } };
      assert.deepEqual(parseCharacterClientSession(JSON.stringify(selectedSession)), selectedSession);
    }
  }
});

test("removed assisted requests are discarded without losing previous results or saved influencers", () => {
  const stored = {
    version: 1,
    jobs: [{ jobId: "11111111-1111-4111-8111-111111111111", generationId: "generation" }],
    selectedCharacterId: "33333333-3333-4333-8333-333333333333",
    pendingRequest: { mode: "assisted", model: "gpt_image", idempotencyKey: "obsolete" },
  };
  assert.deepEqual(parseCharacterClientSession(JSON.stringify(stored)), { ...EMPTY_CHARACTER_SESSION, ...stored, pendingRequest: null });
});

test("continuous batches accumulate beyond the per-request three-image limit without duplicate receipts", () => {
  const jobs = Array.from({ length: 7 }, (_, index) => ({ jobId: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`, generationId: `generation-${index}` }));
  const accumulated = appendCharacterSessionJobs(jobs.slice(0, 3), [...jobs.slice(2), jobs[6]]);
  assert.deepEqual(accumulated, jobs);
  assert.deepEqual(parseCharacterClientSession(JSON.stringify({ ...EMPTY_CHARACTER_SESSION, jobs: accumulated })).jobs, jobs);
});

test("idle expiration requires ten minutes, known settled jobs and a resolved admission", () => {
  const session = { ...EMPTY_CHARACTER_SESSION, lastActivityAt: 1_000 };
  assert.equal(isCharacterSessionIdle(session, 1_000 + CHARACTER_SESSION_IDLE_TIMEOUT_MS - 1, true), false);
  assert.equal(isCharacterSessionIdle(session, 1_000 + CHARACTER_SESSION_IDLE_TIMEOUT_MS, true), true);
  assert.equal(isCharacterSessionIdle(session, 1_000 + CHARACTER_SESSION_IDLE_TIMEOUT_MS, false), false);
  assert.equal(isCharacterSessionIdle({ ...session, pendingRequest: { mode: "custom", prompt: "A presenter", model: "gpt_image", idempotencyKey: "unresolved" } }, 1_000 + CHARACTER_SESSION_IDLE_TIMEOUT_MS, true), false);
  assert.equal(isCharacterSessionIdle(EMPTY_CHARACTER_SESSION, CHARACTER_SESSION_IDLE_TIMEOUT_MS, true), false);
});

test("browser session storage remains scoped to each account", () => {
  assert.notEqual(characterSessionStorageKey("account-a"), characterSessionStorageKey("account-b"));
  assert.equal(characterSessionStorageKey("account/a"), "ugc-character-session:v1:account%2Fa");
});
