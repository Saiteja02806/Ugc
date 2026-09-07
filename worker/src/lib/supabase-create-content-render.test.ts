import assert from "node:assert/strict";
import test from "node:test";

import type { RenderCreateContentVideoPayload } from "./render-engine.js";
import { SupabaseJobStore } from "./supabase.js";

const EXISTING_MEDIA_ASSET_ID = "00000000-0000-4000-8000-000000000421";
const PROPOSED_MEDIA_ASSET_ID = "00000000-0000-4000-8000-000000000422";

test("completion reuses the existing media asset ID instead of overwriting its primary key", async () => {
  const mediaAssetUpdates: Array<Record<string, unknown>> = [];
  const renderUpdates: Array<Record<string, unknown>> = [];
  const renderFilters: Array<[string, unknown]> = [];
  const mediaBuilder = createBuilder({
    maybeSingle: async () => ({
      data: { id: EXISTING_MEDIA_ASSET_ID },
      error: null,
    }),
    onUpdate(value) {
      mediaAssetUpdates.push(value);
    },
  });
  const renderBuilder = createBuilder({
    maybeSingle: async () => ({ data: { id: "render-1" }, error: null }),
    onEq(column, value) {
      renderFilters.push([column, value]);
    },
    onUpdate(value) {
      renderUpdates.push(value);
    },
  });
  const client = {
    from(table: string) {
      return table === "media_assets" ? mediaBuilder : renderBuilder;
    },
  };
  const store = new SupabaseJobStore(client as never);

  const mediaAssetId = await store.markCreateContentRenderCompleted({
    cardRevision: 2,
    jobId: "job-current",
    key: "videos/rendered/create-content.mp4",
    mediaAssetId: PROPOSED_MEDIA_ASSET_ID,
    payload: createPayload(),
    url: "https://cdn.example.com/create-content.mp4",
  });

  assert.equal(mediaAssetId, EXISTING_MEDIA_ASSET_ID);
  assert.equal(mediaAssetUpdates.length, 1);
  assert.equal(mediaAssetUpdates[0]?.id, undefined);
  assert.equal(mediaAssetUpdates[0]?.source_record_id, "render-1:attempt:1");
  assert.equal(mediaAssetUpdates[0]?.storage_key, "videos/rendered/create-content.mp4");
  assert.equal(
    (mediaAssetUpdates[0]?.metadata as Record<string, unknown>)
      ?.createContentRenderAttempt,
    1,
  );
  assert.deepEqual(renderUpdates, [
    {
      error_message: null,
      rendered_media_asset_id: EXISTING_MEDIA_ASSET_ID,
      status: "ready",
      updated_at: renderUpdates[0]?.updated_at,
    },
  ]);
  assert.ok(renderFilters.some(([column, value]) => column === "render_job_id" && value === "job-current"));
});

test("failure reconciliation is constrained to the background job that owns the render", async () => {
  const filters: Array<[string, unknown]> = [];
  const builder = createBuilder({
    onEq(column, value) {
      filters.push([column, value]);
    },
  });
  const client = { from: () => builder };
  const store = new SupabaseJobStore(client as never);

  await store.markCreateContentRenderFailed({
    errorMessage: "FFmpeg rejected the source.",
    jobId: "job-current",
    renderId: "render-1",
    userId: "user-1",
  });

  assert.ok(filters.some(([column, value]) => column === "render_job_id" && value === "job-current"));
});

function createPayload() {
  return {
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
  } as RenderCreateContentVideoPayload;
}

function createBuilder(params: {
  maybeSingle?: () => Promise<{ data: unknown; error: null }>;
  onEq?: (column: string, value: unknown) => void;
  onUpdate?: (value: Record<string, unknown>) => void;
}) {
  const builder = {
    eq(column: string, value: unknown) {
      params.onEq?.(column, value);
      return builder;
    },
    in() {
      return builder;
    },
    is() {
      return builder;
    },
    maybeSingle: params.maybeSingle ?? (async () => ({ data: null, error: null })),
    select() {
      return builder;
    },
    update(value: Record<string, unknown>) {
      params.onUpdate?.(value);
      return builder;
    },
  };

  return builder;
}
