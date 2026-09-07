import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  workspace,
  renderRoute,
  renderStorage,
  renderEngine,
  renderWorker,
  schedulingWorkspace,
] =
  await Promise.all([
    readFile(
      new URL(
        "../../components/create-content/create-content-workspace.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../../app/api/create-content/renders/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("./render-storage.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../worker/src/lib/render-engine.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../worker/src/jobs/render-create-content-video.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../components/scheduling/scheduling-workspace.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

test("Create Content schedules a rendered asset rather than the unedited source", () => {
  assert.match(workspace, /fetch\("\/api\/create-content\/renders"/);
  assert.match(workspace, /`\/scheduling\?assetId=\$\{encodeURIComponent\(activeRender\.mediaAssetId\)\}`/);
  assert.match(renderRoute, /jobType: RENDER_JOB_TYPE/);
  assert.match(renderRoute, /render_create_content_video/);
  assert.match(renderWorker, /markCreateContentRenderCompleted/);
});

test("Create Content retains the selected video's original audio", () => {
  assert.match(renderEngine, /function buildCreateContentWallTextVideoArgs/);
  assert.match(renderEngine, /"0:a\?"/);
  assert.match(renderEngine, /No app-selected or fixed[\s\S]+soundtrack/);
});

test("Create Content enters the existing scheduler as one video, never an automatic hook combination", () => {
  assert.match(schedulingWorkspace, /initialClipSelection: "secondary_only"/);
  assert.match(schedulingWorkspace, /initialDemoMediaId: assetId/);
});

test("Create Content retries a failed render snapshot with a new background job", () => {
  assert.match(
    renderStorage,
    /export async function createOrRetryQueuedCreateContentRender/,
  );
  assert.match(renderStorage, /\.eq\("status", "failed"\)/);
  assert.match(renderStorage, /render_job_id: null/);
  assert.match(renderStorage, /status: "queued"/);
  assert.match(
    renderRoute,
    /createOrRetryQueuedCreateContentRender/,
  );
  assert.match(
    renderRoute,
    /create-content-render:\$\{queued\.render\.id\}:\$\{crypto\.randomUUID\(\)\}/,
  );
  assert.match(workspace, /Select Schedule to try again\./);
});
