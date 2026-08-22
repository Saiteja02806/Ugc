import assert from "node:assert/strict";
import test from "node:test";

import { runRenderScheduleCombinationJob } from "./render-schedule-combination.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow } from "../types.js";

const JOB_ID = "00000000-0000-4000-8000-000000000201";
const RENDER_ID = "00000000-0000-4000-8000-000000000202";
const SCHEDULE_ID = "00000000-0000-4000-8000-000000000203";
const MEDIA_ASSET_ID = "00000000-0000-4000-8000-000000000204";
const HOOK_VIDEO_DRAFT_ID = "00000000-0000-4000-8000-000000000209";

test("renders and asks the server to finalize a planned schedule", async () => {
  const fixture = createStore();

  const output = await runRenderScheduleCombinationJob(createJob(true), {
    dependencies: {
      createMediaAssetId: () => MEDIA_ASSET_ID,
      async finalizeRenderedSchedule(params) {
        fixture.events.push("finalize");
        assert.deepEqual(params, {
          renderId: RENDER_ID,
          scheduleId: SCHEDULE_ID,
          userId: "user-test",
        });
        return {
          created: true,
          scheduleId: SCHEDULE_ID,
          skipped: false,
          status: "scheduled",
        };
      },
      async renderScheduleCombinationToStorage(payload) {
        fixture.events.push("render");
        assert.equal(payload.hookText, "The old way takes twice the effort.");
        assert.equal(payload.hookTextFontSize, 44);
        assert.deepEqual(payload.hookTextLines, [
          "The old way takes",
          "twice the effort.",
        ]);
        assert.equal(payload.hookTextColor, "#fde047");
        assert.deepEqual(payload.hookAudio, {
          audioAssetId: "hook_audio_029",
          audioUrl: "https://cdn.example.com/EWW.mp3",
          durationSeconds: 14.08,
          selectionSource: "video_locked",
        });
        assert.equal(payload.hookTrimStart, 0.5);
        assert.equal(payload.hookTrimEnd, 4.5);
        assert.equal(payload.compositionFingerprint, "fingerprint-1");
        return createRenderOutput(payload);
      },
    },
    store: fixture.store,
  });

  assert.deepEqual(fixture.events, [
    "render-started",
    "render",
    "render-completed",
    "finalize",
    "finalization-completed",
  ]);
  assert.ok("finalScheduleCreated" in output);
  assert.equal(output.finalScheduleCreated, true);
  assert.equal(output.finalScheduleStatus, "scheduled");
  assert.equal(output.mediaAssetId, MEDIA_ASSET_ID);
});

test("does not call server finalization for a render-only request", async () => {
  const fixture = createStore();
  let finalizationCalls = 0;

  const output = await runRenderScheduleCombinationJob(createJob(false), {
    dependencies: {
      createMediaAssetId: () => MEDIA_ASSET_ID,
      async finalizeRenderedSchedule() {
        finalizationCalls += 1;
        throw new Error("Finalization must not run.");
      },
      async renderScheduleCombinationToStorage(payload) {
        fixture.events.push("render");
        return createRenderOutput(payload);
      },
    },
    store: fixture.store,
  });

  assert.equal(finalizationCalls, 0);
  assert.equal(output.finalScheduleStatus, "not_requested");
  assert.deepEqual(fixture.events, [
    "render-started",
    "render",
    "render-completed",
  ]);
});

test("stores an explicit library save on the Hook draft without touching schedules", async () => {
  const events: string[] = [];
  const job = createJob(false);
  (job.input_json as Record<string, unknown>).hookVideoDraftId =
    HOOK_VIDEO_DRAFT_ID;
  (job.input_json as Record<string, unknown>).scheduleId = HOOK_VIDEO_DRAFT_ID;
  const store = {
    async markHookVideoLibraryRenderStarted(params: { draftId: string }) {
      events.push("hook-render-started");
      assert.equal(params.draftId, HOOK_VIDEO_DRAFT_ID);
    },
    async markHookVideoLibraryRenderCompleted(params: {
      draftId: string;
      mediaAssetId: string;
    }) {
      events.push("hook-render-completed");
      assert.equal(params.draftId, HOOK_VIDEO_DRAFT_ID);
      assert.equal(params.mediaAssetId, MEDIA_ASSET_ID);
    },
    async markHookVideoLibraryRenderFailed() {
      events.push("hook-render-failed");
    },
  } as unknown as SupabaseJobStore;

  const output = await runRenderScheduleCombinationJob(job, {
    dependencies: {
      createMediaAssetId: () => MEDIA_ASSET_ID,
      async renderScheduleCombinationToStorage(payload) {
        events.push("render");
        return createRenderOutput(payload);
      },
    },
    store,
  });

  assert.equal(output.finalScheduleStatus, "not_requested");
  assert.deepEqual(events, [
    "hook-render-started",
    "render",
    "hook-render-completed",
  ]);
});

