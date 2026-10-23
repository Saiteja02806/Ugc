import assert from "node:assert/strict";
import test from "node:test";
import { buildReapiVideoRequest, generateReapiVideoBuffer } from "./reapi-video.js";
import { ProviderOperationPollingError, ProviderOperationTerminalError, ProviderOutputCollectionError, ProviderRequestNotSubmittedError } from "./generation-provider.js";

const input = { model: "seedance_2_5", prompt: "The creator introduces an app in a calm voice.", aspectRatio: "9:16", durationSeconds: 17, resolution: "720p" } as const;
const references = { referenceImageUrls: ["https://storage.example.com/portrait.png"], referenceAudioUrls: ["https://storage.example.com/voice.mp3"], referenceAudioDurationSeconds: [8], referenceVideoUrl: "https://storage.example.com/source.mp4", referenceVideoDurationSeconds: 7.923 };
const callbacks = { onOperationCreated: async () => {}, onOperationSucceeded: async () => {} };
const apiKey = "reapi-private-test-key";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const video = () => new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), { headers: { "content-type": "video/mp4" } });

test("approved first-frame animation uses the explicit frame role, adaptive shape and fixed duration with sound off", () => {
  for (const durationSeconds of [4, 8, 15]) {
    const request = buildReapiVideoRequest({ ...input, durationSeconds, startingFrameImageUrl: "https://storage.example.com/approved-frame.png" });
    assert.equal(request.model, "doubao-seedance-2.5-face");
    assert.deepEqual(request.image_with_roles, [{ url: "https://storage.example.com/approved-frame.png", role: "first_frame" }]);
    assert.equal(request.size, "adaptive");
    assert.equal(request.duration, durationSeconds);
    assert.equal("generate_audio" in request && request.generate_audio, false);
    for (const field of ["image_urls", "video_urls", "audio_urls", "omni_reference_task_type", "generation_type"]) assert.equal(field in request, false, field);
  }
  const audible = buildReapiVideoRequest({ ...input, durationSeconds: 8, startingFrameImageUrl: "https://storage.example.com/approved-frame.png", generateAudio: true });
  assert.equal("generate_audio" in audible && audible.generate_audio, true);
});

test("WAN starting frames use the literal frame family, not general reference mode", () => {
  const request = buildReapiVideoRequest({ ...input, model: "wan_3_0", durationSeconds: 8, startingFrameImageUrl: "https://storage.example.com/frame.png" });
  assert.equal(request.model, "wan3.0-video"); assert.equal(request.size, "adaptive");
  assert.deepEqual(request.image_with_roles, [{ url: "https://storage.example.com/frame.png", role: "first_frame" }]);
  assert.equal("audio" in request && request.audio, false); assert.equal(request.content_filter, true);
  assert.equal("generation_type" in request, false); assert.equal("image_urls" in request, false);
});

test("first-frame conflicts and unsupported models or durations reject before any paid request", async () => {
  for (const patch of [
    { model: "google_omni" }, { durationSeconds: -1 }, { durationSeconds: 16 }, { durationSeconds: 3.5 },
    { startingFrameImageUrl: "http://storage.example.com/frame.png" },
    { referenceImageUrl: "https://storage.example.com/portrait.png" },
    { referenceImageUrls: ["https://storage.example.com/portrait.png"] },
    { referenceVideoUrl: "https://storage.example.com/video.mp4", referenceVideoDurationSeconds: 4 },
    { referenceAudioUrls: ["https://storage.example.com/music.mp3"], referenceAudioDurationSeconds: [4] },
    { referenceVideoMode: "edit" },
  ]) {
    await assert.rejects(generateReapiVideoBuffer({ ...input, durationSeconds: 4, startingFrameImageUrl: "https://storage.example.com/frame.png", ...patch, ...callbacks } as Parameters<typeof generateReapiVideoBuffer>[0], {
      apiKey, fetchImpl: (async () => assert.fail("Invalid frame animation must not contact the provider")) as typeof fetch,
    }), ProviderRequestNotSubmittedError);
  }
});

