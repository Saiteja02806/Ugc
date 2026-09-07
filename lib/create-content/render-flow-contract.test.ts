import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  workspace,
  renderRoute,
  renderEngine,
  renderWorker,
  schedulingWorkspace,
  renderStorage,
  renderSlotMigration,
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
    readFile(
      new URL("./render-storage.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../supabase/migrations/20260907170000_add_create_content_video_renders.sql",
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
test("Create Content renders claim the bounded video-render lease before launch", () => {
  assert.match(
    renderSlotMigration,
    /claim_video_render_execution_slot[\s\S]*job\.job_type in \([\s\S]*'render_create_content_video'/,
  );
});

test("a failed Create Content render gets one new durable attempt while duplicate clicks reuse it", () => {
  assert.match(
    renderStorage,
    /attempt:\s*existing\.attempt \+ 1,[\s\S]*?\.eq\("status", "failed"\)/,
  );
  assert.match(
    renderStorage,
    /\.eq\("attempt", params\.attempt\)[\s\S]*?\.is\("render_job_id", null\)/,
  );
  assert.match(
    renderRoute,
    /create-content-render:\$\{queued\.render\.id\}:attempt:\$\{queued\.render\.attempt\}/,
  );
  assert.match(renderRoute, /claimBackgroundJobDelivery\(creation\.job\)/);
  assert.match(renderRoute, /sendBackgroundJobMessageWithBestEffortAttachment/);
  assert.match(renderSlotMigration, /attempt integer not null default 1 check \(attempt > 0\)/);
  assert.match(
    renderWorker,
    /renderAttempt: getPositiveInteger\(input\.renderAttempt, "renderAttempt"\)/,
  );
  assert.match(
    renderEngine,
    /\$\{cleanPathPart\(getCreateContentRenderArtifactId\(payload\)\)\}\.mp4/,
  );
});

test("render enqueue validates saved text against the final renderer before it creates work", () => {
  assert.match(renderRoute, /normalizeAndValidateCreateContentText/);
  assert.match(
    renderRoute,
    /normalizeAndValidateCreateContentText\([\s\S]*?createOrGetQueuedCreateContentRender/,
  );
});

test("an unlinked terminal job is reconciled to a retryable render state", () => {
  assert.match(renderRoute, /isTerminalBackgroundJobStatus\(creation\.job\.status\)/);
  assert.match(
    renderRoute,
    /failCreateContentRender\([\s\S]*?Video preparation stopped before it could start/,
  );
  assert.match(
    renderRoute,
    /failCreateContentRender\([\s\S]*?allowUnattachedJob: true[\s\S]*?attempt: queued\.render\.attempt/,
  );
});
