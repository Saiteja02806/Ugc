import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const db = readFileSync("lib/business-profiles/db.ts", "utf8");
const route = readFileSync("app/api/business-context/route.ts", "utf8");
const settingsPanel = readFileSync(
  "components/settings/business-context-settings.tsx",
  "utf8",
);
const settingsForm = readFileSync(
  "lib/business-profiles/business-context-form.ts",
  "utf8",
);
const directApplyMigration = readFileSync(
  "supabase/migrations/20260915160000_apply_business_context_directly.sql",
  "utf8",
);

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Could not find ${start}`);
  assert.notEqual(endIndex, -1, `Could not find ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Business Context accepts a versioned direct apply and optional re-analysis", () => {
  assert.match(route, /z\.discriminatedUnion\("action"/);
  assert.match(route, /action: z\.literal\("save_draft"\)[\s\S]*expectedDraftUpdatedAt[\s\S]*expectedProfileVersion/);
  assert.match(route, /action: z\.literal\("reanalyze"\)[\s\S]*expectedDraftUpdatedAt[\s\S]*source: z\.string\(\)\.trim\(\)\.min\(20\)/);
  assert.match(route, /action: z\.literal\("apply"\)[\s\S]*context: WebsiteBusinessAnalysisSchema[\s\S]*expectedDraftUpdatedAt: draftRevisionSchema\.nullable\(\)[\s\S]*expectedProfileVersion/);
  assert.match(route, /profile\.profileVersion !== body\.data\.expectedProfileVersion/);
  assert.match(route, /applyPrimaryGoals\(body\.data\.context, profile\.primaryGoals\)/);
  assert.match(route, /analyzeBusinessDescription\(body\.data\.source\)/);
});

test("saving a draft cannot change active Business Context or its version", () => {
  const saveDraft = sourceBetween(
    db,
    "export async function saveBusinessContextDraft",
    "export async function applyBusinessContext",
  );

  assert.match(saveDraft, /business_context_draft_base_version: params\.profile\.profileVersion/);
  assert.match(saveDraft, /business_context_draft_json: params\.context/);
  assert.match(saveDraft, /\.eq\("profile_version", params\.profile\.profileVersion\)/);
  assert.match(saveDraft, /query\.eq\("business_context_draft_updated_at", params\.expectedDraftUpdatedAt\)/);
  assert.match(saveDraft, /query\.is\("business_context_draft_updated_at", null\)/);
  assert.doesNotMatch(saveDraft, /context_json:/);
  assert.doesNotMatch(saveDraft, /profile_version:/);
});

test("direct apply validates facts and uses the atomic versioned database write", () => {
  const applyContext = sourceBetween(
    db,
    "export async function applyBusinessContext",
    "export async function completeTrendingWalkthroughForUser",
  );

  assert.match(applyContext, /profile\.profileVersion !== params\.expectedProfileVersion/);
  assert.match(applyContext, /assertBusinessContextCandidateReady\(params\.context\)/);
  assert.match(applyContext, /\.rpc\("apply_business_context_v1"/);
  assert.match(applyContext, /p_expected_draft_updated_at: params\.expectedDraftUpdatedAt/);
  assert.match(applyContext, /p_expected_profile_version: params\.expectedProfileVersion/);
});

test("only a fact-ready context can apply, without prebuilding today's feed", () => {
  const applyBranch = sourceBetween(
    route,
    "const applied = await applyBusinessContext",
    "function toClientContext",
  );

  assert.doesNotMatch(applyBranch, /prebuildTrendingAfterOnboarding/);
  assert.match(applyBranch, /next local Trending day/);
  assert.match(route, /prepareBusinessContextCandidate/);
  assert.match(settingsPanel, /Edit the details below, then apply them when ready/);
  assert.match(settingsPanel, /Needs factual anchors/);
  assert.match(settingsPanel, /Apply changes to future content/);
  assert.match(settingsPanel, /disabled=\{busyAction !== null \|\| !canApplyChanges\}/);
  assert.doesNotMatch(settingsPanel, />\s*Save draft/);
});

test("list fields preserve raw typing and normalize only when applying", () => {
  const listUpdater = sourceBetween(
    settingsPanel,
    "function updateListField",
    "async function runAction",
  );

  assert.match(listUpdater, /setListText/);
  assert.doesNotMatch(listUpdater, /split\(|trim\(/);
  assert.match(settingsPanel, /applyBusinessContextListText\(context, listText\)/);
  assert.match(settingsForm, /split\(\/\\r\?\\n\/u\)/);
  assert.doesNotMatch(settingsForm, /split\(\/\\n\|,\/u\)/);
});

test("direct apply migration preserves the onboarding guard and authorizes only the atomic apply function", () => {
  assert.match(directApplyMigration, /create or replace function public\.guard_background_onboarding_profile_v1/);
  assert.match(directApplyMigration, /current_setting\('ugc\.business_context_writer', true\) is distinct from 'apply_business_context_v1'/);
  assert.match(directApplyMigration, /create or replace function public\.apply_business_context_v1/);
  assert.match(directApplyMigration, /perform set_config\('ugc\.business_context_writer', 'apply_business_context_v1', true\)/);
  assert.match(directApplyMigration, /business_context_draft_json = null/);
  assert.match(directApplyMigration, /business_context_draft_updated_at is not distinct from p_expected_draft_updated_at/);
  assert.match(directApplyMigration, /profile_version = p_expected_profile_version \+ 1/);
  assert.match(directApplyMigration, /grant execute on function public\.apply_business_context_v1/);
});
