import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260802213000_finalize_edit_render_atomically.sql",
    import.meta.url,
  ),
  "utf8",
);
const appStore = readFileSync(
  new URL("./render-storage.ts", import.meta.url),
  "utf8",
);
const workerStore = readFileSync(
  new URL("../../worker/src/lib/supabase.ts", import.meta.url),
  "utf8",
);

test("finalizes the render job and editable asset in one locked transaction", () => {
  assert.match(
    migration,
    /create or replace function public\.finalize_edit_render/,
  );
  assert.match(
    migration,
    /from public\.video_render_jobs as render_job[\s\S]*for update/,
  );
  assert.match(
    migration,
    /update public\.video_render_jobs as render_job[\s\S]*update public\.editable_videos as editable/,
  );
  assert.match(
    migration,
    /v_render_job\.status not in \('queued', 'rendering', p_terminal_status\)/,
  );
});

test("same-terminal retries repair dependent state and remain service-only", () => {
  assert.match(
    migration,
    /A retry of the same terminal transition repairs all dependent rows/,
  );
  assert.match(
    migration,
    /revoke all on function public\.finalize_edit_render[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.finalize_edit_render[\s\S]*to service_role/,
  );
});

test("both app and worker stores use the atomic terminal transition", () => {
  assert.match(appStore, /\.rpc\(\s*"finalize_edit_render"/);
  assert.match(workerStore, /\.rpc\("finalize_edit_render"/);
  assert.doesNotMatch(
    workerStore,
    /markDemoRenderCompletedIfPresent|markDemoRenderFailedIfPresent/,
  );
});
