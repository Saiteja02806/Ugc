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
const tiktokHardeningMigration = readProjectFile(
  "supabase/migrations/20260716135333_harden_tiktok_oauth_and_publishing.sql",
);
const publishRetryMigration = readProjectFile(
  "supabase/migrations/20260716142500_add_social_publish_target_retry.sql",
);
const instagramRenewalMigration = readProjectFile(
  "supabase/migrations/20260716151500_support_instagram_token_renewal.sql",
);
const carouselPublishRetryMigration = readProjectFile(
  "supabase/migrations/20260717183000_support_carousel_publish_retry.sql",
);
const hookVideoScheduleMigration = readProjectFile(
  "supabase/migrations/20260717190000_link_hook_video_schedules.sql",
);
const hookVideoScheduleRoute = readProjectFile(
  "app/api/trending/hook-videos/drafts/schedule/route.ts",
);
const schedulingDb = readProjectFile("lib/scheduling/db.ts");
const schedulingWorkspace = readProjectFile(
  "components/scheduling/scheduling-workspace.tsx",
);
const carouselScheduleModal = readProjectFile(
  "components/social/platform-selection-modal.tsx",
);
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
  const targetLock = retryFunction.indexOf("select\n    target.status");

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
  assert.match(schedulingLayout, /import \{ AuthGuard \}/);
  assert.match(schedulingLayout, /<AuthGuard>\{children\}<\/AuthGuard>/);
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
    /schedule\.sourceKind === "library_item"[\s\S]*?loadSocialConnections\(\)[\s\S]*?Promise\.all\(\[loadScheduleMedia\(\), loadSocialConnections\(\)\]\)/,
  );
  assert.doesNotMatch(draftHandoff, /setActiveTab\("drafts"\)/);
  assert.doesNotMatch(draftHandoff, /setViewMode\("list"\)/);
  assert.doesNotMatch(draftHandoff, /setTimeout/);
  assert.ok(
    draftHandoff.indexOf("setDrawerOpen(true)") <
      draftHandoff.lastIndexOf('initialDraftQueryState.current = "handled"'),
  );
});

test("new video schedules auto-select the only available scheduled video", () => {
  assert.match(
    schedulingWorkspace,
    /editingSchedule \|\|[\s\S]*selectedDemoMediaId \|\|[\s\S]*demoMediaOptions\.length !== 1[\s\S]*setSelectedDemoMediaId\(demoMediaOptions\[0\]!\.id\)/,
  );
});

test("carousel captions remain optional and are never replaced with the carousel title", () => {
  const mediaValidation = getSection(
    schedulingWorkspace,
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
  assert.match(schedulingWorkspace, /Caption[\s\S]*?\(optional\)/);
  assert.match(schedulingWorkspace, /Caption optional\./);
  assert.match(
    schedulingWorkspace,
    /Choose an account, date, and time to schedule this carousel\./,
  );
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
    /await scheduleTrendingCarousel\([\s\S]*?await completeTrendingCarouselAction\([\s\S]*?"scheduled"/,
  );
  assert.match(libraryWorkspace, /await scheduleLibraryCarousel\(/);
  assert.match(libraryWorkspace, /Carousel scheduled\. View it on the Scheduled page\./);
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
  assert.match(carouselScheduleModal, /const platformConnections = useMemo/);
  assert.match(
    carouselScheduleModal,
    /connection\.platform === "youtube"[\s\S]*YouTube accepts video uploads, not carousel posts\./,
  );
  assert.match(carouselScheduleModal, /Select connected account/);
  assert.match(carouselScheduleModal, /connectionId: connection\.id/);
  assert.match(carouselScheduleModal, /Caption[\s\S]*?\(optional\)/);
  assert.match(
    carouselScheduleModal,
    /self-start overflow-hidden rounded-card border border-border bg-card/,
  );
  assert.match(carouselScheduleModal, /label="Post ASAP"/);
  assert.match(carouselScheduleModal, /label="Schedule for later"/);
  assert.match(carouselScheduleModal, /type="date"/);
  assert.match(carouselScheduleModal, /type="time"/);
  assert.match(carouselScheduleModal, /Choose who can view the TikTok post\./);
  assert.doesNotMatch(carouselScheduleModal, /Connect Instagram or TikTok above/);
  assert.doesNotMatch(carouselScheduleModal, /Also show the Reel/);
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

test("each saved Hook video links to at most one valid schedule", () => {
  assert.match(
    hookVideoScheduleMigration,
    /foreign key \(scheduled_post_id\)[\s\S]*references public\.scheduled_posts\(id\)[\s\S]*on delete set null/,
  );
  assert.match(
    hookVideoScheduleMigration,
    /create unique index if not exists hook_video_drafts_unique_schedule_idx[\s\S]*where scheduled_post_id is not null/,
  );
  assert.match(
    hookVideoScheduleMigration,
    /create unique index if not exists scheduled_posts_active_hook_video_draft_idx[\s\S]*metadata \? 'hookVideoDraftId'[\s\S]*status <> 'cancelled'/,
  );
  assert.match(
    hookVideoScheduleRoute,
    /existingDraft\?\.scheduledPostId[\s\S]*existingSchedule\.idempotencyKey === requestedIdempotencyKey[\s\S]*hook_video_already_scheduled/,
  );
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
