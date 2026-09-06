import assert from "node:assert/strict";
import test from "node:test";

import { validateReactionBriefBatch } from "../lib/reaction-generation.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow } from "../types.js";
import {
  ReactionGenerationTerminalError,
  runGenerateReactionJob,
} from "./generate-reaction.js";

const palette = {
  availableReactionPalette: [
    { freshClipCount: 1, intent: "shock", reusableClipCount: 0 },
  ],
  generationRule: "test",
  recentlyShownIntents: [],
} as never;

test("Reaction brief validation preserves the canonical semantic beats", () => {
  const batch = {
    briefs: [{
      content: {
        caption: "When the task finally makes sense",
        emotion: "surprise",
        languageFormat: "when",
        lines: ["When the task", "finally makes sense"],
        semantic: {
          expectation: "The task stays confusing",
          reality: "It finally makes sense",
          structure: "expectation_reality",
        },
        visualContextTags: ["office"],
        visualTreatment: "outlined_text",
      },
      preferredReactions: ["shock"],
      slotIndex: 0,
    }],
  };

  const [brief] = validateReactionBriefBatch(batch, palette, 1);
  assert.deepEqual(brief?.content.semantic, batch.briefs[0]?.content.semantic);

  assert.throws(
    () => validateReactionBriefBatch({
      briefs: [{
        ...batch.briefs[0],
        content: {
          ...batch.briefs[0]!.content,
          caption: "Our app instantly makes every task easy",
          lines: ["Our app instantly", "makes every task easy"],
          semantic: { payoff: "Easy", setup: "Tasks", structure: "expectation_reality" },
        },
      }],
    }, palette, 1),
    /deterministic copy validation/u,
  );
});

test("a zero-ready Reaction render fails the durable background job", async () => {
  let completedRun = false;
  let failedItem = false;
  const store = {
    async ensureReactionGenerationRun() {
      return { brief_payload: {}, id: "run-1" };
    },
    async listActiveReactionCatalog() {
      return {
        backgrounds: [{
          context_tags: ["office"], foreground_placement: "bottom_center", id: "background-1",
          source_storage_key: "reaction/backgrounds/background-1.jpg", status: "active",
        }],
        clips: [{
          composition: "bust", duration_seconds: 6, foreground_anchor: "bottom_center",
          foreground_height_percent: 0.5, has_alpha: true, id: "clip-1", reactions: ["shock"],
          source_storage_key: "reaction/clips/clip-1.mov", status: "active", subject_count: "one",
        }],
      };
    },
    async getReactionClipPresentationHistory() { return new Map(); },
    async getReservedReactionClipIds() { return new Set(); },
    async persistReactionGenerationPlan() {
      return [{
        background_asset_id: "background-1",
        caption: "When the task finally makes sense",
        clip_asset_id: "clip-1",
        content_json: { caption: "When the task finally makes sense" },
        duration_seconds: 6,
        id: "item-1",
        reaction_creative_id: "creative-1",
        render_plan_json: {
          foreground: { anchor: "bottom_center", heightPercent: 0.5 },
          text: { lines: ["When the task", "finally makes sense"], treatment: "outlined_text" },
        },
        render_status: "queued",
        slot_index: 0,
        title: "Reaction Reel · shock",
      }];
    },
    async failReactionGenerationItemRender() { failedItem = true; },
    async completeReactionGenerationRun() {
      completedRun = true;
      return { failed_count: 1, ready_count: 0, status: "failed" } as const;
    },
  } as unknown as SupabaseJobStore;

  await assert.rejects(
    () => runGenerateReactionJob(createJob(), {
      checkpoint: async () => undefined,
      dependencies: {
        renderReactionVideoToStorage: async () => {
          throw new Error("ffmpeg unavailable");
        },
      },
      store,
    }),
    (error: unknown) => error instanceof ReactionGenerationTerminalError,
  );

  assert.equal(failedItem, true);
  assert.equal(completedRun, true);
});

function createJob(): BackgroundJobRow {
  const now = new Date().toISOString();
  return {
    attempt_count: 2,
    cancel_requested_at: null,
    claim_token: null,
    completed_at: null,
    created_at: now,
    error_code: null,
    error_message: null,
    failed_at: null,
    id: "713ae0a7-35a6-4964-91a5-41c9641ed512",
    input_json: {
      businessProfileId: "e7b1bbbd-2494-4f72-9b75-21eac1fdc70b",
      businessProfileVersion: 1,
      generationContext: { audience: [], commonSituations: [], desiredOutcomes: [], pains: [] },
      projectId: "project-1",
      requestKey: "reaction-v1:feed-1:profile-1:active-0:need-1",
      requestedCount: 1,
      userId: "user-1",
    },
    input_reference: null,
    job_type: "reaction_generation",
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
    queue_name: "ugc-ai-generation",
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
