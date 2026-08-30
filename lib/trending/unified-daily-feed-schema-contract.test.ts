import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260820084842_create_unified_daily_trending_feed.sql",
  "utf8",
);
const progressiveDeliveryMigration = readFileSync(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260825090000_progressive_trending_daily_delivery.sql",
  "utf8",
);
const hookAssignmentIntegrityMigration = readFileSync(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260825054213_preserve_bound_trending_hook_assignments.sql",
  "utf8",
);
const deliveryHardeningMigration = readFileSync(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260825140000_harden_trending_daily_delivery.sql",
  "utf8",
);
const durableReconciliationMigration = readFileSync(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260825153000_make_trending_delivery_reconciliation_durable.sql",
  "utf8",
);
const wallTextFailureRecoveryMigration = readFileSync(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260827170000_repair_wall_text_persistence_failures.sql",
  "utf8",
);
const fullFormatMixMigration = readFileSync(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260827180000_allow_full_format_content_mixes.sql",
  "utf8",
);
const decisionRoute = readFileSync(
  "app/api/trending/feed/decisions/route.ts",
  "utf8",
);
const contentMixRoute = readFileSync(
  "app/api/trending/content-mix/route.ts",
  "utf8",
);
const freeAllowanceMigration = readFileSync(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260823130857_raise_free_trending_allowance.sql",
  "utf8",
);
const planUpgradeGrant = readFileSync(
  "lib/trending/plan-upgrade-grant.ts",
  "utf8",
);
const unifiedFeed = readFileSync(
  "lib/trending/unified-daily-feed.ts",
  "utf8",
);
const unifiedFeedDatabase = readFileSync(
  "lib/trending/unified-daily-feed-db.ts",
  "utf8",
);
const feedRoute = readFileSync(
  "app/api/trending/feed/route.ts",
  "utf8",
);
const carouselDailyFeed = readFileSync(
  "lib/trending/daily-feed.ts",
  "utf8",
);
const trendingReconciliationRoute = readFileSync(
  "app/api/internal/trending/reconcile/route.ts",
  "utf8",
);
const trendingReconciliationWorker = readFileSync(
  "worker/src/lib/trending-feed-reconciliation.ts",
  "utf8",
);
const completedFeedReconciliation = readFileSync(
  "lib/trending/reconcile-completed-feed.ts",
  "utf8",
);
const recoveryMigration = readFileSync(
  "supabase/migrations/20260830120123_harden_daily_trending_feed_recovery.sql",
  "utf8",
);
const workerProcessor = readFileSync("worker/src/processor.ts", "utf8");
const recoveryRoute = readFileSync(
  "app/api/internal/jobs/recover/route.ts",
  "utf8",
);

test("uses the ten-piece free-trial allowance and repairs an already-created smaller feed", () => {
  assert.match(
    freeAllowanceMigration,
    /daily_trending_limit = 10[\s\S]*where plan_key = 'free'/,
  );
  assert.match(
    freeAllowanceMigration,
    /resolved_daily_limit < p_daily_limit[\s\S]*where requested\.ordinality > resolved_daily_limit/,
  );
  assert.match(
    freeAllowanceMigration,
    /daily_limit = p_daily_limit[\s\S]*status = 'preparing'/,
  );
  assert.match(
    unifiedFeedDatabase,
    /assertFreeTrialContentAccess\(userId\)[\s\S]*freeTrialAccess\.trial\?\.dailyContentPieces/,
  );
});

