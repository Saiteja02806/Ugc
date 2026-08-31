import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const avatarsWorkspace = readProjectFile(
  "components/avatars/avatars-workspace.tsx",
);
const draftRoute = readProjectFile(
  "app/api/trending/hook-videos/drafts/route.ts",
);
const hookLibrary = readProjectFile(
  "components/library/hook-video-library-tab.tsx",
);
const mediaRoute = readProjectFile("app/api/media/route.ts");
const mediaGroupStorage = readProjectFile("lib/media/creative-asset-groups.ts");
const mediaLibraryVisibility = readProjectFile(
  "lib/media/media-library-visibility.ts",
);
const scheduleRoute = readProjectFile(
  "app/api/trending/hook-videos/drafts/schedule/route.ts",
);
const schedulingService = readProjectFile("lib/scheduling/service.ts");
const scheduleDrawer = readProjectFile(
  "components/trending/hook-video-schedule-drawer.tsx",
);
const trendingWorkspace = readProjectFile(
  "components/trending/trending-workspace.tsx",
);
const hookComposer = readProjectFile(
  "components/trending/hook-video-composer.tsx",
);
const savedRender = readProjectFile(
  "lib/trending/hook-video-library-render.ts",
);
const workerJob = readProjectFile(
  "worker/src/jobs/render-schedule-combination.ts",
);
const migration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260822130444_add_saved_hook_video_rendering.sql",
);

test("raw company Hook clips are excluded from the frontend media library", () => {
  const sourceTypes = avatarsWorkspace.slice(
    avatarsWorkspace.indexOf("const hookVideoSourceTypes"),
    avatarsWorkspace.indexOf("const creativeAssetVideoCollections"),
  );

  assert.doesNotMatch(sourceTypes, /catalog_influencer/);
  assert.match(mediaRoute, /isMediaAssetVisibleInCreativeLibrary/);
  assert.match(mediaGroupStorage, /isMediaAssetVisibleInCreativeLibrary/);
  assert.match(mediaLibraryVisibility, /asset\.sourceType === "catalog_influencer"/);
  assert.match(mediaLibraryVisibility, /libraryVisibility !== "hook_videos_only"/);
});

test("only explicit Save queues the finished Hook library render", () => {
  assert.match(draftRoute, /librarySaved: true/);
  assert.match(draftRoute, /queueSavedHookVideoRender/);
  assert.match(scheduleRoute, /librarySaved: false/);
});

test("Saved Hook cards use the finished render and never request the raw preview", () => {
  assert.match(hookLibrary, /item\.renderedVideoUrl/);
  assert.match(hookLibrary, /Preparing finished video/);
  assert.doesNotMatch(hookLibrary, /preview-session/);
});

test("Hook render claims are owner-scoped and require an explicit library save", () => {
  assert.match(
    migration,
    /draft\.id = p_draft_id[\s\S]*draft\.user_id = p_user_id[\s\S]*draft\.library_saved_at is not null/,
  );
  assert.match(
    migration,
    /grant execute on function public\.claim_hook_video_library_render\(uuid, text, text\)[\s\S]*to service_role/,
  );
});

test("new saved and scheduled Hook renders carry the authoritative layout version", () => {
  assert.match(
    scheduleRoute,
    /hookTextLayoutVersion: composition\.hookRenderSpec\.version/,
  );
  assert.match(
    savedRender,
    /hookTextLayoutVersion: composition\.hookRenderSpec\.version/,
  );
  assert.match(workerJob, /The authoritative Hook text layout is incomplete/);
  assert.match(workerJob, /hookTextLines must match hookText exactly/);
});

test("untouched Hook schedule times resolve at confirmation and always confirm the saved schedule", () => {
  assert.match(scheduleDrawer, /useDefaultScheduleTime/);
  assert.match(scheduleDrawer, /setHasManualScheduleTime\(true\)/);
  assert.match(
    scheduleDrawer,
    /Leave these unchanged to schedule[\s\S]*after you confirm/,
  );
  assert.match(scheduleRoute, /parsed\.data\.useDefaultScheduleTime/);
  assert.match(scheduleRoute, /getDefaultHookVideoScheduleTime/);
  assert.match(scheduleRoute, /error instanceof ScheduleTimeError/);
  assert.match(hookComposer, /Your video has been scheduled\./);
  assert.match(hookComposer, /Scheduled · View Scheduling/);
  assert.match(hookComposer, /className=\{scheduledButtonClass\}/);
  assert.match(
    hookComposer,
    /setScheduledPostId\(data\.scheduleId\);[\s\S]*setScheduleDrawerOpen\(false\);[\s\S]*fetch\([\s\S]*\/render/,
  );
});

test("Wall-of-text scheduling opens while preparation runs and resolves post right away at final confirmation", () => {
  assert.match(scheduleDrawer, /const useDefaultScheduleTime = !hasManualScheduleTime;/);
  assert.match(
    trendingWorkspace,
    /useDefaultScheduleTime: params\.selection\.useDefaultScheduleTime/,
  );
  assert.match(trendingWorkspace, /\? "post-right-away"/);
  assert.match(
    schedulingService,
    /input\.useDefaultScheduleTime === true[\s\S]*getDefaultScheduleTime\(timezone\)/,
  );
  assert.match(schedulingService, /function getDefaultScheduleTime\(timezone: string\)/);
  assert.match(schedulingService, /getEarliestScheduleTimestamp\(/);

  const wallSchedulePreparation = getSection(
    trendingWorkspace,
    "async function handleScheduleWallText",
    "async function confirmWallTextSchedule",
  );
  const wallScheduleConfirmation = getSection(
    trendingWorkspace,
    "async function confirmWallTextSchedule",
    "const wallTextActionCandidate",
  );

  assert.match(
    wallSchedulePreparation,
    /const savedDraft = await saveWallTextDraft\(wallTextCandidate\.item\);[\s\S]*setPendingWallTextDraft\(savedDraft\);[\s\S]*setPendingWallTextScheduleCandidate\(wallTextCandidate\);/,
  );
  assert.doesNotMatch(wallSchedulePreparation, /waitForWallTextRender/);
  assert.doesNotMatch(wallScheduleConfirmation, /waitForWallTextRender/);
  assert.match(trendingWorkspace, /preparation=\{wallTextPreparation\}/);
  assert.match(
    scheduleDrawer,
    /Preparing this Wall-of-text Reel\.[\s\S]*confirmation unlocks as soon as the video is[\s\S]*ready\./,
  );
  assert.match(scheduleDrawer, /\(stage === "review" && !canConfirmPreparation\)/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

function getSection(source: string, startMarker: string, endMarker: string) {
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);

  assert.notEqual(startIndex, -1, `Missing ${startMarker}`);
  assert.notEqual(endIndex, -1, `Missing ${endMarker}`);

  return source.slice(startIndex, endIndex);
}
