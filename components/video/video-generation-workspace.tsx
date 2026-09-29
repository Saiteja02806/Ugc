"use client";

import {
  ChevronDown,
  ChevronUp,
  Clock3,
  History,
  Loader2,
  Monitor,
  Pause,
  Play,
  ScanText,
  Search,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  AiStudioComposer,
  AiStudioSettingSelect,
  AiStudioRatioPicker,
} from "@/components/generation/ai-studio-composer";
import {
  AiStudioResults,
  type AiStudioResultsStatus,
} from "@/components/generation/ai-studio-results";
import { AiStudioResultActions } from "@/components/generation/ai-studio-result-actions";
import { ReferenceMediaUpload } from "@/components/generation/reference-media-upload";
import { Input } from "@/components/ui/input";
import { ReferenceImageListUpload } from "@/components/video/reference-image-list-upload";
import { CreatorReferencePicker } from "@/components/video/creator-reference-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import type { AIStudioAccessState } from "@/lib/ai-studio/access-policy";
import { DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND } from "@/lib/billing/generation-credit-policy";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import {
  AI_STUDIO_GENERATION_QUANTITIES,
  AI_STUDIO_VIDEO_ASPECT_RATIOS,
  AI_STUDIO_VIDEO_DURATIONS,
  AI_STUDIO_VIDEO_MODELS,
  AI_STUDIO_VIDEO_RESOLUTIONS,
  isAIStudioVideoResolutionSupported,
  parseAIStudioVideoModel,
  parseAIStudioVideoResolution,
  type AIStudioGenerationQuantity,
  type AIStudioVideoAspectRatio,
  type AIStudioVideoDuration,
  type AIStudioVideoModel,
  type AIStudioVideoResolution,
} from "@/lib/ai-studio/generation-settings";
import {
  fetchAIStudioMediaAsset,
  fetchAIStudioMediaAssets,
} from "@/lib/ai-studio/media-client";
import {
  getAIStudioVideoResults,
  type AIStudioVideoResult,
  upsertAIStudioResult,
} from "@/lib/ai-studio/media-results";
import {
  filterAIStudioVideoHistory,
  groupAIStudioVideoHistory,
} from "@/lib/ai-studio/video-history";
import {
  AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "@/lib/ai-studio/prompt-policy";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  persistJobIdInUrl,
  useBackgroundJobs,
  useCancelBackgroundJob,
  usePersistedJobIdFromUrl,
  useRetryBackgroundJob,
} from "@/lib/jobs/background-job-client";
import type { Json } from "@/lib/jobs/background-jobs";
import { cn } from "@/lib/utils";

type GenerationState = "empty" | "generating" | "completed" | "failed";

type GeneratedVideo = AIStudioVideoResult;

const VIDEO_JOB_STORAGE_PREFIX = "ugc-ai-studio.latest-video-job.v2.";
const VIDEO_JOB_METADATA_PREFIX = "ugc-ai-studio.video-job.v2.";
const VIDEO_JOB_URL_PARAMETER = "videoJob";
const VIDEO_RESULT_WIDTH_CLASS_NAMES: Record<GeneratedVideo["ratio"], string> = {
  "4:5": "w-[min(100%,20rem)]",
  "1:1": "w-[min(100%,24rem)]",
  "9:16": "w-[min(100%,22.5rem)]",
  "16:9": "w-[min(100%,38rem)]",
};

type GenerateVideoResponse =
  | {
      jobId: string;
      jobs: { jobId: string; videoId: string }[];
      message: string;
      ok: true;
      partial: boolean;
      videoId: string;
    }
  | {
      error: string;
      ok: false;
    };

function getVideoJobOutput(output: Json | null) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  return {
    mediaAssetId:
      typeof output.mediaAssetId === "string" ? output.mediaAssetId : null,
    ratio:
      typeof output.ratio === "string" &&
      AI_STUDIO_VIDEO_ASPECT_RATIOS.includes(
        output.ratio as AIStudioVideoAspectRatio,
      )
        ? (output.ratio as AIStudioVideoAspectRatio)
        : null,
    url: typeof output.url === "string" ? output.url : null,
    videoId: typeof output.videoId === "string" ? output.videoId : null,
  };
}

function persistPendingVideoMetadata(
  userId: string,
  jobs: readonly { jobId: string }[],
  metadata: {
    aspectRatio: AIStudioVideoAspectRatio;
    avatarName: string;
    model: AIStudioVideoModel;
    prompt: string;
    resolution: AIStudioVideoResolution;
  },
) {
  try {
    const jobIds = jobs.map((job) => job.jobId);
    window.localStorage.setItem(
      `${VIDEO_JOB_STORAGE_PREFIX}${userId}`,
      JSON.stringify(jobIds),
    );
    for (const jobId of jobIds) {
      window.localStorage.setItem(
        `${VIDEO_JOB_METADATA_PREFIX}${userId}.${jobId}`,
        JSON.stringify(metadata),
      );
    }
  } catch {
    // Supabase remains authoritative; this metadata only restores local labels.
  }
}

function getPendingVideoMetadata(userId: string, jobId: string) {
  try {
    const rawValue = window.localStorage.getItem(
      `${VIDEO_JOB_METADATA_PREFIX}${userId}.${jobId}`,
    );

    if (!rawValue) {
      return null;
    }

    const value = JSON.parse(rawValue) as Record<string, unknown>;

    return {
      aspectRatio:
        typeof value.aspectRatio === "string" &&
        AI_STUDIO_VIDEO_ASPECT_RATIOS.includes(
          value.aspectRatio as AIStudioVideoAspectRatio,
        )
          ? (value.aspectRatio as AIStudioVideoAspectRatio)
          : "9:16",
      avatarName:
        typeof value.avatarName === "string" ? value.avatarName : "",
      model: parseAIStudioVideoModel(value.model),
      prompt: typeof value.prompt === "string" ? value.prompt : "",
      resolution: parseAIStudioVideoResolution(value.resolution),
    };
  } catch {
    return null;
  }
}

