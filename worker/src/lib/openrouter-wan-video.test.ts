import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenRouterWanRequest, estimateOpenRouterWanCost, generateOpenRouterWanVideoBuffer } from "./openrouter-wan-video.js";
import { ProviderOperationPollingError, ProviderOperationTerminalError, ProviderRequestNotSubmittedError } from "./generation-provider.js";

const input = { aspectRatio: "9:16", durationSeconds: 3, resolution: "720p", prompt: "Use the reference creator for a three-second curiosity hook." } as const;
const apiKey = "wan-test-private-key";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const video = () => new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), { headers: { "content-type": "video/mp4" } });
const callbacks = { onOperationCreated: async () => {}, onOperationSucceeded: async () => {} };

test("WAN sends its exact model and image guidance, preserving requested settings and prompt", () => {
  const request = buildOpenRouterWanRequest({ ...input, referenceImageUrls: ["https://storage.example.com/creator.png"] });
  assert.equal(request.model, "alibaba/wan-3.0"); assert.equal(request.duration, 3);
  assert.equal(request.prompt, input.prompt); assert.equal(request.resolution, "720p");
  assert.equal(request.generate_audio, true);
  assert.deepEqual(request.input_references, [{ type: "image_url", image_url: { url: "https://storage.example.com/creator.png" } }]);
  for (const durationSeconds of [2, 30]) for (const resolution of ["480p", "720p", "1080p"] as const) {
    assert.equal(buildOpenRouterWanRequest({ ...input, durationSeconds, resolution }).duration, durationSeconds);
  }
  assert.equal(estimateOpenRouterWanCost("480p", 3), 0.05 * 3);
  assert.equal(estimateOpenRouterWanCost("720p", 3), 0.1 * 3);
  assert.equal(estimateOpenRouterWanCost("1080p", 30), 6);
});

test("WAN rejects invalid settings and unsupported inputs before key checks or paid submissions", async () => {
  for (const patch of [{ durationSeconds: 1 }, { durationSeconds: 31 }, { durationSeconds: 2.5 }, { resolution: "4K" }, { aspectRatio: "1:1" }, { prompt: " " }, { prompt: "x".repeat(10001) },
    { referenceImageUrls: ["http://storage.example.com/person.png"] }, { referenceImageUrls: ["https://example.com/a.png", "https://example.com/a.png"] },
    { referenceImageUrls: Array.from({ length: 7 }, (_, i) => `https://example.com/${i}.png`) },
    { referenceVideoUrl: "https://example.com/demo.mp4" }, { referenceAudioUrls: ["https://example.com/voice.mp3"] },
  ]) {
    await assert.rejects(generateOpenRouterWanVideoBuffer({ ...input, ...patch, ...callbacks } as Parameters<typeof generateOpenRouterWanVideoBuffer>[0], {
      apiKey, fetchImpl: (async () => { assert.fail("Invalid WAN input must not call the provider"); }) as typeof fetch,
    }), ProviderRequestNotSubmittedError);
  }
});

test("WAN submits once, saves the ID before polling, authenticates downloads and keeps usage", async () => {
  const events: string[] = [];
  await generateOpenRouterWanVideoBuffer({ ...input,
    onOperationCreated: async id => { assert.equal(id, "wan-job"); events.push("save-id"); },
    onOperationSucceeded: async (id, url, usage) => {
      assert.equal(id, "wan-job"); assert.equal(url, "https://openrouter.ai/api/v1/videos/wan-job/content?index=0");
      assert.deepEqual(usage, { costUsd: 0.255, generationId: "generation-wan" }); events.push("save-output");
    },
  }, { apiKey, fetchImpl: (async (url, init) => {
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${apiKey}`);
    assert.equal(init?.redirect, "error");
    if (String(url).endsWith("/key")) { events.push("key"); return json({ data: { limit_remaining: 1 } }); }
    if (init?.method === "POST") { events.push("submit"); assert.equal(JSON.parse(String(init.body)).model, "alibaba/wan-3.0"); return json({ id: "wan-job" }, 202); }
    if (String(url).includes("/content")) { events.push("download"); return video(); }
    events.push("poll"); return json({ status: "completed", unsigned_urls: ["https://untrusted.example/video"], usage: { cost: 0.255 }, generation_id: "generation-wan" });
  }) as typeof fetch });
  assert.deepEqual(events, ["key", "submit", "save-id", "poll", "save-output", "download"]);
});

test("WAN checks its resolution-specific spending allowance before a paid request", async () => {
  await assert.rejects(generateOpenRouterWanVideoBuffer({ ...input, ...callbacks, resolution: "1080p", durationSeconds: 30 }, {
    apiKey, fetchImpl: (async (_url, init) => { assert.notEqual(init?.method, "POST"); return json({ data: { limit_remaining: 5.99 } }); }) as typeof fetch,
  }), ProviderRequestNotSubmittedError);
});

test("WAN resumes pending and completed jobs without another paid POST", async () => {
  for (const providerOutputUrl of [undefined, "https://ignored.example/output"]) {
    let calls = 0;
    await generateOpenRouterWanVideoBuffer({ ...input, ...callbacks, providerOperationId: "saved-wan", providerOutputUrl }, {
      apiKey, fetchImpl: (async (url, init) => {
        assert.notEqual(init?.method, "POST"); assert.ok(String(url).startsWith("https://openrouter.ai/api/v1/videos/saved-wan")); calls++;
        return String(url).includes("/content") ? video() : json({ status: "completed" });
      }) as typeof fetch,
    });
    assert.equal(calls, providerOutputUrl ? 1 : 2);
  }
});

test("WAN pending jobs remain recoverable and moderation errors redact credentials", async () => {
  await assert.rejects(generateOpenRouterWanVideoBuffer({ ...input, ...callbacks, providerOperationId: "pending-wan" }, {
    apiKey, timeoutMs: 0, fetchImpl: (async () => json({ status: "pending" })) as typeof fetch,
  }), ProviderOperationPollingError);
  await assert.rejects(generateOpenRouterWanVideoBuffer({ ...input, ...callbacks, providerOperationId: "blocked-wan" }, {
    apiKey, fetchImpl: (async () => json({ status: "failed", error: `Content policy violation ${apiKey}` })) as typeof fetch,
  }), (error: unknown) => error instanceof ProviderOperationTerminalError && !error.message.includes(apiKey));
});
