import { createHash, randomUUID } from "node:crypto";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { runGenerateTrendingHookCopyJob } from "../worker/dist/jobs/generate-trending-hook-copy.js";
import { createSupabaseJobStore } from "../worker/dist/lib/supabase.js";
import {
  TRENDING_HOOK_PROMPT_VERSION,
  TRENDING_HOOK_SELECTION_VERSION,
} from "../worker/dist/lib/trending-hook-copy.js";

const LOCKED_HOOK_VIDEO_ID = "f8493ecd-9ce1-4918-9c36-94d740382321";
const CANARY_USER_ID = "hook-v6-locked-canary";
const CANARY_PROJECT_ID = "hook-v6-locked-canary";
const execute = process.argv.includes("--execute");
const confirmed = process.argv.includes("--yes");
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

if (!execute) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        message:
          "This creates an isolated synthetic profile and one v6 Hook job for the Locked video. Add --execute --yes to run it.",
        productionFeatureGateChanged: false,
        realBusinessProfileUsed: false,
        testedVideoId: LOCKED_HOOK_VIDEO_ID,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!confirmed) {
  throw new Error("Refusing to run the canary without --yes.");
}

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey || !process.env.OPENAI_API_KEY?.trim()) {
  throw new Error("Supabase service access and OPENAI_API_KEY are required.");
}

process.env.OPENAI_TRENDING_HOOK_MODEL =
  process.env.OPENAI_TRENDING_HOOK_TEST_MODEL?.trim() || "gpt-5-mini";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const store = createSupabaseJobStore({
  supabaseServiceRoleKey: serviceRoleKey,
  supabaseUrl,
});
const now = new Date().toISOString();
const businessProfile = {
  brandTone: "clear, practical, and encouraging",
  businessName: "Canary Meal Logger",
  category: "Nutrition tracking test application",
  claimsToAvoid: [
    "medical advice",
    "guaranteed results",
    "guaranteed weight loss",
  ],
  differentiators: ["fast logging", "clear progress summaries"],
  mainProblem: "Manual meal logging can feel repetitive and difficult to maintain.",
  mainPromise: "Make everyday meal logging easier to understand and continue.",
  painPoints: ["People stop logging when the process feels tedious."],
  productSummary:
    "A synthetic test app that helps people record meals and review simple nutrition summaries.",
  targetAudience: ["Adults who want a simpler way to record everyday meals"],
  valueProps: ["Faster meal logging", "Simple progress summaries"],
};
const contentHash = createHash("sha256")
  .update(JSON.stringify(businessProfile))
  .digest("hex");

const [videoResult, lockResult] = await Promise.all([
  supabase
    .from("avatar_assets")
    .select(
      "id,name,status,duration_seconds,has_audio,hook_format_id,influencer_key,visual_group,thumbnail_url,metadata,source_video_url",
    )
    .eq("id", LOCKED_HOOK_VIDEO_ID)
    .single(),
  supabase
    .from("hook_video_audio_locks")
    .select("audio_asset_id")
    .eq("hook_video_id", LOCKED_HOOK_VIDEO_ID)
    .single(),
]);

if (videoResult.error || !videoResult.data) {
  throw new Error(`Locked Hook video is unavailable: ${videoResult.error?.message}`);
}
if (lockResult.error || !lockResult.data) {
  throw new Error(`Locked Hook audio mapping is unavailable: ${lockResult.error?.message}`);
}

const { data: audio, error: audioError } = await supabase
  .from("hook_audio_assets")
  .select("id,source_file_name,status,review_status,duration_seconds,audio_url")
  .eq("id", lockResult.data.audio_asset_id)
  .single();

if (audioError || !audio) {
  throw new Error(`Locked Hook audio is unavailable: ${audioError?.message}`);
}

const video = videoResult.data;
const videoDuration = Number(video.duration_seconds);
const audioDuration = Number(audio.duration_seconds);

if (
  video.status !== "ready" ||
  video.has_audio !== false ||
  !video.hook_format_id ||
  !Number.isFinite(videoDuration) ||
  videoDuration <= 0 ||
  audio.status !== "active" ||
  audio.review_status !== "approved" ||
  audioDuration < videoDuration
) {
  throw new Error("The Locked Hook video or audio no longer meets the canary contract.");
}

const { data: profile, error: profileError } = await supabase
  .from("business_profiles")
  .upsert(
    {
      user_id: CANARY_USER_ID,
      project_id: CANARY_PROJECT_ID,
      intake_type: "manual",
      context_json: businessProfile,
      source_url: null,
      source_context: "Synthetic Locked Hook v6 canary. Not a customer profile.",
      content_hash: contentHash,
      profile_version: 1,
      preparation_status: "preparing",
      preparation_error: null,
      onboarding_status: "completed",
      onboarding_version: 3,
      onboarding_completed_at: now,
      primary_goal: "grow_views",
      primary_goals: ["grow_views"],
      updated_at: now,
    },
    { onConflict: "user_id" },
  )
  .select("id,user_id,profile_version")
  .single();

if (profileError || !profile) {
  throw new Error(`Could not prepare the synthetic canary profile: ${profileError?.message}`);
}