function getStoredVideoJobIds(userId: string) {
  try {
    const rawValue = window.localStorage.getItem(
      `${VIDEO_JOB_STORAGE_PREFIX}${userId}`,
    );

    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;

      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];
    } catch {
      return [rawValue];
    }
  } catch {
    return [];
  }
}

function extractInstagramShortcode(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      (segments[0] === "reel" || segments[0] === "p" || segments[0] === "tv") &&
      segments[1]
    ) {
      return segments[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function VideoGenerationStudioPanel({
  accessMessage,
  accessState = "locked",
  active = true,
  creditsPerSecond = DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND,
  creditsRemaining = null,
}: {
  accessMessage?: string | null;
  accessState?: AIStudioAccessState;
  active?: boolean;
  creditsPerSecond?: number;
  creditsRemaining?: number | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refTypeParam = searchParams.get("refType");
  const refIdParam = searchParams.get("refId");
  const sourceUrlParam = searchParams.get("sourceUrl");
  const hasExploreRecreateParam =
    (refTypeParam === "hook" || refTypeParam === "wall_text") &&
    searchParams.get("exploreRecreate") === "1";
  const referenceParamContext: {
    id: string;
    shortcode: string | null;
    sourceUrl: string;
    type: "hook" | "wall_text";
  } | null =
    (refTypeParam === "hook" || refTypeParam === "wall_text") && refIdParam
      ? {
          id: refIdParam,
          shortcode: extractInstagramShortcode(sourceUrlParam),
          sourceUrl: sourceUrlParam ?? "",
          type: refTypeParam,
        }
      : null;
  const referenceParamKey = referenceParamContext
    ? `${referenceParamContext.type}:${referenceParamContext.id}:${referenceParamContext.sourceUrl}`
    : null;
  const [dismissedReferenceKey, setDismissedReferenceKey] = useState<
    string | null
  >(null);
  const referenceContext =
    referenceParamKey && dismissedReferenceKey !== referenceParamKey
      ? referenceParamContext
      : null;
  const isExploreRecreate =
    hasExploreRecreateParam &&
    (referenceContext?.type === "hook" || referenceContext?.type === "wall_text");

  function handleDismissReference() {
    setDismissedReferenceKey(referenceParamKey);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("refType");
    nextParams.delete("refId");
    nextParams.delete("sourceUrl");
    nextParams.delete("exploreRecreate");
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  const { loading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] =
    useState<AIStudioVideoAspectRatio>("9:16");
  const [quantity, setQuantity] =
    useState<AIStudioGenerationQuantity>(1);
  const [model, setModel] = useState<AIStudioVideoModel>("seedance_2_5");
  const [durationSeconds, setDurationSeconds] =
    useState<AIStudioVideoDuration>(5);
  const [resolution, setResolution] =
    useState<AIStudioVideoResolution>("720p");
  const [uploadedReference, setUploadedReference] =
    useState<AIStudioReferenceMedia | null>(null);
  const [additionalImageReferences, setAdditionalImageReferences] =
    useState<AIStudioReferenceMedia[]>([]);
  const [uploadedVideoReference, setUploadedVideoReference] =
    useState<AIStudioReferenceMedia | null>(null);
  const [selectedCreatorReferenceId, setSelectedCreatorReferenceId] =
    useState<string | null>(null);
  const [creatorReferenceUploadPending, setCreatorReferenceUploadPending] =
    useState(false);
  const [referenceImageRequiredDialogOpen, setReferenceImageRequiredDialogOpen] =
    useState(false);
  const [activeVideoPrompt, setActiveVideoPrompt] = useState("");
  const [latestCompletedVideoId, setLatestCompletedVideoId] = useState<string | null>(null);
  const [generationState, setGenerationState] =
    useState<GenerationState>("empty");
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [submittedJobIds, setSubmittedJobIds] = useState<string[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [storedJobIds, setStoredJobIds] = useState<string[]>([]);
  const [ignoredPersistedJobId, setIgnoredPersistedJobId] = useState<
    string | null
  >(null);
  const resolvedJobIdsRef = useRef(new Set<string>());
  const billingSyncedJobIdsRef = useRef(new Set<string>());
  const submissionKeyRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const persistedJobId = usePersistedJobIdFromUrl(VIDEO_JOB_URL_PARAMETER);
  const urlJobId =
    persistedJobId && persistedJobId !== ignoredPersistedJobId
      ? persistedJobId
      : null;
  const activeJobIds = Array.from(
    new Set([
      ...submittedJobIds,
      ...(urlJobId ? [urlJobId] : []),
      ...storedJobIds,
    ]),
  );
  const activeJobQueries = useBackgroundJobs(activeJobIds);
  const cancelJob = useCancelBackgroundJob();
  const retryJob = useRetryBackgroundJob();
  const generationLocked = accessState !== "pro";
  const creditsPerVideo = durationSeconds * creditsPerSecond;
  const requiredCredits = creditsPerVideo * quantity;
  const hasInsufficientCredits =
    accessState === "pro" &&
    creditsRemaining !== null &&
    creditsRemaining < requiredCredits;
  const composerMessage = generationLocked
    ? accessMessage
    : hasInsufficientCredits
      ? `This generation needs ${requiredCredits} AI credits. You have ${creditsRemaining}.`
      : `This generation uses ${requiredCredits} AI credits (${creditsPerSecond} per second).`;

  const referenceImages = [
    ...(uploadedReference ? [uploadedReference] : []),
    ...additionalImageReferences,
  ];
  const activeReferenceImageUrl = uploadedReference?.asset.url ?? null;
  const maxReferenceImages = model === "seedance_2_5"
    ? (uploadedVideoReference ? 29 : 30)
    : 6;
  const uploadedReferenceVideo = uploadedVideoReference;

  function handleReferenceChange(selection: AIStudioReferenceMedia | null) {
    submissionKeyRef.current = null;
    setSelectedCreatorReferenceId(null);
    setUploadedReference(selection);
    if (!selection) setAdditionalImageReferences([]);
    if (selection && model === "google_omni") setUploadedVideoReference(null);
  }

  function handleImageReferencesChange(selections: AIStudioReferenceMedia[]) {
    submissionKeyRef.current = null;
    setSelectedCreatorReferenceId(null);
    setUploadedReference(selections[0] ?? null);
    setAdditionalImageReferences(selections.slice(1));
    if (selections.length && model === "google_omni") setUploadedVideoReference(null);
  }

  function handleVideoReferenceChange(selection: AIStudioReferenceMedia | null) {
    submissionKeyRef.current = null;
    setUploadedVideoReference(selection);
    if (!selection) return;
    if (model === "google_omni") {
      setUploadedReference(null);
      setAdditionalImageReferences([]);
      setSelectedCreatorReferenceId(null);
    } else {
      if (referenceImages.length > 29) {
        setAdditionalImageReferences(referenceImages.slice(1, 29));
        setActionNotice("The video uses one of Seedance's 30 reference slots; the last image was removed.");
      }
      const matchingDuration = AI_STUDIO_VIDEO_DURATIONS.find(
        (duration) => duration >= 4 && duration >= selection.asset.durationSeconds!,
      );
      if (matchingDuration) setDurationSeconds(matchingDuration);
    }
    if (selection.asset.ratio === "9:16" || selection.asset.ratio === "16:9") {
      setAspectRatio(selection.asset.ratio);
    }
  }
  const queriedJobs = activeJobQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  );
  const durableJobs = queriedJobs.filter(
    (job) => job.jobType === "video_generation",
  );
  const failedDurableJob = durableJobs.find((job) => job.status === "failed");
  const cancelledDurableJob = durableJobs.find(
    (job) => job.status === "cancelled",
  );
  const completedWithoutOutput = durableJobs.find(
    (job) =>
      job.status === "completed" && !getVideoJobOutput(job.output)?.url,
  );
  const durableNotice =
    cancelledDurableJob
      ? "Video generation was cancelled."
      : failedDurableJob
        ? failedDurableJob.error?.message ||
          "Video generation failed. You can retry it."
        : completedWithoutOutput
          ? "Video generation completed without a usable output."
          : null;
  const effectiveGenerationState: GenerationState =
    activeJobQueries.some((query) => query.isPending)
      ? "generating"
      : durableJobs.some(
            (job) =>
              !["cancelled", "completed", "failed"].includes(job.status),
          )
        ? "generating"
        : failedDurableJob || cancelledDurableJob || completedWithoutOutput
          ? "failed"
          : generationState;
  const isGenerating =
    effectiveGenerationState === "generating";
  const pendingGenerationCount =
    generationState === "generating" && activeJobIds.length === 0
    ? quantity
    : activeJobQueries.reduce((count, query) => {
        if (query.isPending) {
          return count + 1;
        }

        return query.data &&
          !["cancelled", "completed", "failed"].includes(query.data.status)
          ? count + 1
          : count;
      }, 0);

  useEffect(() => {
    activeUserIdRef.current = user?.uid ?? null;
    resolvedJobIdsRef.current.clear();
    billingSyncedJobIdsRef.current.clear();

    return () => {
      activeUserIdRef.current = null;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!active || authLoading) {
      return;
    }

    let ignore = false;

    async function loadGeneratedVideos() {
      if (!user) {
        if (!ignore) {
          setGeneratedVideos([]);
          setStoredJobIds([]);
          setResultsError("Sign in to view your generated videos.");
          setResultsLoading(false);
        }
        return;
      }

      setResultsLoading(true);
      setResultsError(null);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in to view your generated videos.");
        }

        const assets = await fetchAIStudioMediaAssets({
          collection: "video",
          sourceType: "generated_video",
          token,
        });

        if (!ignore) {
          setGeneratedVideos(getAIStudioVideoResults(assets));
          setSubmittedJobIds([]);
          setIgnoredPersistedJobId(null);
          setStoredJobIds(getStoredVideoJobIds(user.uid));
        }
      } catch (error) {
        if (!ignore) {
          setResultsError(
            getErrorMessage(error, "Could not load your generated videos."),
          );
        }
      } finally {
        if (!ignore) {
          setResultsLoading(false);
        }
      }
    }

    void loadGeneratedVideos();

    return () => {
      ignore = true;
    };
  }, [active, authLoading, user]);

  useEffect(() => {
    if (
      persistedJobId &&
      queriedJobs.some(
        (job) =>
          job?.id === persistedJobId && job.jobType !== "video_generation",
      )
    ) {
      const timeoutId = window.setTimeout(
        () => setIgnoredPersistedJobId(persistedJobId),
        0,
      );

      return () => window.clearTimeout(timeoutId);
    }
  }, [persistedJobId, queriedJobs]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const terminalJobs = durableJobs.filter(
      (job) =>
        ["cancelled", "completed", "failed"].includes(job.status) &&
        !billingSyncedJobIdsRef.current.has(job.id),
    );

    if (terminalJobs.length === 0) {
      return;
    }

    terminalJobs.forEach((job) => billingSyncedJobIdsRef.current.add(job.id));
    void queryClient.invalidateQueries({
      queryKey: ["billing-subscription", user.uid],
    });
  }, [durableJobs, queryClient, user]);

  useEffect(() => {
    const completedJobs = durableJobs.filter(
      (job) =>
        job.status === "completed" &&
        !resolvedJobIdsRef.current.has(job.id) &&
        Boolean(getVideoJobOutput(job.output)?.url),
    );

    if (!user || completedJobs.length === 0) {
      return;
    }
    for (const completedJob of completedJobs) {
      resolvedJobIdsRef.current.add(completedJob.id);
    }

    const userId = user.uid;

    async function restoreCompletedVideo(
      completedJob: (typeof completedJobs)[number],
    ) {
      const completedOutput = getVideoJobOutput(completedJob.output);

      if (!completedOutput?.url) {
        return;
      }

      const completedOutputUrl = completedOutput.url;

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in to restore the generated video.");
        }

        const metadata = getPendingVideoMetadata(userId, completedJob.id);
        let persistedVideo: GeneratedVideo | null = null;

        try {
          if (completedOutput.mediaAssetId) {
            const mediaAsset = await fetchAIStudioMediaAsset(
              completedOutput.mediaAssetId,
              token,
            );
            persistedVideo = getAIStudioVideoResults([mediaAsset], 1)[0] ?? null;
          } else {
            const assets = await fetchAIStudioMediaAssets({
              collection: "video",
              sourceType: "generated_video",
              token,
            });
            persistedVideo =
              getAIStudioVideoResults(
                assets.filter(
                  (asset) => asset.sourceRecordId === completedJob.id,
                ),
                1,
              )[0] ?? null;
          }
        } catch {
          // Keep the completed output playable while media persistence catches
          // up or the media endpoint is temporarily unavailable.
        }

        const completedPrompt = metadata?.prompt || "Generated video";
        const nextVideo: GeneratedVideo = persistedVideo
          ? {
              ...persistedVideo,
              modelLabel: getVideoModelLabel(metadata?.model),
              prompt: metadata?.prompt || persistedVideo.prompt,
              resolution: metadata?.resolution ?? persistedVideo.resolution,
            }
          : {
              createdAt: completedJob.completedAt ?? completedJob.updatedAt,
              durationSeconds: null,
              id:
                completedOutput.mediaAssetId ??
                completedOutput.videoId ??
                completedJob.id,
              mediaAssetId: completedOutput.mediaAssetId,
              modelLabel: getVideoModelLabel(metadata?.model),
              prompt: completedPrompt,
              ratio:
                completedOutput.ratio ?? metadata?.aspectRatio ?? "9:16",
              resolution: metadata?.resolution ?? null,
              status: "Ready",
              thumbnailUrl: null,
              title: getGeneratedVideoTitle(completedPrompt),
              url: completedOutputUrl,
            };

        if (activeUserIdRef.current !== userId) {
          return;
        }

        setGeneratedVideos((currentVideos) =>
          upsertAIStudioResult(currentVideos, nextVideo),
        );
        setLatestCompletedVideoId(nextVideo.id);
        setTimeout(() => setLatestCompletedVideoId(null), 3500);
        setActiveVideoPrompt("");
        setGenerationState("completed");
        setActionNotice(null);
        setActionError(null);
      } catch (error) {
        resolvedJobIdsRef.current.delete(completedJob.id);
        if (activeUserIdRef.current === userId) {
          setGenerationState("failed");
          setActionError(
            getErrorMessage(error, "Could not restore the generated video."),
          );
        }
      }
    }

    void Promise.all(completedJobs.map(restoreCompletedVideo));
  }, [durableJobs, user]);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const trimmedPrompt = normalizeAIStudioPrompt(prompt);
    const promptLengthError = getAIStudioPromptLengthError(
      trimmedPrompt,
      AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
    );

    if (
      generationLocked ||
      hasInsufficientCredits ||
      !trimmedPrompt ||
      isGenerating
    ) {
      return;
    }

    if (isExploreRecreate && !activeReferenceImageUrl) {
      setReferenceImageRequiredDialogOpen(true);
      return;
    }

    if (promptLengthError) {
      setActionError(promptLengthError);
      return;
    }

    setActionNotice(null);
    setActionError(null);
    setActiveVideoPrompt(trimmedPrompt);
    setGenerationState("generating");

    try {
      const token = await getCurrentUserIdToken();

      if (!token || !user) {
        throw new Error("Sign in before generating a video.");
      }

      const idempotencyKey =
        submissionKeyRef.current ?? crypto.randomUUID();
      submissionKeyRef.current = idempotencyKey;

      const response = await fetch("/api/ai-studio/videos/generate", {
        body: JSON.stringify({
          aspectRatio,
          avatarImageUrl: activeReferenceImageUrl,
          referenceImageUrls: referenceImages.map((image) => image.asset.url),
          durationSeconds,
          idempotencyKey,
          model,
          prompt: trimmedPrompt,
          quantity,
          resolution,
          referenceVideoDurationSeconds:
            uploadedReferenceVideo?.asset.durationSeconds ?? null,
          referenceVideoUrl: uploadedReferenceVideo?.asset.url ?? null,
          referenceId: referenceContext?.id ?? null,
          referenceType: referenceContext?.type ?? null,
          referenceUrl: referenceContext?.sourceUrl ?? null,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });
      const data = (await response.json()) as GenerateVideoResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.ok === false ? data.error : "Video generation could not start.",
        );
      }
      persistPendingVideoMetadata(user.uid, data.jobs, {
        aspectRatio,
        avatarName: uploadedReference?.asset.title ?? uploadedVideoReference?.asset.title ?? "",
        model,
        prompt: trimmedPrompt,
        resolution,
      });
      void queryClient.invalidateQueries({
        queryKey: ["billing-subscription", user.uid],
      });
      persistJobIdInUrl(data.jobId, VIDEO_JOB_URL_PARAMETER);
      for (const job of data.jobs) {
        resolvedJobIdsRef.current.delete(job.jobId);
      }
      const jobIds = data.jobs.map((job) => job.jobId);
      setStoredJobIds(jobIds);
      setSubmittedJobIds(jobIds);
      if (data.partial) {
        setActionNotice(data.message);
      }
      submissionKeyRef.current = null;
    } catch (error) {
      console.error("Video generation failed:", error);
      setActionError(
        getErrorMessage(error, "Video generation failed. Try again."),
      );
      setGenerationState("failed");
    }
  }

  async function handleCancelGeneration() {
    const cancellableJobIds = durableJobs
      .filter((job) => !["cancelled", "completed", "failed"].includes(job.status))
      .map((job) => job.id);

    if (cancellableJobIds.length === 0 || cancelJob.isPending) {
      return;
    }

    try {
      for (const jobId of cancellableJobIds) {
        await cancelJob.mutateAsync(jobId);
      }
      setActionError(null);
      setActionNotice(
        "Cancellation requested. The current checkpoint will stop safely.",
      );
    } catch (error) {
      setActionError(
        getErrorMessage(error, "Could not cancel this video job."),
      );
    }
  }

  async function handleRetryGeneration() {
    const retryableJob = durableJobs.find(
      (job) => job.status === "failed" && Boolean(job.error?.retryable),
    );

    if (!retryableJob || retryJob.isPending) {
      return;
    }

    try {
      resolvedJobIdsRef.current.delete(retryableJob.id);
      await retryJob.mutateAsync(retryableJob.id);
      setGenerationState("generating");
      setActionNotice(null);
      setActionError(null);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not retry this video job."));
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  const failedJobQuery = activeJobQueries.find((query) => query.isError);
  const jobQueryError = failedJobQuery
    ? getErrorMessage(
        failedJobQuery.error,
        "Could not retrieve the video generation job.",
      )
    : null;
  const resultsErrorMessage =
    actionError ??
    jobQueryError ??
    (effectiveGenerationState === "failed" ? durableNotice : null) ??
    resultsError;
  const resultsStatus: AiStudioResultsStatus | null =
    resultsErrorMessage
      ? {
          label: resultsErrorMessage,
          tone: "error",
        }
      : effectiveGenerationState === "generating"
        ? { label: "Creating your video…", tone: "progress" }
        : actionNotice ?? durableNotice
          ? { label: actionNotice ?? durableNotice ?? "", tone: "neutral" }
          : null;
  const canRetry = durableJobs.some(
    (job) => job.status === "failed" && Boolean(job.error?.retryable),
  );
  const filteredHistoryVideos = filterAIStudioVideoHistory(
    generatedVideos,
    historyQuery,
  );
  const historyGroups = groupAIStudioVideoHistory(filteredHistoryVideos);

  function focusHistoryVideo(videoId: string) {
    setHistoryOpen(false);

    window.requestAnimationFrame(() => {
      document
        .getElementById(`ai-studio-video-result-${videoId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div
      id="ai-studio-videos-panel"
      role="tabpanel"
      aria-labelledby="ai-studio-videos-tab"
      hidden={!active}
      className={cn(
        "min-h-0 flex-1 flex-col",
        active ? "flex flex-col" : "hidden",
      )}
    >
      <AiStudioResults
        ariaLabel="Generated videos"
        emptyDescription="Describe the video you want below. Finished generations are saved to your account."
        gridClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 2xl:grid-cols-1"
        hasResults={generatedVideos.length > 0 || isGenerating}
        loading={resultsLoading}
        status={resultsStatus}
        toolbar={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            className="gap-2 rounded-full bg-card/90 px-3 shadow-xs"
          >
            <History className="size-3.5" aria-hidden="true" />
            History
            {generatedVideos.length > 0 ? (
              <span className="rounded-full bg-card-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted">
                {generatedVideos.length}
              </span>
            ) : null}
          </Button>
        }
      >
        {isGenerating
          ? Array.from(
              { length: Math.max(1, pendingGenerationCount) },
              (_, index) => (
                <OptimisticVideoCard
                  key={`pending-video-${index}`}
                  aspectRatio={aspectRatio}
                  avatarThumbnail={activeReferenceImageUrl}
                  avatarLabel={uploadedReference?.asset.title ?? null}
                  prompt={activeVideoPrompt}
                />
              ),
            )
          : null}
        {generatedVideos.map((video) => (
          <VideoResultCard
            key={video.id}
            video={video}
            isNew={video.id === latestCompletedVideoId}
          />
        ))}
      </AiStudioResults>

      <VideoHistoryDrawer
        groups={historyGroups}
        onClose={() => setHistoryOpen(false)}
        onQueryChange={setHistoryQuery}
        onSelectVideo={focusHistoryVideo}
        open={historyOpen}
        query={historyQuery}
        selectedVideoId={latestCompletedVideoId}
      />

      <AiStudioComposer
        accessMessage={composerMessage}
        active={active}
        ariaLabel="Video prompt"
        contextBanner={
          referenceContext ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-foreground shadow-sm">
              <div className="flex items-center gap-2 truncate">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-selected text-primary">
                  {referenceContext.type === "hook" ? (
                    <Video className="size-3" aria-hidden="true" />
                  ) : (
                    <ScanText className="size-3" aria-hidden="true" />
                  )}
                </span>
                <span className="font-semibold text-foreground-strong">
                  {isExploreRecreate
                    ? "Explore Recreate"
                    : referenceContext.type === "hook"
                    ? "Reference Hook"
                    : "Reference Format"}
                </span>
                <span className="truncate text-muted">
                  {referenceContext.shortcode
                    ? `• Instagram (${referenceContext.shortcode})`
                    : "• Attached Context"}
                </span>
                {isExploreRecreate ? (
                  <span className="shrink-0 font-medium text-primary">
                    • Image required
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleDismissReference}
                aria-label="Remove reference context"
                title="Remove reference"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-card hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : null
        }
        generateDisabled={
          generationLocked ||
          hasInsufficientCredits ||
          !prompt.trim() ||
          creatorReferenceUploadPending ||
          isGenerating
        }
        generateLabel="Generate video"
        generationLocked={generationLocked}
        isGenerating={isGenerating}
        layout="unified"
        unifiedMaxWidthClassName="max-w-[1280px]"
        leadingControl={
          <div className="flex min-w-0 flex-col gap-2">
            <ReferenceImageListUpload
              active={active}
              disabled={generationLocked || isGenerating || creatorReferenceUploadPending}
              maxImages={maxReferenceImages}
              selections={referenceImages}
              onChange={handleImageReferencesChange}
            />
            {!isExploreRecreate && model === "seedance_2_5" ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2"><ReferenceMediaUpload
                active={active}
                allowedKinds={["video"]}
                disabled={generationLocked || isGenerating || creatorReferenceUploadPending}
                maxVideoDurationSeconds={model === "seedance_2_5" ? 30 : 3}
                selection={uploadedVideoReference}
                onChange={handleVideoReferenceChange}
              /></div>
            ) : null}
          </div>
        }
        maxLength={AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH}
        name="videoPrompt"
        placeholder="Describe the video you want to create…"
        prompt={prompt}
        onPromptChange={(nextPrompt) => {
          submissionKeyRef.current = null;
          setActionError(null);
          setPrompt(nextPrompt);
        }}
        onSubmit={handleSubmit}
        onTextareaKeyDown={handleTextareaKeyDown}
        secondaryActions={
          <>
            {isGenerating ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={cancelJob.isPending}
                onClick={() => void handleCancelGeneration()}
              >
                Cancel
              </Button>
            ) : null}
            {canRetry ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={retryJob.isPending}
                onClick={() => void handleRetryGeneration()}
              >
                Retry
              </Button>
            ) : null}
          </>
        }
        settings={
          <>
            <AiStudioSettingSelect
              ariaLabel="Video model"
              disabled={generationLocked || isGenerating}
              options={AI_STUDIO_VIDEO_MODELS.map((value) => ({
                label:
                  value === "seedance_2_5" ? "Seedance 2.5" : "Omni Flash 1.1",
                value,
              }))}
              value={model}
              onChange={(value) => {
                submissionKeyRef.current = null;
                if (value === "seedance_2_5" && durationSeconds < 4) {
                  setDurationSeconds(5);
                }
                if (value === "google_omni") {
                  if (uploadedVideoReference) {
                    setUploadedVideoReference(null);
                    setActionNotice("Removed the video reference. Select Seedance 2.5 to use a video together with images.");
                  }
                  if (referenceImages.length > 6) {
                    setAdditionalImageReferences(referenceImages.slice(1, 6));
                    setActionNotice("Google Omni accepts up to 6 reference images in UGC Pilot; extra images were removed.");
                  }
                  if (durationSeconds > 10) setDurationSeconds(5);
                }
                const nextModel = value as AIStudioVideoModel;
                if (!isAIStudioVideoResolutionSupported(nextModel, resolution)) {
                  setResolution("720p");
                }
                setModel(nextModel);
              }}
            />
            <AiStudioSettingSelect
              ariaLabel="Video quality"
              disabled={generationLocked || isGenerating}
              options={AI_STUDIO_VIDEO_RESOLUTIONS.map((value) => {
                const supported = isAIStudioVideoResolutionSupported(model, value);

                return {
                  disabled: !supported,
                  label: supported ? value : `${value} · unavailable for this model`,
                  value,
                };
              })}
              value={resolution}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setResolution(value as AIStudioVideoResolution);
              }}
            />
            <AiStudioSettingSelect
              ariaLabel="Video duration"
              disabled={generationLocked || isGenerating}
              icon={<Clock3 className="size-4" aria-hidden="true" />}
              options={AI_STUDIO_VIDEO_DURATIONS.filter(
                (duration) => model === "seedance_2_5" ? duration >= 4 : duration <= 10,
              ).map((duration) => ({
                label: `${duration} sec · ${duration * creditsPerSecond} credits`,
                value: String(duration),
              }))}
              value={String(durationSeconds)}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setDurationSeconds(Number(value) as AIStudioVideoDuration);
              }}
            />
            <CreatorReferencePicker
              active={active}
              disabled={
                generationLocked || isGenerating || creatorReferenceUploadPending
              }
              selection={uploadedReference}
              selectedCreatorId={selectedCreatorReferenceId}
              onChange={handleReferenceChange}
              onPendingChange={setCreatorReferenceUploadPending}
              onSelectedCreatorChange={setSelectedCreatorReferenceId}
              required={isExploreRecreate}
            />
            <AiStudioSettingSelect
              ariaLabel="Number of videos"
              disabled={generationLocked || isGenerating}
              icon={<Video className="size-4" aria-hidden="true" />}
              options={AI_STUDIO_GENERATION_QUANTITIES.map((count) => ({
                label: `${count} video${count === 1 ? "" : "s"}`,
                triggerLabel: String(count),
                value: String(count),
              }))}
              value={String(quantity)}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setQuantity(Number(value) as AIStudioGenerationQuantity);
              }}
            />
            <AiStudioRatioPicker
              value={aspectRatio}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setAspectRatio(value as AIStudioVideoAspectRatio);
              }}
              allowedRatios={["9:16", "16:9"]}
              disabled={generationLocked || isGenerating}
            />
          </>
        }
      />

      <Dialog
        open={referenceImageRequiredDialogOpen}
        onOpenChange={setReferenceImageRequiredDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a reference image to recreate this video</DialogTitle>
            <DialogDescription>
              This Explore format requires an image reference. It gives the
              generation a clear subject and produces a result closer to the
              expected quality. Upload your own image or choose a creator
              reference, then generate again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getGeneratedVideoTitle(prompt: string) {
  const singleLinePrompt = prompt.replace(/\s+/g, " ").trim();

  return singleLinePrompt.length > 54
    ? `${singleLinePrompt.slice(0, 51)}…`
    : singleLinePrompt;
}

function getVideoModelLabel(model: AIStudioVideoModel | undefined) {
  return model === "google_omni" ? "Google Omni" : "Seedance 2.5";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function OptimisticVideoCard({
  aspectRatio,
  avatarThumbnail,
  avatarLabel,
  prompt,
}: {
  aspectRatio: AIStudioVideoAspectRatio;
  avatarThumbnail?: string | null;
  avatarLabel?: string | null;
  prompt?: string;
}) {
  return (
    <article className="border-b border-border py-6 first:pt-1 last:border-b-0 animate-in fade-in-0 duration-300 sm:py-8">
      <VideoPromptBubble
        createdAt={new Date().toISOString()}
        prompt={prompt || "Creating presenter video…"}
        status="Rendering"
      />

      <div
        className={cn(
          "mt-4 sm:ml-[10%]",
          getVideoResultWidthClassName(aspectRatio),
        )}
      >
        <div
          className="relative overflow-hidden rounded-[20px] bg-card-muted ring-1 ring-primary/30 shadow-sm"
          style={{ aspectRatio: aspectRatio.replace(":", " / ") }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.04] via-transparent to-primary/[0.08]" />
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
            {avatarThumbnail ? (
              <div className="relative size-12 overflow-hidden rounded-full border-2 border-primary/40 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarThumbnail}
                  alt={avatarLabel ?? "Avatar"}
                  className="size-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                  <Loader2 className="size-5 animate-spin text-white" aria-hidden="true" />
                </span>
              </div>
            ) : (
              <span className="inline-flex size-11 items-center justify-center rounded-full border border-primary/30 bg-card/90 shadow-sm backdrop-blur-md">
                <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/85 px-2.5 py-0.5 text-[10px] font-semibold text-foreground-strong backdrop-blur-md">
              <Sparkles className="size-2.5 text-primary" aria-hidden="true" />
              Rendering video
            </span>
          </div>
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          Your generation will appear here when it is ready.
        </p>
      </div>
    </article>
  );
}

function VideoResultCard({
  video,
  isNew = false,
}: {
  video: GeneratedVideo;
  isNew?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds ?? 0);
  const displayDuration = duration || video.durationSeconds || 0;

  useEffect(() => {
    const player = videoRef.current;

    return () => {
      player?.pause();
    };
  }, [video.id, video.url]);

  async function togglePlayback() {
    const player = videoRef.current;

    if (!player) {
      return;
    }

    if (player.paused) {
      try {
        await player.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    player.pause();
  }

  function toggleMuted() {
    const player = videoRef.current;
    const nextMuted = !isMuted;

    setIsMuted(nextMuted);

    if (player) {
      player.muted = nextMuted;
    }
  }

  return (
    <article
      id={`ai-studio-video-result-${video.id}`}
      className={cn(
        "scroll-mt-4 border-b border-border py-6 first:pt-1 last:border-b-0 transition-[transform,box-shadow] duration-300 sm:py-8",
        isNew &&
          "animate-in fade-in-50 zoom-in-[0.98] duration-500 rounded-[var(--radius-card)] ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background px-3",
      )}
    >
      <VideoPromptBubble createdAt={video.createdAt} prompt={video.prompt} />

      <div
        className={cn(
          "mt-4 sm:ml-[10%]",
          getVideoResultWidthClassName(video.ratio),
        )}
      >
        <div
          className="relative overflow-hidden rounded-[20px] bg-black shadow-sm"
          style={{ aspectRatio: video.ratio.replace(":", " / ") }}
        >
          <video
            key={video.url}
            ref={videoRef}
            src={video.url}
            poster={video.thumbnailUrl ?? undefined}
            aria-label={`${video.title} preview`}
            className="size-full object-cover"
            muted={isMuted}
            playsInline
            preload="metadata"
            onEnded={() => {
              setCurrentTime(displayDuration);
              setIsPlaying(false);
            }}
            onLoadedMetadata={(event) => {
              const nextDuration = event.currentTarget.duration;

              setCurrentTime(0);
              setIsPlaying(false);

              if (Number.isFinite(nextDuration)) {
                setDuration(nextDuration);
              }
            }}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onTimeUpdate={(event) =>
              setCurrentTime(event.currentTarget.currentTime)
            }
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-9">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="bg-card/90 shadow-sm"
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                  aria-pressed={isPlaying}
                  onClick={() => void togglePlayback()}
                >
                  {isPlaying ? (
                    <Pause aria-hidden="true" />
                  ) : (
                    <Play aria-hidden="true" />
                  )}
                </Button>
                <span className="rounded-md bg-black/55 px-1.5 py-1 text-[11px] font-medium tabular-nums text-white">
                  {formatVideoDuration(currentTime)} / {formatVideoDuration(displayDuration)}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="bg-card/90 shadow-sm"
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                aria-pressed={!isMuted}
                onClick={toggleMuted}
              >
                {isMuted ? (
                  <VolumeX aria-hidden="true" />
                ) : (
                  <Volume2 aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-muted">
          {video.modelLabel ? (
            <span className="inline-flex items-center gap-1.5 text-foreground/85">
              <Sparkles className="size-3 text-primary" aria-hidden="true" />
              {video.modelLabel}
            </span>
          ) : null}
          {displayDuration > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3" aria-hidden="true" />
              {formatVideoDuration(displayDuration)}
            </span>
          ) : null}
          {video.resolution ? (
            <span className="inline-flex items-center gap-1.5">
              <Monitor className="size-3" aria-hidden="true" />
              {video.resolution}
            </span>
          ) : null}
          <span>{video.ratio}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <AiStudioResultActions
            kind="video"
            title={video.title}
            url={video.url}
            variant="buttons"
          />
          <Link
            href="/avatars"
            className="inline-flex h-8 items-center rounded-[var(--radius-control)] border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Creative Assets
          </Link>
          <span className="ml-auto hidden text-xs text-muted sm:inline">
            {formatGeneratedAt(video.createdAt)}
          </span>
        </div>
      </div>
    </article>
  );
}

function VideoPromptBubble({
  createdAt,
  prompt,
  status,
}: {
  createdAt: string;
  prompt: string;
  status?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ml-auto max-w-[520px] sm:max-w-[min(520px,62%)]">
      <div className="mb-1.5 flex items-center justify-end gap-2 px-1 text-[11px] font-medium text-muted">
        <span className="text-foreground-strong">You</span>
        <span>{formatGeneratedAt(createdAt)}</span>
        {status ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
            <Loader2 className="size-2.5 animate-spin" aria-hidden="true" />
            {status}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className={cn(
          "group flex w-full items-start gap-3 rounded-[18px] border border-border bg-card-muted/70 px-4 py-3 text-left shadow-xs transition-colors hover:border-border-strong hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          expanded && "max-w-[700px] bg-card",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 whitespace-pre-wrap text-sm font-medium leading-6 text-foreground",
            expanded ? "max-h-[26rem] overflow-y-auto pr-2" : "line-clamp-2",
          )}
        >
          {prompt}
        </span>
        {expanded ? (
          <ChevronUp className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        ) : (
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function VideoHistoryDrawer({
  groups,
  onClose,
  onQueryChange,
  onSelectVideo,
  open,
  query,
  selectedVideoId,
}: {
  groups: ReturnType<typeof groupAIStudioVideoHistory>;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSelectVideo: (videoId: string) => void;
  open: boolean;
  query: string;
  selectedVideoId: string | null;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const hasVideos = groups.some((group) => group.videos.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close generation history"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Generation history"
        className="relative flex h-full w-full max-w-[460px] flex-col border-l border-border bg-background shadow-2xl animate-in slide-in-from-right duration-200"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-5">
          <div>
            <p className="text-base font-semibold text-foreground-strong">Generation History</p>
            <p className="mt-1 text-xs text-muted">Your completed AI Studio videos</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close history"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className="shrink-0 border-b border-border px-5 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search your generations…"
              aria-label="Search your generations"
              className="h-10 rounded-full pl-9"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {hasVideos ? (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    {group.label}
                  </h2>
                  <div className="space-y-2">
                    {group.videos.map((video) => (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => onSelectVideo(video.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[16px] border border-transparent p-2 text-left transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                          selectedVideoId === video.id && "border-primary/60 bg-primary/[0.06]",
                        )}
                      >
                        <div
                          className="relative w-[76px] shrink-0 overflow-hidden rounded-xl bg-card-muted"
                          style={{ aspectRatio: video.ratio.replace(":", " / ") }}
                        >
                          <video
                            src={video.url}
                            poster={video.thumbnailUrl ?? undefined}
                            muted
                            playsInline
                            preload="metadata"
                            className="size-full object-cover"
                            aria-hidden="true"
                          />
                          {video.durationSeconds ? (
                            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                              {formatVideoDuration(video.durationSeconds)}
                            </span>
                          ) : null}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-sm font-semibold leading-5 text-foreground">
                            {getVideoHistoryTitle(video)}
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-medium text-muted">
                            {video.modelLabel ? <span>{video.modelLabel}</span> : null}
                            {video.resolution ? <span>{video.resolution}</span> : null}
                            <span>{video.ratio}</span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
              <History className="size-6 text-muted" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-foreground">No matching videos</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Try another search term or create a video from this workspace.
              </p>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-border p-4">
          <Link
            href="/avatars"
            className="flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Open Creative Assets
          </Link>
        </footer>
      </aside>
    </div>
  );
}

function getVideoHistoryTitle(video: GeneratedVideo) {
  return video.prompt === "Generated influencer video" || video.prompt === "Generated video"
    ? video.title
    : video.prompt;
}

function getVideoResultWidthClassName(
  aspectRatio: GeneratedVideo["ratio"],
) {
  return VIDEO_RESULT_WIDTH_CLASS_NAMES[aspectRatio];
}

function formatVideoDuration(durationSeconds: number) {
  const roundedSeconds = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Generated"
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
