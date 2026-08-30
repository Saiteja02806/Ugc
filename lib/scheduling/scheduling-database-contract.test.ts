import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { QueryClient } from "@tanstack/react-query";

import {
  DEFAULT_SOCIAL_SCHEDULING_CALENDAR_START_AT,
  getSocialSchedulingCalendarStartAt,
  isScheduleDraftVisibleInCalendar,
} from "./calendar-start.ts";
import {
  getSchedulingMediaCatalogQueryKey,
  SCHEDULING_CATALOG_FRESH_TIME_MS,
  SCHEDULING_CATALOG_GC_TIME_MS,
} from "./workspace-query-cache.ts";
import {
  ACCOUNT_DATA_FRESH_TIME_MS,
  ACCOUNT_DATA_GC_TIME_MS,
  getAccountScheduleConfigQueryKey,
  getAccountSchedulesQueryKey,
  getAccountSocialConnectionsQueryKey,
} from "./account-data-query-cache.ts";

const recoveryMigration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260715191340_harden_schedule_recovery.sql",
);
const reconciliationFixMigration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260716081546_fix_social_schedule_reconciliation.sql",
);
const tiktokHardeningMigration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260716135333_harden_tiktok_oauth_and_publishing.sql",
);
const publishRetryMigration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260716142500_add_social_publish_target_retry.sql",
);
const instagramRenewalMigration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260716151500_support_instagram_token_renewal.sql",
);
const carouselPublishRetryMigration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260717183000_support_carousel_publish_retry.sql",
);
const hookVideoScheduleMigration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260717190000_link_hook_video_schedules.sql",
);
const hookVideoScheduleRecoveryMigration = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260829093000_restore_hook_video_schedule_uniqueness_guards.sql",
);
const hookVideoScheduleDuplicatesMigration = readProjectFile(
  "supabase/migrations/20260830081949_allow_multiple_hook_video_schedules.sql",
);
const hookVideoScheduleRoute = readProjectFile(
  "app/api/trending/hook-videos/drafts/schedule/route.ts",
);
const schedulingDb = readProjectFile("lib/scheduling/db.ts");
const schedulingWorkspace = readProjectFile(
  "components/scheduling/scheduling-workspace.tsx",
);
const scheduleEditor = readProjectFile(
  "components/scheduling/schedule-editor.tsx",
);
const accountDataQuery = readProjectFile(
  "lib/scheduling/account-data-query.ts",
);
const instagramAnalyticsWorkspace = readProjectFile(
  "components/analytics/instagram-analytics-workspace.tsx",
);
const instagramAccountManager = readProjectFile(
  "components/settings/instagram-account-manager.tsx",
);
const carouselScheduleModal = readProjectFile(
  "components/social/platform-selection-modal.tsx",
);
const hookVideoScheduleDrawer = readProjectFile(
  "components/trending/hook-video-schedule-drawer.tsx",
);
const hookVideoComposer = readProjectFile(
  "components/trending/hook-video-composer.tsx",
);
const hookVideoLibrary = readProjectFile(
  "components/library/hook-video-library-tab.tsx",
);
const scheduleTime = readProjectFile("lib/scheduling/schedule-time.ts");
const schedulingService = readProjectFile("lib/scheduling/service.ts");
const schedulesRoute = readProjectFile("app/api/schedules/route.ts");
const carouselScheduleClient = readProjectFile(
  "lib/scheduling/carousel-scheduling-client.ts",
);
const trendingWorkspace = readProjectFile(
  "components/trending/trending-workspace.tsx",
);
const libraryWorkspace = readProjectFile(
  "components/library/library-workspace.tsx",
);
const renderRoute = readProjectFile(
  "app/api/schedules/[scheduleId]/render/route.ts",
);
const workspaceRouteBoundary = readProjectFile(
  "components/layout/workspace-route-boundary.tsx",
);
const workspaceRoutes = readProjectFile("lib/navigation/workspace-route.ts");

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

test("analytics reconciliation only reads the owner's published Instagram posts", () => {
  const publishedReferences = getSection(
    schedulingDb,
    "export async function listPublishedInstagramPostReferencesForUser",
    "export async function getScheduledPostForUser",
  );

  assert.match(publishedReferences, /\.eq\("user_id", params\.userId\)/);
  assert.match(publishedReferences, /\.eq\("platform", "instagram"\)/);
  assert.match(publishedReferences, /\.eq\("status", "published"\)/);
  assert.match(publishedReferences, /\.not\("platform_post_id", "is", null\)/);
  assert.match(publishedReferences, /\.gte\("published_at", params\.from\)/);
  assert.match(publishedReferences, /\.lte\("published_at", params\.to\)/);
});

