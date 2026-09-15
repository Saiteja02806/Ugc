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

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Could not find ${start}`);
  assert.notEqual(endIndex, -1, `Could not find ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Business Context accepts only versioned draft, re-analysis, and apply operations", () => {
  assert.match(route, /z\.discriminatedUnion\("action"/);
  assert.match(route, /action: z\.literal\("save_draft"\)[\s\S]*expectedDraftUpdatedAt[\s\S]*expectedProfileVersion/);
  assert.match(route, /action: z\.literal\("reanalyze"\)[\s\S]*expectedDraftUpdatedAt[\s\S]*source: z\.string\(\)\.trim\(\)\.min\(20\)/);
  assert.match(route, /action: z\.literal\("apply"\)[\s\S]*expectedDraftUpdatedAt[\s\S]*expectedProfileVersion/);
  assert.match(route, /profile\.profileVersion !== body\.data\.expectedProfileVersion/);
  assert.match(route, /applyPrimaryGoals\(body\.data\.context, profile\.primaryGoals\)/);
  assert.match(route, /analyzeBusinessDescription\(body\.data\.source\)/);
});

test("saving a draft cannot change active Business Context or its version", () => {
  const saveDraft = sourceBetween(
    db,
    "export async function saveBusinessContextDraft",
    "export async function applyBusinessContextDraft",
  );

  assert.match(saveDraft, /business_context_draft_base_version: params\.profile\.profileVersion/);
  assert.match(saveDraft, /business_context_draft_json: params\.context/);
  assert.match(saveDraft, /\.eq\("profile_version", params\.profile\.profileVersion\)/);
  assert.match(saveDraft, /query\.eq\("business_context_draft_updated_at", params\.expectedDraftUpdatedAt\)/);
  assert.match(saveDraft, /query\.is\("business_context_draft_updated_at", null\)/);
  assert.doesNotMatch(saveDraft, /context_json:/);
  assert.doesNotMatch(saveDraft, /profile_version:/);
});

test("applying requires the exact saved draft and creates one new immutable version", () => {
  const applyDraft = sourceBetween(
    db,
    "export async function applyBusinessContextDraft",
    "export async function completeTrendingWalkthroughForUser",
  );

  assert.match(applyDraft, /businessContextDraftBaseVersion !== params\.expectedProfileVersion/);
  assert.match(applyDraft, /businessContextDraftUpdatedAt !== params\.expectedDraftUpdatedAt/);
  assert.match(applyDraft, /assertBusinessContextCandidateReady\(draft\)/);
  assert.match(applyDraft, /context_json: draft/);
  assert.match(applyDraft, /profile_version: params\.expectedProfileVersion \+ 1/);
  assert.match(applyDraft, /business_context_draft_base_version: null/);
  assert.match(applyDraft, /business_context_draft_json: null/);
  assert.match(applyDraft, /\.eq\("business_context_draft_base_version", params\.expectedProfileVersion\)/);
  assert.match(applyDraft, /\.eq\("business_context_draft_updated_at", params\.expectedDraftUpdatedAt\)/);
});

test("only a fact-ready exact draft can apply, without prebuilding today's feed", () => {
  const applyBranch = sourceBetween(
    route,
    "const applied = await applyBusinessContextDraft",
    "function toClientContext",
  );

  assert.doesNotMatch(applyBranch, /prebuildTrendingAfterOnboarding/);
  assert.match(applyBranch, /next local Trending day/);
  assert.match(route, /prepareBusinessContextCandidate/);
  assert.match(settingsPanel, /Saving or re-analyzing creates a draft only/);
  assert.match(settingsPanel, /Needs factual anchors/);
  assert.match(settingsPanel, /Apply to future content/);
  assert.match(settingsPanel, /disabled=\{busyAction !== null \|\| !canApplyDraft\}/);
});

test("list fields preserve raw typing and normalize only on Save draft", () => {
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