const jobId = randomUUID();
const reactionType =
  video.metadata &&
  typeof video.metadata === "object" &&
  !Array.isArray(video.metadata) &&
  typeof video.metadata.reactionType === "string"
    ? video.metadata.reactionType
    : "confusion_skepticism";
const input = {
  businessProfile,
  businessProfileId: profile.id,
  businessProfileVersion: profile.profile_version,
  candidates: [
    {
      candidateIndex: 0,
      durationSeconds: videoDuration,
      influencerId: `catalog:${video.influencer_key || "creator_022"}`,
      influencerKey: video.influencer_key,
      influencerName: "Creator 022",
      influencerVideoId: video.id,
      influencerVideoTitle: video.name,
      reactionType,
      sourceDurationSeconds: videoDuration,
      sourceKind: "catalog",
      thumbnailUrl: video.thumbnail_url,
      trimEnd: videoDuration,
      trimStart: 0,
      visualGroup: video.visual_group,
    },
  ],
  performanceSignals: {},
  promptVersion: TRENDING_HOOK_PROMPT_VERSION,
  selectionVersion: TRENDING_HOOK_SELECTION_VERSION,
  sourceSelectionKey: `locked-canary:${video.id}`,
  userId: CANARY_USER_ID,
};

const { data: insertedJob, error: jobError } = await supabase
  .from("background_jobs")
  .insert({
    id: jobId,
    user_id: CANARY_USER_ID,
    project_id: CANARY_PROJECT_ID,
    job_type: "generate_trending_hook_copy",
    queue_name: "ai-generation",
    status: "processing",
    input_json: input,
    attempt_count: 1,
    worker_id: "local-locked-hook-canary",
    locked_at: now,
    last_heartbeat_at: now,
    started_at: now,
    idempotency_key: `locked-hook-v6-canary:${jobId}`,
    last_delivery_at: now,
    stage: "processing",
    progress: 10,
    max_attempts: 1,
    worker_execution_id: `local:${jobId}`,
    queued_at: now,
    queue_provider: "gcp",
  })
  .select("*")
  .single();

if (jobError || !insertedJob) {
  throw new Error(`Could not create the canary Hook job: ${jobError?.message}`);
}

let output;

try {
  output = await runGenerateTrendingHookCopyJob(insertedJob, { store });
  const completedAt = new Date().toISOString();
  const { error: completionError } = await supabase
    .from("background_jobs")
    .update({
      status: "completed",
      output_json: output,
      completed_at: completedAt,
      updated_at: completedAt,
      stage: "completed",
      progress: 100,
      error_code: null,
      error_message: null,
    })
    .eq("id", jobId);

  if (completionError) {
    throw new Error(`Could not mark the canary job complete: ${completionError.message}`);
  }
} catch (error) {
  const failedAt = new Date().toISOString();
  await supabase
    .from("background_jobs")
    .update({
      status: "failed",
      failed_at: failedAt,
      updated_at: failedAt,
      stage: "failed",
      error_message:
        error instanceof Error ? error.message.slice(0, 2000) : "Unknown canary failure",
    })
    .eq("id", jobId);
  throw error;
}

const { data: suggestions, error: suggestionsError } = await supabase
  .from("hook_video_suggestions")
  .select(
    "id,text,opening_lines,prompt_version,validator_version,audio_intent,quality_score,campaign_purpose,influencer_video_id,generation_job_id",
  )
  .eq("generation_job_id", jobId)
  .eq("user_id", CANARY_USER_ID)
  .order("candidate_index", { ascending: true });

if (suggestionsError || !suggestions || suggestions.length !== 1) {
  throw new Error(
    `Expected one saved canary Hook suggestion: ${suggestionsError?.message || suggestions?.length}`,
  );
}

const saved = suggestions[0];
const lines = Array.isArray(saved.opening_lines) ? saved.opening_lines : [];

if (
  saved.prompt_version !== TRENDING_HOOK_PROMPT_VERSION ||
  saved.influencer_video_id !== LOCKED_HOOK_VIDEO_ID ||
  lines.length < 1 ||
  lines.length > 3 ||
  lines.some((line) => typeof line !== "string" || !line.trim()) ||
  !saved.audio_intent
) {
  throw new Error("The saved canary Hook did not satisfy the v6 persistence contract.");
}

console.log(
  JSON.stringify(
    {
      audio: {
        assetId: audio.id,
        fileName: audio.source_file_name,
        reviewStatus: audio.review_status,
        status: audio.status,
      },
      job: {
        id: jobId,
        promptVersion: saved.prompt_version,
        status: "completed",
      },
      productionFeatureGateChanged: false,
      realBusinessProfileUsed: false,
      savedHook: {
        audioIntent: saved.audio_intent,
        campaignPurpose: saved.campaign_purpose,
        hookText: saved.text,
        id: saved.id,
        lineCount: lines.length,
        lines,
        qualityScore: saved.quality_score,
        validatorVersion: saved.validator_version,
      },
      testedVideo: {
        formatId: video.hook_format_id,
        id: video.id,
        name: video.name,
      },
      threeLineLimitSatisfied: lines.length <= 3,
    },
    null,
    2,
  ),
);
