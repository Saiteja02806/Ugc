import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260808114907_add_required_business_profile_onboarding.sql",
  "utf8",
);
const storage = readFileSync("lib/business-profiles/db.ts", "utf8");
const profileRoute = readFileSync("app/api/business-profile/route.ts", "utf8");
const logoValidation = readFileSync("lib/business-profiles/logo.ts", "utf8");
const logoUploadRoute = readFileSync(
  "app/api/business-profile/logo/upload-url/route.ts",
  "utf8",
);
const v3Migration = readFileSync(
  "supabase/migrations/20260808114924_add_business_identity_and_primary_goal.sql",
  "utf8",
);
const multiGoalMigration = readFileSync(
  "supabase/migrations/20260809114404_add_multiple_business_profile_goals.sql",
  "utf8",
);

test("onboarding persistence defaults analyzed profiles to incomplete", () => {
  assert.match(migration, /onboarding_status text not null default 'incomplete'/i);
  assert.match(migration, /onboarding_version integer not null default 0/i);
  assert.match(migration, /onboarding_completed_at timestamptz/i);
  assert.match(storage, /onboarding_status: "incomplete"/);
  assert.match(storage, /onboarding_version: 0/);
});

test("the v2 backfill depends only on a non-empty business name", () => {
  assert.match(migration, /context_json ->> 'businessName'/);
  assert.match(migration, /then 2/);

  for (const removedRequirement of [
    "campaignPurposes",
    "businessModel",
    "targetAudience",
    "brandTone",
  ]) {
    assert.doesNotMatch(migration, new RegExp(removedRequirement));
  }
});

test("v3 introduced the original goal and optional validated logo", () => {
  assert.match(v3Migration, /primary_goal text/i);
  assert.match(v3Migration, /business_profiles_primary_goal_check/i);
  assert.match(v3Migration, /logo_storage_key text/i);
  assert.match(v3Migration, /logo_file_size_bytes between 1 and 2097152/i);
  assert.match(v3Migration, /logo_width between 64 and 4096/i);
  assert.match(v3Migration, /logo_height between 64 and 4096/i);
  assert.match(v3Migration, /logos remain optional/i);
  assert.doesNotMatch(v3Migration, /update public\.business_profiles[\s\S]*primary_goal/i);
});

test("multiple goals are stored as a validated array with a legacy backfill", () => {
  assert.match(multiGoalMigration, /primary_goals text\[\] not null/i);
  assert.match(multiGoalMigration, /set primary_goals = array\[primary_goal\]/i);
  assert.match(multiGoalMigration, /business_profiles_primary_goals_values_check/i);
  assert.match(multiGoalMigration, /primary_goals <@ array/i);
  assert.match(multiGoalMigration, /cardinality\(primary_goals\) >= 1/i);
});

test("incomplete goal choices are saved without completing onboarding", () => {
  assert.match(profileRoute, /action: z\.literal\("save_goal_draft"\)/);
  assert.match(profileRoute, /saveBusinessProfileOnboardingGoalDraft/);
  assert.match(storage, /primary_goal: primaryGoals\[0\] \?\? null/);
  assert.match(storage, /primary_goals: primaryGoals/);

  const goalDraftFunction = storage.slice(
    storage.indexOf("export async function saveBusinessProfileOnboardingGoalDraft"),
    storage.indexOf("export async function saveBusinessProfileOnboardingIdentity"),
  );
  assert.match(goalDraftFunction, /\.eq\("onboarding_status", "incomplete"\)/);
  assert.match(goalDraftFunction, /\.eq\("profile_version", params\.profile\.profileVersion\)/);
  assert.doesNotMatch(goalDraftFunction, /onboarding_status:|profile_version:/);
});

test("logo uploads are tenant-owned and verified before persistence", () => {
  assert.match(logoUploadRoute, /requireFirebaseUser\(request\)/);
  assert.match(logoUploadRoute, /BUSINESS_LOGO_MAX_BYTES/);
  assert.match(logoUploadRoute, /createSignedPutUrl/);
  assert.match(logoValidation, /createHash\("sha256"\)\.update\(userId\)/);
  assert.match(logoValidation, /isOwnedBusinessLogoStorageKey/);
  assert.match(logoValidation, /headStorageObject/);
  assert.match(logoValidation, /range: `bytes=0-\$\{BUSINESS_LOGO_MAX_BYTES\}`/);
  assert.match(logoValidation, /sharp\(buffer, \{ failOn: "error" \}\)\.metadata\(\)/);
});

test("daily generation requires persisted and runtime completeness", () => {
  assert.match(storage, /\.eq\("onboarding_status", "completed"\)/);
  assert.match(storage, /\.gte\("onboarding_version", BUSINESS_PROFILE_ONBOARDING_VERSION\)/);
  assert.match(storage, /filter\(isBusinessProfileOnboardingComplete\)/);
});
