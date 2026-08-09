import assert from "node:assert/strict";
import test from "node:test";

import { runRenderWallTextVideoJob } from "./render-wall-text-video.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow } from "../types.js";

const JOB_ID = "00000000-0000-4000-8000-000000000301";
const ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000302";
const CREATIVE_ID = "00000000-0000-4000-8000-000000000303";
const RENDER_ID = "00000000-0000-4000-8000-000000000304";
const MEDIA_ASSET_ID = "00000000-0000-4000-8000-000000000305";

test("stores one ready standalone Wall-text media asset", async () => {
  const events: string[] = [];
  const store = {
    async markWallTextRenderStarted() {
      events.push("started");
    },
    async markWallTextRenderCompleted(params: {
      mediaAssetId: string;
      renderId: string;
    }) {
      events.push("completed");
      assert.equal(params.mediaAssetId, MEDIA_ASSET_ID);
      assert.equal(params.renderId, RENDER_ID);
    },
    async markWallTextRenderFailed() {
      events.push("failed");
    },
  } as unknown as SupabaseJobStore;

  const output = await runRenderWallTextVideoJob(createJob(), {
    dependencies: {
      createMediaAssetId: () => MEDIA_ASSET_ID,
      async renderWallTextVideoToStorage(payload) {
        events.push("render");
        assert.equal(payload.assignmentId, ASSIGNMENT_ID);
        assert.equal(payload.audio.assetId, "audio_001_segment_01");
        assert.equal(payload.audio.fitMode, "trim");
        assert.equal(
          payload.text.fullText,
          "I logged every meal but skipped drinks oil and small bites. Those missing details quietly changed the final total.",
        );
        assert.equal(payload.placement, "middle");
        assert.equal(payload.text.segments.length, 3);
        return {
          assignmentId: payload.assignmentId,
          creativeId: payload.creativeId,
          key: "videos/rendered/wall.mp4",
          ok: true,
          renderId: payload.renderId,
          url: "https://cdn.example.com/wall.mp4",
        };
      },
    },
    store,
  });

  assert.deepEqual(events, ["started", "render", "completed"]);
  assert.equal(output.mediaAssetId, MEDIA_ASSET_ID);
});

test("records a standalone Wall-text render failure", async () => {
  const events: string[] = [];
  const store = {
    async markWallTextRenderStarted() {
      events.push("started");
    },
    async markWallTextRenderCompleted() {
      events.push("completed");
    },
    async markWallTextRenderFailed() {
      events.push("failed");
    },
  } as unknown as SupabaseJobStore;

  await assert.rejects(
    runRenderWallTextVideoJob(createJob(), {
      dependencies: {
        async renderWallTextVideoToStorage() {
          events.push("render");
          throw new Error("ffmpeg failed");
        },
      },
      store,
    }),
    /ffmpeg failed/,
  );

  assert.deepEqual(events, ["started", "render", "failed"]);
});

test("records a failure when render startup persistence fails", async () => {
  const events: string[] = [];
  const store = {
    async markWallTextRenderStarted() {
      events.push("started");
      throw new Error("database unavailable");
    },
    async markWallTextRenderCompleted() {
      events.push("completed");
    },
    async markWallTextRenderFailed() {
      events.push("failed");
    },
  } as unknown as SupabaseJobStore;

  await assert.rejects(
    runRenderWallTextVideoJob(createJob(), {
      dependencies: {
        async renderWallTextVideoToStorage() {
          events.push("render");
          throw new Error("render should not start");
        },
      },
      store,
    }),
    /database unavailable/,
  );

  assert.deepEqual(events, ["started", "failed"]);
});

test("records a failure when a payload is invalid but identifiers are recoverable", async () => {
  const events: string[] = [];
  const job = createJob();

  (job.input_json as Record<string, unknown>).durationSeconds = 61;

  const store = {
    async markWallTextRenderStarted() {
      events.push("started");
    },
    async markWallTextRenderCompleted() {
      events.push("completed");
    },
    async markWallTextRenderFailed(params: {
      assignmentId: string;
      renderId: string;
      userId: string;
    }) {
      events.push("failed");
      assert.equal(params.assignmentId, ASSIGNMENT_ID);
      assert.equal(params.renderId, RENDER_ID);
      assert.equal(params.userId, "user-test");
    },
  } as unknown as SupabaseJobStore;

  await assert.rejects(
    runRenderWallTextVideoJob(job, { store }),
    /between 0 and 60/,
  );

  assert.deepEqual(events, ["failed"]);
});

function createJob(): BackgroundJobRow {
  const now = "2026-07-29T10:00:00.000Z";

  return {
    attempt_count: 0,
    cancel_requested_at: null,
    queue_message_id: "message-1",
    claim_token: "00000000-0000-4000-8000-000000000306",
    completed_at: null,
    created_at: now,
    error_code: null,
    error_message: null,
    failed_at: null,
    id: JOB_ID,
    input_json: {
      assignmentId: ASSIGNMENT_ID,
      audio: {
        assetDurationSeconds: 12.5,
        assetId: "audio_001_segment_01",
        audioUrl: "https://cdn.example.com/wall-audio.mp3",
        cueStartSeconds: 0,
        fadeOutSeconds: 0.2,
        fitMode: "trim",
        matchingVersion: "wall-audio-match-v1",
        selectionId: "00000000-0000-4000-8000-000000000307",
      },
      creativeId: CREATIVE_ID,
      durationSeconds: 5.056,
      layout: {
        placement: "middle",
        safeArea: {
          bottom: 460 / 1920,
          left: 120 / 1080,
          right: 200 / 1080,
          top: 280 / 1920,
        },
        textBox: {
          height: 480 / 1920,
          width: 620 / 1080,
          x: 230 / 1080,
          y: 660 / 1920,
        },
      },
      projectId: "trending-wall-text",
      renderId: RENDER_ID,
      sourceVideoUrl: "https://cdn.example.com/wall-source.mp4",
      text: {
        fullText:
          "I logged every meal but skipped drinks oil and small bites. Those missing details quietly changed the final total.",
        segments: [
          {
            lines: ["I logged every meal"],
            role: "lead",
          },
          {
            lines: ["but skipped drinks", "oil and small bites."],
            role: "support",
          },
          {
            lines: ["Those missing details", "quietly changed", "the final total."],
            role: "closing",
          },
        ],
      },
      title: "Wall-text idea",
      userId: "user-test",
    },
    input_reference: null,
    job_type: "render_wall_text_video",
    last_delivery_at: now,
    last_heartbeat_at: null,
    locked_at: null,
    max_attempts: 3,
    next_attempt_at: null,
    output_json: null,
    output_reference: null,
    progress: null,
    project_id: "trending-wall-text",
    queue_name: "video-render",
    queue_provider: "gcp",
    queued_at: now,
    stage: "processing",
    started_at: null,
    status: "processing",
    updated_at: now,
    user_id: "user-test",
    worker_execution_id: null,
    worker_id: "worker-test",
  };
}
