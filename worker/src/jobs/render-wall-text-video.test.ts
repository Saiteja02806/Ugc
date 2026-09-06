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
    async hasPendingWallTextSchedules() {
      return true;
    },
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
      async finalizeRenderedWallTextSchedules(params) {
        events.push("finalized");
        assert.equal(params.assignmentId, ASSIGNMENT_ID);
        assert.equal(params.mediaAssetId, MEDIA_ASSET_ID);
        assert.equal(params.renderId, RENDER_ID);
        return { finalizedCount: 1, scheduleCount: 1 };
      },
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

  assert.deepEqual(events, ["started", "render", "completed", "finalized"]);
  assert.equal(output.mediaAssetId, MEDIA_ASSET_ID);
});

test("accepts the versioned Arial Bold 500 final layout", async () => {
  const job = createJob();
  const input = job.input_json as Record<string, unknown>;
  const text = input.text as Record<string, unknown>;
  const finalTextLines = [
    "I logged every meal but",
    "skipped drinks oil and small",
    "bites. Those missing details",
    "quietly changed the final",
    "total.",
  ];
  text.finalLayout = {
    blocks: [{ lines: finalTextLines, role: "text" }],
    fontFamily: "Arial",
    fontSizePx: 48,
    fontWeight: 500,
    lineHeightPx: 52.8,
    textBox: (input.layout as { textBox: unknown }).textBox,
    version: "wall-text-final-layout-v3",
  };

  await runRenderWallTextVideoJob(job, {
    dependencies: {
      async renderWallTextVideoToStorage(payload) {
        assert.equal(payload.text.finalLayout?.fontFamily, "Arial");
        assert.equal(payload.text.finalLayout?.fontWeight, 500);
        assert.equal(payload.text.finalLayout?.version, "wall-text-final-layout-v3");
        return {
          assignmentId: ASSIGNMENT_ID,
          creativeId: CREATIVE_ID,
          key: "videos/rendered/wall.mp4",
          ok: true,
          renderId: RENDER_ID,
          url: "https://cdn.example.com/wall.mp4",
        };
      },
    },
    store: successfulStore(),
  });
});

test("accepts the current Arial Regular 400 final layout", async () => {
  const job = createJob();
  const input = job.input_json as Record<string, unknown>;
  const text = input.text as Record<string, unknown>;
  text.finalLayout = {
    blocks: [{
      lines: [
        "I logged every meal but",
        "skipped drinks oil and small",
        "bites. Those missing details",
        "quietly changed the final",
        "total.",
      ],
      role: "text",
    }],
    fontFamily: "Arial",
    fontSizePx: 48,
    fontWeight: 400,
    lineHeightPx: 52.8,
    textBox: (input.layout as { textBox: unknown }).textBox,
    version: "wall-text-final-layout-v4",
  };

  await runRenderWallTextVideoJob(job, {
    dependencies: {
      async renderWallTextVideoToStorage(payload) {
        assert.equal(payload.text.finalLayout?.fontFamily, "Arial");
        assert.equal(payload.text.finalLayout?.fontWeight, 400);
        assert.equal(payload.text.finalLayout?.version, "wall-text-final-layout-v4");
        return {
          assignmentId: ASSIGNMENT_ID,
          creativeId: CREATIVE_ID,
          key: "videos/rendered/wall.mp4",
          ok: true,
          renderId: RENDER_ID,
          url: "https://cdn.example.com/wall.mp4",
        };
      },
    },
    store: successfulStore(),
  });
});