test("first-frame submission sends the native role once and saved-task recovery never rebuilds or resubmits it", async () => {
  let posts = 0, saves = 0;
  const frame = { ...input, durationSeconds: 8, startingFrameImageUrl: "https://storage.example.com/approved-frame.png" };
  const fetchImpl = (async (url, init) => {
    if (init?.method === "POST") {
      posts++;
      assert.equal(String(url), "https://reapi.ai/api/v1/videos/generations");
      assert.deepEqual(JSON.parse(String(init.body)), {
        model: "doubao-seedance-2.5-face", prompt: frame.prompt, duration: 8, size: "adaptive", resolution: "720p",
        content_filter: false, generate_audio: false, output_format: "mp4",
        image_with_roles: [{ url: frame.startingFrameImageUrl, role: "first_frame" }],
      });
      return json({ id: "accepted-first-frame", status: "processing" }, 202);
    }
    if (String(url).startsWith("https://reapi.ai/api/v1/tasks/")) {
      assert.equal(saves, 1, "Save the task before the first poll");
      return json({ id: "accepted-first-frame", status: "completed", output: { video_urls: ["https://cdn.reapi.ai/frame.mp4"] } });
    }
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    return video();
  }) as typeof fetch;
  await generateReapiVideoBuffer({ ...frame, ...callbacks, onOperationCreated: async id => {
    assert.equal(id, "accepted-first-frame"); saves++;
  } }, { apiKey, fetchImpl });
  await generateReapiVideoBuffer({ ...frame, ...callbacks, providerOperationId: "accepted-first-frame",
    startingFrameImageUrl: "expired-or-unreadable-reference", onOperationCreated: async () => assert.fail("Recovery cannot create a task"),
  }, { apiKey, fetchImpl });
  assert.equal(posts, 1);
});

test("Seedance source editing uses the complete native contract, retaining every photo and explicit silence", () => {
  const images = Array.from({ length: 6 }, (_, i) => `https://storage.example.com/face-${i + 1}.png`);
  const request = buildReapiVideoRequest({ ...input, ...references, durationSeconds: 8, referenceVideoMode: "edit", referenceImageUrls: images, generateAudio: false });
  assert.equal(request.model, "doubao-seedance-2.5-face");
  assert.equal(request.duration, -1);
  assert.equal(request.size, "adaptive");
  assert.equal(request.content_filter, false);
  assert.equal("omni_reference_task_type" in request && request.omni_reference_task_type, "edit");
  assert.equal("generate_audio" in request && request.generate_audio, false);
  assert.deepEqual(request.image_urls, images);
  assert.deepEqual(request.video_urls, [references.referenceVideoUrl]);
  const reference = buildReapiVideoRequest({ ...input, ...references });
  assert.equal(reference.duration, 17);
  assert.equal(reference.size, "9:16");
  assert.equal("omni_reference_task_type" in reference && reference.omni_reference_task_type, "reference");
});

test("ineligible editing cannot make a paid provider request", async () => {
  for (const patch of [{ referenceVideoDurationSeconds: 3.467 }, { referenceVideoDurationSeconds: 30.001 }, { referenceVideoUrl: undefined }, { model: "wan_3_0" }]) {
    await assert.rejects(generateReapiVideoBuffer({ ...input, ...references, referenceVideoMode: "edit", ...patch, ...callbacks } as Parameters<typeof generateReapiVideoBuffer>[0], {
      apiKey, fetchImpl: (async () => assert.fail("incompatible editing must not contact the provider")) as typeof fetch,
    }), ProviderRequestNotSubmittedError);
  }
});

test("explicit sound choices reach the model's native flag without changing reference order", () => {
  for (const generateAudio of [false, true]) for (const model of ["seedance_2_5", "wan_3_0"] as const) {
    const request = buildReapiVideoRequest({ ...input, ...references, model, generateAudio });
    assert.equal("generate_audio" in request ? request.generate_audio : request.audio, generateAudio);
    assert.deepEqual(request.image_urls, references.referenceImageUrls);
    assert.deepEqual(request.video_urls, [references.referenceVideoUrl]);
  }
});

test("Seedance Less Restriction and WAN use ReAPI's exact native schema with every reference intact", () => {
  const seedance = buildReapiVideoRequest({ ...input, ...references });
  assert.ok("generate_audio" in seedance);
  assert.equal(seedance.model, "doubao-seedance-2.5-face");
  assert.equal(seedance.content_filter, false); assert.equal(seedance.generate_audio, true);
  assert.equal(seedance.omni_reference_task_type, "reference");
  assert.equal(seedance.size, "9:16"); assert.equal(seedance.resolution, "720p");
  const wan = buildReapiVideoRequest({ ...input, ...references, model: "wan_3_0" });
  assert.ok("audio" in wan);
  assert.equal(wan.model, "wan3.0-video"); assert.equal(wan.content_filter, true);
  assert.equal(wan.audio, true); assert.equal("generate_audio" in wan, false);
  assert.equal(wan.generation_type, "reference"); assert.equal(wan.resolution, "720P");
  for (const request of [seedance, wan]) {
    assert.equal(request.prompt, input.prompt); assert.equal(request.duration, 17);
    assert.deepEqual(request.image_urls, references.referenceImageUrls);
    assert.deepEqual(request.audio_urls, references.referenceAudioUrls);
    assert.deepEqual(request.video_urls, [references.referenceVideoUrl]);
    assert.equal("input_references" in request, false);
  }
});

