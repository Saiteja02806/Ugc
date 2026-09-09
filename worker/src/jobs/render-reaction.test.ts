import assert from "node:assert/strict";
import test from "node:test";

import { runRenderReactionJob } from "./render-reaction.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow } from "../types.js";

const generationJobId = "713ae0a7-35a6-4964-91a5-41c9641ed512";
const runId = "e7b1bbbd-2494-4f72-9b75-21eac1fdc70b";
const itemId = "9df128f9-839a-4b43-b3bb-2dc30d40fdd9";
const renderJobId = "2df128f9-839a-4b43-b3bb-2dc30d40fdd9";

test("renders and publishes one durable Reaction item without waiting for its siblings", async () => {
  const calls: string[] = [];
  const store = {
    async claimReactionGenerationItemRender() {
      return {
        background_asset_id: "background-1",
        caption: "When the task finally makes sense",
        clip_asset_id: "clip-1",
        content_json: { caption: "When the task finally makes sense" },
        duration_seconds: 6,
        id: itemId,
        preview_url: null,
        reaction_assignment_id: "assignment-1",
        reaction_creative_id: "creative-1",
        render_error: null,
        render_job_id: renderJobId,
        render_plan_json: {
          foreground: { anchor: "bottom_center", heightPercent: 0.5 },
          text: { lines: ["When the task", "finally makes sense"], treatment: "outlined_text" },
        },
        render_status: "rendering" as const,
        rendered_media_asset_id: null,
        slot_index: 0,
        title: "Reaction Reel · shock",
      };
    },
    async listActiveReactionCatalog() {
      return {
        backgrounds: [{
          context_tags: ["office"], foreground_placement: "bottom_center", id: "background-1",
          source_storage_key: "reaction/backgrounds/background-1.jpg", status: "active" as const,
        }],
        clips: [{
          composition: "bust", duration_seconds: 6, foreground_anchor: "bottom_center",
          foreground_height_percent: 0.5, has_alpha: true, id: "clip-1", reactions: ["shock"],
          source_storage_key: "reaction/clips/clip-1.mov", status: "active" as const, subject_count: "one",
        }],
      };
    },
    async saveReactionRenderedMedia() {
      calls.push("save");
      return renderJobId;
    },
    async completeReactionGenerationItemRenderV2() {
      calls.push("item-ready");
    },
    async completeReactionGenerationRun() {
      calls.push("run-progress");
      return { failed_count: 0, ready_count: 1, status: "rendering" as const };
    },
  } as unknown as SupabaseJobStore;

  const result = await runRenderReactionJob(createJob(), {
    checkpoint: async () => undefined,
    dependencies: {
      render: async () => ({
        byteLength: 42,
        key: "videos/rendered/reaction/item.mp4",
        ok: true,
        renderId: itemId,
        url: "https://example.com/item.mp4",
      }),
    },
    store,
  });

  assert.equal(result.status, "rendering");
  assert.deepEqual(calls, ["save", "item-ready", "run-progress"]);
});

function createJob(): BackgroundJobRow {
  const now = new Date().toISOString();
  return {
    attempt_count: 0,
    cancel_requested_at: null,
    claim_token: null,
    completed_at: null,
    created_at: now,
    error_code: null,
    error_message: null,
    failed_at: null,
    id: renderJobId,
    input_json: { generationJobId, generationRunId: runId, itemId, projectId: "project-1", userId: "user-1" },
    input_reference: null,
    job_type: "reaction_render",
    last_delivery_at: now,
    last_heartbeat_at: null,
    locked_at: null,
    max_attempts: 3,
    next_attempt_at: null,
    output_json: null,
    output_reference: null,
    progress: null,
    project_id: "project-1",
    queue_message_id: null,
    queue_name: "reaction-render",
    queue_provider: "gcp",
    queued_at: now,
    stage: "processing",
    started_at: now,
    status: "processing",
    updated_at: now,
    user_id: "user-1",
    worker_execution_id: null,
    worker_id: "worker-test",
  };
}
