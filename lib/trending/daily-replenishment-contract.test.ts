import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260717100000_add_daily_carousel_replenishment.sql",
    import.meta.url,
  ),
  "utf8",
);
const terminalCarouselRecoveryMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260828100000_reconcile_terminal_carousel_generation_failures.sql",
    import.meta.url,
  ),
  "utf8",
);
const businessProfileDatabase = readFileSync(
  new URL("../business-profiles/db.ts", import.meta.url),
  "utf8",
);
const replenishmentSweep = readFileSync(
  new URL("./daily-replenishment-sweep.ts", import.meta.url),
  "utf8",
);
const replenishmentSweepState = readFileSync(
  new URL("./daily-replenishment-sweep-state.ts", import.meta.url),
  "utf8",
);
const replenishmentRoute = readFileSync(
  new URL(
    "../../app/api/internal/carousels/replenish/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const carouselDatabase = readFileSync(
  new URL("../carousel/db.ts", import.meta.url),
  "utf8",
);
const dailyFeed = readFileSync(
  new URL("./daily-feed.ts", import.meta.url),
  "utf8",
);

test("migration enforces refill and generation idempotency contracts", () => {
  assert.match(
    migration,
    /unique\s*\(feed_id,\s*business_profile_id,\s*business_profile_version\)/i,
  );
  assert.match(
    migration,
    /create unique index[^;]+carousel_generations_batch_candidate_uidx[^;]+generation_batch_id,\s*candidate_index/i,
  );
  assert.match(
    migration,
    /carousel_generations_initial_profile_candidate_uidx[^;]+origin_daily_feed_id is null/i,
  );
  assert.match(
    migration,
    /background_jobs_idempotency_key_uidx[^;]+idempotency_key/i,
  );
  assert.match(migration, /last_delivery_at\s+timestamptz/i);
  assert.match(
    migration,
    /revoke all privileges on table public\.daily_carousel_refill_batches\s+from service_role/i,
  );
  assert.match(
    migration,
    /generation\.trigger_run_id\s*=\s*job\.id::text[^;]+job\.job_type\s*=\s*'generate_carousel'/i,
  );
  assert.match(
    migration,
    /order by user_id,\s*created_at desc,\s*id desc/i,
  );
  assert.match(
    migration,
    /insert_daily_carousel_feed_items_if_profile_current[\s\S]+profile\.profile_version\s*=\s*p_business_profile_version[\s\S]+for share/i,
  );
  assert.match(
    migration,
    /create or replace function public\.assert_business_profile_version_current[\s\S]+profile\.profile_version\s*=\s*p_business_profile_version[\s\S]+for share/i,
  );
  assert.match(
    migration,
    /create or replace function public\.reserve_daily_carousel_refill_batch_if_profile_current[\s\S]+assert_business_profile_version_current[\s\S]+on conflict \(feed_id, business_profile_id, business_profile_version\)[\s\S]+greatest/i,
  );
  assert.match(
    migration,
    /assignment\.business_profile_version is distinct from p_business_profile_version/i,
  );
  assert.match(
    dailyFeed,
    /\.rpc\(\s*"insert_daily_carousel_feed_items_if_profile_current"/,
  );
  assert.match(
    dailyFeed,
    /\.rpc\(\s*"reserve_daily_carousel_refill_batch_if_profile_current"/,
  );
  assert.match(
    dailyFeed,
    /generationsNeedingDelivery\.length > 0[\s\S]+assertBusinessProfileVersionCurrent[\s\S]+enqueueProcessingCarouselCandidates/,
  );
  assert.doesNotMatch(
    dailyFeed,
    /\.from\(DAILY_CAROUSEL_REFILL_BATCHES_TABLE\)[^;]+\.(insert|update)\(/,
  );
  assert.match(
    dailyFeed,
    /isBusinessProfileVersionChangedError[\s\S]+markAssignmentsFailed\([\s\S]+filter\(\(\{ created \}\) => created\)/,
  );
});

test("signed replenishment route persists and resumes every cursor", () => {
  assert.match(replenishmentRoute, /verifyCarouselReplenishmentSignature/);
  assert.match(replenishmentRoute, /validateCarouselReplenishmentContentLength/);
  assert.match(replenishmentRoute, /requestedCycleId:\s*cycleId/);
  assert.match(replenishmentRoute, /replenishTrendingCarouselFeedCyclePage/);
  assert.doesNotMatch(replenishmentRoute, /payload\.cursor/);
  assert.doesNotMatch(replenishmentRoute, /\.trigger\(/);
  assert.match(
    businessProfileDatabase,
    /not\("trending_timezone",\s*"is",\s*null\)/,
  );
  assert.doesNotMatch(replenishmentSweep, /trendingTimezone\s*\?\?\s*"UTC"/);
  assert.match(
    replenishmentSweep,
    /claimDailyCarouselReplenishmentCycle[\s\S]+checkpoint\.cursor[\s\S]+advanceDailyCarouselReplenishmentCycle/,
  );
  assert.match(
    replenishmentSweepState,
    /claim_daily_carousel_replenishment_cycle/,
  );
  assert.match(
    replenishmentSweepState,
    /advance_daily_carousel_replenishment_cycle/,
  );
});

test("migration serializes sweep checkpoint claims and compare-and-set advances", () => {
  assert.match(
    migration,
    /create table if not exists public\.daily_carousel_replenishment_sweep_state/,
  );
  assert.match(
    migration,
    /claim_daily_carousel_replenishment_cycle[\s\S]+for update[\s\S]+v_status = 'active'/i,
  );
  assert.match(
    migration,
    /advance_daily_carousel_replenishment_cycle[\s\S]+v_cursor is distinct from p_expected_cursor[\s\S]+daily_carousel_replenishment_sweep_cursor_changed/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.daily_carousel_replenishment_sweep_state\s+from public, anon, authenticated, service_role/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.claim_daily_carousel_replenishment_cycle\(text\)\s+to service_role/i,
  );
});

test("a stale scheduled retry cannot replace a newer completed sweep", () => {
  assert.match(
    migration,
    /v_requested_cycle_at\s*:=\s*p_requested_cycle_id::timestamptz/i,
  );
  assert.match(
    migration,
    /v_requested_cycle_at\s*<=\s*v_cycle_id::timestamptz[\s\S]+return query select v_cycle_id, v_cursor, v_status/i,
  );
});

test("daily inventory walks stable filtered pages instead of stopping at 50 rows", () => {
  assert.match(
    carouselDatabase,
    /getAutoCarouselGenerationStatusPageForUser[\s\S]+generation_source",\s*"auto_generated"[\s\S]+\.in\("status", statuses\)/,
  );
  assert.match(
    carouselDatabase,
    /created_at\.lt[\s\S]+created_at\.eq[\s\S]+id\.lt[\s\S]+\.order\("created_at", \{ ascending: false \}\)[\s\S]+\.order\("id", \{ ascending: false \}\)/,
  );
  assert.match(
    dailyFeed,
    /cursor = page\.nextCursor;[\s\S]+while \([\s\S]*cursor[\s\S]*selected\.length < params\.count/,
  );
  assert.doesNotMatch(dailyFeed, /FRESH_CANDIDATE_SCAN_LIMIT/);
  assert.match(
    dailyFeed,
    /getExistingVisibleConceptFingerprints[\s\S]+isVisibleCarouselConceptFingerprint/,
  );
  assert.match(
    dailyFeed,
    /existingAssignmentIds[\s\S]+updateAssignmentsLastAssignedDate[\s\S]+currentDayOrphans[\s\S]+listUnpersistedCurrentDayAssignments/,
  );
  assert.doesNotMatch(dailyFeed, /listCarryAssignments/);
});

test("terminal daily Carousel failures wake durable reconciliation immediately", () => {
  assert.match(
    terminalCarouselRecoveryMigration,
    /new\.status in \('failed', 'cancelled'\)[\s\S]+new\.job_type = 'generate_carousel'/i,
  );
  assert.match(
    terminalCarouselRecoveryMigration,
    /carousel_generations[\s\S]+trigger_run_id = new\.id::text[\s\S]+origin_daily_feed_id is not null/i,
  );
  assert.match(
    terminalCarouselRecoveryMigration,
    /insert into public\.trending_feed_reconciliation_outbox[\s\S]+on conflict \(source_job_id\) do nothing/i,
  );
  assert.match(
    dailyFeed,
    /hasTerminalFailure\s*=\s*await hasTerminalDailyCarouselFailure[\s\S]+canExtendDailyCarouselRefill\(\{[\s\S]+hasTerminalFailure/,
  );
});
