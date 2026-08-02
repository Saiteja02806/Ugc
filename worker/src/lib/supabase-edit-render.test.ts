import assert from "node:assert/strict";
import test from "node:test";

import { SupabaseJobStore } from "./supabase.js";

test("starting an Edit render is idempotent for a worker retry", async () => {
  const filters: Array<{ column: string; values: unknown[] }> = [];
  const builder = {
    eq() {
      return builder;
    },
    in(column: string, values: unknown[]) {
      filters.push({ column, values });
      return builder;
    },
    maybeSingle: async () => ({
      data: { render_id: "render-1" },
      error: null,
    }),
    select() {
      return builder;
    },
    update() {
      return builder;
    },
  };
  const client = {
    from() {
      return builder;
    },
  };
  const store = new SupabaseJobStore(client as never);

  await store.markEditRenderRendering("render-1");

  assert.deepEqual(filters, [
    {
      column: "status",
      values: ["queued", "rendering"],
    },
  ]);
});

test("starting a completed Edit render returns its durable output", async () => {
  let readCount = 0;
  const builder = {
    eq() {
      return builder;
    },
    in() {
      return builder;
    },
    async maybeSingle() {
      readCount += 1;
      return readCount === 1
        ? { data: null, error: null }
        : {
            data: {
              output_s3_key: "videos/rendered/user-1/project-1/render-1.mp4",
              output_url: "https://media.example/render-1.mp4",
              status: "completed",
            },
            error: null,
          };
    },
    select() {
      return builder;
    },
    update() {
      return builder;
    },
  };
  const client = {
    from() {
      return builder;
    },
  };
  const store = new SupabaseJobStore(client as never);

  const state = await store.markEditRenderRendering("render-1");

  assert.deepEqual(state, {
    key: "videos/rendered/user-1/project-1/render-1.mp4",
    status: "completed",
    url: "https://media.example/render-1.mp4",
  });
});

test("completes an Edit render through the atomic terminal RPC", async () => {
  const calls: Array<{ args: unknown; name: string }> = [];
  const client = {
    async rpc(name: string, args: unknown) {
      calls.push({ args, name });
      return { data: true, error: null };
    },
  };
  const store = new SupabaseJobStore(client as never);

  const completed = await store.markEditRenderCompleted({
    key: "videos/rendered/user-1/project-1/render-1.mp4",
    projectId: "project-1",
    renderId: "render-1",
    sourceVideoId: "asset-1",
    url: "https://media.example/render-1.mp4",
    userId: "user-1",
  });

  assert.equal(completed, true);
  assert.deepEqual(calls, [
    {
      args: {
        p_error_message: null,
        p_output_s3_key: "videos/rendered/user-1/project-1/render-1.mp4",
        p_output_url: "https://media.example/render-1.mp4",
        p_project_id: "project-1",
        p_render_id: "render-1",
        p_source_video_id: "asset-1",
        p_terminal_status: "completed",
        p_user_id: "user-1",
      },
      name: "finalize_edit_render",
    },
  ]);
});

test("fails an Edit render through the same atomic terminal RPC", async () => {
  const calls: Array<{ args: unknown; name: string }> = [];
  const client = {
    async rpc(name: string, args: unknown) {
      calls.push({ args, name });
      return { data: true, error: null };
    },
  };
  const store = new SupabaseJobStore(client as never);

  const failed = await store.markEditRenderFailed({
    errorMessage: "FFmpeg failed",
    projectId: "project-1",
    renderId: "render-1",
    sourceVideoId: "asset-1",
    userId: "user-1",
  });

  assert.equal(failed, true);
  assert.deepEqual(calls, [
    {
      args: {
        p_error_message: "FFmpeg failed",
        p_output_s3_key: null,
        p_output_url: null,
        p_project_id: "project-1",
        p_render_id: "render-1",
        p_source_video_id: "asset-1",
        p_terminal_status: "failed",
        p_user_id: "user-1",
      },
      name: "finalize_edit_render",
    },
  ]);
});