test("text, image, audio, video and combined guidance are all preserved independently", () => {
  for (const model of ["seedance_2_5", "wan_3_0"] as const) {
    for (const refs of [{}, { referenceImageUrls: references.referenceImageUrls },
      { referenceAudioUrls: references.referenceAudioUrls, referenceAudioDurationSeconds: [8] },
      { referenceVideoUrl: references.referenceVideoUrl, referenceVideoDurationSeconds: 7.923 }, references]) {
      const request = buildReapiVideoRequest({ ...input, ...refs, model });
      assert.equal(request.model, model === "seedance_2_5" ? "doubao-seedance-2.5-face" : "wan3.0-video");
      assert.deepEqual(request.image_urls, "referenceImageUrls" in refs ? refs.referenceImageUrls : undefined);
      assert.deepEqual(request.audio_urls, "referenceAudioUrls" in refs ? refs.referenceAudioUrls : undefined);
      assert.deepEqual(request.video_urls, "referenceVideoUrl" in refs ? [refs.referenceVideoUrl] : undefined);
    }
  }
});

test("model-specific image limits preserve every ordered image independently of timed references", () => {
  for (const [model, limit] of [["seedance_2_5", 30], ["wan_3_0", 10]] as const) {
    const images = Array.from({ length: limit }, (_, index) => `https://storage.example.com/face-${index}.png`);
    const request = buildReapiVideoRequest({ ...input, ...references, model, referenceImageUrls: images });
    assert.deepEqual(request.image_urls, images);
    assert.deepEqual(request.video_urls, [references.referenceVideoUrl]);
    assert.deepEqual(request.audio_urls, references.referenceAudioUrls);
    assert.throws(() => buildReapiVideoRequest({ ...input, ...references, model,
      referenceImageUrls: [...images, "https://storage.example.com/excess.png"],
    }), ProviderRequestNotSubmittedError);
  }
});

test("invalid ReAPI settings and timed references fail before any paid submission", async () => {
  for (const patch of [{ generateAudio: "false" }, { durationSeconds: 3 }, { referenceAudioUrls: references.referenceAudioUrls },
    { referenceAudioUrls: references.referenceAudioUrls, referenceAudioDurationSeconds: [1] },
    { referenceVideoUrl: references.referenceVideoUrl, referenceVideoDurationSeconds: 31 },
    { referenceImageUrls: ["http://example.com/image.png"] }, { referenceImageUrls: Array(7).fill("https://example.com/x.png") },
    { model: "wan_3_0", ...references, durationSeconds: 30 }, { resolution: "4K" }, { prompt: " " }]) {
    await assert.rejects(generateReapiVideoBuffer({ ...input, ...patch, ...callbacks } as Parameters<typeof generateReapiVideoBuffer>[0], {
      apiKey, fetchImpl: (async () => assert.fail("invalid input must not call ReAPI")) as typeof fetch,
    }), ProviderRequestNotSubmittedError);
  }
});

