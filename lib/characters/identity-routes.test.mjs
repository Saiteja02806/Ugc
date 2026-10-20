import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { CharacterIdentityError, CharacterSelectionRequestSchema } from "./identity-service.ts";

let authError;
let storeError;
let calls = [];
const publicCharacter = {
  id: "a1111111-1111-4111-8111-111111111111",
  name: "Maya",
  url: "https://media.example.com/character.png",
  gender: "female",
  model: "gpt_image",
  createdAt: "2026-10-02T12:00:00.000Z",
};
class FirebaseAuthRequestError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

mock.module("../firebase/server-auth.ts", {
  namedExports: {
    FirebaseAuthRequestError,
    requireFirebaseUser: async () => {
      if (authError) throw authError;
      return { uid: "verified-owner" };
    },
  },
});
mock.module("./identity.ts", {
  namedExports: {
    CharacterIdentityError,
    CharacterSelectionRequestSchema,
    selectCharacterForUser: async (input) => {
      calls.push(input);
      if (storeError) throw storeError;
      return publicCharacter;
    },
    listCharactersForUser: async (userId) => {
      calls.push({ userId });
      if (storeError) throw storeError;
      return [publicCharacter];
    },
  },
});

const { POST } = await import("../../app/api/characters/select/route.ts");
const { GET } = await import("../../app/api/characters/route.ts");
const jobId = "b2222222-2222-4222-8222-222222222222";
const postRequest = (body) => new Request("https://www.getugcpilot.com/api/characters/select", {
  method: "POST",
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json" },
});

beforeEach(() => { authError = storeError = undefined; calls = []; });

test("selection passes only the verified owner, job ID and normalized optional name", async () => {
  const response = await POST(postRequest({ jobId, name: " Maya " }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(calls, [{ jobId, name: "Maya", userId: "verified-owner" }]);
  assert.deepEqual(await response.json(), { ok: true, character: publicCharacter });
});

test("selection rejects browser-provided URL/spec/owner fields before persistence", async () => {
  for (const extra of [{ url: "https://attacker.example.com/face.png" }, { characterSpec: {} }, { userId: "foreign-owner" }]) {
    const response = await POST(postRequest({ jobId, ...extra }));
    assert.equal(response.status, 400);
  }
  assert.deepEqual(calls, []);
});

test("unauthenticated and unverified accounts cannot select or list characters", async () => {
  for (const status of [401, 403]) {
    authError = new FirebaseAuthRequestError("Sign in or verify your email.", status);
    const select = await POST(postRequest({ jobId }));
    const list = await GET(new Request("https://www.getugcpilot.com/api/characters"));
    assert.equal(select.status, status);
    assert.equal(list.status, status);
  }
  assert.deepEqual(calls, []);
});

test("list ignores a spoofed owner query and returns only the verified owner's public identities", async () => {
  const response = await GET(new Request("https://www.getugcpilot.com/api/characters?userId=foreign-owner"));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ userId: "verified-owner" }]);
  assert.deepEqual(await response.json(), { ok: true, characters: [publicCharacter] });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("ownership and completion errors preserve status while internal diagnostics remain private", async () => {
  storeError = new CharacterIdentityError("Character candidate was not found.", 404);
  const missing = await POST(postRequest({ jobId }));
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { ok: false, error: storeError.message });
  storeError = new Error("private SQL relation diagnostics");
  const log = mock.method(console, "error", () => {});
  try {
    const failedSelect = await POST(postRequest({ jobId }));
    const failedList = await GET(new Request("https://www.getugcpilot.com/api/characters"));
    assert.equal(failedSelect.status, 500);
    assert.equal(failedList.status, 500);
    assert.ok(!JSON.stringify(await failedSelect.json()).includes("SQL"));
    assert.ok(!JSON.stringify(await failedList.json()).includes("SQL"));
  } finally {
    log.mock.restore();
  }
});
