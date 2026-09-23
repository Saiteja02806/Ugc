import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260923193000_stage_fact_matched_wall_plans_for_pro.sql",
    import.meta.url,
  ),
  "utf8",
);
const planLaunch = readFileSync(
  new URL("./wall-text-content-plan-generation-job.ts", import.meta.url),
  "utf8",
);
const backfillScript = readFileSync(
  new URL(
    "../../scripts/start-wall-text-fact-matched-pro-backfill.mjs",
    import.meta.url,
  ),
  "utf8",
);
const completionMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260908173235_wall_text_early_delivery.sql",
    import.meta.url,
  ),
  "utf8",
);

test("stages a fact-matched replacement for active Pro only without interrupting the active plan", () => {
  assert.match(
    migration,
    /start_wall_text_fact_matched_plan_replacement_v1[\s\S]*subscription\.status = 'active'[\s\S]*subscription\.plan_key = 'starter'/i,
  );
  assert.match(
    migration,
    /Free and Creator users are[\s\S]*rejected/i,
  );
  assert.match(
    migration,
    /plan\.status = 'generating'[\s\S]*plan\.planner_prompt_version = btrim\(p_planner_prompt_version\)[\s\S]*RETURN v_existing_replacement/i,
  );
  assert.match(
    migration,
    /plan\.status = 'active'[\s\S]*position\('fact-first' IN v_active_plan\.planner_prompt_version\) > 0[\s\S]*RETURN v_active_plan/i,
  );
  assert.match(
    migration,
    /CASE plan\.status[\s\S]*WHEN 'active' THEN 0[\s\S]*WHEN 'generating' THEN 1/i,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.start_wall_text_fact_matched_plan_replacement_v1[\s\S]*GRANT EXECUTE[\s\S]*service_role/i,
  );
  assert.doesNotMatch(
    migration,
    /^\s*(?:delete\s+from|truncate(?:\s+table)?|drop\s+table)\b/im,
  );
});

test("uses the normal durable planner job and switches only after all 200 items complete", () => {
  assert.match(
    planLaunch,
    /startWallTextFactMatchedPlanReplacementGeneration[\s\S]*startWallTextFactMatchedPlanReplacement[\s\S]*dispatchWallTextContentPlanGeneration/i,
  );
  assert.match(
    planLaunch,
    /createAndDispatchBackgroundJob[\s\S]*wall_text_content_plan_generation[\s\S]*attachWallTextContentPlanGenerationJob/i,
  );
  assert.match(
    completionMigration,
    /v_item_count <> v_plan\.target_item_count[\s\S]*wall_text_content_plan_incomplete[\s\S]*update public\.wall_text_content_plans as prior_plan[\s\S]*status = 'superseded'[\s\S]*update public\.wall_text_content_plans as plan[\s\S]*status = 'active'/i,
  );
});

test("locks the one-time customer mutation to the requested verified Pro account", () => {
  assert.match(backfillScript, /const execute = process\.argv\.includes\("--execute"\)/);
  assert.match(backfillScript, /Refusing to start customer plan replacements without --yes/);
  assert.match(backfillScript, /databaseWrites: false,[\s\S]*dryRun: true/);
  assert.match(backfillScript, /const TARGET_EMAIL = "vtu19403@veltech\.edu\.in"/);
  assert.match(backfillScript, /findFirebaseUserByEmail\(TARGET_EMAIL\)/);
  assert.match(backfillScript, /!subscription\.isActive \|\| subscription\.planKey !== "starter"/);
  assert.match(backfillScript, /startWallTextFactMatchedPlanReplacementGeneration\(\{ profile \}\)/);
});