test("accepts the current Avenir Next Demi Bold 600 final layout", async () => {
  const job = createJob();
  const input = job.input_json as Record<string, unknown>;
  const text = input.text as Record<string, unknown>;
  text.layoutVersion = "wall-text-overlay-v9";
  text.finalLayout = {
    blocks: [{
      lines: [
        "I logged every meal but",
        "skipped drinks oil and small",
        "bites. Those missing details",
        "quietly changed the final",
        "total.",
      ],
      role: "text",
    }],
    fontFamily: "Avenir Next",
    fontSizePx: 48,
    fontWeight: 600,
    lineHeightPx: 52.8,
    textBox: (input.layout as { textBox: unknown }).textBox,
    version: "wall-text-final-layout-v5",
  };

  await runRenderWallTextVideoJob(job, {
    dependencies: {
      async renderWallTextVideoToStorage(payload) {
        assert.equal(payload.text.finalLayout?.fontFamily, "Avenir Next");
        assert.equal(payload.text.finalLayout?.fontWeight, 600);
        assert.equal(payload.text.finalLayout?.version, "wall-text-final-layout-v5");
        return {
          assignmentId: ASSIGNMENT_ID,
          creativeId: CREATIVE_ID,
          key: "videos/rendered/wall.mp4",
          ok: true,
          renderId: RENDER_ID,
          url: "https://cdn.example.com/wall.mp4",
        };
      },
    },
    store: successfulStore(),
  });
});

test("restores Avenir Next Demi Bold from the V4 rollout envelope", async () => {
  const job = createJob();
  const input = job.input_json as Record<string, unknown>;
  const text = input.text as Record<string, unknown>;
  text.layoutVersion = "wall-text-overlay-v9";
  text.finalLayout = {
    blocks: [{
      lines: [
        "I logged every meal but",
        "skipped drinks oil and small",
        "bites. Those missing details",
        "quietly changed the final",
        "total.",
      ],
      role: "text",
    }],
    fontFamily: "Arial",
    fontSizePx: 48,
    fontWeight: 400,
    lineHeightPx: 52.8,
    textBox: (input.layout as { textBox: unknown }).textBox,
    version: "wall-text-final-layout-v4",
  };

  await runRenderWallTextVideoJob(job, {
    dependencies: {
      async renderWallTextVideoToStorage(payload) {
        assert.equal(payload.text.finalLayout?.fontFamily, "Avenir Next");
        assert.equal(payload.text.finalLayout?.fontWeight, 600);
        assert.equal(payload.text.finalLayout?.version, "wall-text-final-layout-v5");
        return {
          assignmentId: ASSIGNMENT_ID,
          creativeId: CREATIVE_ID,
          key: "videos/rendered/wall.mp4",
          ok: true,
          renderId: RENDER_ID,
          url: "https://cdn.example.com/wall.mp4",
        };
      },
    },
    store: successfulStore(),
  });
});

test("restores Arial Regular 400 from the V3 rollout envelope", async () => {
  const job = createJob();
  const input = job.input_json as Record<string, unknown>;
  const text = input.text as Record<string, unknown>;
  text.layoutVersion = "wall-text-overlay-v8";
  text.finalLayout = {
    blocks: [{
      lines: [
        "I logged every meal but",
        "skipped drinks oil and small",
        "bites. Those missing details",
        "quietly changed the final",
        "total.",
      ],
      role: "text",
    }],
    fontFamily: "Arial",
    fontSizePx: 48,
    fontWeight: 500,
    lineHeightPx: 52.8,
    textBox: (input.layout as { textBox: unknown }).textBox,
    version: "wall-text-final-layout-v3",
  };

  await runRenderWallTextVideoJob(job, {
    dependencies: {
      async renderWallTextVideoToStorage(payload) {
        assert.equal(payload.text.finalLayout?.fontFamily, "Arial");
        assert.equal(payload.text.finalLayout?.fontWeight, 400);
        assert.equal(payload.text.finalLayout?.version, "wall-text-final-layout-v4");
        return {
          assignmentId: ASSIGNMENT_ID,
          creativeId: CREATIVE_ID,
          key: "videos/rendered/wall.mp4",
          ok: true,
          renderId: RENDER_ID,
          url: "https://cdn.example.com/wall.mp4",
        };
      },
    },
    store: successfulStore(),
  });
});

