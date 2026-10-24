import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock, test } from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

let stored;
mock.module("../../dist/lib/storage.js", { namedExports: {
  getStoredObject: async () => null,
  uploadBufferToStorage: async input => { stored = input.buffer; return { key: input.key, url: `https://storage.example.com/${input.key}` }; },
} });
const { runGenerateHookVideoJob } = await import("../../dist/jobs/generate-hook-video.js");
const json = value => Response.json(value);

test("the worker sends the edit contract to mocked ReAPI and verifies actual MP4 timing and silence without duplicate submission", async () => {
  const folder = await mkdtemp(join(tmpdir(), "ugc-seedance-edit-"));
  const oldKey = process.env.REAPI_API_KEY, oldFfmpeg = process.env.FFMPEG_PATH;
  process.env.REAPI_API_KEY = "offline-fixture-key"; process.env.FFMPEG_PATH = ffmpeg;
  try {
    const source = join(folder, "provider.mp4"), output = join(folder, "delivered.mp4");
    execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=180x320:rate=30:duration=4", "-f", "lavfi", "-i", "sine=frequency=660:duration=4", "-c:v", "libx264", "-c:a", "aac", "-shortest", source], { windowsHide: true });
    const providerBytes = await readFile(source);
    const images = Array.from({ length: 6 }, (_, i) => `https://storage.example.com/face-${i + 1}.png`);
    const prompt = "Edit @Video 1: replace the face with @Image 1; @Image 2, @Image 3, @Image 4, @Image 5, @Image 6 show the same person. Preserve performance and scene. SOUND SETTING: OFF.";
    const job = { id: "edit-job", input_json: { provider: "reapi", model: "seedance_2_5", promptMode: "direct", hookIdea: prompt,
      exploreFormat: "hook", referenceVideoMode: "edit", referenceVideoUrl: "https://storage.example.com/source.mp4", referenceVideoDurationSeconds: 4,
      avatarImageUrl: images[0], referenceImageUrls: images, durationSeconds: 4, resolution: "720p", aspectRatio: "9:16", generateAudio: false,
      projectId: "ai-studio", userId: "user-1", videoId: "video-1" } };
    let operation, posts = 0;
    const events = [];
    const context = { checkpoint: async () => {}, store: {
      getGenerationProviderOperation: async ({ operationKey }) => operationKey === "primary-reapi" ? operation ?? null : null,
      reserveGenerationProviderOperation: async input => {
        const shouldSubmit = !operation;
        if (operation) assert.equal(input.requestFingerprint, operation.request_fingerprint);
        operation ??= { provider: input.provider, status: "reserved", request_fingerprint: input.requestFingerprint, metadata: input.metadata };
        return { shouldSubmit, operation };
      },
      markGenerationProviderSubmitted: async value => { events.push("save-id"); Object.assign(operation, { status: "submitted", provider_operation_id: value.providerOperationId }); },
      markGenerationProviderSucceeded: async value => { events.push("save-completion"); Object.assign(operation, { status: "provider_succeeded", output_url: value.outputUrl, metadata: value.metadata }); },
      markGenerationOutputPersisted: async value => { events.push("persist-output"); Object.assign(operation, { status: "output_persisted", output_url: value.outputUrl, metadata: value.metadata }); },
      markGenerationProviderSubmissionUncertain: async () => assert.fail("unexpected uncertain submission"),
      markGenerationProviderFailed: async () => assert.fail("unexpected provider failure"),
    } };
    mock.method(globalThis, "fetch", async (url, init) => {
      if (init?.method === "POST") {
        posts++;
        const request = JSON.parse(init.body);
        assert.equal(request.prompt, prompt); assert.equal(request.duration, -1); assert.equal(request.size, "adaptive");
        assert.equal(request.omni_reference_task_type, "edit"); assert.equal(request.content_filter, false); assert.equal(request.generate_audio, false);
        assert.deepEqual(request.image_urls, images); assert.deepEqual(request.video_urls, [job.input_json.referenceVideoUrl]);
        return json({ id: "accepted-edit" });
      }
      if (String(url).startsWith("https://reapi.ai/api/v1/tasks/")) {
        assert.equal(operation.provider_operation_id, "accepted-edit");
        return json({ id: "accepted-edit", status: "completed", output: { video_urls: ["https://cdn.reapi.ai/edit.mp4"] }, usage: { credits: 1288 } });
      }
      assert.equal(String(url), "https://cdn.reapi.ai/edit.mp4");
      assert.equal(new Headers(init?.headers).has("Authorization"), false);
      return new Response(providerBytes, { headers: { "content-type": "video/mp4" } });
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await runGenerateHookVideoJob(job, context);
      assert.equal(result.provider, "reapi"); assert.equal(result.durationSeconds, 4);
      assert.equal(result.generateAudio, false);
      await writeFile(output, stored);
      const info = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", output], { encoding: "utf8", windowsHide: true }));
      assert.equal(info.streams.some(stream => stream.codec_type === "audio"), false);
    }
    assert.equal(posts, 1, "recovery must reuse the same accepted task");
    assert.equal(operation.metadata.durationSeconds, 4);
    assert.equal(operation.metadata.providerCostUsd, 1.288);
    assert.equal(events[0], "save-id");
    const pictures = path => execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-i", path, "-map", "0:v:0", "-f", "framemd5", "pipe:1"], { encoding: "utf8", windowsHide: true });
    assert.equal(pictures(source), pictures(output), "silencing must preserve every decoded provider picture and timestamp");
  } finally {
    mock.restoreAll();
    if (oldKey === undefined) delete process.env.REAPI_API_KEY; else process.env.REAPI_API_KEY = oldKey;
    if (oldFfmpeg === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = oldFfmpeg;
    await rm(folder, { recursive: true, force: true });
  }
});
