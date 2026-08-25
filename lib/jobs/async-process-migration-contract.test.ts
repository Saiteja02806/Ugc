import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("user-facing AI and analytics routes only enqueue durable jobs", () => {
  const contracts = [
    {
      enqueue: "enqueueBusinessProfileSetupJob",
      forbidden: ["analyzeWebsiteBusiness", "scrapeWebsitePages"],
      path: "app/api/business-profile/route.ts",
    },
    {
      enqueue: "enqueueWebsiteAnalysisJob",
      forbidden: ["analyzeWebsiteBusiness", "scrapeWebsitePages"],
      path: "app/api/website-analysis/analyze/route.ts",
    },
    {
      enqueue: "enqueueHookSuggestionJob",
      forbidden: ["generateBusinessHookSuggestions"],
      path: "app/api/trending/hook-videos/suggestions/route.ts",
    },
    {
      enqueue: "enqueueAnalyticsSyncJob",
      forbidden: ["listInstagramAccountInsightsForOwner"],
      path: "app/api/analytics/instagram/insights/route.ts",
    },
    {
      enqueue: "enqueueAnalyticsSyncJob",
      forbidden: ["listInstagramContentInsightsForOwner"],
      path: "app/api/analytics/instagram/content/route.ts",
    },
    {
      enqueue: "enqueueAnalyticsSyncJob",
      forbidden: ["listTikTokPublicVideoAnalyticsForOwner"],
      path: "app/api/analytics/tiktok/videos/route.ts",
    },
  ];

  for (const contract of contracts) {
    const source = readFileSync(contract.path, "utf8");

    assert.match(source, new RegExp(contract.enqueue));
    assert.match(source, /status === "completed" \? 200 : 202/);

    for (const forbidden of contract.forbidden) {
      assert.doesNotMatch(source, new RegExp(forbidden));
    }
  }
});

test("Analytics is available to every signed-in user without a paid-plan gate", () => {
  for (const routePath of [
    "app/api/analytics/instagram/insights/route.ts",
    "app/api/analytics/instagram/content/route.ts",
    "app/api/analytics/tiktok/videos/route.ts",
  ]) {
    const source = readFileSync(routePath, "utf8");

    assert.match(source, /requireFirebaseUser\(request\)/);
    assert.doesNotMatch(source, /requireActivePaidUser/);
    assert.doesNotMatch(source, /BillingAccessError/);
  }
});

test("analysis retries restore provider output from a job-scoped database row", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801103000_add_website_analysis_job_idempotency.sql",
    "utf8",
  );
  const storage = readFileSync("lib/website-analysis/supabase.ts", "utf8");

  assert.match(migration, /source_job_id uuid/);
  assert.match(migration, /website_analyses_source_job_unique_idx/);
  assert.match(storage, /getWebsiteAnalysisBySourceJobId/);
  assert.match(storage, /error\.code === "23505"/);
});

test("the worker implements every newly migrated Slice 6 job type", () => {
  const config = readFileSync("worker/src/config.ts", "utf8");
  const handlers = readFileSync("worker/src/jobs/index.ts", "utf8");
  const types = readFileSync("worker/src/types.ts", "utf8");

  assert.match(config, /EXECUTABLE_BACKGROUND_JOB_TYPES/);
  assert.match(handlers, /EXECUTABLE_BACKGROUND_JOB_TYPES/);

  for (const jobType of [
    "analytics_sync",
    "hook_text_generation",
    "media_analysis",
    "wall_text_content_plan_generation",
    "wall_text_generation",
  ]) {
    assert.match(types, new RegExp(`"${jobType}"`));
  }
});

test("Hook text generation has one validated worker path", () => {
  const handler = readFileSync(
    "worker/src/jobs/generate-hook-suggestions.ts",
    "utf8",
  );
  const databaseStore = readFileSync("worker/src/lib/supabase.ts", "utf8");

  assert.equal(
    existsSync("app/api/internal/jobs/generate-hook-suggestions/route.ts"),
    false,
  );
  assert.equal(existsSync("lib/trending/generate-hook-suggestions.ts"), false);
  assert.equal(existsSync("worker/src/lib/hook-suggestions.ts"), false);
  assert.match(handler, /generateValidatedTrendingHookCopies/);
  assert.match(handler, /persistValidatedHookCompositionGeneration/);
  assert.match(databaseStore, /persist_validated_hook_composition_generation/);
});

test("validated demo Hook suggestions do not collide with Trending candidate slots", () => {
  const migration = readFileSync(
    "supabase/migrations/20260808114916_add_validated_hook_composition_v5.sql",
    "utf8",
  );

  assert.match(
    migration,
    /drop constraint if exists hook_video_suggestions_trending_candidate_unique/,
  );
  assert.match(
    migration,
    /create unique index if not exists hook_video_suggestions_trending_candidate_unique_idx[\s\S]*where suggestion_context = 'trending'/,
  );
  assert.match(
    migration,
    /persist_validated_hook_composition_generation[\s\S]*suggestion_context = 'composition'/,
  );
});

test("Cloud Tasks is the sole active queue transport", () => {
  const rootPackage = JSON.parse(readFileSync("package.json", "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const workerPackage = JSON.parse(
    readFileSync("worker/package.json", "utf8"),
  ) as { dependencies?: Record<string, string> };
  const foundation = readFileSync("infra/gcp/foundation/locals.tf", "utf8");

  for (const dependencyName of [
    ...Object.keys(rootPackage.dependencies ?? {}),
    ...Object.keys(workerPackage.dependencies ?? {}),
  ]) {
    assert.doesNotMatch(dependencyName, /^@aws-sdk\//);
  }

  assert.doesNotMatch(foundation, /pubsub/i);
  assert.equal(existsSync("infra/gcp/foundation/pubsub.tf"), false);
  assert.equal(existsSync("infra/gcp/worker-canary/main.tf"), false);
  assert.equal(existsSync("lib/aws/sqs.ts"), false);
  assert.equal(existsSync("worker/src/lib/pubsub.ts"), false);
});

test("paid image and video providers are fenced before submission", () => {
  const avatarWorker = readFileSync("worker/src/jobs/generate-avatar.ts", "utf8");
  const imageWorker = readFileSync("worker/src/jobs/generate-image.ts", "utf8");
  const videoWorker = readFileSync("worker/src/jobs/generate-hook-video.ts", "utf8");
  const openAiProvider = readFileSync("worker/src/lib/openai-image.ts", "utf8");
  const runwayProvider = readFileSync("worker/src/lib/runway-video.ts", "utf8");
  const veoProvider = readFileSync("worker/src/lib/veo-video.ts", "utf8");

  for (const worker of [avatarWorker, imageWorker, videoWorker]) {
    assert.match(worker, /reserveGenerationProviderOperation/);
    assert.match(worker, /markGenerationOutputPersisted/);
  }

  assert.match(videoWorker, /providerOperationId/);
  assert.match(videoWorker, /markGenerationProviderSubmitted/);
  assert.match(openAiProvider, /maxRetries: 0/);
  assert.match(runwayProvider, /maxRetries: 0/);
  assert.match(veoProvider, /retryOptions: \{ attempts: 1 \}/);
});
