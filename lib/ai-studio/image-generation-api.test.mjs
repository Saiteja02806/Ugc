import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
let reserved;
let inputs;
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 403; }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError } });
mock.module("@/lib/ai-studio/server-access", { namedExports: { requireAIStudioProUser: async () => ({ uid: "owner" }) } });
mock.module("@/lib/queues/job-queue", { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module("@/lib/jobs/background-jobs", { namedExports: { getMissingBackgroundJobStorageEnvVars: () => [], getBackgroundJobById: async () => null } });
mock.module("@/lib/jobs/background-job-service", { namedExports: {
  createAndDispatchBackgroundJob: async ({ input }) => { inputs.push(input); return { id: `image-job-${inputs.length}`, input }; },
} });
mock.module("@/lib/storage/storage", { namedExports: {
  isTrustedStorageUrl: (url) => new URL(url).hostname === "storage.example.com",
} });
mock.module("@/lib/billing/subscription-db", { namedExports: {
  BillingAccessError,
  deliverBillingUsageForJob: async () => {},
  getGenerationCreditCost: () => 1,
  releaseBillingCredits: async () => {},
  reserveBillingCredits: async () => { reserved++; },
} });
const { handleAIStudioImageGeneration } = await import("./image-generation-api.ts");
beforeEach(() => { reserved = 0; inputs = []; });
function generate(body = {}) {
  return handleAIStudioImageGeneration(new Request("https://www.getugcpilot.com/api/ai-studio/images/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "A cup on a table.", model: "gemini_3_pro", ...body }),
  }));
}

test("queues Gemini 3 Pro with the selected prompt, ratio, and trusted reference", async () => {
  const response = await generate({ aspectRatio: "4:5", referenceImageUrl: "https://storage.example.com/portrait.png" });
  assert.equal(response.status, 202);
  assert.equal(inputs[0].model, "gemini_3_pro");
  assert.equal(inputs[0].prompt, "A cup on a table.");
  assert.equal(inputs[0].aspectRatio, "4:5");
  assert.equal(inputs[0].referenceImageUrl, "https://storage.example.com/portrait.png");
  assert.equal(reserved, 1);
});

test("app quantities remain separate durable jobs with one credit reservation each", async () => {
  assert.equal((await generate({ quantity: 4 })).status, 202);
  assert.equal(reserved, 4);
  assert.equal(inputs.length, 4);
  assert.deepEqual(inputs.map((input) => input.batchIndex), [1, 2, 3, 4]);
  assert.equal(inputs.every((input) => input.model === "gemini_3_pro"), true);
});

test("removed or unsupported models reject stale clients before reserving credits", async () => {
  for (const model of ["nano_banana_2", "unknown", null]) {
    const response = await generate({ model });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /Refresh AI Studio/);
  }
  assert.equal(reserved, 0);
  assert.deepEqual(inputs, []);
});

test("GPT Image and omitted model defaults retain the original route", async () => {
  assert.equal((await generate({ model: "gpt_image" })).status, 202);
  assert.equal((await generate({ model: undefined })).status, 202);
  assert.deepEqual(inputs.map((input) => input.model), ["gpt_image", "gpt_image"]);
});

test("untrusted references fail before billing or job creation", async () => {
  assert.equal((await generate({ referenceImageUrl: "https://other.example.com/image.png" })).status, 400);
  assert.equal(reserved, 0);
  assert.deepEqual(inputs, []);
});