test("saves the ReAPI task before polling, preserves settlement cost, and never leaks credentials to CDN", async () => {
  const events: string[] = [];
  const bytes = await generateReapiVideoBuffer({ ...input, ...references,
    onOperationCreated: async id => { assert.equal(id, "saved-task"); events.push("save-id"); },
    onOperationSucceeded: async (id, url, usage) => { assert.equal(id, "saved-task"); assert.equal(url, "https://cdn.reapi.ai/media/output.mp4"); assert.deepEqual(usage, { generationId: id, costUsd: 0.189 }); events.push("save-output"); },
  }, { apiKey, fetchImpl: (async (url, init) => {
    assert.equal(init?.redirect, "error");
    if (String(url).startsWith("https://cdn.reapi.ai/")) { assert.equal(new Headers(init?.headers).has("Authorization"), false); events.push("download"); return video(); }
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${apiKey}`);
    if (init?.method === "POST") { assert.equal(String(url), "https://reapi.ai/api/v1/videos/generations"); assert.equal(JSON.parse(String(init.body)).content_filter, false); events.push("submit"); return json({ id: "saved-task", status: "processing" }, 202); }
    assert.equal(String(url), "https://reapi.ai/api/v1/tasks/saved-task"); events.push("poll"); return json({ id: "saved-task", status: "completed", output: { video_urls: ["https://cdn.reapi.ai/media/output.mp4"] }, usage: { credits: 189 } });
  }) as typeof fetch });
  assert.ok(bytes.length); assert.deepEqual(events, ["submit", "save-id", "poll", "save-output", "download"]);
});

test("saved pending/completed tasks recover by ID with no POST and refresh their output URL", async () => {
  for (const providerOutputUrl of [undefined, "https://expired.example.com/old.mp4"]) {
    await generateReapiVideoBuffer({ ...input, ...callbacks, providerOperationId: "accepted", providerOutputUrl }, { apiKey,
      fetchImpl: (async (url, init) => { assert.notEqual(init?.method, "POST"); return String(url).includes("/tasks/") ? json({ status: "completed", output: { video_urls: ["https://cdn.reapi.ai/fresh.mp4"] } }) : video(); }) as typeof fetch });
  }
  await assert.rejects(generateReapiVideoBuffer({ ...input, ...callbacks, providerOperationId: "pending" }, { apiKey, timeoutMs: 0,
    fetchImpl: (async () => json({ status: "processing" })) as typeof fetch }), ProviderOperationPollingError);
});

test("recovers completed production WAN output from either verified host without submitting or sending credentials to storage", async () => {
  for (const host of ["cdn.reapi.ai", "file.deepytb.com"]) {
    const events: string[] = [];
    const outputUrl = `https://${host}/wan/result.mp4?token=private-signed-token`;
    await generateReapiVideoBuffer({ ...input, model: "wan_3_0", providerOperationId: "saved-wan", ...callbacks,
      onOperationSucceeded: async (id, url, usage) => {
        assert.equal(id, "saved-wan"); assert.equal(url, outputUrl);
        assert.deepEqual(usage, { generationId: id, costUsd: .495 }); events.push("completed");
      },
    }, { apiKey, fetchImpl: (async (url, init) => {
      assert.notEqual(init?.method, "POST"); assert.equal(init?.redirect, "error");
      if (String(url).startsWith("https://reapi.ai/api/v1/tasks/")) {
        assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${apiKey}`);
        return json({ id: "saved-wan", status: "completed", output: { video_urls: [outputUrl] }, usage: { credits: 495 } });
      }
      assert.equal(String(url), outputUrl); assert.equal(new Headers(init?.headers).has("Authorization"), false);
      events.push("download"); return video();
    }) as typeof fetch });
    assert.deepEqual(events, ["completed", "download"]);
  }
});

test("recovers the completed Seedance Less Restriction result from its isolated production CDN without a paid POST", async () => {
  const outputUrl = "https://reapiflexible.b-cdn.net/seedance/result.mp4?token=private-signed-token";
  const events: string[] = [];
  const bytes = await generateReapiVideoBuffer({ ...input, providerOperationId: "saved-seedance", ...callbacks,
    onOperationCreated: async () => assert.fail("recovery must not create a task"),
    onOperationSucceeded: async (id, url, usage) => {
      assert.equal(id, "saved-seedance"); assert.equal(url, outputUrl);
      assert.deepEqual(usage, { generationId: id, costUsd: 1.281 }); events.push("completed");
    },
  }, { apiKey, fetchImpl: (async (url, init) => {
    assert.notEqual(init?.method, "POST"); assert.equal(init?.redirect, "error");
    if (String(url) === "https://reapi.ai/api/v1/tasks/saved-seedance") {
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${apiKey}`);
      return json({ id: "saved-seedance", status: "completed", model: "doubao-seedance-2.5-face",
        output: { video_urls: [outputUrl] }, usage: { credits: 1281 } });
    }
    assert.equal(String(url), outputUrl); assert.equal(new Headers(init?.headers).has("Authorization"), false);
    assert.deepEqual(events, ["completed"]); events.push("download"); return video();
  }) as typeof fetch });
  assert.ok(bytes.length); assert.deepEqual(events, ["completed", "download"]);
});

test("rejects missing and untrusted outputs without fetching them, retaining safe completion and settlement", async () => {
  for (const outputUrl of [undefined, "", "http://file.deepytb.com/video.mp4", "https://file.deepytb.com.evil.example/video.mp4",
    "https://cdn.reapi.ai@evil.example/video.mp4", "https://user:private@file.deepytb.com/video.mp4",
    "https://file.deepytb.com:8443/video.mp4", "https://127.0.0.1/video.mp4", "https://evil.example/private-token",
    "http://reapiflexible.b-cdn.net/video.mp4", "https://reapiflexible.b-cdn.net.evil.example/video.mp4",
    "https://untrusted.b-cdn.net/video.mp4", "https://reapiflexible.b-cdn.net@evil.example/video.mp4",
    "https://private@reapiflexible.b-cdn.net/video.mp4", "https://reapiflexible.b-cdn.net:8443/video.mp4"]) {

    let completed = 0;
    await assert.rejects(generateReapiVideoBuffer({ ...input, ...callbacks, providerOperationId: "saved",
      onOperationSucceeded: async (id, url, usage) => { completed++; assert.equal(id, "saved"); assert.equal(url, undefined); assert.equal(usage?.costUsd, .495); },
    }, { apiKey, fetchImpl: (async (url) => {
      assert.equal(String(url), "https://reapi.ai/api/v1/tasks/saved", "untrusted output must never be fetched");
      return json({ id: "saved", status: "completed", output: { video_urls: outputUrl === undefined ? [] : [outputUrl] }, usage: { credits: 495 } });
    }) as typeof fetch }), error => error instanceof ProviderOutputCollectionError && error.code === "PROVIDER_OUTPUT_COLLECTION_FAILED" &&
      !/private-token|evil|private@/.test(error.message));
    assert.equal(completed, 1);
  }
});

test("completed video download failures retain collection diagnostics without leaking raw CDN errors", async () => {
  let completed = false;
  await assert.rejects(generateReapiVideoBuffer({ ...input, ...callbacks, providerOperationId: "saved",
    onOperationSucceeded: async () => { completed = true; },
  }, { apiKey, fetchImpl: (async (url, init) => {
    assert.notEqual(init?.method, "POST"); assert.equal(init?.redirect, "error");
    if (String(url).includes("/tasks/")) return json({ status: "completed", output: { video_urls: ["https://file.deepytb.com/video.mp4"] } });
    assert.equal(completed, true); throw new Error("private-signed-url private-secret");
  }) as typeof fetch }), error => error instanceof ProviderOutputCollectionError && error.code === "PROVIDER_OUTPUT_COLLECTION_FAILED" &&
    /could not be downloaded/.test(error.message) && !/private|still being recovered/.test(error.message));
});

test("provider rejections remain terminal and raw keys or signed URL diagnostics stay private", async () => {
  await assert.rejects(generateReapiVideoBuffer({ ...input, ...callbacks }, { apiKey,
    fetchImpl: (async () => json({ error: { code: 80006, message: apiKey } }, 400)) as typeof fetch }),
    (error: unknown) => error instanceof ProviderOperationTerminalError && error.code === "PROVIDER_CONTENT_MODERATION" && !error.message.includes(apiKey));
  await assert.rejects(generateReapiVideoBuffer({ ...input, ...callbacks }, { apiKey,
    fetchImpl: (async () => json({ error: { message: apiKey } }, 402)) as typeof fetch }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "insufficient_credits" && !error.message.includes(apiKey));
  await assert.rejects(generateReapiVideoBuffer({ ...input, ...callbacks, providerOperationId: "failed" }, { apiKey,
    fetchImpl: (async () => json({ status: "failed", error: { code: 80006, message: apiKey } })) as typeof fetch }), ProviderOperationTerminalError);
  await assert.rejects(generateReapiVideoBuffer({ ...input, ...callbacks }, { apiKey,
    fetchImpl: (async () => { throw new Error(apiKey); }) as typeof fetch }), error => error instanceof Error && !error.message.includes(apiKey));
});

test("missing key and malformed acceptance cannot trigger a second paid POST", async () => {
  const previous = process.env.REAPI_API_KEY;
  delete process.env.REAPI_API_KEY;
  try { await assert.rejects(generateReapiVideoBuffer({ ...input, ...callbacks }, { fetchImpl: (async () => assert.fail("no key")) as typeof fetch }), ProviderRequestNotSubmittedError); }
  finally { if (previous !== undefined) process.env.REAPI_API_KEY = previous; }
  let posts = 0;
  await assert.rejects(generateReapiVideoBuffer({ ...input, ...callbacks }, { apiKey,
    fetchImpl: (async () => { posts++; return json({ status: "processing" }, 202); }) as typeof fetch }));
  assert.equal(posts, 1);
});
