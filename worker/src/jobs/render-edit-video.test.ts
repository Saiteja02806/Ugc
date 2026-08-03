import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow } from "../types.js";
import {
  reconcileRenderEditVideoJobFailure,
  runRenderEditVideoJob,
} from "./render-edit-video.js";

test("reconciles the persisted render when payload validation fails", async () => {
  const failures: Array<Record<string, string>> = [];
  const store = {
    markEditRenderFailed: async (failure: Record<string, string>) => {
      failures.push(failure);
      return true;
    },
  } as unknown as SupabaseJobStore;
  const job = createRenderJob(null);

  await assert.rejects(
    () => runRenderEditVideoJob(job, { store }),
    /draft must be an object/i,
  );
  assert.deepEqual(failures, [
    {
      errorMessage: "draft must be an object.",
      projectId: "project-1",
      renderId: "render-1",
      sourceVideoId: "asset-1",
      userId: "user-1",
    },
  ]);
});

test("terminal reconciliation is a no-op for unrelated worker jobs", async () => {
  let failureCount = 0;
  const store = {
    markEditRenderFailed: async () => {
      failureCount += 1;
      return true;
    },
  } as unknown as SupabaseJobStore;
  const job = {
    ...createRenderJob({}),
    job_type: "test_worker_job",
  } as BackgroundJobRow;

  await reconcileRenderEditVideoJobFailure(job, store, "Cancelled");
  assert.equal(failureCount, 0);
});

test("a retry reuses and repairs an already-completed persisted render", async () => {
  const completions: Array<Record<string, string>> = [];
  const store = {
    markEditRenderCompleted: async (completion: Record<string, string>) => {
      completions.push(completion);
      return true;
    },
    markEditRenderRendering: async () => ({
      key: "videos/rendered/user-1/project-1/render-1.mp4",
      status: "completed" as const,
      url: "https://media.example/render-1.mp4",
    }),
  } as unknown as SupabaseJobStore;

  const output = await runRenderEditVideoJob(createRenderJob({}), { store });

  assert.deepEqual(output, {
    key: "videos/rendered/user-1/project-1/render-1.mp4",
    url: "https://media.example/render-1.mp4",
  });
  assert.deepEqual(completions, [
    {
      key: "videos/rendered/user-1/project-1/render-1.mp4",
      projectId: "project-1",
      renderId: "render-1",
      sourceVideoId: "asset-1",
      url: "https://media.example/render-1.mp4",
      userId: "user-1",
    },
  ]);
});

function createRenderJob(draft: unknown) {
  return {
    id: "background-1",
    input_json: {
      draft,
      projectId: "project-1",
      ratio: "9:16",
      renderId: "render-1",
      sourceVideoId: "asset-1",
      sourceVideoUrl: "https://media.example/source.mp4",
      userId: "user-1",
    },
    job_type: "render_edit_video",
  } as unknown as BackgroundJobRow;
}
