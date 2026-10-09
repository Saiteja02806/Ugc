import "server-only";

import { NextResponse } from "next/server";

import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import {
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "@/lib/ai-studio/prompt-policy";
import {
  parseAIStudioGenerationQuantity,
  parseAIStudioVideoDuration,
  parseAIStudioVideoAspectRatio,
  parseAIStudioVideoModel,
  parseAIStudioVideoResolution,
  isAIStudioVideoResolutionSupported,
  AI_STUDIO_VIDEO_MODELS,
  isAIStudioVideoModelAvailable,
  getAIStudioVideoModelLabel,
  getAIStudioVideoResolutions,
} from "@/lib/ai-studio/generation-settings";
import { isExploreHookVideoId } from "@/lib/explore/hook-video-library";
import { isExploreWallTextVideoId } from "@/lib/explore/wall-text-video-library";
import { getExploreVideoPromptMaxLength, WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS } from "@/lib/explore/format-generation-prompt";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import {
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
  type Json,
} from "@/lib/jobs/background-jobs";
import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import { canonicalMediaReference, isTrustedMediaReferenceUrl as isTrustedStorageUrl } from "@/lib/media/media-reference";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import {
  BillingAccessError,
  deliverBillingUsageForJob,
  getGenerationCreditCost,
  releaseBillingCredits,
  reserveBillingCredits,
} from "@/lib/billing/subscription-db";

type GenerateVideoRequest = {
  exploreFormat?: unknown;
  aspectRatio?: unknown;
  avatarImageUrl?: unknown;
  referenceImageUrls?: unknown;
  referenceAudioUrls?: unknown;
  referenceAudioAssetIds?: unknown;
  hookIdea?: unknown;
  idempotencyKey?: unknown;
  model?: unknown;
  prompt?: unknown;
  quantity?: unknown;
  referenceVideoDurationSeconds?: unknown;
  referenceVideoAssetId?: unknown;
  referenceVideoUrl?: unknown;
  referenceId?: unknown;
  referenceType?: unknown;
  referenceUrl?: unknown;
  durationSeconds?: unknown;
  resolution?: unknown;
};

type VideoJobOutput = {
  key?: unknown;
  mediaAssetId?: unknown;
  ok?: unknown;
  provider?: unknown;
  ratio?: unknown;
  url?: unknown;
  videoId?: unknown;
};

const VIDEO_JOB_TYPE = "generate_hook_video";
const TERMINAL_STATUSES = new Set(["cancelled", "completed", "failed"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:") {
      return null;
    }

    return isTrustedStorageUrl(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingJobQueueEnvVars([VIDEO_JOB_TYPE]),
    ]),
  );
}

function getSafeOutput(output: unknown) {
  if (!output || typeof output !== "object") {
    return null;
  }

  const videoOutput = output as VideoJobOutput;

  return {
    key: typeof videoOutput.key === "string" ? videoOutput.key : null,
    mediaAssetId:
      typeof videoOutput.mediaAssetId === "string"
        ? videoOutput.mediaAssetId
        : null,
    ok: videoOutput.ok === true,
    provider:
      typeof videoOutput.provider === "string" ? videoOutput.provider : null,
    ratio: typeof videoOutput.ratio === "string" ? videoOutput.ratio : null,
    url: typeof videoOutput.url === "string" ? videoOutput.url : null,
    videoId:
      typeof videoOutput.videoId === "string" ? videoOutput.videoId : null,
  };
}

export type ValidatedWorkflowVideoBatch = {
  amountPerVideo: number;
  inputs: Record<string, Json | undefined>[];
  requestKey: string;
  userId: string;
};