test("TikTok refresh is leased and atomically rotates every token field", () => {
  const claimFunction = getSection(
    tiktokHardeningMigration,
    "create or replace function public.claim_social_connection_token_refresh",
    "create or replace function public.complete_social_connection_token_refresh",
  );
  const completeFunction = getSection(
    tiktokHardeningMigration,
    "create or replace function public.complete_social_connection_token_refresh",
    "create or replace function public.release_social_connection_token_refresh",
  );

  assert.match(claimFunction, /token_refresh_claim_token = p_claim_token/);
  assert.match(
    claimFunction,
    /token_refresh_claimed_at <[\s\S]*make_interval\(secs => v_stale_after_seconds\)/,
  );
  assert.match(completeFunction, /access_token_ciphertext = p_access_token_ciphertext/);
  assert.match(completeFunction, /refresh_token_ciphertext = p_refresh_token_ciphertext/);
  assert.match(completeFunction, /refresh_expires_at = p_refresh_expires_at/);
  assert.match(completeFunction, /scopes = coalesce\(p_scopes/);
  assert.match(completeFunction, /token_refresh_claim_token = null/);
});

test("Instagram token renewal shares the refresh lease without a refresh token", () => {
  const claimFunction = getSection(
    instagramRenewalMigration,
    "create or replace function public.claim_social_connection_token_refresh",
    "revoke all on function public.claim_social_connection_token_refresh",
  );

  assert.match(
    claimFunction,
    /refresh_token_ciphertext is not null[\s\S]*platform = 'instagram'/,
  );
  assert.match(claimFunction, /token_refresh_claim_token = p_claim_token/);
  assert.match(claimFunction, /returning connection\.\*/);
});

test("TikTok disconnect blocks pending targets until the user acts", () => {
  const revokeFunction = getSection(
    tiktokHardeningMigration,
    "create or replace function public.revoke_social_connection",
    "revoke all on function public.claim_social_connection_token_refresh",
  );

  assert.match(tiktokHardeningMigration, /'action_required'/);
  assert.match(revokeFunction, /status = 'revoked'/);
  assert.match(
    revokeFunction,
    /update public\.scheduled_post_targets[\s\S]*status = 'action_required'/,
  );
  assert.match(revokeFunction, /last_error_code = 'social_connection_revoked'/);
});

test("action-required targets can still be cancelled cleanly", () => {
  const cancelFunction = getSection(
    tiktokHardeningMigration,
    "create or replace function public.cancel_scheduled_post",
    "revoke all on function public.cancel_scheduled_post",
  );

  assert.match(
    cancelFunction,
    /target\.status in \([\s\S]*'failed',[\s\S]*'action_required'/,
  );
  assert.match(cancelFunction, /status = 'cancelled'/);
});

test("action-required target and parent status update atomically", () => {
  const actionFunction = getSection(
    tiktokHardeningMigration,
    "create or replace function public.mark_social_publish_target_action_required",
    "create or replace function public.revoke_social_connection",
  );

  assert.match(actionFunction, /status = 'action_required'/);
  assert.match(
    actionFunction,
    /update public\.scheduled_posts[\s\S]*'partially_failed'[\s\S]*'failed'/,
  );
  assert.match(actionFunction, /return true;/);
});

test("manual publish retry locks one post and target before changing state", () => {
  const retryFunction = getSection(
    publishRetryMigration,
    "create or replace function public.retry_social_publish_target",
    "revoke all on function public.retry_social_publish_target",
  );
  const postLock = retryFunction.indexOf("select post.status");
  const targetLock = retryFunction.search(/select\r?\n\s+target\.status/);

  assert.ok(postLock >= 0);
  assert.ok(targetLock > postLock);
  assert.match(retryFunction, /select post\.status[\s\S]*for update;/);
  assert.match(retryFunction, /select[\s\S]*target\.status[\s\S]*for update;/);
  assert.match(
    retryFunction,
    /v_post_status = 'cancelled' or v_target_status = 'cancelled'[\s\S]*return;/,
  );
});

test("manual publish retry accepts ready carousel slides without weakening video checks", () => {
  const retryFunction = getSection(
    carouselPublishRetryMigration,
    "create or replace function public.retry_social_publish_target",
    "revoke all on function public.retry_social_publish_target",
  );

  assert.match(retryFunction, /v_source_kind = 'library_item'/);
  assert.match(retryFunction, /v_platform not in \('instagram', 'tiktok'\)/);
  assert.match(retryFunction, /from public\.library_carousel_slides as slide/);
  assert.match(retryFunction, /slide\.rendered_url like 'https:\/\/%'/);
  assert.match(retryFunction, /elsif not exists \([\s\S]*from public\.media_assets/);
});

test("repeated publish retry reuses active work and creates only one new job", () => {
  const retryFunction = getSection(
    publishRetryMigration,
    "create or replace function public.retry_social_publish_target",
    "revoke all on function public.retry_social_publish_target",
  );

  assert.match(
    retryFunction,
    /job\.status in \('queued', 'processing'\)[\s\S]*for update;/,
  );
  assert.match(
    retryFunction,
    /return query select 'already_queued'::text, v_active_job_id/,
  );
  assert.match(retryFunction, /if v_target_status <> 'failed'/);
  assert.match(
    retryFunction,
    /insert into public\.background_jobs \([\s\S]*'publish_social_post'[\s\S]*'social-publish'/,
  );
  assert.match(
    retryFunction,
    /publish_job_id = v_active_job_id[\s\S]*status = 'scheduled'/,
  );
  assert.match(
    retryFunction,
    /return query select 'retry_created'::text, v_active_job_id/,
  );
});

test("publish retry repairs provider success and fails closed for unsafe inputs", () => {
  const retryFunction = getSection(
    publishRetryMigration,
    "create or replace function public.retry_social_publish_target",
    "revoke all on function public.retry_social_publish_target",
  );

  assert.match(
    retryFunction,
    /operation\.status = 'published'[\s\S]*status = 'published'/,
  );
  assert.match(
    retryFunction,
    /return query select 'already_published'::text/,
  );
  assert.match(retryFunction, /v_target_status = 'action_required'/);
  assert.match(retryFunction, /'scheduling_retry_required'/);
  assert.match(
    retryFunction,
    /media\.status = 'ready'[\s\S]*media\.source_type in \([\s\S]*'combined_render'[\s\S]*'demo_upload'[\s\S]*'upload'[\s\S]*'generated_video'[\s\S]*'edit_export'/,
  );
  assert.match(
    retryFunction,
    /connection\.status = 'connected'[\s\S]*connection\.revoked_at is null/,
  );
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
  assert.match(
    workspaceRoutes,
    /prefix: "\/scheduling", activeKey: "scheduling", access: "profile"/,
  );
  assert.match(
    workspaceRouteBoundary,
    /requireBusinessProfile=\{route\.access === "profile"\}/,
  );
});

test("schedule listing returns without waiting for provider cleanup", () => {
  const listSchedules = getSection(
    schedulingService,
    "export async function listUserSchedules",
    "export async function reconcileCancelledSchedulerResources",
  );
  const reconciliation = getSection(
    schedulingService,
    "export async function reconcileCancelledSchedulerResources",
    "export async function getUserSchedule",
  );
  const getRoute = getSection(
    schedulesRoute,
    "export async function GET(request: Request)",
    "export async function POST(request: Request)",
  );

  assert.match(listSchedules, /return listScheduledPostsForUser\(params\)/);
  assert.doesNotMatch(
    listSchedules,
    /reconcileCancelledSchedulerResources|deleteSocialPublishSchedule/,
  );
  assert.match(
    reconciliation,
    /listCancelledScheduleTargetsNeedingCleanup\([\s\S]*limit: 10[\s\S]*userId/,
  );
  assert.match(
    reconciliation,
    /cleanupCancelledSchedulerTargets\(\{ targets, userId \}\)/,
  );
  assert.match(schedulesRoute, /import \{ after, NextResponse \} from "next\/server"/);
  assert.match(
    getRoute,
    /after\(\(\) =>[\s\S]*reconcileCancelledSchedulerResources\(userId\)\.catch/,
  );
  assert.ok(
    getRoute.indexOf("after(() =>") <
      getRoute.indexOf("const schedules = await listUserSchedules"),
  );
  assert.ok(
    getRoute.indexOf("requireFirebaseUser(request)") <
      getRoute.indexOf("after(() =>"),
  );
  assert.ok(
    getRoute.indexOf('url.searchParams.get("configOnly") === "1"') <
      getRoute.indexOf("after(() =>"),
  );
  assert.ok(
    getRoute.indexOf('url.searchParams.get("status") && !status') <
      getRoute.indexOf("after(() =>"),
  );
  assert.match(
    getRoute,
    /reconcileCancelledSchedulerResources\(userId\)\.catch\([\s\S]*Could not reconcile cancelled schedule resources/,
  );
});

test("direct cancellation still waits for provider cleanup", () => {
  const cancellation = getSection(
    schedulingService,
    "export async function cancelUserSchedule",
    "function assertScheduleTargetSelection",
  );

  assert.match(
    cancellation,
    /await cleanupCancelledSchedulerTargets\(\{[\s\S]*targets: cancelled\.targets[\s\S]*userId: params\.userId/,
  );
  assert.ok(
    cancellation.indexOf("await cleanupCancelledSchedulerTargets") <
      cancellation.lastIndexOf("return getRequiredSchedule"),
  );
});

test("scheduling loads only Creative Assets media catalogs concurrently", () => {
  const mediaLoad = getSection(
    schedulingWorkspace,
    "const loadScheduleMedia = useCallback(async (",
    "const loadSchedules = useCallback(async (",
  );

  assert.match(
    mediaLoad,
    /Promise\.all\(\[[\s\S]*collection=influencer[\s\S]*collection=video/,
  );
  assert.match(mediaLoad, /isCreativeAssetHookMediaAsset/);
  assert.doesNotMatch(mediaLoad, /\/api\/avatars/);
});

test("scheduling media catalogs are briefly reused only inside one Firebase account", () => {
  assert.deepEqual(getSchedulingMediaCatalogQueryKey("user-a"), [
    "scheduling-workspace",
    "user-a",
    "media-catalog",
  ]);
  assert.notDeepEqual(
    getSchedulingMediaCatalogQueryKey("user-a"),
    getSchedulingMediaCatalogQueryKey("user-b"),
  );
  assert.equal(SCHEDULING_CATALOG_FRESH_TIME_MS, 30 * 60 * 1_000);
  assert.equal(SCHEDULING_CATALOG_GC_TIME_MS, 30 * 60 * 1_000);

  assert.match(schedulingWorkspace, /const \{ user \} = useAuth\(\)/);
  assert.match(schedulingWorkspace, /const accountId = user\?\.uid \?\? "signed-out"/);
  assert.match(schedulingWorkspace, /queryClient\.getQueryData<SchedulingMediaCatalog>/);
  assert.match(schedulingWorkspace, /queryClient\.fetchQuery\(\{/);
  assert.match(
    schedulingWorkspace,
    /staleTime: options\.force \? 0 : SCHEDULING_CATALOG_FRESH_TIME_MS/,
  );
  assert.match(schedulingWorkspace, /retry: false/);
});

test("connections and schedules use shared account-scoped query keys", () => {
  assert.deepEqual(getAccountSocialConnectionsQueryKey("user-a"), [
    "account",
    "user-a",
    "social-connections",
  ]);
  assert.deepEqual(getAccountSchedulesQueryKey("user-a"), [
    "account",
    "user-a",
    "schedules",
  ]);
  assert.deepEqual(getAccountScheduleConfigQueryKey("user-a"), [
    "account",
    "user-a",
    "schedule-config",
  ]);
  assert.notDeepEqual(
    getAccountSchedulesQueryKey("user-a"),
    getAccountSchedulesQueryKey("user-b"),
  );
  assert.equal(ACCOUNT_DATA_FRESH_TIME_MS, 30 * 60 * 1_000);
  assert.equal(ACCOUNT_DATA_GC_TIME_MS, 30 * 60 * 1_000);

  assert.match(accountDataQuery, /queryClient\.fetchQuery\(\{/);
  assert.match(accountDataQuery, /fetch\("\/api\/social\/connections"/);
  assert.match(accountDataQuery, /fetch\("\/api\/schedules"/);
  assert.match(accountDataQuery, /fetch\("\/api\/schedules\?configOnly=1"/);
  assert.match(
    accountDataQuery,
    /staleTime: options\.force \? 0 : ACCOUNT_DATA_FRESH_TIME_MS/,
  );
  assert.match(accountDataQuery, /retry: false/);
});

test("active account screens consume the shared connection and schedule queries", () => {
  for (const consumer of [
    schedulingWorkspace,
    carouselScheduleModal,
    hookVideoScheduleDrawer,
    instagramAnalyticsWorkspace,
    instagramAccountManager,
  ]) {
    assert.match(consumer, /loadAccountSocialConnections/);
  }

  assert.match(schedulingWorkspace, /loadAccountSchedules/);
  assert.match(instagramAnalyticsWorkspace, /loadAccountSchedules/);
  assert.match(carouselScheduleModal, /loadAccountScheduleConfig/);
  assert.match(hookVideoScheduleDrawer, /loadAccountScheduleConfig/);
  assert.doesNotMatch(instagramAnalyticsWorkspace, /fetch\("\/api\/schedules"/);
  assert.doesNotMatch(carouselScheduleModal, /fetch\("\/api\/social\/connections"/);
  assert.doesNotMatch(hookVideoScheduleDrawer, /fetch\("\/api\/social\/connections"/);
  assert.doesNotMatch(instagramAccountManager, /fetch\("\/api\/social\/connections"/);
  assert.match(schedulingWorkspace, /upsertAccountSchedule\(queryClient, accountId, schedule\)/);
  assert.match(carouselScheduleModal, /invalidateAccountSchedules\(queryClient, accountId\)/);
  assert.match(hookVideoScheduleDrawer, /invalidateAccountSchedules\(queryClient, accountId\)/);
});

test("the catalog cache reuses fresh data, refetches on force, and isolates accounts", async () => {
  const queryClient = new QueryClient();
  let requestCount = 0;
  const queryFn = async () => {
    requestCount += 1;
    return { requestCount };
  };

  try {
    const first = await queryClient.fetchQuery({
      queryFn,
      queryKey: getSchedulingMediaCatalogQueryKey("user-a"),
      staleTime: SCHEDULING_CATALOG_FRESH_TIME_MS,
    });
    const reused = await queryClient.fetchQuery({
      queryFn,
      queryKey: getSchedulingMediaCatalogQueryKey("user-a"),
      staleTime: SCHEDULING_CATALOG_FRESH_TIME_MS,
    });
    const forced = await queryClient.fetchQuery({
      queryFn,
      queryKey: getSchedulingMediaCatalogQueryKey("user-a"),
      staleTime: 0,
    });
    const otherAccount = await queryClient.fetchQuery({
      queryFn,
      queryKey: getSchedulingMediaCatalogQueryKey("user-b"),
      staleTime: SCHEDULING_CATALOG_FRESH_TIME_MS,
    });

    assert.deepEqual(first, { requestCount: 1 });
    assert.deepEqual(reused, first);
    assert.deepEqual(forced, { requestCount: 2 });
    assert.deepEqual(otherAccount, { requestCount: 3 });
    assert.equal(requestCount, 3);
  } finally {
    queryClient.clear();
  }
});

test("the shared account cache reuses fresh data, refetches on force, and isolates accounts", async () => {
  const queryClient = new QueryClient();
  let requestCount = 0;
  const queryFn = async () => {
    requestCount += 1;
    return { requestCount };
  };

  try {
    const first = await queryClient.fetchQuery({
      queryFn,
      queryKey: getAccountSocialConnectionsQueryKey("user-a"),
      staleTime: ACCOUNT_DATA_FRESH_TIME_MS,
    });
    const reused = await queryClient.fetchQuery({
      queryFn,
      queryKey: getAccountSocialConnectionsQueryKey("user-a"),
      staleTime: ACCOUNT_DATA_FRESH_TIME_MS,
    });
    const forced = await queryClient.fetchQuery({
      queryFn,
      queryKey: getAccountSocialConnectionsQueryKey("user-a"),
      staleTime: 0,
    });
    const otherAccount = await queryClient.fetchQuery({
      queryFn,
      queryKey: getAccountSocialConnectionsQueryKey("user-b"),
      staleTime: ACCOUNT_DATA_FRESH_TIME_MS,
    });

    assert.deepEqual(first, { requestCount: 1 });
    assert.deepEqual(reused, first);
    assert.deepEqual(forced, { requestCount: 2 });
    assert.deepEqual(otherAccount, { requestCount: 3 });
    assert.equal(requestCount, 3);
  } finally {
    queryClient.clear();
  }
});

test("user actions open the editor using cached scheduling catalogs while refresh forces fresh media", () => {
  const newScheduleFlow = getSection(
    schedulingWorkspace,
    "async function handleNewSchedulePost(",
    "async function handleEditSchedule",
  );
  const editScheduleFlow = getSection(
    schedulingWorkspace,
    "async function handleEditSchedule",
    "useEffect(() => {",
  );

  assert.match(newScheduleFlow, /loadSocialConnections\(\)/);
  assert.match(newScheduleFlow, /loadScheduleMedia\(\)/);
  assert.match(editScheduleFlow, /loadScheduleMedia\(\)/);
  assert.match(editScheduleFlow, /loadSocialConnections\(\)/);
  assert.match(
    schedulingWorkspace,
    /onRefreshMedia=\{\(\) => loadScheduleMedia\(\{ force: true \}\)\}/,
  );
});

test("schedule refreshes share in-flight reads while polling still forces fresh data", () => {
  const scheduleLoad = getSection(
    schedulingWorkspace,
    "const loadSchedules = useCallback(async (",
    "const loadSocialConnections = useCallback(async (",
  );

  assert.match(
    scheduleLoad,
    /loadAccountSchedules\(queryClient, accountId, options\)/,
  );
  assert.doesNotMatch(scheduleLoad, /fetch\("\/api\/schedules"/);
  assert.match(
    schedulingWorkspace,
    /ACTIVE_SCHEDULE_POLL_INTERVAL_MS = 5_000/,
  );
  assert.match(
    schedulingWorkspace,
    /window\.setInterval\(\(\) => \{[\s\S]*?loadSchedules\(\{ force: true \}\)/,
  );
  assert.match(
    schedulingWorkspace,
    /target\.status === "publishing" \|\| target\.status === "scheduling"[\s\S]*?target\.updatedAt[\s\S]*?ACTIVE_JOB_TIMEOUT_MS/,
  );
});

test("a deep-linked carousel draft opens the scheduling editor without switching to Drafts", () => {
  const draftHandoff = getSection(
    schedulingWorkspace,
    'const draftId = new URLSearchParams(window.location.search).get("draft");',
    "async function handleSaveScheduleDraft",
  );

  assert.match(
    draftHandoff,
    /fetch\([\s\S]*?`\/api\/schedules\/\$\{encodeURIComponent\(requestedDraftId\)\}`/,
  );
  assert.match(draftHandoff, /setEditingScheduleId\(schedule\.id\)/);
  assert.match(draftHandoff, /setRequireScheduleTarget\(true\)/);
  assert.match(draftHandoff, /setDrawerOpen\(true\)/);
  assert.match(
    draftHandoff,
    /schedule\.sourceKind === "library_item"[\s\S]*?loadSocialConnections\(\{ force: true \}\)[\s\S]*?Promise\.all\(\[[\s\S]*?loadScheduleMedia\(\{ force: true \}\)[\s\S]*?loadSocialConnections\(\{ force: true \}\)/,
  );
  assert.doesNotMatch(draftHandoff, /setActiveTab\("drafts"\)/);
  assert.doesNotMatch(draftHandoff, /setViewMode\("list"\)/);
  assert.doesNotMatch(draftHandoff, /setTimeout/);
  assert.ok(
    draftHandoff.indexOf("setDrawerOpen(true)") <
      draftHandoff.lastIndexOf('initialDraftQueryState.current = "handled"'),
  );
});

test("new schedules preselect available hook and secondary clips", () => {
  assert.match(
    scheduleEditor,
    /editingSchedule \|\|[\s\S]*selectedDemoMediaId \|\|[\s\S]*demoMediaOptions\.length === 0[\s\S]*setSelectedDemoMediaId\(demoMediaOptions\[0\]!\.id\)/,
  );
  assert.match(
    scheduleEditor,
    /editingSchedule \|\|[\s\S]*selectedHookMediaId \|\|[\s\S]*localHookMediaOptions\.length === 0[\s\S]*setSelectedHookMediaId\(localHookMediaOptions\[0\]!\.id\)/,
  );
  assert.match(scheduleEditor, /function getInitialClipSelection/);
  assert.match(schedulingWorkspace, /clipSelection: submission\.clipSelection/);
  assert.match(
    schedulingWorkspace,
    /clipSelection\) === "hook_only"[\s\S]*initialHookMediaId/,
  );
});

test("carousel captions remain optional and are never replaced with the carousel title", () => {
  const mediaValidation = getSection(
    scheduleEditor,
    "function getScheduleMediaValidationError",
    "function getStatusPreviewMessage",
  );
  const requestBody = getSection(
    schedulingWorkspace,
    "function buildScheduleRequestBody",
    "async function completeTrendingScheduleAssignment",
  );

  assert.doesNotMatch(mediaValidation, /caption/i);
  assert.match(requestBody, /caption: submission\.caption/);
  assert.doesNotMatch(requestBody, /submission\.caption\s*\|\|/);
  assert.match(scheduleEditor, /Caption[\s\S]*?\(optional\)/);
  assert.match(scheduleEditor, /Caption optional\./);
  assert.match(
    scheduleEditor,
    /Confirm the carousel, choose your Instagram account, and set the publish time\./,
  );
});

test("the Scheduling editor loads only after an editor flow opens", () => {
  assert.match(schedulingWorkspace, /const ScheduleEditor = dynamic\(/);
  assert.match(
    schedulingWorkspace,
    /import\("@\/components\/scheduling\/schedule-editor"\)/,
  );
  assert.doesNotMatch(
    schedulingWorkspace,
    /function NewScheduleDrawer|function ScheduleFlowSection/,
  );
  assert.match(
    schedulingWorkspace,
    /drawerOpen \? \([\s\S]*?<ScheduleEditor/,
  );
  assert.match(schedulingWorkspace, /loading: ScheduleEditorLoading/);
  assert.match(scheduleEditor, /export function ScheduleEditor/);
  assert.doesNotMatch(scheduleEditor, /onPrepareCatalogInfluencer/);
  assert.match(
    schedulingWorkspace,
    /onRefreshMedia=\{\(\) => loadScheduleMedia\(\{ force: true \}\)\}/,
  );
  assert.match(
    schedulingWorkspace,
    /const \[drawerOpen, setDrawerOpen\] = useState\(false\)/,
  );
  assert.match(
    schedulingWorkspace,
    /const \[editingScheduleId, setEditingScheduleId\] = useState<string \| null>/,
  );
  assert.match(scheduleEditor, /const \[caption, setCaption\] = useState/);
});

test("carousel scheduling stays inline on Trending and Library", () => {
  assert.doesNotMatch(
    trendingWorkspace,
    /router\.push\(`\/scheduling\?draft=/,
  );
  assert.doesNotMatch(
    libraryWorkspace,
    /router\.push\(`\/scheduling\?draft=/,
  );
  assert.match(trendingWorkspace, /await scheduleTrendingCarousel\(/);
  assert.match(
    trendingWorkspace,
    /await scheduleTrendingCarousel\([\s\S]*?await completeAcceptedCarouselWorkflow\([\s\S]*?"scheduled"/,
  );
  assert.match(libraryWorkspace, /await scheduleLibraryCarousel\(/);
  assert.match(libraryWorkspace, /Carousel scheduled\. View it on the Scheduled page\./);
});

test("the large inline Carousel scheduler loads only after scheduling is opened", () => {
  for (const workspace of [trendingWorkspace, libraryWorkspace]) {
    assert.match(workspace, /const PlatformSelectionModal = dynamic\(/);
    assert.match(
      workspace,
      /import\("@\/components\/social\/platform-selection-modal"\)/,
    );
    assert.doesNotMatch(
      workspace,
      /import \{\s*PlatformSelectionModal[\s,}]/,
    );
    assert.match(
      workspace,
      /scheduleContext \? \([\s\S]*?<PlatformSelectionModal[\s\S]*?context=\{scheduleContext\}[\s\S]*?open/,
    );
    assert.match(workspace, /loading: PlatformSelectionModalLoading/);
  }
});

test("the Hook and Wall scheduling drawer loads only from an open flow", () => {
  for (const source of [trendingWorkspace, hookVideoComposer, hookVideoLibrary]) {
    assert.match(source, /const HookVideoScheduleDrawer = dynamic\(/);
    assert.match(
      source,
      /import\("@\/components\/trending\/hook-video-schedule-drawer"\)/,
    );
    assert.doesNotMatch(
      source,
      /import \{\s*HookVideoScheduleDrawer[\s,}]/,
    );
    assert.match(source, /loading: PlatformSelectionModalLoading/);
  }

  assert.match(
    trendingWorkspace,
    /pendingWallTextScheduleCandidate \? \([\s\S]*<HookVideoScheduleDrawer/,
  );
  assert.match(
    hookVideoComposer,
    /scheduleDrawerOpen &&[\s\S]*<HookVideoScheduleDrawer/,
  );
  assert.match(
    hookVideoLibrary,
    /pendingScheduleItem \? \([\s\S]*<HookVideoScheduleDrawer/,
  );
});

test("the inline carousel modal implements exact-account content and time steps", () => {
  assert.match(carouselScheduleModal, /Step \{currentStep\.number\} of 4/);
  assert.match(carouselScheduleModal, /title: "Select Instagram account"/);
  assert.match(carouselScheduleModal, /title: "Content details"/);
  assert.match(carouselScheduleModal, /title: "Schedule"/);
  assert.match(
    carouselScheduleModal,
    /const visiblePlatforms = platforms\.filter\([\s\S]*definition\.platform === "instagram"/,
  );
  assert.match(
    carouselScheduleModal,
    /connections\.filter\([\s\S]*connection\.platform === "instagram"/,
  );
  assert.match(carouselScheduleModal, /\{visiblePlatforms\.map\(/);
  assert.match(carouselScheduleModal, /label: "TikTok"[\s\S]*platform: "tiktok"/);
  assert.match(carouselScheduleModal, /label: "YouTube"[\s\S]*platform: "youtube"/);
  assert.match(
    carouselScheduleModal,
    /className="instagram-theme [^"]*bg-card/,
  );
  assert.match(
    carouselScheduleModal,
    /connection\.platform === "youtube"[\s\S]*YouTube accepts video uploads, not carousel posts\./,
  );
  assert.match(carouselScheduleModal, /Publishing account/);
  assert.match(carouselScheduleModal, /\{carouselConnections\.map\(/);
  assert.match(carouselScheduleModal, />Reconnect<\/span>/);
  assert.doesNotMatch(carouselScheduleModal, /Instagram connection/);
  assert.doesNotMatch(carouselScheduleModal, /Select connected account/);
  assert.doesNotMatch(carouselScheduleModal, /const platformConnections = useMemo/);
  assert.match(carouselScheduleModal, /connectionId: connection\.id/);
  assert.match(carouselScheduleModal, /Caption[\s\S]*?\(optional\)/);
  assert.match(
    carouselScheduleModal,
    /self-start overflow-hidden rounded-card border border-border bg-card/,
  );
  assert.match(carouselScheduleModal, /label="Post Right away"/);
  assert.match(carouselScheduleModal, /label="Schedule for later"/);
  assert.match(carouselScheduleModal, /type="date"/);
  assert.match(carouselScheduleModal, /type="time"/);
  assert.match(carouselScheduleModal, /Choose who can view the TikTok post\./);
  assert.doesNotMatch(carouselScheduleModal, /Connect Instagram or TikTok above/);
  assert.doesNotMatch(carouselScheduleModal, /Also show the Reel/);
});

test("Post Right away calculates its lead time at final submission, not when the screen rendered", () => {
  const submitSchedule = getSection(
    carouselScheduleModal,
    'async function submitSchedule(mode: "asap" | "later")',
    "function applyQuickSlot",
  );

  assert.match(submitSchedule, /const submittedAt = Date\.now\(\);/);
  assert.match(submitSchedule, /setCurrentTime\(submittedAt\);/);
  assert.match(
    submitSchedule,
    /mode === "asap"\s*\? getEarliestScheduleSlot\(\s*submittedAt,\s*minimumLeadMinutes,\s*timezone,\s*\)/,
  );
  assert.doesNotMatch(submitSchedule, /mode === "asap" \? earliestSlot/);
  assert.match(submitSchedule, /useDefaultScheduleTime: mode === "asap"/);
  assert.match(
    carouselScheduleClient,
    /useDefaultScheduleTime: submission\.useDefaultScheduleTime/,
  );
  assert.match(
    schedulingService,
    /input\.useDefaultScheduleTime === true[\s\S]*getDefaultScheduleTime\(timezone\)/,
  );
});

test("inline carousel submission persists a recoverable draft before publishing", () => {
  assert.match(carouselScheduleClient, /fetch\("\/api\/schedules"/);
  assert.match(carouselScheduleClient, /plannedTargets: submission\.targets/);
  assert.match(carouselScheduleClient, /targets: \[\]/);
  assert.match(
    carouselScheduleClient,
    /fetch\(`\/api\/schedules\/\$\{draft\.id\}\/publish`/,
  );
  assert.match(carouselScheduleClient, /connectionIds/);
  assert.match(carouselScheduleClient, /CarouselScheduleRecoveryError/);
  assert.match(carouselScheduleClient, /caption: submission\.caption/);
  assert.doesNotMatch(
    carouselScheduleClient,
    /caption:\s*submission\.caption\s*\|\|/,
  );
});

test("scheduling requires a selected account before any draft is stored", () => {
  const createSchedule = getSection(
    schedulingService,
    "export async function createUserSchedule",
    "export async function retryUserScheduleTargetPublishing",
  );
  const updateSchedule = getSection(
    schedulingService,
    "export async function updateUserSchedule",
    "export async function finalizeRenderedScheduleFromWorker",
  );

  assert.match(createSchedule, /assertScheduleTargetSelection\(normalized\)/);
  assert.ok(
    createSchedule.indexOf("assertScheduleTargetSelection(normalized)") <
      createSchedule.indexOf("insertScheduledPost"),
  );
  assert.match(updateSchedule, /assertScheduleTargetSelection\(normalized\)/);
  assert.match(
    schedulingWorkspace,
    /getInstagramSchedulingAccessState\(connections\)/,
  );
  assert.match(schedulingWorkspace, /Connect Instagram first/);
  assert.match(
    schedulingWorkspace,
    /SocialPlatformIcon\s+className="size-6 text-white"\s+platform="instagram"/,
  );
  assert.match(schedulingWorkspace, /target\.platform === "instagram"/);
  assert.doesNotMatch(
    schedulingWorkspace,
    /save a video draft without publishing/i,
  );
});
test("social scheduling uses one five-minute rule without quarter-hour rounding", () => {
  assert.match(
    scheduleTime,
    /DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES = 5/,
  );
  assert.match(
    schedulingService,
    /process\.env\.SOCIAL_SCHEDULING_MIN_LEAD_MINUTES/,
  );
  assert.doesNotMatch(
    schedulingService,
    /process\.env\.SCHEDULING_MIN_RENDER_LEAD_MINUTES/,
  );
  assert.match(
    schedulingService,
    /assertMinimumLead: assertTaskCreationBuffer/,
  );
  assert.match(
    schedulingService,
    /leadPolicy: "render_finalization"/,
  );
  assert.match(schedulesRoute, /minimumScheduleLeadMinutes/);

  for (const schedulingUi of [carouselScheduleModal, hookVideoScheduleDrawer]) {
    assert.match(
      schedulingUi,
      /step=\{SOCIAL_SCHEDULING_TIME_STEP_SECONDS\}/,
    );
    assert.doesNotMatch(schedulingUi, /getMinutes\(\) \/ 15/);
  }

  assert.match(
    scheduleEditor,
    /SOCIAL_SCHEDULING_TIME_STEP_SECONDS \/ 60/,
  );
  assert.match(scheduleEditor, /function ScheduleTimePicker/);
  assert.doesNotMatch(scheduleEditor, /type="time"/);
  assert.doesNotMatch(scheduleEditor, /getMinutes\(\) \/ 15/);

  assert.doesNotMatch(carouselScheduleModal, /minimumLeadMinutes \+ 2/);
  assert.match(
    schedulingWorkspace,
    /ACTIVE_SCHEDULE_POLL_INTERVAL_MS = 5_000/,
  );
});

test("the main scheduler uses compact role-based clip and time controls", () => {
  assert.match(
    schedulingWorkspace,
    /demoMediaOptions: videoAssets[\s\S]*filter\(isScheduledVideoMediaAsset\)/,
  );
  assert.match(scheduleEditor, /Hook clip/);
  assert.match(scheduleEditor, /title="Secondary clip"/);
  assert.match(scheduleEditor, /Choose a secondary clip/);
  assert.match(
    scheduleEditor,
    /Content videos appear here\. Selecting a clip closes this list\./,
  );
  assert.match(
    scheduleEditor,
    /flex snap-x snap-mandatory gap-3 overflow-x-auto/,
  );
  assert.match(scheduleEditor, /function SchedulePrimaryMediaCard/);
  assert.match(scheduleEditor, /<ScheduleMediaVisual option=\{option\}/);
  assert.match(scheduleEditor, /setFailedThumbnailUrl/);
  assert.match(scheduleEditor, /24-hour time with 1-minute precision\./);
  assert.match(scheduleEditor, /function ScheduleTimeRail/);
  assert.match(
    scheduleEditor,
    /snap-x snap-mandatory gap-1\.5 overflow-x-auto/,
  );
  assert.match(scheduleEditor, /aria-label="Scheduling checklist"/);
  assert.match(scheduleEditor, /Show on profile grid/);
  assert.match(scheduleEditor, /max-w-xl/);
  assert.match(
    schedulingWorkspace,
    /influencerData\.assets[\s\S]*filter\(isCreativeAssetHookMediaAsset\)/,
  );
  assert.doesNotMatch(schedulingWorkspace, /\/api\/avatars/);
  assert.doesNotMatch(scheduleEditor, /Presenter catalog/);
  assert.doesNotMatch(scheduleEditor, /onPrepareCatalogInfluencer/);
  assert.match(schedulingService, /"catalog_influencer"/);
  assert.match(schedulingService, /assertSelectedHookIsCreativeAsset/);
  assert.match(schedulingService, /hook_creative_asset_required/);
  assert.match(
    renderRoute,
    /\[\s*"catalog_influencer",\s*"influencer_upload",\s*"upload",\s*"generated_video",\s*\]/,
  );
  assert.match(schedulingService, /directScheduledVideoCollections/);
});

test("every calendar date opens the dedicated day view", () => {
  const calendarPlanner = getSection(
    schedulingWorkspace,
    "function CalendarPlanner(",
    "function CalendarDayCell(",
  );
  const calendarDayCell = getSection(
    schedulingWorkspace,
    "function CalendarDayCell(",
    "function CompactCalendarDay(",
  );
  const compactCalendarDay = getSection(
    schedulingWorkspace,
    "function CompactCalendarDay(",
    "function SelectedCalendarDayPanel(",
  );

  assert.match(calendarPlanner, /onOpenDate=\{onOpenDate\}/);
  assert.match(calendarDayCell, /onClick=\{\(\) => onOpenDate\(day\.dateKey\)\}/);
  assert.match(compactCalendarDay, /onClick=\{\(\) => onOpenDate\(day\.dateKey\)\}/);
  assert.match(schedulingWorkspace, /function handleOpenDayPlanner[\s\S]*setDayPlannerOpen\(true\)/);
  assert.match(schedulingWorkspace, /<DayScheduleWorkspace/);
});

test("List view opens a compact, date-selectable daily agenda", () => {
  const listExperience = getSection(
    schedulingWorkspace,
    "function ScheduleListDatePicker({",
    "function ScheduleDraftActions({",
  );

  assert.match(
    schedulingWorkspace,
    /function handleChangeViewMode[\s\S]*mode === "list"[\s\S]*handleSelectCalendarDate\(toDateKey\(new Date\(\)\)\)/,
  );
  assert.match(listExperience, /type="date"/);
  assert.match(listExperience, /<ScheduleDayListItem/);
  assert.match(listExperience, /getScheduleDayListDrafts\(drafts, selectedDate\)/);
  assert.match(listExperience, /draft\.scheduledTime/);
  assert.match(listExperience, /getScheduleDayListFormatLabel\(draft\)/);
  assert.match(listExperience, /getScheduleDayListStatusVariant\(draft\.status\)/);
  assert.doesNotMatch(listExperience, /ScheduleDraftMediaThumb/);
});
test("calendar and Day view include all posts, with upcoming posts first", () => {
  const calendarSelection = getSection(
    schedulingWorkspace,
    "const visibleDrafts = useMemo(",
    "function handleSelectCalendarDate",
  );
  const scheduleContent = getSection(
    schedulingWorkspace,
    "function ScheduleContent({",
    "function ScheduleListDatePicker({",
  );
  const dateGrouping = getSection(
    schedulingWorkspace,
    "function groupDraftsByDate(",
    "function getMonthCalendarDays(",
  );

  assert.match(calendarSelection, /groupDraftsByDate\(calendarDrafts\)/);
  assert.doesNotMatch(calendarSelection, /groupDraftsByDate\(visibleDrafts\)/);
  assert.match(scheduleContent, /calendarDrafts: ScheduleDraft\[\]/);
  assert.match(scheduleContent, /drafts=\{calendarDrafts\}/);
  assert.match(scheduleContent, /<ScheduleDayList/);
  assert.match(dateGrouping, /function getCalendarDayDraftSortRank/);
  assert.match(
    dateGrouping,
    /if \(isUpcomingDraft\(draft\)\) \{\s*return 0/,
  );
  assert.match(
    dateGrouping,
    /if \(draft\.status === "published"\) \{\s*return 1/,
  );
});

test("Calendar starts at the fixed rollout boundary and hides historical posts", () => {
  const calendarStartAt = getSocialSchedulingCalendarStartAt(
    "2026-08-08T19:11:15.366Z",
  );

  assert.equal(
    getSocialSchedulingCalendarStartAt("not-a-date"),
    DEFAULT_SOCIAL_SCHEDULING_CALENDAR_START_AT,
  );
  assert.equal(
    isScheduleDraftVisibleInCalendar(
      {
        createdAt: "2026-08-08T19:11:15.365Z",
        scheduledDate: "2026-08-09",
        status: "scheduled",
      },
      calendarStartAt,
    ),
    false,
  );
  assert.equal(
    isScheduleDraftVisibleInCalendar(
      {
        createdAt: "2026-08-08T19:11:15.366Z",
        scheduledDate: "2026-08-09",
        status: "scheduled",
      },
      calendarStartAt,
    ),
    true,
  );
  assert.equal(
    isScheduleDraftVisibleInCalendar(
      {
        createdAt: "2026-08-08T19:11:16.000Z",
        status: "scheduled",
      },
      calendarStartAt,
    ),
    false,
  );
  assert.equal(
    isScheduleDraftVisibleInCalendar(
      {
        createdAt: "2026-08-08T19:11:16.000Z",
        scheduledDate: "2026-08-09",
        status: "cancelled",
      },
      calendarStartAt,
    ),
    false,
  );
  assert.match(schedulesRoute, /calendarStartAt/);
  assert.match(
    schedulingWorkspace,
    /isScheduleDraftVisibleInCalendar\(draft, calendarStartAt\)/,
  );
});

test("a Hook video can be scheduled intentionally more than once", () => {
  assert.match(
    hookVideoScheduleMigration,
    /foreign key \(scheduled_post_id\)[\s\S]*references public\.scheduled_posts\(id\)[\s\S]*on delete set null/,
  );
  assert.match(
    hookVideoScheduleMigration,
    /create unique index if not exists hook_video_drafts_unique_schedule_idx[\s\S]*where scheduled_post_id is not null/,
  );
  assert.match(
    hookVideoScheduleDuplicatesMigration,
    /create index if not exists scheduled_posts_hook_video_draft_idx[\s\S]*metadata \? 'hookVideoDraftId'/,
  );
  assert.match(
    hookVideoScheduleDuplicatesMigration,
    /drop index if exists public\.scheduled_posts_active_hook_video_draft_idx/,
  );
  assert.doesNotMatch(hookVideoScheduleRoute, /hook_video_already_scheduled/);
  assert.match(schedulingService, /getScheduledPostByIdempotency/);
  assert.match(
    schedulingDb,
    /eq\("idempotency_key", params\.idempotencyKey\)[\s\S]*neq\("status", "cancelled"\)/,
  );
  assert.match(
    hookVideoScheduleDuplicatesMigration,
    /create unique index if not exists scheduled_posts_active_user_idempotency_idx[\s\S]*status <> 'cancelled'[\s\S]*drop index if exists public\.scheduled_posts_user_idempotency_idx/,
  );
});

test("the forward recovery migration restores missing Hook-video schedule guards", () => {
  assert.match(hookVideoScheduleRecoveryMigration, /set lock_timeout = '5s'/);
  assert.match(
    hookVideoScheduleRecoveryMigration,
    /create unique index if not exists hook_video_drafts_unique_schedule_idx[\s\S]*where scheduled_post_id is not null/,
  );
  assert.match(
    hookVideoScheduleRecoveryMigration,
    /create unique index if not exists scheduled_posts_active_hook_video_draft_idx[\s\S]*metadata \? 'hookVideoDraftId'[\s\S]*status <> 'cancelled'/,
  );
  assert.match(hookVideoScheduleRecoveryMigration, /reset lock_timeout/);
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
