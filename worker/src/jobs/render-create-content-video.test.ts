import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseJobStore } from "../lib/supabase.js";
import { RetryableJobError } from "../retryable-job-error.js";
import type { BackgroundJobRow } from "../types.js";
import {
  reconcileCreateContentRenderJobFailure,
  runRenderCreateContentVideoJob,
} from "./render-create-content-video.js";

const DURABLE_MEDIA_ASSET_ID = "00000000-0000-4000-8000-000000000411";
const PROPOSED_MEDIA_ASSET_ID = "00000000-0000-4000-8000-000000000412";

test("uses the durable media asset identity when completion repairs a prior attempt", async () => {
  const completions: Array<Record<string, unknown>> = [];
  const store = {
    async markCreateContentRenderCompleted(params: Record<string, unknown>) {
      completions.push(params);
      return DURABLE_MEDIA_ASSET_ID;
    },
    async markCreateContentRenderStarted() {
      return { status: "rendering" as const };
    },
  } as unknown as SupabaseJobStore;

  const output = await runRenderCreateContentVideoJob(createJob(), {
    dependencies: {
      createMediaAssetId: () => PROPOSED_MEDIA_ASSET_ID,
      async renderCreateContentVideoToStorage() {
        return {
          key: "videos/rendered/create-content.mp4",
          ok: true,
          renderId: "render-1",
          sourceVideoId: "source-1",
          url: "https://cdn.example.com/create-content.mp4",
        };
      },
    },
    store,
  });

  assert.equal(completions.length, 1);
  assert.equal(completions[0]?.mediaAssetId, PROPOSED_MEDIA_ASSET_ID);
  assert.deepEqual(output, {
    mediaAssetId: DURABLE_MEDIA_ASSET_ID,
    renderId: "render-1",
    sourceVideoId: "source-1",
    url: "https://cdn.example.com/create-content.mp4",
  });
});

test("does not render again when the same worker job already persisted the output", async () => {
  const store = {
    async markCreateContentRenderStarted() {
      return {
        mediaAssetId: DURABLE_MEDIA_ASSET_ID,
        status: "ready" as const,
      };
    },
  } as unknown as SupabaseJobStore;

  const output = await runRenderCreateContentVideoJob(createJob(), {
    dependencies: {
      async renderCreateContentVideoToStorage() {
        throw new Error("A ready Create Content render must not render again.");
      },
    },
    store,
  });

  assert.deepEqual(output, {
    mediaAssetId: DURABLE_MEDIA_ASSET_ID,
    renderId: "render-1",
    sourceVideoId: "source-1",
  });
});

test("leaves a retryable render attempt non-terminal until the processor decides it failed", async () => {
  let failureCount = 0;
  const store = {
    async markCreateContentRenderFailed() {
      failureCount += 1;
    },
    async markCreateContentRenderStarted() {
      return { status: "rendering" as const };
    },
  } as unknown as SupabaseJobStore;

  await assert.rejects(
    () =>
      runRenderCreateContentVideoJob(createJob(), {
        dependencies: {
          async renderCreateContentVideoToStorage() {
            throw new RetryableJobError("Storage request timed out.", {
              code: "storage_timeout",
              retryAfterSeconds: 30,
            });
          },
        },
        store,
      }),
    /Storage request timed out/,
  );

  assert.equal(failureCount, 0);
});

test("reconciles a terminal Create Content failure against the exact background job", async () => {
  const failures: Array<Record<string, string>> = [];
  const store = {
    async markCreateContentRenderFailed(params: Record<string, string>) {
      failures.push(params);
    },
  } as unknown as SupabaseJobStore;
  const job = createJob();

  // The complete payload can be invalid by the time it reaches terminal
  // reconciliation. The stable render and user identity is enough to repair
  // the durable status.
  (job.input_json as Record<string, unknown>).overlay = null;

  await reconcileCreateContentRenderJobFailure(
    job,
    store,
    "FFmpeg rejected the input video.",
  );

  assert.deepEqual(failures, [
    {
      errorMessage: "FFmpeg rejected the input video.",
      jobId: "job-1",
      renderId: "render-1",
      userId: "user-1",
    },
  ]);
});

function createJob() {
  return {
    id: "job-1",
    input_json: {
      cardRevision: 1,
      overlay: {
        format: "hook_text",
        hook: {
          fontSize: 52,
          layoutVersion: "hook-overlay-layout-v2-fixed",
          lines: ["A concise first line"],
        },
        position: { x: 0.5, y: 0.5 },
        text: "A concise first line",
      },
      projectId: "project-1",
      renderAttempt: 1,
      renderId: "render-1",
      sourceVideoId: "source-1",
      sourceVideoUrl: "https://cdn.example.com/source.mp4",
      title: "Create Content",
      userId: "user-1",
    },
    job_type: "render_create_content_video",
  } as unknown as BackgroundJobRow;
}
