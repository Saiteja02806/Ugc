import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceRoot = process.cwd();
const migration = read("supabase/migrations/20260810174540_add_carousel_content_grammar.sql");
const preparation = read("lib/carousel/prepare-business-profile.ts");
const appGenerator = read("lib/carousel/generate-carousel.ts");
const workerGenerator = read("worker/src/lib/carousel-generate.ts");
const workerStore = read("worker/src/lib/supabase.ts");

test("adds content grammar state only to existing carousel generations", () => {
  assert.match(migration, /alter table public\.carousel_generations/i);
  assert.doesNotMatch(migration, /create table(?: if not exists)? public\.business_profiles/i);

  for (const column of [
    "content_format_id",
    "hook_family_id",
    "content_grammar_version",
    "content_selector_version",
    "content_history_snapshot",
    "content_audience_id",
    "content_problem_id",
    "content_goal_id",
    "content_topic_id",
    "content_topic",
    "content_angle",
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}\\b`, "i"));
  }

  assert.match(migration, /jsonb_array_length\(content_history_snapshot\) <= 10/i);
  assert.match(migration, /separate from format, which stores the canvas ratio/i);
  assert.match(
    migration,
    /business_profile_id,\s*created_at desc,\s*candidate_index desc[\s\S]*generation_source = 'auto_generated'[\s\S]*status in \('processing', 'completed'\)/i,
  );
  assert.match(
    migration,
    /content_format_id is not null[\s\S]*content_grammar_version is not null[\s\S]*content_selector_version is not null/i,
  );
});

test("automatic generation derives and reserves grammar from the current onboarding profile", () => {
  assert.match(preparation, /getBusinessProfileForUser/);
  assert.match(
    preparation,
    /buildCarouselBusinessContentContext\(\s*params\.businessContext/,
  );
  assert.match(preparation, /businessContext:\s*profile\.context/);
  assert.match(preparation, /selectCarouselContentAssignments/);
  assert.match(preparation, /reserveCarouselContentAssignment/);
  assert.doesNotMatch(preparation, /createBusinessProfile/);

  assert.match(appGenerator, /contentFormatId: generation\.contentFormatId/);
  assert.match(appGenerator, /getBusinessProfileForUser/);
  assert.match(appGenerator, /listCarouselBatchContentHistory/);
  assert.match(appGenerator, /analysis: businessAnalysis/);
  assert.match(appGenerator, /recentHistory,/);
  assert.match(workerGenerator, /contentFormatId: generation\.content_format_id/);
  assert.match(workerGenerator, /getBusinessProfileForCarousel/);
  assert.match(workerGenerator, /listCarouselBatchContentHistory/);
  assert.match(workerGenerator, /analysis: businessAnalysis/);
  assert.match(workerGenerator, /recentHistory,/);
  assert.match(
    workerStore,
    /from\(BUSINESS_PROFILES_TABLE\)[\s\S]*eq\("id", params\.businessProfileId\)[\s\S]*eq\("user_id", params\.userId\)[\s\S]*eq\("profile_version", params\.businessProfileVersion\)/,
  );
  assert.match(
    workerStore,
    /eq\("generation_batch_id", params\.generationBatchId\)[\s\S]*not\("content_topic_id", "is", null\)/,
  );
});

function read(relativePath: string) {
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}