test("keeps a successful Wall MP4 when final scheduling delivery fails", async () => {
  const events: string[] = [];
  const store = {
    async hasPendingWallTextSchedules() {
      return true;
    },
    async markWallTextRenderStarted() {
      events.push("started");
    },
    async markWallTextRenderCompleted() {
      events.push("completed");
    },
    async markWallTextRenderFailed() {
      events.push("render-failed");
    },
    async markWallTextScheduleFinalizationFailed(params: {
      assignmentId: string;
      renderId: string;
    }) {
      events.push("finalization-failed");
      assert.equal(params.assignmentId, ASSIGNMENT_ID);
      assert.equal(params.renderId, RENDER_ID);
    },
  } as unknown as SupabaseJobStore;

  const output = await runRenderWallTextVideoJob(createJob(), {
    dependencies: {
      createMediaAssetId: () => MEDIA_ASSET_ID,
      async finalizeRenderedWallTextSchedules() {
        throw new Error("internal scheduler unavailable");
      },
      async renderWallTextVideoToStorage() {
        events.push("render");
        return {
          assignmentId: ASSIGNMENT_ID,
          creativeId: CREATIVE_ID,
          key: "videos/rendered/wall.mp4",
          ok: true,
          renderId: RENDER_ID,
          url: "https://cdn.example.com/wall.mp4",
        };
      },
    },
    store,
  });

  assert.deepEqual(events, [
    "started",
    "render",
    "completed",
    "finalization-failed",
  ]);
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

test("accepts trimmed locked audio for an Instagram Reel template", async () => {
  const job = createJob();
  const input = job.input_json as Record<string, unknown>;
  input.attribution = instagramAttribution();
  input.audio = {
    ...(input.audio as Record<string, unknown>),
    matchingVersion: "wall-instagram-reel-locked-v1",
  };
  const store = successfulStore();

  await runRenderWallTextVideoJob(job, {
    dependencies: {
      createMediaAssetId: () => MEDIA_ASSET_ID,
      async renderWallTextVideoToStorage(payload) {
        assert.equal(payload.audio.fitMode, "trim");
        assert.equal(payload.attribution.sourceKind, "instagram_reel");
        return {
          assignmentId: payload.assignmentId,
          creativeId: payload.creativeId,
          key: "videos/rendered/instagram-wall.mp4",
          ok: true,
          renderId: payload.renderId,
          url: "https://cdn.example.com/instagram-wall.mp4",
        };
      },
    },
    store,
  });
});

test("rejects looping audio for an Instagram Reel template", async () => {
  const job = createJob();
  const input = job.input_json as Record<string, unknown>;
  input.attribution = instagramAttribution();
  input.audio = {
    ...(input.audio as Record<string, unknown>),
    assetDurationSeconds: 4,
    fitMode: "loop",
    matchingVersion: "wall-instagram-reel-locked-v1",
  };

  await assert.rejects(
    runRenderWallTextVideoJob(job, { store: failedStore() }),
    /Instagram Reel Wall audio attribution is invalid/,
  );
});

function instagramAttribution() {
  return {
    contentHash: "a".repeat(64),
    editClassification: "none",
    formatId: "relatable_situation",
    formatLearningEligible: false,
    formatVersion: 1,
    instagramReelTemplateId: "00000000-0000-4000-8000-000000000308",
    selectionMode: "instagram_template",
    selectionWeight: 1,
    selectorVersion: "wall-text-format-selector-v1-bounded-views",
    sourceKind: "instagram_reel",
  };
}

function successfulStore() {
  return {
    async hasPendingWallTextSchedules() {
      return false;
    },
    async markWallTextRenderStarted() {},
    async markWallTextRenderCompleted() {},
    async markWallTextRenderFailed() {},
  } as unknown as SupabaseJobStore;
}

function failedStore() {
  return {
    async hasPendingWallTextSchedules() {
      return false;
    },
    async markWallTextRenderStarted() {},
    async markWallTextRenderCompleted() {},
    async markWallTextRenderFailed() {},
  } as unknown as SupabaseJobStore;
}

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
