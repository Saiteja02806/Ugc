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
const scheduleRoute = readProjectFile(
  "app/api/trending/hook-videos/drafts/schedule/route.ts",
);
const savedRender = readProjectFile(
  "lib/trending/hook-video-library-render.ts",
);
const workerJob = readProjectFile(
  "worker/src/jobs/render-schedule-combination.ts",
);
const migration = readProjectFile(
  "supabase/migrations/20260822130444_add_saved_hook_video_rendering.sql",
);

test("raw company Hook clips are excluded from the frontend media library", () => {
  const sourceTypes = avatarsWorkspace.slice(
    avatarsWorkspace.indexOf("const hookVideoSourceTypes"),
    avatarsWorkspace.indexOf("const creativeAssetVideoCollections"),
  );

  assert.doesNotMatch(sourceTypes, /catalog_influencer/);
  assert.match(mediaRoute, /row\.source_type === "catalog_influencer"/);
  assert.match(mediaRoute, /libraryVisibility !== "hook_videos_only"/);
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
  assert.match(scheduleRoute, /hookTextLayoutVersion: HOOK_TEXT_LAYOUT_VERSION/);
  assert.match(savedRender, /hookTextLayoutVersion: HOOK_TEXT_LAYOUT_VERSION/);
  assert.match(workerJob, /The authoritative Hook text layout is incomplete/);
  assert.match(workerJob, /hookTextLines must match hookText exactly/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
