import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readProjectFile(
  "supabase/migrations/20260831053441_add_wall_text_pending_schedules.sql",
);
const workspace = readProjectFile(
  "components/trending/trending-workspace.tsx",
);
const scheduleRoute = readProjectFile(
  "app/api/trending/wall-text/schedules/route.ts",
);
const retryRoute = readProjectFile(
  "app/api/schedules/[scheduleId]/wall-text-render/route.ts",
);
const renderRequest = readProjectFile(
  "lib/trending/wall-text-render-request.ts",
);
const worker = readProjectFile("worker/src/jobs/render-wall-text-video.ts");
const schedulingWorkspace = readProjectFile(
  "components/scheduling/scheduling-workspace.tsx",
);
const scheduleDetailRoute = readProjectFile("app/api/schedules/[scheduleId]/route.ts");
const renderStarter = readProjectFile("lib/scheduling/wall-text-render-start.ts");

test("permits a real MP4-free Wall pending source and nothing else", () => {
  assert.match(migration, /'wall_text_pending'/);
  assert.match(
    migration,
    /source_kind = 'wall_text_pending'[\s\S]+media_asset_id is null[\s\S]+library_item_id is null/,
  );
  assert.match(migration, /metadata \? 'wallTextAssignmentId'/);
  assert.match(migration, /scheduled_posts_wall_text_render_lookup_idx/);
});

test("opens Wall scheduling without the old preparation gate", () => {
  const wallScheduleSection =
    workspace.match(
      /async function handleScheduleWallText\(\)[\s\S]+?\n  return \(/,
    )?.[0] ?? "";

  assert.doesNotMatch(wallScheduleSection, /saveWallTextDraft\(/);
  assert.doesNotMatch(wallScheduleSection, /not ready to schedule/);
  assert.match(workspace, /createPendingWallTextSchedule/);
  assert.doesNotMatch(workspace, /preparation=\{wallTextPreparation\}/);
  assert.match(
    workspace,
    /actionHref: `\/scheduling\?draft=\$\{encodeURIComponent\(schedule\.id\)\}`/,
  );
  assert.match(workspace, /actionLabel: "View Scheduling"/);
  assert.match(
    workspace,
    /message: "Scheduled\. Your Text Reel is being prepared\."/,
  );
  assert.match(
    workspace,
    /contentType: "wall_text"[\s\S]*returnTo: "accounts"/,
  );
  assert.doesNotMatch(workspace, /HookVideoScheduleDrawer/);
});

test("saves the pending schedule before server-side background render delivery", () => {
  const routeBody =
    scheduleRoute.match(/export async function POST[\s\S]+/)?.[0] ?? "";

  assert.match(routeBody, /await createUserSchedule/);
  assert.match(routeBody, /after\(\(\) =>[\s\S]*startWallTextScheduleRender/);
  assert.ok(
    routeBody.indexOf("after(() =>") > routeBody.indexOf("await createUserSchedule"),
  );
  assert.match(routeBody, /schedule: pending\.schedule/);
  assert.match(routeBody, /kind: "wall_text_pending"/);
  assert.match(routeBody, /caption: parsed\.data\.caption \?\? ""/);
  assert.match(routeBody, /plannedTargets: parsed\.data\.targets/);
  assert.match(routeBody, /useDefaultScheduleTime: parsed\.data\.useDefaultScheduleTime/);
  assert.match(routeBody, /wallTextRenderStatus: "not_requested"/);
  assert.match(workspace, /createWallTextScheduleRequest/);
  assert.match(workspace, /caption: params\.selection\.caption/);
  assert.doesNotMatch(workspace, /startPendingWallTextRender/);
  assert.match(
    renderStarter,
    /requestWallTextRender/,
  );
  assert.match(renderRequest, /createBackgroundJobWithCreationResult/);
});

test("accepts standard Wall assignment UUIDs and resumes only the saved hand-off state", () => {
  const sourcePattern = renderStarter.match(
    /const UUID_PATTERN\s*=\s*\/([^/]+)\/i;/,
  )?.[1];

  assert.ok(sourcePattern);
  const assignmentPattern = new RegExp(sourcePattern, "i");
  assert.equal(
    assignmentPattern.test("f1a17385-a6e0-41a1-b77c-ef60554033cd"),
    true,
  );
  assert.equal(assignmentPattern.test("not-a-wall-assignment"), false);
  assert.match(scheduleDetailRoute, /after\(\(\) =>[\s\S]*startWallTextScheduleRender/);
  assert.match(
    scheduleDetailRoute,
    /sourceKind === "wall_text_pending"[\s\S]*status === "draft"[\s\S]*wallTextRenderStatus === "not_requested"/,
  );
});

test("calculates Wall schedule identity from the server-confirmed time", () => {
  assert.doesNotMatch(workspace, /createPendingWallTextScheduleIdempotencyKey/);
  assert.doesNotMatch(scheduleRoute, /idempotencyKey:/);
  assert.match(
    readProjectFile("lib/scheduling/service.ts"),
    /createWallTextPendingScheduleIdempotencyKey[\s\S]+plannedScheduledFor/,
  );
});

test("finalizes rendered Wall MP4s automatically and preserves retry paths", () => {
  assert.match(worker, /finalizeRenderedWallTextSchedules/);
  assert.match(worker, /markWallTextScheduleFinalizationFailed/);
  assert.match(retryRoute, /startWallTextScheduleRender/);
  assert.match(schedulingWorkspace, /queueWallTextRender/);
  assert.match(schedulingWorkspace, /wallTextRenderStatus/);
  assert.match(schedulingWorkspace, /sourceKind === "wall_text_pending"/);
  assert.match(
    schedulingWorkspace,
    /isAwaitingWallRenderStart[\s\S]*renderStatus === "not_requested"/,
  );
});

test("shows a pending Wall video as preparation, not a missing Reel", () => {
  const selectedDayCard =
    schedulingWorkspace.match(
      /function SelectedDayDraftCard\([\s\S]+?type CalendarDay =/,
    )?.[0] ?? "";

  assert.match(selectedDayCard, /draft\.sourceType === "wall_text_render"/);
  assert.match(selectedDayCard, /\? "Wall video"/);
  assert.match(selectedDayCard, /\? "Preparation failed"[\s\S]*: "Preparing"/);
  assert.match(
    selectedDayCard,
    /\{primaryMediaLabel\}: \{primaryMediaValue\}/,
  );
  assert.doesNotMatch(
    selectedDayCard,
    /\{primaryMediaLabel\}: \{demoMedia\?\.title \?\? "Missing"\}/,
  );
  assert.match(
    schedulingWorkspace,
    /isWallTextSchedule && renderStatus === "not_requested"\)\s*\)\s*\{\s*return "rendering"/,
  );
  assert.doesNotMatch(
    schedulingWorkspace,
    /isWallTextSchedule && renderStatus === "not_requested"\)\s*\{\s*return "render_required"/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
