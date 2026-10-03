import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenRouterSeedanceRequest, estimateOpenRouterSeedanceCost, generateOpenRouterSeedanceVideoBuffer } from "./openrouter-seedance-video.js";
import { ProviderOperationPollingError, ProviderOperationTerminalError, ProviderRequestNotSubmittedError } from "./generation-provider.js";

const input = { aspectRatio: "9:16", durationSeconds: 5, resolution: "720p", prompt: "A ceramic cup beside a sunny window" } as const;
const apiKey = "test-private-key";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const video = () => new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), { headers: { "content-type": "video/mp4" } });
const callbacks = { onOperationCreated: async () => {}, onOperationSucceeded: async () => {} };

test("uses the exact model, preserves long prompts and sends images as content guidance", () => {
  const request = buildOpenRouterSeedanceRequest({ ...input, prompt: "x".repeat(5000), referenceImageUrls: ["https://storage.example.com/person.png"] });
  assert.equal(request.model, "bytedance/seedance-2.5");
  assert.equal(request.prompt.length, 5000);
  assert.deepEqual(request.input_references, [{ type: "image_url", image_url: { url: "https://storage.example.com/person.png" } }]);
  assert.equal(request.duration, 5);
  assert.equal(request.aspect_ratio, "9:16");
  assert.equal(request.generate_audio, true);
  assert.ok(Math.abs(estimateOpenRouterSeedanceCost("720p", 10) - 2.3112) < 0.000001);
});

test("rejects invalid duration, resolution and reference inputs before submission", () => {
  for (const patch of [{ durationSeconds: 3 }, { durationSeconds: 31 }, { durationSeconds: 4.5 }, { resolution: "1080p" as const }, { prompt: " " }, { referenceImageUrls: ["http://example.com/a.png"] }, { referenceImageUrls: Array.from({ length: 7 }, (_, i) => `https://example.com/${i}.png`) }, { referenceVideoUrl: "https://example.com/a.mp4" }]) {
    assert.throws(() => buildOpenRouterSeedanceRequest({ ...input, ...patch }), ProviderRequestNotSubmittedError);
  }
});

