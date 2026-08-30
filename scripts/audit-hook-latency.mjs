import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library";

const { loadEnvConfig } = nextEnv;
const email = requiredArgument("--email").toLowerCase();
const maxRows = optionalPositiveInteger("--limit", 40);

loadEnvConfig(process.cwd());

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase service access is required for the latency audit.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const user = await findFirebaseUserByEmail(email);

if (!user) {
  console.log(JSON.stringify({ accountFound: false, email }, null, 2));
  process.exit(0);
}

const [
  profileResult,
  feedResult,
  runResult,
  assignmentResult,
  draftResult,
  jobResult,
] = await Promise.all([
  supabase
    .from("business_profiles")
    .select(
      "id,project_id,profile_version,onboarding_status,onboarding_version,preparation_status,preparation_error,context_json,created_at,updated_at",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(5),
  supabase
    .from("daily_trending_feeds")
    .select(
      "id,local_date,timezone,plan_key,daily_limit,carousel_percent,wall_text_percent,hook_video_percent,status,last_error,recovery_attempt_count,last_recovery_at,last_recovery_error,created_at,updated_at",
    )
    .eq("user_id", user.id)
    .order("local_date", { ascending: false })
    .limit(5),
  supabase
    .from("trending_hook_generation_runs")
    .select(
      "id,business_profile_id,business_profile_version,target_valid_count,completed_valid_count,status,last_error,created_at,updated_at,completed_at",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(maxRows),
  supabase
    .from("user_hook_video_assignments")
    .select(
      "id,business_profile_id,business_profile_version,hook_suggestion_id,position,state,created_at,updated_at,completed_at,last_opened_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(maxRows),
  supabase
    .from("hook_video_drafts")
    .select(
      "id,status,render_status,render_job_id,rendered_media_asset_id,created_at,updated_at",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(maxRows),
  supabase
    .from("background_jobs")
    .select(
      "id,job_type,queue_name,status,stage,progress,attempt_count,max_attempts,queued_at,last_delivery_at,started_at,last_heartbeat_at,completed_at,failed_at,created_at,updated_at,error_code,error_message,worker_id,worker_execution_id,queue_message_id",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(maxRows),
]);

throwIfQueryFailed(profileResult, "business profile");
throwIfQueryFailed(feedResult, "daily Trending feed");
throwIfQueryFailed(runResult, "Hook generation run");
throwIfQueryFailed(assignmentResult, "Hook assignment");
throwIfQueryFailed(draftResult, "Hook video draft");
throwIfQueryFailed(jobResult, "background job");

const profiles = profileResult.data ?? [];
const feeds = feedResult.data ?? [];
const runs = runResult.data ?? [];
const assignments = assignmentResult.data ?? [];
const drafts = draftResult.data ?? [];
const jobs = jobResult.data ?? [];
const feedIds = feeds.map((feed) => feed.id);
const runIds = runs.map((run) => run.id);
const jobIds = jobs.map((job) => job.id);

const [slotResult, chunkResult, eventResult] = await Promise.all([
  feedIds.length === 0
    ? emptyResult()
    : supabase
        .from("daily_trending_feed_slots")
        .select(
          "feed_id,position,format,state,source,hook_video_assignment_id,created_at,updated_at",
        )
        .in("feed_id", feedIds)
        .order("position", { ascending: true }),
  runIds.length === 0
    ? emptyResult()
    : supabase
        .from("trending_hook_generation_run_chunks")
        .select(
          "id,run_id,chunk_number,background_job_id,candidate_count,accepted_count,rejected_count,status,last_error,created_at,updated_at,completed_at",
        )
        .in("run_id", runIds)
        .order("chunk_number", { ascending: true }),
  jobIds.length === 0
    ? emptyResult()
    : supabase
        .from("background_job_events")
        .select("job_id,event_type,created_at")
        .in("job_id", jobIds)
        .order("created_at", { ascending: true }),
]);

throwIfQueryFailed(slotResult, "daily Trending feed slot");
throwIfQueryFailed(chunkResult, "Hook generation chunk");
throwIfQueryFailed(eventResult, "background job event");

const slots = slotResult.data ?? [];
const chunks = chunkResult.data ?? [];
const events = eventResult.data ?? [];
const currentProfile = profiles[0] ?? null;
const [
  sourceSelectionResult,
  userMediaResult,
  catalogAvatarResult,
  avatarPreferenceResult,
] = await Promise.all([
  supabase
    .from("trending_video_source_selections")
    .select("format,selection_kind,media_asset_id,group_id,updated_at")
    .eq("user_id", user.id)
    .eq("format", "hook_video")
    .maybeSingle(),
  supabase
    .from("media_assets")
    .select("id,status,collection,mime_type,ratio,duration_seconds,deleted_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(500),
  supabase
    .from("avatar_assets")
    .select("id,status,avatar_type,ratio,duration_seconds,deleted_at,metadata")
    .eq("avatar_type", "global")
    .eq("status", "ready")
    .is("deleted_at", null)
    .limit(1000),
  supabase
    .from("user_avatar_preferences")
    .select("avatar_asset_id,is_trimmed,trim_start,trim_end")
    .eq("user_id", user.id)
    .limit(1000),
]);

throwIfQueryFailed(sourceSelectionResult, "Hook video source selection");
throwIfQueryFailed(userMediaResult, "user media inventory");
throwIfQueryFailed(catalogAvatarResult, "catalog Hook video inventory");
throwIfQueryFailed(avatarPreferenceResult, "catalog Hook preferences");

const sourceDiagnostics = summarizeHookSources({
  avatarPreferences: avatarPreferenceResult.data ?? [],
  catalogAvatars: catalogAvatarResult.data ?? [],
  profileContext: currentProfile?.context_json ?? null,
  selection: sourceSelectionResult.data ?? null,
  userMedia: userMediaResult.data ?? [],
});
const wallAssignmentResult = await supabase
  .from("user_wall_text_assignments")
  .select(
    "id,business_profile_id,business_profile_version,wall_text_creative_id,position,state,render_status,render_job_id,render_error,created_at,updated_at,completed_at",
  )
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(maxRows);

throwIfQueryFailed(wallAssignmentResult, "Wall-of-text assignment");
const wallAssignments = wallAssignmentResult.data ?? [];
const hookJobs = jobs.filter((job) =>
  [
    "generate_trending_hook_copy",
    "render_demo_video",
    "render_schedule_combination",
  ].includes(job.job_type),
);

console.log(
  JSON.stringify(
    {
      account: { email, found: true, userId: user.id },
      generatedAt: new Date().toISOString(),
      profiles: profiles.map(withProfileSummary),
      hookSourceDiagnostics: sourceDiagnostics,
      feed: {
        feeds,
        slots,
        hookSlots: slots.filter((slot) => slot.format === "hook_video"),
      },
      hookGeneration: {
        runs: runs.map(withRunLatency),
        chunks: chunks.map(withChunkLatency),
      },
      hookAssignments: assignments,
      wallTextAssignments: wallAssignments,
      hookVideoDrafts: drafts.map(withDraftLatency),
      recentUserJobs: jobs.map(withJobLatency),
      hookJobs: hookJobs.map(withJobLatency),
      hookJobEvents: events.filter((event) => jobIds.includes(event.job_id)),
    },
    null,
    2,
  ),
);

async function findFirebaseUserByEmail(targetEmail) {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    process.env.GCP_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim();

  if (!projectId) {
    throw new Error("A Firebase or Google Cloud project ID is required for account lookup.");
  }

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  try {
    const response = await client.request({
      url: `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`,
      method: "POST",
      data: { email: [targetEmail] },
    });
    const firebaseUser = response.data?.users?.[0];

    return firebaseUser?.localId
      ? {
          email: firebaseUser.email ?? targetEmail,
          id: firebaseUser.localId,
        }
      : null;
  } catch (error) {
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "unknown Firebase account lookup error";

    if (message === "EMAIL_NOT_FOUND") return null;
    throw new Error(`Could not resolve the Firebase account: ${message}`);
  }
}

function withRunLatency(run) {
  return {
    ...run,
    elapsedMs: elapsedMilliseconds(run.created_at, run.completed_at ?? run.updated_at),
  };
}

function withProfileSummary(profile) {
  const { context_json: _contextJson, ...summary } = profile;
  return {
    ...summary,
    evidence: summarizeBusinessEvidence(_contextJson),
  };
}

function summarizeHookSources(params) {
  const validReactions = new Set([
    "shock_surprise",
    "curiosity_discovery",
    "secret_reveal",
    "confidence_approval",
    "amusement_laughter",
    "concern_anxiety",
    "confusion_skepticism",
    "focused_attention",
  ]);
  const preferenceByAvatarId = new Map(
    params.avatarPreferences.map((preference) => [
      preference.avatar_asset_id,
      preference,
    ]),
  );
  const catalogCandidates = params.catalogAvatars.filter((asset) =>
    isEligibleHookSource({
      durationSeconds: effectiveDuration(
        asset.duration_seconds,
        preferenceByAvatarId.get(asset.id),
      ),
      ratio: asset.ratio,
      reactionType: getReactionType(asset.metadata),
      validReactions,
    }),
  );
  const userCandidates = params.userMedia.filter((asset) =>
    isEligibleHookSource({
      durationSeconds: asset.duration_seconds,
      ratio: asset.ratio,
      reactionType: null,
      validReactions,
    }),
  );
  const configuredSource = params.selection
    ? {
        kind: params.selection.selection_kind,
        hasGroup: Boolean(params.selection.group_id),
        hasMediaAsset: Boolean(params.selection.media_asset_id),
        updatedAt: params.selection.updated_at,
      }
    : { kind: "catalog_default" };

  return {
    configuredSource,
    catalog: {
      readyAssetCount: params.catalogAvatars.length,
      usableCandidateCount: catalogCandidates.length,
      usableReactions: countByReaction(catalogCandidates),
    },
    userMedia: {
      readyVideoCount: params.userMedia.filter(isReadyUserVideo).length,
      usableCandidateCount: userCandidates.length,
    },
    projectedCandidateCount:
      params.selection?.selection_kind === "asset" ||
      params.selection?.selection_kind === "group"
        ? null
        : catalogCandidates.length + userCandidates.length,
  };
}

function summarizeBusinessEvidence(value) {
  const context = isRecord(value) ? value : {};
  const text = (key) =>
    typeof context[key] === "string" && context[key].trim()
      ? context[key].trim()
      : null;
  const list = (key) =>
    Array.isArray(context[key])
      ? context[key].filter((item) => typeof item === "string" && item.trim())
      : [];
  const desiredOutcome = text("desiredOutcome") ?? text("mainPromise");
  const differentiator = text("differentiator") ?? list("differentiators")[0] ?? null;
  const hasPain = Boolean(text("mainProblem") || list("painPoints").length);
  const hasCapability = Boolean(
    text("productSummary") ||
      desiredOutcome ||
      differentiator ||
      list("differentiators").length ||
      list("valueProps").length,
  );
  const hasAudience = Boolean(text("primaryAudience") || list("targetAudience").length);
  const evidenceValues = new Set(
    [
      text("mainProblem"),
      desiredOutcome,
      differentiator,
      ...list("painPoints"),
      ...list("differentiators"),
      ...list("valueProps"),
    ]
      .filter(Boolean)
      .map((item) => item.toLowerCase()),
  );

  return {
    hasAudience,
    hasCapability,
    hasPain,
    distinctClaimCount: evidenceValues.size,
  };
}

function isEligibleHookSource(params) {
  return (
    params.ratio === "9:16" &&
    typeof params.durationSeconds === "number" &&
    Number.isFinite(params.durationSeconds) &&
    params.durationSeconds > 0 &&
    typeof params.reactionType === "string" &&
    params.validReactions.has(params.reactionType)
  );
}

function effectiveDuration(durationSeconds, preference) {
  if (typeof durationSeconds !== "number" || durationSeconds <= 0) return null;
  if (
    preference?.is_trimmed !== true ||
    typeof preference.trim_start !== "number" ||
    typeof preference.trim_end !== "number"
  ) {
    return durationSeconds;
  }

  return Math.max(0, Math.min(preference.trim_end, durationSeconds) - Math.max(preference.trim_start, 0));
}

function getReactionType(metadata) {
  return isRecord(metadata) && typeof metadata.reactionType === "string"
    ? metadata.reactionType
    : null;
}

function countByReaction(candidates) {
  return candidates.reduce((counts, asset) => {
    const reaction = getReactionType(asset.metadata);
    if (reaction) counts[reaction] = (counts[reaction] ?? 0) + 1;
    return counts;
  }, {});
}

function isReadyUserVideo(asset) {
  return (
    asset.status === "ready" &&
    (asset.collection === "video" || asset.collection === "influencer") &&
    typeof asset.mime_type === "string" &&
    asset.mime_type.startsWith("video/")
  );
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function withChunkLatency(chunk) {
  return {
    ...chunk,
    elapsedMs: elapsedMilliseconds(
      chunk.created_at,
      chunk.completed_at ?? chunk.updated_at,
    ),
  };
}

function withDraftLatency(draft) {
  return {
    ...draft,
    elapsedMs: elapsedMilliseconds(draft.created_at, draft.updated_at),
  };
}

function withJobLatency(job) {
  return {
    ...job,
    queueWaitMs: elapsedMilliseconds(job.queued_at ?? job.created_at, job.started_at),
    runMs: elapsedMilliseconds(job.started_at, job.completed_at ?? job.failed_at),
  };
}

function elapsedMilliseconds(start, end) {
  if (!start || !end) return null;

  const value = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function emptyResult() {
  return Promise.resolve({ data: [], error: null });
}

function throwIfQueryFailed(result, label) {
  if (result.error) {
    throw new Error(`Could not load ${label}: ${result.error.message}`);
  }
}

function requiredArgument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1]?.trim() : null;

  if (!value) {
    throw new Error(`Usage: node scripts/audit-hook-latency.mjs ${name} user@example.com [--limit 40]`);
  }

  return value;
}

function optionalPositiveInteger(name, fallback) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? Number(process.argv[index + 1]) : fallback;

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error(`${name} must be an integer from 1 to 100.`);
  }

  return value;
}
