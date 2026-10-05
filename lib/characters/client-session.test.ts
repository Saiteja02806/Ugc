import assert from "node:assert/strict";
import test from "node:test";
import { characterSessionStorageKey, EMPTY_CHARACTER_SESSION, parseCharacterClientSession } from "./client-session.ts";

test("session restore rejects corrupted, obsolete and untrusted data", () => {
  for (const value of [null, "{", "null", JSON.stringify({ ...EMPTY_CHARACTER_SESSION, version: 2 }),
    JSON.stringify({ ...EMPTY_CHARACTER_SESSION, privateBrief: "not part of the client session" }),
    JSON.stringify({ ...EMPTY_CHARACTER_SESSION, jobs: [{ jobId: "bad", generationId: "value" }] }),
    JSON.stringify({ ...EMPTY_CHARACTER_SESSION, pendingRequest: { mode: "assisted", gender: "female", model: "gpt_image", idempotencyKey: "request", referenceImageUrl: "https://untrusted.test/image.png" } }),
  ]) assert.deepEqual(parseCharacterClientSession(value), EMPTY_CHARACTER_SESSION);
});

test("receipts and uncertain requests survive restore without requiring private server data", () => {
  const session = {
    ...EMPTY_CHARACTER_SESSION,
    jobs: [{ jobId: "11111111-1111-4111-8111-111111111111", generationId: "22222222-2222-4222-8222-222222222222" }],
    selectedCharacterId: "33333333-3333-4333-8333-333333333333",
    pendingRequest: { mode: "assisted", gender: "female", model: "gpt_image", idempotencyKey: "original-request" },
  };
  for (const model of ["gpt_image", "gemini_3_pro", "nano_banana_2"]) {
    for (const imageCount of [undefined, 1, 2, 3]) {
      const selectedSession = { ...session, pendingRequest: { ...session.pendingRequest, model, ...(imageCount ? { imageCount } : {}) } };
      assert.deepEqual(parseCharacterClientSession(JSON.stringify(selectedSession)), selectedSession);
    }
  }
});

test("browser session storage remains scoped to each account", () => {
  assert.notEqual(characterSessionStorageKey("account-a"), characterSessionStorageKey("account-b"));
  assert.equal(characterSessionStorageKey("account/a"), "ugc-character-session:v1:account%2Fa");
});