test("persists accepted ID before polling, preserves cost and authenticates the canonical download", async () => {
  const events: string[] = [];
  let polls = 0;
  const fetchImpl = (async (url, init) => {
    const path = new URL(String(url)).pathname;
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${apiKey}`);
    assert.equal(init?.redirect, "error");
    if (path.endsWith("/key")) { events.push("key-check"); return json({ data: { is_management_key: false, limit_remaining: 100 } }); }
    if (init?.method === "POST") { events.push("submit"); return json({ id: "job-1", status: "pending" }, 202); }
    if (path.endsWith("/content")) { events.push("download"); return video(); }
    events.push("poll");
    return json(++polls === 1 ? { status: "in_progress" } : { status: "completed", unsigned_urls: ["https://attacker.example/content"], generation_id: "generation-1", usage: { cost: 1.1556 } });
  }) as typeof fetch;
  const buffer = await generateOpenRouterSeedanceVideoBuffer({ ...input,
    onOperationCreated: async (id) => { assert.equal(id, "job-1"); events.push("save-id"); },
    onOperationSucceeded: async (id, url, usage) => { assert.equal(id, "job-1"); assert.equal(url, "https://openrouter.ai/api/v1/videos/job-1/content?index=0"); assert.deepEqual(usage, { costUsd: 1.1556, generationId: "generation-1" }); events.push("save-output"); },
  }, { apiKey, fetchImpl, pollIntervalMs: 0 });
  assert.equal(buffer.length, 8);
  assert.deepEqual(events, ["key-check", "submit", "save-id", "poll", "poll", "save-output", "download"]);
});

test("resumes accepted and completed operations without another key check or paid POST", async () => {
  for (const providerOutputUrl of [undefined, "https://outside.example/untrusted-output"]) {
    const requests: string[] = [];
    await generateOpenRouterSeedanceVideoBuffer({ ...input, ...callbacks, providerOperationId: "saved-job", providerOutputUrl,
      onOperationCreated: async () => { assert.fail("must not resubmit"); },
    }, { apiKey, fetchImpl: (async (url, init) => {
      requests.push(String(url)); assert.notEqual(init?.method, "POST");
      return String(url).includes("/content") ? video() : json({ status: "completed" });
    }) as typeof fetch });
    assert.ok(requests.every((url) => url.startsWith("https://openrouter.ai/api/v1/videos/saved-job")));
    assert.equal(requests.length, providerOutputUrl ? 1 : 2);
  }
});

test("failed ID persistence and lost POST responses never cause a second paid submission", async () => {
  let posts = 0;
  const fetchImpl = (async (_url, init) => {
    if (init?.method === "POST") { posts++; return json({ id: "paid-job" }, 202); }
    return json({ data: { limit_remaining: 100 } });
  }) as typeof fetch;
  await assert.rejects(generateOpenRouterSeedanceVideoBuffer({ ...input, ...callbacks, onOperationCreated: async () => { throw new Error("storage failure"); } }, { apiKey, fetchImpl }), /storage failure/);
  assert.equal(posts, 1);
  await assert.rejects(generateOpenRouterSeedanceVideoBuffer({ ...input, ...callbacks }, { apiKey, fetchImpl: (async (_url, init) => {
    if (init?.method === "POST") { posts++; throw new TypeError("connection lost"); }
    return json({ data: { limit_remaining: 100 } });
  }) as typeof fetch }), /connection lost/);
  assert.equal(posts, 2);
});

test("pending timeouts and transient status failures retain the saved operation", async () => {
  let requests = 0;
  await assert.rejects(generateOpenRouterSeedanceVideoBuffer({ ...input, ...callbacks, providerOperationId: "pending-job" }, { apiKey, timeoutMs: 0, fetchImpl: (async (_url, init) => {
    assert.notEqual(init?.method, "POST"); requests++; return json({ status: "pending" });
  }) as typeof fetch }), ProviderOperationPollingError);
  assert.equal(requests, 1);
});

test("moderation is terminal, readable and redacts the API credential", async () => {
  await assert.rejects(generateOpenRouterSeedanceVideoBuffer({ ...input, ...callbacks, providerOperationId: "blocked-job" }, { apiKey, fetchImpl: (async () => json({ status: "failed", error: `Content policy violation ${apiKey}` })) as typeof fetch }), (error: unknown) => {
    assert.ok(error instanceof ProviderOperationTerminalError);
    assert.equal(error.code, "PROVIDER_CONTENT_MODERATION");
    assert.ok(!error.message.includes(apiKey)); return true;
  });
});

test("key allowance and management-key rejection occur before any paid call", async () => {
  for (const data of [{ limit_remaining: 0.01 }, { is_management_key: true }]) {
    let requests = 0;
    await assert.rejects(generateOpenRouterSeedanceVideoBuffer({ ...input, ...callbacks }, { apiKey, fetchImpl: (async (_url, init) => {
      assert.notEqual(init?.method, "POST"); requests++; return json({ data });
    }) as typeof fetch }), ProviderRequestNotSubmittedError);
    assert.equal(requests, 1);
  }
});

test("preflight networking failures are safe to retry; paid HTTP errors retain their status", async () => {
  await assert.rejects(generateOpenRouterSeedanceVideoBuffer({ ...input, ...callbacks }, { apiKey, fetchImpl: (async () => { throw new TypeError("network unavailable"); }) as typeof fetch }), (error: unknown) => error instanceof ProviderRequestNotSubmittedError && error.retryable);
  await assert.rejects(generateOpenRouterSeedanceVideoBuffer({ ...input, ...callbacks }, { apiKey, fetchImpl: (async (_url, init) => init?.method === "POST" ? json({ error: { message: "Insufficient credits" } }, 402) : json({ data: {} })) as typeof fetch }), (error: unknown) => error instanceof Error && "status" in error && error.status === 402);
});
