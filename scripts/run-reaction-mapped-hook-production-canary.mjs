import { randomUUID } from "node:crypto";

import { GoogleAuth } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

const CANARY_USER_ID = "hook-v6-locked-canary";
const CANARY_VIDEO_ID = "f8493ecd-9ce1-4918-9c36-94d740382321";
const EXPECTED_REACTION = "confusion_skepticism";
const EXPECTED_FORMAT = "GF_020";
const PROMPT_VERSION = "trending-hook-copy-v7";
const SELECTION_VERSION = "reaction-format-map-v2";
const GENERATION_MODE = "reaction_mapped_lean_v1";
const COMPLETION_TIMEOUT_MS = 180_000;
const COMPLETION_POLL_INTERVAL_MS = 5_000;
const execute = process.argv.includes("--execute");
const confirmed = process.argv.includes("--yes");

if (!execute || !confirmed) {
  console.log(JSON.stringify({
    dryRun: true,
    message: "This dispatches one paid production Hook-copy canary for the isolated synthetic Hook test account. Run with --execute --yes.",
    userId: CANARY_USER_ID,
    reactionType: EXPECTED_REACTION,
    expectedFormatId: EXPECTED_FORMAT,
  }, null, 2));
  process.exit(0);
}

const supabaseUrl = requireEnv("SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const projectId = process.env.GCP_PROJECT_ID?.trim() || requireEnv("GOOGLE_CLOUD_PROJECT");
const location = process.env.GCP_CLOUD_TASKS_LOCATION?.trim() || "us-central1";
const prefix = process.env.GCP_RESOURCE_NAME_PREFIX?.trim() || "ugc";
const queueName = process.env.GCP_AI_GENERATION_TASKS_QUEUE?.trim() || `${prefix}-ai-generation`;
const schedulerServiceAccount = process.env.GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL?.trim() || `${prefix}-scheduler-sa@${projectId}.iam.gserviceaccount.com`;
const workerServiceName = process.env.GCP_AI_GENERATION_WORKER_SERVICE_NAME?.trim() || "ugc-ai-generation-worker";
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [{ data: profile, error: profileError }, { data: video, error: videoError }] = await Promise.all([
  supabase
    .from("business_profiles")
    .select("id,user_id,project_id,profile_version,context_json")
    .eq("user_id", CANARY_USER_ID)
    .single(),
  supabase
    .from("avatar_assets")
    .select("id,name,status,duration_seconds,influencer_key,visual_group,thumbnail_url,metadata")
    .eq("id", CANARY_VIDEO_ID)
    .single(),
]);

if (profileError || !profile) {
  throw new Error(`Could not load isolated canary profile: ${profileError?.message || "missing"}`);
}
if (videoError || !video) {
  throw new Error(`Could not load isolated canary video: ${videoError?.message || "missing"}`);
}

const activeStatuses = ["queued", "processing", "continuation_pending"];
const { data: activeRuns, error: activeRunError } = await supabase
  .from("trending_hook_generation_runs")
  .select("id,status")
  .eq("user_id", CANARY_USER_ID)
  .in("status", activeStatuses);

if (activeRunError) {
  throw new Error(`Could not check active canary runs: ${activeRunError.message}`);
}
if ((activeRuns ?? []).length > 0) {
  throw new Error("Refusing to overlap an existing canary Hook generation run.");
}

const reactionType = getReactionType(video.metadata);
const durationSeconds = Number(video.duration_seconds);

if (
  video.status !== "ready" ||
  reactionType !== EXPECTED_REACTION ||
  !Number.isFinite(durationSeconds) ||
  durationSeconds <= 0
) {
  throw new Error("The canary video no longer meets the reaction-map contract.");
}

const candidate = {
  candidateIndex: 0,
  durationSeconds,
  influencerId: `catalog:${video.influencer_key || "creator_022"}`,
  influencerKey: video.influencer_key,
  influencerName: "Creator 022",
  influencerVideoId: video.id,
  influencerVideoTitle: video.name,
  reactionType,
  sourceDurationSeconds: durationSeconds,
  sourceKind: "catalog",
  thumbnailUrl: video.thumbnail_url,
  trimEnd: durationSeconds,
  trimStart: 0,
  visualGroup: video.visual_group,
};
const traceId = randomUUID();
const sourceSelectionKey = `reaction-map-production-canary:${traceId}`;

// This must exercise the same atomic path as the app: no committed run is
// allowed to exist without its first reserved chunk and durable outbox entry.
const { data: initialChunkRows, error: initialChunkError } = await supabase.rpc(
  "create_or_resume_and_reserve_trending_hook_generation_chunk_v2",
  {
    p_business_profile_id: profile.id,
    p_business_profile_version: profile.profile_version,
    p_candidate_pool: [candidate],
    p_prompt_version: PROMPT_VERSION,
    p_selection_version: SELECTION_VERSION,
    p_source_selection_key: sourceSelectionKey,
    p_target_valid_count: 1,
    p_user_id: CANARY_USER_ID,
  },
);

const chunk = firstRow(initialChunkRows);
if (initialChunkError || !chunk?.run_id || !chunk?.chunk_id || !Array.isArray(chunk.candidate_payloads)) {
  throw new Error(`Could not atomically prepare mapped canary chunk: ${initialChunkError?.message || "missing run or chunk"}`);
}
const run = { id: chunk.run_id };

const { data: outbox, error: outboxError } = await supabase
  .from("trending_hook_generation_dispatch_outbox")
  .select("id,run_id,chunk_id,status")
  .eq("chunk_id", chunk.chunk_id)
  .single();

if (
  outboxError ||
  !outbox?.id ||
  outbox.run_id !== run.id ||
  outbox.status !== "pending"
) {
  throw new Error(
    `The atomic canary setup did not create a pending dispatch outbox record: ${outboxError?.message || "invalid record"}`,
  );
}

const jobId = randomUUID();
const now = new Date().toISOString();
const input = {
  businessProfile: profile.context_json,
  businessProfileId: profile.id,
  businessProfileVersion: profile.profile_version,
  candidates: chunk.candidate_payloads,
  generationRunChunkId: chunk.chunk_id,
  generationMode: GENERATION_MODE,
  generationRunId: run.id,
  generationRunRemainingValidCount: chunk.remaining_valid_count,
  performanceSignals: {},
  promptVersion: PROMPT_VERSION,
  selectionVersion: SELECTION_VERSION,
  sourceSelectionKey,
  userId: CANARY_USER_ID,
};

const { error: insertJobError } = await supabase
  .from("background_jobs")
  .insert({
    id: jobId,
    user_id: CANARY_USER_ID,
    project_id: profile.project_id,
    job_type: "generate_trending_hook_copy",
    queue_name: "ai-generation",
    queue_provider: "gcp",
    status: "queued",
    input_json: input,
    idempotency_key: `reaction-map-production-canary:${traceId}`,
    max_attempts: 1,
    queued_at: now,
    stage: "queued",
    progress: 0,
  });

if (insertJobError) {
  await releaseUnattachedChunk(supabase, chunk.chunk_id, "Could not create the reaction-map canary job.");
  throw new Error(`Could not create mapped canary job: ${insertJobError.message}`);
}

const { data: attachmentRows, error: attachError } = await supabase.rpc(
  "attach_trending_hook_generation_chunk_job_v1",
  { p_background_job_id: jobId, p_chunk_id: chunk.chunk_id },
);

if (attachError || firstValue(attachmentRows) !== true) {
  await markJobFailed(supabase, jobId, attachError?.message || "Could not attach the canary job to its reserved chunk.");
  throw new Error(`Could not attach mapped canary job: ${attachError?.message || "unexpected false result"}`);
}

try {
  const workerUrl = await getWorkerUrl({ location, projectId, workerServiceName });
  const taskName = `projects/${projectId}/locations/${location}/queues/${queueName}/tasks/job-${jobId}-attempt-0`;
  const taskPayload = { attempt: 0, jobId, jobType: "generate_trending_hook_copy", schemaVersion: 1 };
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  await client.request({
    url: `https://cloudtasks.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/queues/${encodeURIComponent(queueName)}/tasks`,
    method: "POST",
    data: {
      task: {
        name: taskName,
        dispatchDeadline: "1800s",
        httpRequest: {
          body: Buffer.from(JSON.stringify(taskPayload), "utf8").toString("base64"),
          headers: { "Content-Type": "application/json" },
          httpMethod: "POST",
          oidcToken: {
            audience: new URL(workerUrl).origin,
            serviceAccountEmail: schedulerServiceAccount,
          },
          url: new URL("/tasks/jobs", workerUrl).toString(),
        },
      },
    },
  });

  const { error: queueUpdateError } = await supabase
    .from("background_jobs")
    .update({ last_delivery_at: new Date().toISOString(), queue_message_id: taskName, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (queueUpdateError) {
    throw new Error(`The task was created but queue metadata could not be stored: ${queueUpdateError.message}`);
  }

  const completion = await waitForCompletion(supabase, {
    chunkId: chunk.chunk_id,
    jobId,
    runId: run.id,
  });

  console.log(JSON.stringify({
    canary: "reaction-mapped-trending-hook-copy",
    chunkId: chunk.chunk_id,
    completion,
    expectedFormatId: EXPECTED_FORMAT,
    generationMode: GENERATION_MODE,
    jobId,
    reactionType,
    runId: run.id,
    selectionVersion: SELECTION_VERSION,
    taskName,
    workerUrl,
  }, null, 2));
} catch (error) {
  await markJobFailed(supabase, jobId, error instanceof Error ? error.message : "Could not dispatch the mapped Hook canary.");
  throw error;
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getReactionType(metadata) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) && typeof metadata.reactionType === "string"
    ? metadata.reactionType
    : null;
}

async function getWorkerUrl({ location, projectId, workerServiceName }) {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const response = await client.request({
    url: `https://run.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/services/${encodeURIComponent(workerServiceName)}`,
  });
  const uri = response.data?.uri;
  if (typeof uri !== "string" || !uri.trim()) {
    throw new Error("The AI-generation Cloud Run service returned no URI.");
  }
  return uri;
}

async function markJobFailed(supabase, jobId, errorMessage) {
  const now = new Date().toISOString();
  await supabase
    .from("background_jobs")
    .update({ error_message: errorMessage.slice(0, 2000), failed_at: now, stage: "failed", status: "failed", updated_at: now })
    .eq("id", jobId);
}

async function releaseUnattachedChunk(supabase, chunkId, errorMessage) {
  await supabase.rpc("release_unattached_trending_hook_generation_chunk_v1", {
    p_chunk_id: chunkId,
    p_error_message: errorMessage,
  });
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function waitForCompletion(supabase, { chunkId, jobId, runId }) {
  const deadline = Date.now() + COMPLETION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const [{ data: job, error: jobError }, { data: chunk, error: chunkError }, { data: run, error: runError }, { data: outbox, error: outboxError }] = await Promise.all([
      supabase
        .from("background_jobs")
        .select("status,stage,started_at,completed_at,error_message,output_json")
        .eq("id", jobId)
        .single(),
      supabase
        .from("trending_hook_generation_run_chunks")
        .select("status,accepted_count,background_job_id")
        .eq("id", chunkId)
        .single(),
      supabase
        .from("trending_hook_generation_runs")
        .select("status,completed_valid_count,target_valid_count")
        .eq("id", runId)
        .single(),
      supabase
        .from("trending_hook_generation_dispatch_outbox")
        .select("status")
        .eq("chunk_id", chunkId)
        .single(),
    ]);

    if (jobError || chunkError || runError || outboxError) {
      throw new Error(
        `Could not verify canary completion: ${jobError?.message || chunkError?.message || runError?.message || outboxError?.message}`,
      );
    }

    if (job?.status === "failed" || job?.status === "cancelled") {
      throw new Error(`The Hook canary worker job ${job.status}: ${job.error_message || "no error recorded"}`);
    }

    if (
      job?.status === "completed" &&
      job.started_at &&
      job.completed_at &&
      job.output_json?.ideaCount === 1 &&
      chunk?.status === "completed" &&
      chunk.accepted_count === 1 &&
      chunk.background_job_id === jobId &&
      run?.status === "completed" &&
      run.completed_valid_count === 1 &&
      run.target_valid_count === 1 &&
      outbox?.status === "completed"
    ) {
      return {
        acceptedCount: chunk.accepted_count,
        jobStatus: job.status,
        outboxStatus: outbox.status,
        runStatus: run.status,
        workerId: job.worker_id,
      };
    }

    await sleep(COMPLETION_POLL_INTERVAL_MS);
  }

  throw new Error("Timed out waiting for the canary Hook job to complete.");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