test("defaults legacy schedule payloads without a text color to white", async () => {
  const fixture = createStore();
  const job = createJob(false);
  delete (job.input_json as Record<string, unknown>).hookTextColor;

  await runRenderScheduleCombinationJob(job, {
    dependencies: {
      createMediaAssetId: () => MEDIA_ASSET_ID,
      async renderScheduleCombinationToStorage(payload) {
        fixture.events.push("render");
        assert.equal(payload.hookTextColor, "#ffffff");
        return createRenderOutput(payload);
      },
    },
    store: fixture.store,
  });
});

test("accepts a three-line Hook at the reference font size", async () => {
  const fixture = createStore();
  const job = createJob(false);
  (job.input_json as Record<string, unknown>).hookText =
    "Meal logging shouldn't interrupt your whole day 😩";
  (job.input_json as Record<string, unknown>).hookTextFontSize = 60;
  (job.input_json as Record<string, unknown>).hookTextLines = [
    "Meal logging",
    "shouldn't interrupt",
    "your whole day 😩",
  ];

  await runRenderScheduleCombinationJob(job, {
    dependencies: {
      createMediaAssetId: () => MEDIA_ASSET_ID,
      async renderScheduleCombinationToStorage(payload) {
        fixture.events.push("render");
        assert.equal(payload.hookTextFontSize, 60);
        assert.deepEqual(payload.hookTextLines, [
          "Meal logging",
          "shouldn't interrupt",
          "your whole day 😩",
        ]);
        return createRenderOutput(payload);
      },
    },
    store: fixture.store,
  });
});

test("rejects unsupported Hook text colors before rendering", async () => {
  const fixture = createStore();
  const job = createJob(false);
  (job.input_json as Record<string, unknown>).hookTextColor = "url(evil)";

  await assert.rejects(
    runRenderScheduleCombinationJob(job, { store: fixture.store }),
    /hookTextColor is not a supported text color/,
  );
  assert.deepEqual(fixture.events, []);
});

test("rejects an invalid Locked Hook audio contract before rendering", async () => {
  const fixture = createStore();
  const job = createJob(false);
  (job.input_json as Record<string, unknown>).hookAudio = {
    audioAssetId: "hook_audio_029",
    audioUrl: "https://cdn.example.com/EWW.mp3",
    durationSeconds: 14.08,
    selectionSource: "preferred",
  };

  await assert.rejects(
    runRenderScheduleCombinationJob(job, { store: fixture.store }),
    /hookAudio.selectionSource must be video_locked/,
  );
  assert.deepEqual(fixture.events, []);
});

test("keeps the completed video available when server finalization fails", async () => {
  const fixture = createStore();

  const output = await runRenderScheduleCombinationJob(createJob(true), {
    dependencies: {
      createMediaAssetId: () => MEDIA_ASSET_ID,
      async finalizeRenderedSchedule() {
        fixture.events.push("finalize");
        throw new Error("finalization endpoint unavailable");
      },
      async renderScheduleCombinationToStorage(payload) {
        fixture.events.push("render");
        return createRenderOutput(payload);
      },
    },
    store: fixture.store,
  });

  assert.equal(output.finalScheduleStatus, "failed");
  assert.ok("finalScheduleError" in output);
  assert.equal(output.finalScheduleError, "finalization endpoint unavailable");
  assert.deepEqual(fixture.events, [
    "render-started",
    "render",
    "render-completed",
    "finalize",
    "finalization-failed",
  ]);
});

