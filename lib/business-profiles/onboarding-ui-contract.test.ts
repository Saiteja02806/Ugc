import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const onboarding = readProjectFile(
  "components/business-profiles/business-profile-onboarding.tsx",
);
const authGuard = readProjectFile("components/auth/auth-guard.tsx");
const profileGateQuery = readProjectFile(
  "lib/business-profiles/profile-gate-query.ts",
);
const onboardingPage = readProjectFile("app/onboarding/page.tsx");
const setup = readProjectFile("lib/business-profiles/setup.ts");

test("the onboarding route bypasses only the profile gate and cannot loop", () => {
  assert.match(onboardingPage, /<AuthGuard requireBusinessProfile=\{false\}>/);
  assert.match(authGuard, /requireBusinessProfile = true/);
  assert.match(
    profileGateQuery,
    /data\.profile\?\.onboardingComplete === true/,
  );
  assert.match(
    authGuard,
    /profileGateQuery\.data\?\.onboardingComplete === false/,
  );
  assert.match(authGuard, /router\.replace\("\/onboarding"\)/);
});

test("the final approved flow has exactly information, identity, and goal", () => {
  for (const requiredCopy of [
    "Choose the source you trust most",
    "Website",
    "Mobile app",
    "Manual",
    "Add your business name",
    "Business logo",
    "What do you want to achieve?",
    "Enter Trending",
  ]) {
    assert.match(onboarding, new RegExp(escapeRegExp(requiredCopy)));
  }

  for (const removedQuestion of [
    "team size",
    "monthly revenue",
    "job role",
    "content theme",
    "business model",
    "industry pack",
    "product video",
    "product type",
    "confirm your business profile",
  ]) {
    assert.doesNotMatch(onboarding, new RegExp(removedQuestion, "i"));
  }
});

test("the onboarding remains screen-by-screen without tab-like navigation", () => {
  assert.doesNotMatch(onboarding, /function OnboardingProgress/);
  assert.doesNotMatch(onboarding, /aria-label="Onboarding progress"/);
  assert.doesNotMatch(onboarding, /const onboardingSteps/);
});

test("the original three business-information routes keep their payloads", () => {
  assert.match(onboarding, /const payload = \{ aiIdeContext, intakeType, manual, websiteUrl \}/);
  assert.match(onboarding, /value: \"mobile_app_ai_prompt\"/);
  assert.match(onboarding, /Enter the business facts/);
  assert.match(setup, /buildManualBusinessAnalysis\(input\.manual\)/);
});

test("identity saves before the required primary goal completes onboarding", () => {
  assert.match(onboarding, /action: \"save_identity\"/);
  assert.match(onboarding, /logoStorageKey: nextLogoStorageKey/);
  assert.match(
    onboarding,
    /action: \"complete\"[\s\S]+primaryGoals[\s\S]+Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/,
  );
  assert.match(onboarding, /type=\"checkbox\"/);
  assert.match(onboarding, /primaryGoals\.includes\(option\.value\)/);
  assert.match(onboarding, /disabled=\{isSaving \|\| primaryGoals\.length === 0\}/);
  assert.match(onboarding, /router\.replace\("\/dashboard"\)/);
});

test("goal choices autosave to the owner profile before final completion", () => {
  assert.match(onboarding, /action: "save_goal_draft"/);
  assert.match(onboarding, /const goalsToSave = primaryGoals/);
  assert.match(onboarding, /setGoalDirty\(false\)/);
  assert.match(onboarding, /}, 700\)/);
});

test("analysis keeps the first form visible while its controls are disabled", () => {
  assert.match(onboarding, /const isBusy = status === \"saving\" \|\| isAnalyzing/);
  assert.match(onboarding, /<BusinessInformationStep[\s\S]*isSaving=\{isBusy\}/);
  assert.doesNotMatch(onboarding, /function AnalysisState/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
