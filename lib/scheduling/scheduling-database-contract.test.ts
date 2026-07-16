import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const recoveryMigration = readProjectFile(
  "supabase/migrations/20260715191340_harden_schedule_recovery.sql",
);
const reconciliationFixMigration = readProjectFile(
  "supabase/migrations/20260716081546_fix_social_schedule_reconciliation.sql",
);
const schedulingDb = readProjectFile("lib/scheduling/db.ts");
const renderRoute = readProjectFile(
  "app/api/schedules/[scheduleId]/render/route.ts",
);
const schedulingLayout = readProjectFile("app/scheduling/layout.tsx");

test("publish claiming locks the post and target and refuses cancelled work", () => {
  const claimFunction = getSection(
    recoveryMigration,
    "create or replace function public.claim_social_publish_operation",
    "revoke all on function public.claim_social_publish_operation",
  );

  assert.match(claimFunction, /select post\.status[\s\S]*for update;/);
  assert.match(
    claimFunction,
    /v_post_status in \('cancelled', 'published'\)[\s\S]*return;/,
  );
  assert.match(claimFunction, /select target\.status[\s\S]*for update;/);
  assert.match(
    claimFunction,
    /v_target_status not in \('scheduling', 'scheduled', 'publishing'\)/,
  );
  assert.match(
    claimFunction,
    /requested_job\.status = 'processing'[\s\S]*requested_job\.claim_token = p_claim_token/,
  );
});

test("cancellation takes the same locks and becomes too late after provider claim", () => {
  const cancelFunction = getSection(
    recoveryMigration,
    "create or replace function public.cancel_scheduled_post",
    "revoke all on function public.cancel_scheduled_post",
  );
  const postLock = cancelFunction.indexOf("select post.status");
  const targetLock = cancelFunction.indexOf("perform target.id");

  assert.ok(postLock >= 0);
  assert.ok(targetLock > postLock);
  assert.match(cancelFunction, /perform target\.id[\s\S]*for update;/);
  assert.match(
    cancelFunction,
    /operation\.active_claim_token is not null[\s\S]*operation\.status = 'published'/,
  );
  assert.match(cancelFunction, /return 'too_late';/);
  assert.match(
    cancelFunction,
    /update public\.background_jobs as job[\s\S]*status = 'cancelled'[\s\S]*job\.status in \('queued', 'processing'\)/,
  );
});

test("published target reconciliation does not reference an undefined post alias", () => {
  const reconcileFunction = getSection(
    reconciliationFixMigration,
    "create or replace function public.reconcile_social_schedule_state",
    "revoke all on function public.reconcile_social_schedule_state",
  );
  const publishedTargetUpdate = getSection(
    reconcileFunction,
    "update public.scheduled_post_targets as target",
    "get diagnostics v_published_targets = row_count",
  );

  assert.match(publishedTargetUpdate, /last_error_code = null/);
  assert.doesNotMatch(publishedTargetUpdate, /\bpost\./);
});

test("draft edits and render queueing both use optimistic status and version checks", () => {
  const editFunction = getSection(
    schedulingDb,
    "export async function updateEditableScheduledPost",
    "export async function deleteFailedScheduleTargetsForRetry",
  );
  const renderFunction = getSection(
    schedulingDb,
    "export async function updateScheduledPostRenderState",
    "export async function markScheduleTargetScheduler",
  );

  assert.match(editFunction, /\.eq\("status", "draft"\)/);
  assert.match(
    editFunction,
    /\.eq\("updated_at", params\.expectedUpdatedAt\)/,
  );
  assert.match(
    renderFunction,
    /query = query\.eq\("status", params\.expectedStatus\)/,
  );
  assert.match(
    renderFunction,
    /query = query\.eq\("updated_at", params\.expectedUpdatedAt\)/,
  );
  assert.match(renderRoute, /expectedStatus: "draft"/);
  assert.match(renderRoute, /expectedUpdatedAt: schedule\.updatedAt/);
  assert.match(renderRoute, /code: "schedule_version_conflict"/);
});

test("stale selected media is reported as an editable draft conflict", () => {
  assert.match(
    renderRoute,
    /code: "selected_opening_video_unavailable"[\s\S]*Edit this draft[\s\S]*409/,
  );
  assert.match(
    renderRoute,
    /code: "selected_demo_video_unavailable"[\s\S]*Edit this draft[\s\S]*409/,
  );
});

test("the scheduling workspace waits for Firebase auth restoration", () => {
  assert.match(schedulingLayout, /import \{ AuthGuard \}/);
  assert.match(schedulingLayout, /<AuthGuard>\{children\}<\/AuthGuard>/);
});

function getSection(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  assert.ok(startIndex >= 0, `Missing contract start: ${start}`);
  assert.ok(endIndex > startIndex, `Missing contract end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function readProjectFile(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
    "utf8",
  );
}