export async function handleAIStudioVideoGeneration(request: Request, options?: {
  /** Explore's atomic adapter runs only after the existing validation/access checks. */
  startBatch: (batch: ValidatedWorkflowVideoBatch) => Promise<Response>;
}) {
  let user;

  try {
    user = await requireAIStudioProUser(request);
  } catch (error) {
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    return NextResponse.json(
      {
        error:
          error instanceof FirebaseAuthRequestError
            ? error.message
            : "Could not verify your session.",
        ok: false,
      },
      { status },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | GenerateVideoRequest
    | null;
  const prompt = normalizeAIStudioPrompt(body?.prompt ?? body?.hookIdea);
  // Resolve private browser links once, with ownership, before validation/billing.
  try {
    if (body) {
      body.avatarImageUrl = await canonicalMediaReference(body.avatarImageUrl, user.uid);
      if (Array.isArray(body.referenceImageUrls)) body.referenceImageUrls =
        await Promise.all(body.referenceImageUrls.map(value => canonicalMediaReference(value, user.uid)));
      if (Array.isArray(body.referenceAudioUrls)) body.referenceAudioUrls =
        await Promise.all(body.referenceAudioUrls.map(value => canonicalMediaReference(value, user.uid)));
      body.referenceVideoUrl = await canonicalMediaReference(body.referenceVideoUrl, user.uid);
    }
  } catch {
    return NextResponse.json({ error: "The selected private reference is unavailable to this account.", ok: false }, { status: 400 });
  }
  const avatarImageUrl = cleanHttpsUrl(body?.avatarImageUrl);
  const imageUrlsInput = body?.referenceImageUrls;
  const referenceImageUrls = Array.isArray(imageUrlsInput)
    ? imageUrlsInput.map(cleanHttpsUrl)
    : avatarImageUrl ? [avatarImageUrl] : [];
  const referenceVideoUrl = cleanHttpsUrl(body?.referenceVideoUrl);
  const referenceVideoAssetId = typeof body?.referenceVideoAssetId === "string" && UUID_PATTERN.test(body.referenceVideoAssetId)
    ? body.referenceVideoAssetId : null;
  const audioUrlsInput = body?.referenceAudioUrls;
  const audioAssetIdsInput = body?.referenceAudioAssetIds;
  const referenceAudioUrls = Array.isArray(audioUrlsInput) ? audioUrlsInput.map(cleanHttpsUrl) : [];
  const referenceAudioAssetIds = Array.isArray(audioAssetIdsInput) ? audioAssetIdsInput : [];
  const referenceVideoDurationSeconds = cleanReferenceVideoDuration(
    body?.referenceVideoDurationSeconds,
  );
  const aspectRatio = parseAIStudioVideoAspectRatio(body?.aspectRatio);
  const quantity = parseAIStudioGenerationQuantity(body?.quantity);
  if (body?.model !== undefined && !AI_STUDIO_VIDEO_MODELS.some((value) => value === body?.model)) {
    return NextResponse.json({ error: "Choose a supported video model.", ok: false }, { status: 400 });
  }
  const model = parseAIStudioVideoModel(body?.model);
  if (body?.exploreFormat !== undefined && body.exploreFormat !== "hook" && body.exploreFormat !== "wall_text") {
    return NextResponse.json({ error: "Choose a video workflow.", ok: false }, { status: 400 });
  }
  if (body?.exploreFormat && model !== "google_omni" && model !== "wan_3_0") {
    return NextResponse.json({ error: "Choose the workflow's supported video model.", ok: false }, { status: 400 });
  }
  const isFormatVideoReference = Boolean(body?.exploreFormat && referenceVideoUrl && model === "google_omni");
  const durationSeconds = isFormatVideoReference ? 3 : parseAIStudioVideoDuration(body?.durationSeconds);
  const resolution = parseAIStudioVideoResolution(body?.resolution);
  if (!isAIStudioVideoModelAvailable(model)) {
    return NextResponse.json({ error: `${getAIStudioVideoModelLabel(model)} is temporarily unavailable. Choose another video model.`, ok: false }, { status: 503 });
  }
  const isExploreRecreate =
    (body?.referenceType === "hook" && isExploreHookVideoId(body?.referenceId)) ||
    (body?.referenceType === "wall_text" &&
      isExploreWallTextVideoId(body?.referenceId));

  if (body?.avatarImageUrl && !avatarImageUrl) {
    return NextResponse.json(
      { error: "The reference image is not a trusted uploaded file.", ok: false },
      { status: 400 },
    );
  }

  if (
    (imageUrlsInput !== undefined && !Array.isArray(imageUrlsInput)) ||
    referenceImageUrls.some((url) => !url) ||
    (avatarImageUrl && referenceImageUrls[0] !== avatarImageUrl) ||
    new Set(referenceImageUrls).size !== referenceImageUrls.length
  ) {
    return NextResponse.json(
      { error: "Reference images must be distinct trusted uploaded files.", ok: false },
      { status: 400 },
    );
  }

  if (
    (audioUrlsInput !== undefined && !Array.isArray(audioUrlsInput)) ||
    (audioAssetIdsInput !== undefined && !Array.isArray(audioAssetIdsInput)) ||
    referenceAudioUrls.some((url) => !url) ||
    new Set(referenceAudioUrls).size !== referenceAudioUrls.length ||
    referenceAudioAssetIds.length !== referenceAudioUrls.length ||
    new Set(referenceAudioAssetIds).size !== referenceAudioAssetIds.length ||
    referenceAudioAssetIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))
  ) {
    return NextResponse.json(
      { error: "Audio references must be distinct uploaded audio files.", ok: false },
      { status: 400 },
    );
  }
  if (body?.exploreFormat && referenceAudioUrls.length) {
    return NextResponse.json({ error: "Add narration in Edit video; voice references are not used in this workflow.", ok: false }, { status: 400 });
  }
  if (isFormatVideoReference && (referenceImageUrls.length || !referenceVideoDurationSeconds || referenceVideoDurationSeconds > 3)) {
    return NextResponse.json({ error: "Choose one optional image or a video reference up to 3 seconds.", ok: false }, { status: 400 });
  }
  if ((referenceAudioUrls.length || referenceVideoUrl) && model !== "seedance_2_5" && !isFormatVideoReference) {
    return NextResponse.json(
      { error: "Choose Seedance 2.5 to use audio or video references through OpenRouter. Other models support image references only.", ok: false },
      { status: 400 },
    );
  }
  if (referenceAudioUrls.length > 1) {
    return NextResponse.json({ error: "Use one audio reference in UGC Pilot.", ok: false }, { status: 400 });
  }
  const maxReferences = model === "kling_3_0" ? 2 : 6;
  if (referenceImageUrls.length + referenceAudioUrls.length + (referenceVideoUrl ? 1 : 0) > maxReferences) {
    return NextResponse.json(
      { error: `This model accepts up to ${maxReferences} reference files in UGC Pilot.`, ok: false },
      { status: 400 },
    );
  }

  if (body?.referenceVideoUrl && !referenceVideoUrl) {
    return NextResponse.json(
      { error: "The reference video is not a trusted uploaded file.", ok: false },
      { status: 400 },
    );
  }

  if (isExploreRecreate && !body?.exploreFormat && referenceImageUrls.length === 0) {
    return NextResponse.json(
      {
        error:
          "Add a reference image before recreating an Explore video. This format is image-reference-only for better results.",
        ok: false,
      },
      { status: 400 },
    );
  }

  if ((referenceVideoUrl && (!referenceVideoAssetId || !referenceVideoDurationSeconds)) ||
      (!referenceVideoUrl && (body?.referenceVideoAssetId != null || body?.referenceVideoDurationSeconds != null))) {
    return NextResponse.json(
      { error: "Choose an uploaded reference video up to 30 seconds with its saved asset ID and duration. Videos are not shortened automatically.", ok: false },
      { status: 400 },
    );
  }

  if (!isAIStudioVideoResolutionSupported(model, resolution)) {
    const supportedResolutions = getAIStudioVideoResolutions(model).join(" or ");

    return NextResponse.json(
      {
        error: `${getAIStudioVideoModelLabel(model)} supports ${supportedResolutions}.`,
        ok: false,
      },
      { status: 400 },
    );
  }

  if (model === "google_omni" && (durationSeconds < 3 || durationSeconds > 10)) {
    return NextResponse.json(
      { error: "Google Omni duration must be between 3 and 10 seconds.", ok: false },
      { status: 400 },
    );
  }

  if (model === "kling_3_0" && (durationSeconds < 3 || durationSeconds > 15)) {
    return NextResponse.json(
      {
        error: "Kling 3.0 duration must be between 3 and 15 seconds.",
        ok: false,
      },
      { status: 400 },
    );
  }

  if (model === "seedance_2_5" && body?.durationSeconds !== undefined && (
    typeof body.durationSeconds !== "number" || !Number.isInteger(body.durationSeconds) ||
    body.durationSeconds < 4 || body.durationSeconds > 30
  )) {
    return NextResponse.json({ error: "Seedance 2.5 duration must be between 4 and 30 seconds.", ok: false }, { status: 400 });
  }

  if (model === "seedance_2_5" && body?.resolution !== undefined && body.resolution !== "480p" && body.resolution !== "720p") {
    return NextResponse.json({ error: "Seedance 2.5 supports 480p or 720p video quality.", ok: false }, { status: 400 });
  }

  if (model === "wan_3_0") {
    if (body?.durationSeconds !== undefined && (
      typeof body.durationSeconds !== "number" || !Number.isInteger(body.durationSeconds) ||
      body.durationSeconds < 2 || body.durationSeconds > 30
    )) {
      return NextResponse.json({ error: "WAN 3.0 duration must be between 2 and 30 seconds.", ok: false }, { status: 400 });
    }
    if (body?.resolution !== undefined && (typeof body.resolution !== "string" || !["480p", "720p", "1080p"].includes(body.resolution))) {
      return NextResponse.json({ error: "WAN 3.0 supports 480p, 720p or 1080p video quality.", ok: false }, { status: 400 });
    }
    if (body?.aspectRatio !== undefined && body.aspectRatio !== "9:16" && body.aspectRatio !== "16:9") {
      return NextResponse.json({ error: "Choose portrait 9:16 or landscape 16:9 for WAN 3.0.", ok: false }, { status: 400 });
    }
  }

  if (!prompt) {
    return NextResponse.json(
      {
        error: "Add a prompt before generating a video.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const promptLengthError = getAIStudioPromptLengthError(
    prompt,
    getExploreVideoPromptMaxLength({ model, hasReferenceVideo: Boolean(referenceVideoUrl), format: body?.exploreFormat === "hook" || body?.exploreFormat === "wall_text" ? body.exploreFormat : undefined }),
  );

  if (promptLengthError) {
    return NextResponse.json(
      { error: promptLengthError, ok: false },
      { status: 400 },
    );
  }

  if (model === "kling_3_0" && prompt.length < 2) {
    return NextResponse.json({ error: "Kling 3.0 requires a prompt of at least 2 characters.", ok: false }, { status: 400 });
  }

  // A trusted storage host does not prove ownership. Resolve timed references
  // before billing or freezing an Explore receipt; never silently discard them.
  try {
    const references = [
      ...referenceAudioUrls.map((url, index) => ({ kind: "audio" as const, url, id: referenceAudioAssetIds[index] as string })),
      ...(referenceVideoUrl && referenceVideoAssetId ? [{ kind: "video" as const, url: referenceVideoUrl, id: referenceVideoAssetId }] : []),
    ];
    if (new Set([...referenceImageUrls, ...references.map(ref => ref.url)]).size !== referenceImageUrls.length + references.length) {
      return NextResponse.json({ error: "Reference files must be distinct.", ok: false }, { status: 400 });
    }
    for (const reference of references) {
      const asset = await getMediaAssetForOwner({ assetId: reference.id, userId: user.uid });
      if (!asset || asset.id !== reference.id || asset.user_id !== user.uid || asset.deleted_at !== null ||
          asset.status !== "ready" || asset.collection !== reference.kind || asset.url !== reference.url ||
          !asset.mime_type.startsWith(`${reference.kind}/`) ||
          typeof asset.file_size_bytes !== "number" || !Number.isFinite(asset.file_size_bytes) || asset.file_size_bytes <= 0 ||
          asset.file_size_bytes > (reference.kind === "audio" ? 25 : 250) * 1024 ** 2 ||
          typeof asset.duration_seconds !== "number" || !Number.isFinite(asset.duration_seconds) || asset.duration_seconds <= 0 || asset.duration_seconds > 30 ||
          (reference.kind === "video" && asset.duration_seconds !== referenceVideoDurationSeconds)) {
        return NextResponse.json({ error: `Choose your own ready reference ${reference.kind} file up to 30 seconds. Its saved URL, type and duration must match.`, ok: false }, { status: 400 });
      }
    }
  } catch {
    return NextResponse.json({ error: "Could not verify your reference uploads. No generation was started. Try again after your files are available.", ok: false }, { status: 503 });
  }

  const missingRuntimeEnv = getMissingRuntimeEnv();

  if (missingRuntimeEnv.length > 0) {
    return NextResponse.json(
      {
        error: `Video generation is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )}.`,
        ok: false,
      },
      { status: 501 },
    );
  }

  const projectId = "ai-studio";
  const baseIdempotencyKey = cleanIdempotencyKey(
    request.headers.get("Idempotency-Key") ?? body?.idempotencyKey,
  );
  if (options) {
    return options.startBatch({
      amountPerVideo: getGenerationCreditCost("video", durationSeconds),
      requestKey: baseIdempotencyKey,
      userId: user.uid,
      inputs: Array.from({ length: quantity }, (_, index) => ({
        aspectRatio, avatarImageUrl, referenceImageUrls, referenceAudioUrls,
        ...(referenceAudioAssetIds.length ? { referenceAudioAssetIds: referenceAudioAssetIds as string[] } : {}),
        ...(referenceVideoAssetId ? { referenceVideoAssetId } : {}),
        batchIndex: index + 1, batchSize: quantity, durationSeconds,
        hookIdea: body?.exploreFormat === "wall_text" ? `${prompt}\n${WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS}` : prompt, model,
        ...(body?.exploreFormat === "hook" || body?.exploreFormat === "wall_text" ? { exploreFormat: body.exploreFormat } : {}),
        ...(model === "seedance_2_5" || model === "wan_3_0" ? { provider: "openrouter" } : {}),
        promptMode: "direct", projectId,
        referenceVideoDurationSeconds, referenceVideoUrl,
        referenceId: typeof body?.referenceId === "string" ? body.referenceId : null,
        referenceType: typeof body?.referenceType === "string" ? body.referenceType : null,
        referenceUrl: typeof body?.referenceUrl === "string" ? body.referenceUrl : null,
        resolution, userId: user.uid, videoId: crypto.randomUUID(),
      })),
    });
  }
  const queuedJobs: { jobId: string; videoId: string }[] = [];
  let queueError: unknown = null;

  for (let index = 0; index < quantity; index += 1) {
    const videoId = crypto.randomUUID();
    const idempotencyKey = getChildIdempotencyKey(
      baseIdempotencyKey,
      index,
      quantity,
    );
    let creditsReserved = false;

    try {
      await reserveBillingCredits({
        amount: getGenerationCreditCost("video", durationSeconds),
        idempotencyKey,
        jobType: VIDEO_JOB_TYPE,
        userId: user.uid,
      });
      creditsReserved = true;
      const backgroundJob = await createAndDispatchBackgroundJob({
        idempotencyKey,
        input: {
          aspectRatio,
          ...(body?.exploreFormat === "hook" || body?.exploreFormat === "wall_text" || body?.exploreFormat === "slideshow" ? { exploreFormat: body.exploreFormat } : {}),
          avatarImageUrl,
          referenceImageUrls,
          referenceAudioUrls,
          ...(referenceAudioAssetIds.length ? { referenceAudioAssetIds: referenceAudioAssetIds as string[] } : {}),
          ...(referenceVideoAssetId ? { referenceVideoAssetId } : {}),
          batchIndex: index + 1,
          batchSize: quantity,
          durationSeconds,
          hookIdea: body?.exploreFormat === "wall_text" ? `${prompt}\n${WALL_TEXT_VIDEO_BACKGROUND_INSTRUCTIONS}` : prompt,
          model,
          ...(model === "seedance_2_5" || model === "wan_3_0" ? { provider: "openrouter" } : {}),
          promptMode: "direct",
          projectId,
          referenceVideoDurationSeconds,
          referenceVideoUrl,
          referenceId:
            typeof body?.referenceId === "string" ? body.referenceId : null,
          referenceType:
            typeof body?.referenceType === "string" ? body.referenceType : null,
          referenceUrl:
            typeof body?.referenceUrl === "string" ? body.referenceUrl : null,
          resolution,
          userId: user.uid,
          videoId,
        },
        jobType: VIDEO_JOB_TYPE,
        projectId,
        userId: user.uid,
      });

      queuedJobs.push({
        jobId: backgroundJob.id,
        videoId: getJobInputString(backgroundJob.input, "videoId") || videoId,
      });
    } catch (error) {
      queueError = error;

      if (creditsReserved) {
        await releaseBillingCredits({ idempotencyKey, userId: user.uid }).catch(
          (releaseError) =>
            console.error(
              "Could not release video generation credits:",
              releaseError,
            ),
        );
      }

      break;
    }
  }

  if (queuedJobs.length > 0) {
    const firstJob = queuedJobs[0];
    const partial = queuedJobs.length < quantity;

    return NextResponse.json(
      {
        jobId: firstJob.jobId,
        jobs: queuedJobs,
        message: partial
          ? `${queuedJobs.length} of ${quantity} video generations started.`
          : `${quantity} video generation${quantity === 1 ? "" : "s"} started.`,
        ok: true,
        partial,
        videoId: firstJob.videoId,
      },
      { status: 202 },
    );
  }

  {
    const error = queueError;

    if (error instanceof BillingAccessError) {
      return NextResponse.json(
        { error: error.message, ok: false },
        { status: error.status },
      );
    }

    console.error("Failed to start video generation:", error);

    return NextResponse.json(
      {
        error: "Could not queue video generation.",
        ok: false,
      },
      { status: 502 },
    );
  }
}

function getChildIdempotencyKey(baseKey: string, index: number, quantity: number) {
  return quantity === 1
    ? baseKey
    : `${baseKey.slice(0, 190)}:${index + 1}`;
}

function cleanIdempotencyKey(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : crypto.randomUUID();
}

function cleanReferenceVideoDuration(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 30
    ? value
    : null;
}

function getJobInputString(value: unknown, key: string) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    key in value &&
    typeof value[key as keyof typeof value] === "string"
    ? String(value[key as keyof typeof value])
    : "";
}

export async function handleAIStudioVideoStatus(request: Request) {
  let user;

  try {
    user = await requireAIStudioProUser(request);
  } catch (error) {
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    return NextResponse.json(
      {
        error:
          error instanceof FirebaseAuthRequestError
            ? error.message
            : "Could not verify your session.",
        ok: false,
      },
      { status },
    );
  }

  const jobId = new URL(request.url).searchParams.get("jobId")?.trim() ?? "";

  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json(
      {
        error: "Missing or invalid job id.",
        ok: false,
      },
      { status: 400 },
    );
  }

  try {
    const job = await getBackgroundJobById(jobId);

    if (!job || job.userId !== user.uid) {
      return NextResponse.json(
        {
          error: "Video generation job was not found.",
          ok: false,
        },
        { status: 404 },
      );
    }

    if (job.jobType !== VIDEO_JOB_TYPE) {
      return NextResponse.json(
        {
          error: "The requested job is not a video generation job.",
          ok: false,
        },
        { status: 400 },
      );
    }

    if (job.status === "completed") {
      await deliverBillingUsageForJob(job.id).catch((error) =>
        console.error("Could not deliver video usage to Dodo:", error),
      );
    }

    return NextResponse.json({
      job: {
        error: job.errorMessage,
        id: job.id,
        isTerminal: TERMINAL_STATUSES.has(job.status),
        output: getSafeOutput(job.output),
        status: job.status,
      },
      ok: true,
    });
  } catch (error) {
    console.error("Failed to retrieve video generation status:", error);

    return NextResponse.json(
      {
        error: "Could not retrieve video generation status.",
        ok: false,
      },
      { status: 500 },
    );
  }
}