test("uses each plan's effective saved mix and dispatches missing formats together", () => {
  assert.match(
    unifiedFeed,
    /resolveTrendingContentMixPreference\([\s\S]*planKey: entitlement\.planKey[\s\S]*preference/,
  );
  assert.match(
    deliveryHardeningMigration,
    /on conflict \(feed_id, position\) do nothing[\s\S]*inserted_slot_count/,
  );
  assert.match(
    deliveryHardeningMigration,
    /missing position caused by a partial or interrupted write/,
  );
  assert.doesNotMatch(
    unifiedFeed,
    /entitlement\.planKey === "free"[\s\S]*FREE_TRENDING_CONTENT_MIX/,
  );
  assert.match(
    unifiedFeed,
    /carouselAssignmentIds: carouselProvider\.items\.map[\s\S]*hookVideoAssignmentIds: hookProvider\.items\.map[\s\S]*wallTextAssignmentIds: wallTextProvider\.items\.map/,
  );
  assert.match(unifiedFeed, /await Promise\.all\(tasks\)/);
});

test("exposes ready content before every remaining daily slot resolves", () => {
  assert.match(unifiedFeed, /getTrendingDailyPackReadiness/);
  assert.match(unifiedFeed, /exposeTrendingDailyPackItems/);
  assert.match(
    unifiedFeed,
    /const state = getPublicDailyFeedState\(\{[\s\S]*readiness: responseReadiness/,
  );
  assert.match(
    unifiedFeed,
    /const resolvedAssignmentIds = new Set\([\s\S]*resolvedItems\.map\(\(item\) => item\.assignmentId\)/,
  );
  assert.match(
    unifiedFeed,
    /slots\.length !== params\.dailyLimit[\s\S]*params\.readiness\.pendingSlotCount > 0/,
  );
  assert.match(
    unifiedFeed,
    /params\.items\.length > 0[\s\S]*return "ready"/,
  );
});

test("a same-day plan upgrade grants a full new plan pack exactly once", () => {
  assert.match(
    planUpgradeGrant,
    /currentTier <= existingTier[\s\S]*return 0[\s\S]*currentPlanDailyLimit/,
  );
  assert.match(
    unifiedFeed,
    /upgradeSlots > 0 \|\|[\s\S]*shouldPrepareDailyFeed/,
  );
  assert.match(
    unifiedFeed,
    /getStoredDailyFeedFormats[\s\S]*\[\.\.\.existingFormats, \.\.\.dailyPlan\.formats\]/,
  );
  assert.match(
    unifiedFeed,
    /getReservedTrendingDailyLimit\(\{[\s\S]*existingFeedDailyLimit: existingPlan\?\.feed\.dailyLimit[\s\S]*upgradeSlots/,
  );
  assert.match(
    planUpgradeGrant,
    /return existingFeedDailyLimit \+ upgradeSlots/,
  );
});

test("serves a read-only feed fast path and prepares missing work after the response", () => {
  assert.match(feedRoute, /readUnifiedTrendingDailyFeed\(preparationParams\)/);
  assert.match(
    feedRoute,
    /after\(\(\) =>[\s\S]*prepareUnifiedTrendingDailyFeed\(preparationParams\)/,
  );
  assert.doesNotMatch(feedRoute, /await ensureUnifiedTrendingDailyFeed/);
  assert.match(unifiedFeed, /inFlightDailyPackPreparations/);
  assert.match(unifiedFeed, /readTrendingDailyFeed\(/);
  assert.match(carouselDailyFeed, /inspectProcessingCandidates: false/);
});

test("isolates terminal format failures to their unbound slots", () => {
  assert.match(unifiedFeed, /getTerminalPreparationFailureFormats/);
  assert.match(
    unifiedFeed,
    /preparationResults\.get\("hook_video"\) === "failed"/,
  );
  assert.match(
    unifiedFeed,
    /preparationResults\.get\("wall_text"\) === "failed"/,
  );
  assert.match(unifiedFeed, /markDailyTrendingFeedFormatsFailed/);
  assert.match(
    unifiedFeedDatabase,
    /mark_daily_trending_feed_formats_failed/,
  );
  assert.match(
    progressiveDeliveryMigration,
    /and format = any\(p_formats\)[\s\S]*and state in \('planned', 'preparing'\)/,
  );
});

test("does not select a prior-day Carousel assignment for a new daily feed", () => {
  assert.doesNotMatch(carouselDailyFeed, /listCarryAssignments/);
  assert.match(
    carouselDailyFeed,
    /Only recover an\s+\/\/ assignment that was already created for this same day/,
  );
});

test("turns a terminal Wall persistence rejection into a visible retry state", () => {
  assert.match(
    unifiedFeed,
    /params\.terminalFailure \|\| params\.readiness\.failedSlotCount > 0[\s\S]*return "failed"/,
  );
  assert.match(
    unifiedFeed,
    /result\.status === "failed" \? "failed" : "scheduled"/,
  );
  assert.match(
    unifiedFeedDatabase,
    /restartFailedDailyTrendingFeedSlots[\s\S]*restart_failed_daily_trending_feed_slots/,
  );
  assert.match(
    wallTextFailureRecoveryMigration,
    /wall_text_retry_key uuid/,
  );
  assert.match(
    wallTextFailureRecoveryMigration,
    /wall_text_creatives_text_content_chk[\s\S]*status = 'failed'/,
  );
  assert.match(
    wallTextFailureRecoveryMigration,
    /create or replace function public\.restart_failed_daily_trending_feed_slots/,
  );
});

test("keeps the per-feed Carousel binding index for historic-row compatibility", () => {
  assert.match(
    progressiveDeliveryMigration,
    /drop index if exists public\.daily_trending_feed_slots_carousel_assignment_uidx/,
  );
  assert.match(
    progressiveDeliveryMigration,
    /create unique index if not exists daily_trending_feed_slots_feed_carousel_assignment_uidx[\s\S]*\(feed_id, carousel_assignment_id\)/,
  );
  assert.match(
    progressiveDeliveryMigration,
    /used_slot\.feed_id = p_feed_id[\s\S]*used_slot\.carousel_assignment_id = candidate\.assignment_id/,
  );
});

test("derives feed status from slots so stale failure metadata cannot hide ready content", () => {
  assert.match(
    progressiveDeliveryMigration,
    /when exists \([\s\S]*slot\.state = 'ready'[\s\S]*then 'ready'/,
  );
  assert.match(
    progressiveDeliveryMigration,
    /with derived_status as \([\s\S]*update public\.daily_trending_feeds as feed/,
  );
});

test("preserves a current ready Hook during refills and reopens only stale current slots", () => {
  assert.match(
    hookAssignmentIntegrityMigration,
    /create trigger preserve_current_daily_hook_assignment_on_supersede/i,
  );
  assert.match(
    hookAssignmentIntegrityMigration,
    /old\.state = 'active'[\s\S]*new\.state = 'superseded'[\s\S]*slot\.hook_video_assignment_id = old\.id[\s\S]*slot\.state = 'ready'/i,
  );
  assert.match(
    hookAssignmentIntegrityMigration,
    /feed\.local_date = \(now\(\) at time zone feed\.timezone\)::date/i,
  );
  assert.match(
    hookAssignmentIntegrityMigration,
    /update public\.daily_trending_feed_slots as slot[\s\S]*hook_video_assignment_id = null,[\s\S]*state = 'planned'[\s\S]*assignment\.state = 'superseded'/i,
  );
  assert.doesNotMatch(
    hookAssignmentIntegrityMigration,
    /delete from public\.user_hook_video_assignments/i,
  );
});

test("repairs a dangling ready slot without replacing decided content", () => {
  assert.match(
    deliveryHardeningMigration,
    /create or replace function public\.reconcile_daily_trending_feed_slot_integrity/,
  );
  assert.match(
    deliveryHardeningMigration,
    /slot\.state = 'ready'[\s\S]*state = 'planned'/,
  );
  assert.match(
    deliveryHardeningMigration,
    /Decided content is never replaced/,
  );
  assert.match(
    deliveryHardeningMigration,
    /p_hook_video_provider_resolved[\s\S]*not \(slot\.hook_video_assignment_id = any\(p_hook_video_assignment_ids\)\)/,
  );
  assert.match(
    unifiedFeedDatabase,
    /reconcileDailyTrendingFeedSlotIntegrity[\s\S]*reconcile_daily_trending_feed_slot_integrity/,
  );
  assert.match(
    unifiedFeed,
    /reconcileDailyTrendingFeedSlotIntegrity[\s\S]*attachDailyTrendingAssignments/,
  );
});

test("keeps a ready daily assignment readable across mutable source changes", () => {
  assert.match(unifiedFeed, /pinnedAssignmentIds: pinnedHookAssignmentIds/);
  assert.match(unifiedFeed, /pinnedAssignmentIds: pinnedWallTextAssignmentIds/);
  assert.match(
    readFileSync("lib/trending/hook-video-db.ts", "utf8"),
    /suggestion\.prompt_version !== params\.promptVersion[\s\S]*!pinnedAssignmentIds\.has\(assignment\.id\)/,
  );
  assert.match(
    readFileSync("lib/trending/wall-text-db.ts", "utf8"),
    /availableSourceMediaAssetIds[\s\S]*asset\.source_media_asset_id[\s\S]*!availableSourceMediaAssetIds\.has\(asset\.source_media_asset_id\)/,
  );
});

test("reconciles completed worker output without another browser feed request", () => {
  assert.match(
    completedFeedReconciliation,
    /ensureUnifiedTrendingDailyFeed\(/,
  );
  assert.match(
    trendingReconciliationRoute,
    /reconcileCompletedTrendingFeedForUser\(/,
  );
  assert.match(
    trendingReconciliationRoute,
    /verifyInternalFinalizationRequest/,
  );
  assert.match(
    trendingReconciliationWorker,
    /RECONCILIATION_PATH = "\/api\/internal\/trending\/reconcile"/,
  );
  assert.match(
    trendingReconciliationWorker,
    /createWorkerScheduleFinalizationSignature/,
  );
});

test("persists failed post-completion reconciliation until the server can continue the feed", () => {
  assert.match(
    durableReconciliationMigration,
    /create table if not exists public\.trending_feed_reconciliation_outbox/,
  );
  assert.match(
    durableReconciliationMigration,
    /create trigger enqueue_completed_trending_feed_reconciliation[\s\S]*new\.status = 'completed'/,
  );
  assert.match(
    durableReconciliationMigration,
    /claim_due_trending_feed_reconciliations[\s\S]*for update skip locked/,
  );
  assert.match(
    durableReconciliationMigration,
    /reschedule_trending_feed_reconciliation[\s\S]*next_attempt_at = now\(\) \+ make_interval/,
  );
  assert.match(
    workerProcessor,
    /claimTrendingFeedReconciliation[\s\S]*rescheduleTrendingFeedReconciliation/,
  );
  assert.match(
    recoveryRoute,
    /claimDueTrendingFeedReconciliations[\s\S]*reconcileCompletedTrendingFeedForUser[\s\S]*rescheduleTrendingFeedReconciliation/,
  );
});

test("never marks a daily feed complete when a promised position is missing", () => {
  assert.match(
    durableReconciliationMigration,
    /mark_daily_trending_feed_slot_decided[\s\S]*count\(\*\)[\s\S]*feed\.daily_limit[\s\S]*remaining_slot\.state <> 'decided'[\s\S]*then 'completed'/,
  );
  assert.match(
    durableReconciliationMigration,
    /list_current_trending_feed_integrity_repairs[\s\S]*feed\.local_date = \(now\(\) at time zone feed\.timezone\)::date[\s\S]*count\(\*\)[\s\S]*<> feed\.daily_limit/,
  );
  assert.match(
    recoveryRoute,
    /listCurrentTrendingFeedIntegrityRepairs[\s\S]*repairIncompleteTrendingFeeds[\s\S]*reconcileCompletedTrendingFeedForUser/,
  );
});

test("claims stale unassigned slots even when the physical slot count is correct", () => {
  assert.match(recoveryMigration, /list_due_daily_trending_feed_repairs/);
  assert.match(
    recoveryMigration,
    /state in \('planned', 'preparing', 'failed'\)[\s\S]*carousel_assignment_id is null[\s\S]*updated_at < now\(\)/,
  );
  assert.match(recoveryMigration, /for update skip locked/);
  assert.match(recoveryMigration, /recovery_attempt_count < greatest/);
  assert.match(unifiedFeedDatabase, /listDueTrendingFeedRepairs/);
  assert.match(recoveryRoute, /listDueTrendingFeedRepairs[\s\S]*finishTrendingFeedRepair/);
});

test("bounds repeated recovery and preserves a terminal diagnostic", () => {
  assert.match(recoveryMigration, /finish_daily_trending_feed_repair/);
  assert.match(recoveryMigration, /recovery_attempt_count >= greatest/);
  assert.match(recoveryMigration, /list_current_trending_feed_integrity_repairs[\s\S]*recovery_attempt_count < 3/);
  assert.match(recoveryMigration, /reset_daily_trending_feed_recovery_on_slot_change/);
  assert.match(recoveryMigration, /old\.state = 'failed' and new\.state = 'planned'/);
  assert.match(recoveryMigration, /state = 'failed'/);
  assert.match(recoveryMigration, /last_recovery_error/);
  assert.match(
    recoveryMigration,
    /last_error = case[\s\S]*stale_count > 0[\s\S]*Daily Trending preparation stopped/,
  );
});

test("stores an exact combined daily allowance for the renamed billing plans", () => {
  assert.match(
    migration,
    /where plan_key = 'pro'[\s\S]*values \('creator', 'Growth', 10, 50, true\)/,
  );
  assert.match(
    migration,
    /display_name = 'Starter',[\s\S]*daily_trending_limit = 20/,
  );
  assert.match(
    migration,
    /create table if not exists public\.daily_trending_feeds/,
  );
  assert.match(
    migration,
    /create table if not exists public\.daily_trending_feed_slots/,
  );
  assert.match(migration, /unique \(user_id, local_date\)/);
  assert.match(migration, /unique \(feed_id, position\)/);
});

test("enforces the content mix and protects its server-only tables", () => {
  assert.match(
    fullFormatMixMigration,
    /wall_text_percent between 0 and 100[\s\S]*hook_video_percent between 0 and 100[\s\S]*carousel_percent \+ wall_text_percent \+ hook_video_percent = 100/,
  );
  for (const table of [
    "trending_content_mix_preferences",
    "daily_trending_feeds",
    "daily_trending_feed_slots",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(
      migration,
      new RegExp(`revoke all privileges on table public\\.${table}[\\s\\S]*from anon, authenticated`),
    );
  }
  assert.match(
    migration,
    /save_trending_content_mix_preference[\s\S]*pg_advisory_xact_lock/,
  );
});

test("retires a daily slot after a swipe and never schedules a replacement", () => {
  assert.match(decisionRoute, /markDailyTrendingSlotDecided/);
  assert.doesNotMatch(decisionRoute, /replenishTrendingFormatAfterDecision/);
  assert.match(
    migration,
    /mark_daily_trending_feed_slot_decided[\s\S]*set state = 'decided'/,
  );
});

test("keeps an existing daily pack immutable after an authenticated mix update", () => {
  assert.match(contentMixRoute, /requireFirebaseUser\(request\)/);
  assert.match(contentMixRoute, /wall_text: z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)/);
  assert.match(contentMixRoute, /hook_video: z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)/);
  assert.doesNotMatch(contentMixRoute, /allocateUnboundTrendingSlots/);
  assert.doesNotMatch(contentMixRoute, /replanDailyTrendingUnboundSlots/);
  assert.match(contentMixRoute, /applied: currentFeed \? "next_day" : "today"/);
  assert.match(contentMixRoute, /Today's complete pack stays unchanged/);
  assert.match(contentMixRoute, /editable: true/);
  assert.doesNotMatch(contentMixRoute, /entitlement\.planKey === "free"/);
  assert.doesNotMatch(contentMixRoute, /fixed daily mix/);
});