test("records a render failure and does not attempt final scheduling", async () => {
  const fixture = createStore();
  let finalizationCalls = 0;

  await assert.rejects(
    runRenderScheduleCombinationJob(createJob(true), {
      dependencies: {
        createMediaAssetId: () => MEDIA_ASSET_ID,
        async finalizeRenderedSchedule() {
          finalizationCalls += 1;
          throw new Error("Finalization must not run.");
        },
        async renderScheduleCombinationToStorage() {
          fixture.events.push("render");
          throw new Error("ffmpeg failed");
        },
      },
      store: fixture.store,
    }),
    /ffmpeg failed/,
  );

  assert.equal(finalizationCalls, 0);
  assert.deepEqual(fixture.events, [
    "render-started",
    "render",
    "render-failed",
  ]);
});

function createStore() {
  const events: string[] = [];
  const store = {
    async markScheduleCombinationFinalizationCompleted() {
      events.push("finalization-completed");
    },
    async markScheduleCombinationFinalizationFailed() {
      events.push("finalization-failed");
    },
    async markScheduleCombinationRenderCompleted(params: {
      hookAudioAssetId: string | null;
      mediaAssetId: string;
      renderId: string;
    }) {
      events.push("render-completed");
      assert.equal(params.hookAudioAssetId, "hook_audio_029");
      assert.equal(params.mediaAssetId, MEDIA_ASSET_ID);
      assert.equal(params.renderId, RENDER_ID);
    },
    async markScheduleCombinationRenderFailed() {
      events.push("render-failed");
    },
    async markScheduleCombinationRenderStarted() {
      events.push("render-started");
    },
  };

  return {
    events,
    store: store as unknown as SupabaseJobStore,
  };
}

function createRenderOutput(payload: {
  demoVideoId: string;
  hookVideoId: string;
  renderId: string;
  scheduleId: string;
}) {
  return {
    demoVideoId: payload.demoVideoId,
    hookVideoId: payload.hookVideoId,
    key: "schedules/final.mp4",
    ok: true as const,
    renderId: payload.renderId,
    scheduleId: payload.scheduleId,
    url: "https://cdn.example.com/schedules/final.mp4",
  };
}

function createJob(autoFinalize: boolean): BackgroundJobRow {
  const now = "2026-07-16T10:00:00.000Z";

  return {
    attempt_count: 0,
    cancel_requested_at: null,
    queue_message_id: "message-1",
    claim_token: "00000000-0000-4000-8000-000000000205",
    completed_at: null,
    created_at: now,
    error_code: null,
    error_message: null,
    failed_at: null,
    id: JOB_ID,
    input_json: {
      autoFinalize,
      compositionFingerprint: "fingerprint-1",
      demoVideoId: "00000000-0000-4000-8000-000000000206",
      demoVideoUrl: "https://cdn.example.com/demo.mp4",
      hookText: "The old way takes twice the effort.",
      hookTextFontSize: 44,
      hookTextLines: ["The old way takes", "twice the effort."],
      hookTextColor: "#fde047",
      hookAudio: {
        audioAssetId: "hook_audio_029",
        audioUrl: "https://cdn.example.com/EWW.mp3",
        durationSeconds: 14.08,
        selectionSource: "video_locked",
      },
      hookTrimEnd: 4.5,
      hookTrimStart: 0.5,
      hookVideoId: "00000000-0000-4000-8000-000000000207",
      hookVideoUrl: "https://cdn.example.com/hook.mp4",
      projectId: "00000000-0000-4000-8000-000000000208",
      ratio: "9:16",
      renderId: RENDER_ID,
      scheduleId: SCHEDULE_ID,
      title: "Combined schedule",
      userId: "user-test",
    },
    input_reference: null,
    job_type: "render_schedule_combination",
    last_delivery_at: now,
    last_heartbeat_at: now,
    locked_at: now,
    max_attempts: 3,
    next_attempt_at: null,
    output_json: null,
    output_reference: null,
    progress: null,
    project_id: "00000000-0000-4000-8000-000000000208",
    queue_name: "video-render",
    queue_provider: "gcp",
    queued_at: now,
    stage: "processing",
    started_at: now,
    status: "processing",
    updated_at: now,
    user_id: "user-test",
    worker_execution_id: null,
    worker_id: "worker-test",
  };
}
