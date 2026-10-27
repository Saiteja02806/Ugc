import assert from "node:assert/strict";
import { mock, test } from "node:test";

// Keep the real website processing, quality gate and setup orchestrator. Stub
// external transports/persistence; never call providers or a live database.
let pages, analysis, recovered, saved, stored;
let draft, recoveryCalls, inserts, mutations;
const url = "https://cal.com/";
const moduleUrl = path => new URL(path, import.meta.url);
mock.module(moduleUrl("../website-analysis/firecrawl.ts"), { namedExports: {
  scrapeWebsitePages: async () => pages,
} });
mock.module(moduleUrl("../website-analysis/analyze-business.ts"), { namedExports: {
  analyzeWebsiteBusiness: async () => analysis,
  recoverMissingWebsiteFacts: async () => { recoveryCalls++; return recovered ?? analysis; },
  analyzeBusinessDescription: async () => assert.fail("Website flow must not analyze a manual description"),
} });
mock.module(moduleUrl("../website-analysis/url.ts"), { namedExports: {
  validateWebsiteUrl: async () => ({ url, origin: url, normalizedDomain: "cal.com" }),
  buildImportantPageUrls: () => [],
} });
mock.module(moduleUrl("../website-analysis/supabase.ts"), { namedExports: {
  getWebsiteAnalysisBySourceJobId: async () => stored,
  insertWebsiteAnalysis: async value => { inserts++; saved = value; return "analysis-id"; },
} });
mock.module(moduleUrl("./ai-context.ts"), { namedExports: { parseAiIdeBusinessContext: async () => assert.fail("Unexpected IDE intake") } });
mock.module(moduleUrl("./db.ts"), { namedExports: { saveBusinessProfile: async () => assert.fail("Draft setup must attach before finalizing") } });
mock.module(moduleUrl("./onboarding-drafts.ts"), { namedExports: {
  getOnboardingDraft: async () => draft,
  mutateOnboardingDraft: async (_user, action, payload) => { mutations.push({ action, payload }); return draft; },
  dispatchOnboardingJobs: async () => {},
} });
const { processBusinessProfileSetupJob } = await import("./setup.ts");
const params = { userId: "owner", jobId: "job-id", draftId: "draft-id", sourceRevision: 1,
  input: { experience: "streamlined", intakeType: "website", websiteUrl: url } };
function reset() {
  pages = [{ url, title: "Cal.com | Scheduling", markdown: "Cal.com helps teams schedule meetings." }];
  analysis = { businessName: "Cal.com", productSummary: "Scheduling infrastructure for individuals and teams.", targetAudience: ["Teams"], confidence: "high" };
  recovered = stored = saved = undefined;
  recoveryCalls = inserts = 0; mutations = [];
  draft = { id: "draft-id", source_revision: 1, source_job_id: "job-id" };
}

test("Cal.com URL onboarding persists source-supported facts and attaches its exact draft/job without a repair call", async () => {
  reset();
  const result = await processBusinessProfileSetupJob(params);
  assert.equal(result.analysisId, "analysis-id");
  assert.equal(recoveryCalls, 0);
  assert.equal(inserts, 1);
  assert.equal(saved.analysis.businessName, "Cal.com");
  assert.equal(saved.sourceJobId, "job-id");
  assert.equal(saved.userId, "owner");
  assert.equal("verifiedBusinessName" in saved, false, "Evidence authorization is server-local, not persisted input");
  assert.deepEqual(mutations, [{ action: "attach", payload: { draftId: "draft-id", sourceRevision: 1, jobId: "job-id", analysisId: "analysis-id" } }]);
});

test("repaired domain-brand facts are rechecked against the scraped evidence before persistence", async () => {
  reset();
  recovered = { ...analysis };
  analysis = { ...analysis, businessName: null, targetAudience: [] };
  await processBusinessProfileSetupJob(params);
  assert.equal(recoveryCalls, 1);
  assert.equal(saved.analysis.businessName, "Cal.com");
  assert.equal(inserts, 1);
});

test("missing facts and unsupported domain placeholders fail before saving or advancing the draft", async () => {
  for (const fault of ["evidence", "summary", "audience"]) {
    reset();
    if (fault === "evidence") pages = [{ url, title: null, markdown: "[Book](https://cal.com/)" }];
    if (fault === "summary") analysis.productSummary = null;
    if (fault === "audience") analysis.targetAudience = [];
    await assert.rejects(processBusinessProfileSetupJob(params), error => error.status === 422);
    assert.equal(inserts, 0);
    assert.deepEqual(mutations, []);
  }
});

test("a previously accepted domain-brand analysis resumes without scraping, reinserting or losing draft ownership", async () => {
  reset();
  stored = { id: "accepted-analysis", analysis, sourceContext: null, websiteUrl: url };
  const result = await processBusinessProfileSetupJob(params);
  assert.equal(result.analysisId, "accepted-analysis");
  assert.equal(inserts, 0);
  assert.equal(recoveryCalls, 0);
  assert.equal(mutations[0].payload.analysisId, "accepted-analysis");
  draft.source_revision = 2;
  mutations = [];
  assert.equal((await processBusinessProfileSetupJob(params)).skipped, "superseded");
  assert.deepEqual(mutations, []);
});
