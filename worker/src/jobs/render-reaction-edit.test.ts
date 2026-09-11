import assert from "node:assert/strict";
import test from "node:test";
import { buildReactionTextEditPayload, runRenderReactionEditJob } from "./render-reaction-edit.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow, ReactionCreativeRow } from "../types.js";

function creative(): ReactionCreativeRow {
  return {
    id: "creative", user_id: "owner", business_profile_id: "profile", business_profile_version: 1,
    background_asset_id: "original-background", clip_asset_id: "original-clip", caption: "Original caption",
    content_json: { caption: "Original caption", userTextEdit: { revision: 2, status: "queued", lines: ["Me realizing", "the deadline was yesterday"] } },
    render_plan_json: { foreground: { anchor: "bottom_right", heightPercent: 0.55 }, text: { treatment: "outlined_text", lines: ["Original caption"] } },
    duration_seconds: 6, generation_origin: "business_generation", render_status: "preview_ready", rendered_media_asset_id: "original-media",
    preview_url: "https://example.com/original.mp4", render_error: null, render_job_id: "render-job",
    thumbnail_url: null, title: "Reaction",
  };
}
const job = {
  id: "render-job", user_id: "owner", job_type: "final_render", attempt_count: 0, max_attempts: 3,
  input_json: { creativeId: "creative", userId: "owner", format: "reaction", revision: 2 },
} as unknown as BackgroundJobRow;
const rendered = { ok: true as const, renderId: job.id, byteLength: 1200, key: "reaction/render-job.mp4", url: "https://example.com/edited.mp4" };

function store(overrides: Partial<SupabaseJobStore> = {}): SupabaseJobStore {
  return {
    getReactionTextEditForJob: async () => creative(),
    listActiveReactionCatalog: async () => ({
      backgrounds: [{ id: "original-background", source_storage_key: "background-original" }],
      clips: [{ id: "original-clip", source_storage_key: "clip-original" }],
    }),
    saveReactionRenderedMedia: async () => "edited-media",
    completeReactionTextEdit: async () => undefined,
    failReactionTextEdit: async () => undefined,
    ...overrides,
  } as SupabaseJobStore;
}

test("renders new text with the existing sources, duration, placement and style", async () => {
  let completed = false;
  await runRenderReactionEditJob(job, {
    checkpoint: async () => undefined,
    store: store({
      saveReactionRenderedMedia: async (value) => {
        assert.equal(value.mediaAssetId, job.id);
        assert.equal(value.sourceRecordId, job.id);
        assert.notEqual(value.mediaAssetId, "original-media");
        return "edited-media";
      },
      completeReactionTextEdit: async (value) => {
        assert.equal(value.mediaAssetId, "edited-media");
        assert.equal(value.caption, "Me realizing the deadline was yesterday");
        assert.equal(value.jobId, job.id);
        assert.deepEqual(value.content, { caption: value.caption, lines: ["Me realizing", "the deadline was yesterday"], userTextEdit: { revision: 2, lines: ["Me realizing", "the deadline was yesterday"], status: "ready" } });
        completed = true;
      },
    }),
    dependencies: { render: async (payload) => {
      assert.deepEqual(payload, {
        backgroundStorageKey: "background-original", foregroundStorageKey: "clip-original",
        captionLines: ["Me realizing", "the deadline was yesterday"], creativeId: "creative",
        durationSeconds: 6, foreground: { anchor: "bottom_right", heightPercent: 0.55 },
        renderId: job.id, treatment: "outlined_text",
      });
      return rendered;
    } },
  });
  assert.equal(completed, true);
});

test("skips obsolete jobs and already completed revisions without rendering", async () => {
  const ready = creative();
  ready.content_json = { userTextEdit: { revision: 2, status: "ready" } };
  for (const value of [null, ready, { ...creative(), content_json: { userTextEdit: { revision: 3, status: "queued" } } }]) {
    await runRenderReactionEditJob(job, {
      checkpoint: async () => undefined,
      store: store({ getReactionTextEditForJob: async () => value }),
      dependencies: { render: async () => { assert.fail("Must not render obsolete or completed work"); } },
    });
  }
});

test("leaves transient failures retryable and records terminal render failure", async () => {
  for (const attempt of [0, 2]) {
    let failed = false;
    await assert.rejects(runRenderReactionEditJob({ ...job, attempt_count: attempt }, {
      checkpoint: async () => undefined,
      store: store({ failReactionTextEdit: async () => { failed = true; } }),
      dependencies: { render: async () => { throw new Error("render unavailable"); } },
    }), /render unavailable/);
    assert.equal(failed, attempt === 2);
  }
});

test("rejects missing catalog inputs and invalid placement instead of replacing the source", () => {
  assert.throws(() => buildReactionTextEditPayload({
    creative: creative(), renderId: job.id, backgroundStorageKey: null, foregroundStorageKey: "clip-original",
  }), /render sources are invalid/);
  const invalid = creative();
  invalid.render_plan_json = { foreground: { anchor: "bottom_right", heightPercent: Number.NaN }, text: { treatment: "outlined_text" } };
  assert.throws(() => buildReactionTextEditPayload({
    creative: invalid, renderId: job.id, backgroundStorageKey: "background-original", foregroundStorageKey: "clip-original",
  }), /render sources are invalid/);
});

test("rejects a render input whose owner differs from the durable job", async () => {
  await assert.rejects(runRenderReactionEditJob({ ...job, user_id: "different-owner" }, {
    checkpoint: async () => undefined,
    store: store(),
  }), /Invalid Reaction text render input/);
});
