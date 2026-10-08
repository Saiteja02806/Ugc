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
  Plus,
  RefreshCw,
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
import { AiStudioCopyButton } from "@/components/generation/ai-studio-copy-button";
import { Input } from "@/components/ui/input";
import { ReferenceFilesUpload } from "@/components/video/reference-files-upload";
import { FormatGenerationReferences } from "@/components/explore/format-generation-references";
import { CreatorReferencePicker } from "@/components/video/creator-reference-picker";
import { VideoGenerationFailure } from "@/components/video/video-generation-failure";
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
import type { RecreateGenerationView } from "@/components/explore/recreate-generation-view";
import type { AIStudioAccessState } from "@/lib/ai-studio/access-policy";
import { getVideoGenerationState } from "@/lib/ai-studio/video-generation-state";
import { DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND } from "@/lib/billing/generation-credit-policy";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { EXPLORE_FORMAT_VIDEO_PROMPT_MAX_LENGTH, WALL_TEXT_VIDEO_PROMPT_MAX_LENGTH } from "@/lib/explore/format-generation-prompt";
import {
  AI_STUDIO_GENERATION_QUANTITIES,
  AI_STUDIO_VIDEO_ASPECT_RATIOS,
  AI_STUDIO_VIDEO_MODELS,
  AI_STUDIO_VIDEO_RESOLUTIONS,
  isAIStudioVideoResolutionSupported,
  isAIStudioVideoModelAvailable,
  getAIStudioVideoModelLabel,
  getAIStudioVideoDurations,
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
  getVideoHistoryDateLabel,
  groupAIStudioVideoHistory,
} from "@/lib/ai-studio/video-history";
import { appendAIStudioSessionResultIds, getAIStudioSessionResults, isAIStudioSessionCompletion } from "@/lib/ai-studio/generation-session";
import {
  AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
  AI_STUDIO_KLING_PROMPT_MAX_LENGTH,
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
  "4:5": "w-[min(100%,calc(34dvh*4/5),16rem)]",
  "1:1": "w-[min(100%,34dvh,18rem)]",
  "9:16": "w-[min(100%,calc(34dvh*9/16),11.25rem)]",
  "16:9": "w-[min(100%,calc(34dvh*16/9),24rem)]",
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

function getPendingVideoMetadata(
  userId: string,
  jobId: string,
): {
  aspectRatio: AIStudioVideoAspectRatio;
  avatarName: string;
  model: AIStudioVideoModel;
  prompt: string;
  resolution: AIStudioVideoResolution;
} | null {
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
  recreateView,
}: {
  accessMessage?: string | null;
  accessState?: AIStudioAccessState;
  active?: boolean;
  creditsPerSecond?: number;
  creditsRemaining?: number | null;
  recreateView?: RecreateGenerationView;
}) {
  const workflow = recreateView?.workflow;
  const workflowFormat = workflow?.format;
  const promptMaxLength = workflowFormat === "wall_text" ? WALL_TEXT_VIDEO_PROMPT_MAX_LENGTH : workflow ? EXPLORE_FORMAT_VIDEO_PROMPT_MAX_LENGTH : AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH;
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
    !workflow && hasExploreRecreateParam &&
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
  const [model, setModel] = useState<AIStudioVideoModel>(() => {
    if (workflow) return "google_omni";
    const requested = parseAIStudioVideoModel(searchParams.get("model"));
    return isAIStudioVideoModelAvailable(requested) ? requested : "kling_3_0";
  });
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
  const [audioReferences, setAudioReferences] = useState<AIStudioReferenceMedia[]>([]);
  const [referenceFilesPending, setReferenceFilesPending] = useState(false);
  const [selectedCreatorReferenceId, setSelectedCreatorReferenceId] =
    useState<string | null>(null);
  const [creatorReferenceUploadPending, setCreatorReferenceUploadPending] =
    useState(false);
  const [referenceImageRequiredDialogOpen, setReferenceImageRequiredDialogOpen] =
    useState(false);
  const [activeVideoPrompt, setActiveVideoPrompt] = useState("");
  const [activeSubmittedAt, setActiveSubmittedAt] = useState(() => new Date().toISOString());
  const [latestCompletedVideoId, setLatestCompletedVideoId] = useState<string | null>(null);
  const [generationState, setGenerationState] =
    useState<GenerationState>("empty");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [refreshingAccess, setRefreshingAccess] = useState(false);
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [selectedHistoryVideoId, setSelectedHistoryVideoId] = useState<string | null>(null);
  const [currentResultIds, setCurrentResultIds] = useState<string[]>([]);
  const [currentDay, setCurrentDay] = useState(() => new Date());
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
  const foregroundJobIdsRef = useRef(new Set<string>());
  const foregroundEpochRef = useRef(0);
  const foregroundAutoResumeRef = useRef(true);
  const historyOwnerIdRef = useRef<string | null>(null);
  const billingSyncedJobIdsRef = useRef(new Set<string>());
  const submissionKeyRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const persistedJobId = usePersistedJobIdFromUrl(workflowFormat ? `explore-${workflowFormat}Job` : VIDEO_JOB_URL_PARAMETER);
  const urlJobId =
    persistedJobId && persistedJobId !== ignoredPersistedJobId
      ? persistedJobId
      : null;
  const activeJobIds = recreateView?.preview ? [] : Array.from(
    new Set([
      ...submittedJobIds,
      ...(urlJobId ? [urlJobId] : []),
      ...storedJobIds,
    ]),
  );
  const activeJobQueries = useBackgroundJobs(activeJobIds);
  const cancelJob = useCancelBackgroundJob();
  const retryJob = useRetryBackgroundJob();
  const generationLocked = recreateView?.preview === true || accessState !== "pro";
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
  const activeReferenceImageUrl = uploadedReference?.asset.url ?? (workflow && !uploadedVideoReference ? recreateView?.referenceImageUrl : null) ?? null;
  const uploadedReferenceVideo = uploadedVideoReference;
  const referenceFiles = [...referenceImages, ...(uploadedVideoReference ? [uploadedVideoReference] : []), ...audioReferences];

  function handleReferenceFilesChange(selections: AIStudioReferenceMedia[]) {
    handleImageReferencesChange(selections.filter((selection) => selection.kind === "image"));
    const video = selections.find((selection) => selection.kind === "video") ?? null;
    if (video?.asset.id !== uploadedVideoReference?.asset.id) handleVideoReferenceChange(video);
    setAudioReferences(selections.filter((selection) => selection.kind === "audio"));
  }

  function handleReferenceChange(selection: AIStudioReferenceMedia | null) {
    submissionKeyRef.current = null;
    setSelectedCreatorReferenceId(null);
    if (workflow) {
      setAdditionalImageReferences([]);
      setUploadedReference(selection?.kind === "image" ? selection : null);
      setUploadedVideoReference(selection?.kind === "video" ? selection : null);
      if (selection?.kind === "video") {
        setDurationSeconds(3);
        if (selection.asset.ratio === "9:16" || selection.asset.ratio === "16:9") setAspectRatio(selection.asset.ratio);
      }
      return;
    }
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
      const matchingDuration = getAIStudioVideoDurations(model).find(
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
    (job) => job.jobType === "video_generation" && (!workflowFormat || job.exploreFormat === workflowFormat) && (
      !["cancelled", "completed", "failed"].includes(job.status) ||
      submittedJobIds.includes(job.id) ||
      job.id === urlJobId ||
      getVideoHistoryDateLabel(job.updatedAt, currentDay) === "Today"
    ),
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
          "Video generation failed. The provider did not return a failure reason."
        : completedWithoutOutput
          ? "Video generation completed without a usable output."
          : null;
  const effectiveGenerationState = getVideoGenerationState({
    submitting: isSubmitting,
    loading: activeJobQueries.some((query) => query.isLoading),
    jobs: durableJobs,
    fallback: generationState,
    missingOutput: Boolean(completedWithoutOutput),
  });
  const isGenerating =
    effectiveGenerationState === "generating";
  const onWorkflowBusyChange = workflow?.onBusyChange;
  useEffect(() => { onWorkflowBusyChange?.(isGenerating); }, [isGenerating, onWorkflowBusyChange]);
  const pendingGenerationCount =
    isSubmitting
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
    foregroundJobIdsRef.current.clear();
    foregroundEpochRef.current += 1;
    foregroundAutoResumeRef.current = true;
    billingSyncedJobIdsRef.current.clear();

    return () => {
      activeUserIdRef.current = null;
    };
  }, [user?.uid]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let day = new Date().toDateString();
    function updateDay() {
      const now = new Date();
      day = now.toDateString();
      setCurrentDay(now);
      setSelectedHistoryVideoId(null);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      clearTimeout(timeout);
      timeout = setTimeout(updateDay, midnight.getTime() - now.getTime() + 100);
    }
    function handleFocus() {
      if (day !== new Date().toDateString()) updateDay();
    }
    updateDay();
    window.addEventListener("focus", handleFocus);
    return () => { clearTimeout(timeout); window.removeEventListener("focus", handleFocus); };
  }, []);

  useEffect(() => {
    if (!active || authLoading) {
      return;
    }

    let ignore = false;

    async function loadGeneratedVideos() {
      if (recreateView?.preview) {
        setGeneratedVideos([]);
        setStoredJobIds([]);
        setSubmittedJobIds([]);
        setCurrentResultIds([]);
        setSelectedHistoryVideoId(null);
        setResultsError(null);
        setResultsLoading(false);
        return;
      }
      if (historyOwnerIdRef.current !== (user?.uid ?? null)) {
        historyOwnerIdRef.current = user?.uid ?? null;
        setGeneratedVideos([]);
        setCurrentResultIds([]);
        setSelectedHistoryVideoId(null);
      }
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
          setGeneratedVideos(getAIStudioVideoResults(assets, assets.length));
          setSelectedHistoryVideoId(null);
          setSubmittedJobIds([]);
          setIgnoredPersistedJobId(null);
          setStoredJobIds(getStoredVideoJobIds(workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid));
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
  }, [active, authLoading, user, recreateView?.preview, workflowFormat]);

  useEffect(() => {
    if (!foregroundAutoResumeRef.current) return;
    for (const job of durableJobs) {
      if (!["cancelled", "completed", "failed"].includes(job.status) || job.id === urlJobId) {
        foregroundJobIdsRef.current.add(job.id);
      }
    }
  }, [durableJobs, urlJobId]);

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
        !billingSyncedJobIdsRef.current.has(`${job.id}:${job.status}:${job.updatedAt}`),
    );

    if (terminalJobs.length === 0) {
      return;
    }

    terminalJobs.forEach((job) => billingSyncedJobIdsRef.current.add(`${job.id}:${job.status}:${job.updatedAt}`));
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
      const completionEpoch = foregroundEpochRef.current;
      const isForeground = () => isAIStudioSessionCompletion(
        completedJob.id, completionEpoch, foregroundEpochRef.current, foregroundJobIdsRef.current,
      );
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

        const metadata = getPendingVideoMetadata(workflowFormat ? `${userId}.${workflowFormat}` : userId, completedJob.id);
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
          upsertAIStudioResult(currentVideos, nextVideo, Number.POSITIVE_INFINITY),
        );
        if (isForeground()) {
          setCurrentResultIds((current) => appendAIStudioSessionResultIds(current, nextVideo.id));
          setLatestCompletedVideoId(nextVideo.id);
          setTimeout(() => setLatestCompletedVideoId(null), 3500);
          setGenerationState("completed");
          setActionNotice(null);
          setActionError(null);
        }
      } catch (error) {
        resolvedJobIdsRef.current.delete(completedJob.id);
        if (activeUserIdRef.current === userId && isForeground()) {
          setGenerationState("failed");
          setActionError(
            getErrorMessage(error, "Could not restore the generated video."),
          );
        }
      }
    }

    void Promise.all(completedJobs.map(restoreCompletedVideo));
  }, [durableJobs, user, workflowFormat]);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const trimmedPrompt = normalizeAIStudioPrompt(prompt);
    const promptLengthError = getAIStudioPromptLengthError(
      trimmedPrompt,
      workflow ? promptMaxLength : model === "kling_3_0" ? AI_STUDIO_KLING_PROMPT_MAX_LENGTH : AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
    );

    if (
      generationLocked ||
      hasInsufficientCredits ||
      !trimmedPrompt ||
      referenceFilesPending || creatorReferenceUploadPending ||
      isGenerating || submittingRef.current
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

    if (model === "kling_3_0" && trimmedPrompt.length < 2) {
      setActionError("Kling 3.0 requires a prompt of at least 2 characters.");
      return;
    }

    if (!isAIStudioVideoModelAvailable(model)) {
      setActionError("Seedance 2.5 is temporarily unavailable. Choose another video model.");
      return;
    }

    setActionNotice(null);
    setActionError(null);
    setActiveVideoPrompt(trimmedPrompt);
    setActiveSubmittedAt(new Date().toISOString());
    setSelectedHistoryVideoId(null);
    foregroundAutoResumeRef.current = false;
    const submissionEpoch = foregroundEpochRef.current;
    setGenerationState("generating");
    submittingRef.current = true;
    setIsSubmitting(true);
    workflow?.onGenerationStart();

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
          exploreFormat: workflow?.format,
          avatarImageUrl: activeReferenceImageUrl,
          referenceImageUrls: referenceImages.length ? referenceImages.map((image) => image.asset.url) : activeReferenceImageUrl ? [activeReferenceImageUrl] : [],
          referenceAudioUrls: audioReferences.map((audio) => audio.asset.url),
          referenceAudioAssetIds: audioReferences.map((audio) => audio.asset.id),
          durationSeconds,
          idempotencyKey,
          model,
          prompt: trimmedPrompt,
          quantity,
          resolution,
          referenceVideoDurationSeconds:
            uploadedReferenceVideo?.asset.durationSeconds ?? null,
          referenceVideoUrl: uploadedReferenceVideo?.asset.url ?? null,
          referenceVideoAssetId: uploadedReferenceVideo?.asset.id ?? null,
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
      persistPendingVideoMetadata(workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid, data.jobs, {
        aspectRatio,
        avatarName: uploadedReference?.asset.title ?? uploadedVideoReference?.asset.title ?? "",
        model,
        prompt: trimmedPrompt,
        resolution,
      });
      void queryClient.invalidateQueries({
        queryKey: ["billing-subscription", user.uid],
      });
      if (activeUserIdRef.current !== user.uid) return;
      persistJobIdInUrl(data.jobId, workflowFormat ? `explore-${workflowFormat}Job` : VIDEO_JOB_URL_PARAMETER);
      for (const job of data.jobs) {
        resolvedJobIdsRef.current.delete(job.jobId);
        if (submissionEpoch === foregroundEpochRef.current) {
          foregroundJobIdsRef.current.add(job.jobId);
        }
      }
      const jobIds = data.jobs.map((job) => job.jobId);
      setStoredJobIds(jobIds);
      setSelectedHistoryVideoId(null);
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
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function dismissFinishedGeneration() {
    if (isGenerating) return;
    setSubmittedJobIds([]);
    setStoredJobIds([]);
    setIgnoredPersistedJobId(persistedJobId);
    persistJobIdInUrl(null, VIDEO_JOB_URL_PARAMETER);
    if (user) {
      try {
        window.localStorage.removeItem(`${VIDEO_JOB_STORAGE_PREFIX}${user.uid}`);
      } catch { /* Local storage can be unavailable; the job remains saved on the server. */ }
    }
    submissionKeyRef.current = null;
    setGenerationState("empty");
    setActionError(null);
    setActionNotice(null);
  }

  async function refreshGenerationAccess() {
    if (!user || refreshingAccess) return;
    setRefreshingAccess(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing-subscription", user.uid] }),
        queryClient.invalidateQueries({ queryKey: ["ai-studio-access", user.uid] }),
      ]);
    } finally {
      setRefreshingAccess(false);
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

  async function handleRetryGeneration(jobId: string) {
    const retryableJob = durableJobs.find(
      (job) => job.id === jobId && job.status === "failed" && Boolean(job.error?.retryable),
    );

    if (!retryableJob || retryJob.isPending || generationLocked || isGenerating) {
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
  const displayedFailedJob =
    !actionError && !jobQueryError && effectiveGenerationState === "failed" &&
    durableNotice === resultsErrorMessage
      ? failedDurableJob
      : undefined;
  const displayedFailedJobs = displayedFailedJob
    ? durableJobs.filter((job) => job.status === "failed")
    : [];

  function focusVideoPrompt() {
    document
      .querySelector<HTMLTextAreaElement>('#ai-studio-videos-panel textarea[name="videoPrompt"]')
      ?.focus();
  }
  const filteredHistoryVideos = filterAIStudioVideoHistory(
    generatedVideos,
    historyQuery,
  );
  const historyGroups = groupAIStudioVideoHistory(filteredHistoryVideos);
  const selectedHistoryVideo = generatedVideos.find((video) => video.id === selectedHistoryVideoId);
  const visibleVideos = getAIStudioSessionResults(generatedVideos, currentResultIds, selectedHistoryVideoId);

  function startNewVideoSession() {
    if (isGenerating) return;
    foregroundEpochRef.current += 1;
    foregroundAutoResumeRef.current = false;
    foregroundJobIdsRef.current.clear();
    setCurrentResultIds([]);
    setSelectedHistoryVideoId(null);
    dismissFinishedGeneration();
    focusVideoPrompt();
  }

  function focusHistoryVideo(videoId: string) {
    setSelectedHistoryVideoId(videoId);
    setHistoryOpen(false);

    window.requestAnimationFrame(() => {
      document
        .getElementById(`ai-studio-video-result-${videoId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const qualitySetting = (<AiStudioSettingSelect
              ariaLabel="Video quality"
              fieldLabel={workflow ? "Quality" : undefined}
              fieldLayout={workflow ? "classic" : undefined}
              disabled={generationLocked || isGenerating}
              size="sm"
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
            />);
  const durationSetting = (<AiStudioSettingSelect
              ariaLabel="Video duration"
              fieldLabel={workflow ? "Duration" : undefined}
              fieldLayout={workflow ? "classic" : undefined}
              disabled={generationLocked && !recreateView?.preview || isGenerating || Boolean(workflow && uploadedReferenceVideo)}
              size="sm"
              icon={<Clock3 className="size-3.5" aria-hidden="true" />}
              options={getAIStudioVideoDurations(model).map((duration) => ({
                label: `${duration} sec · ${duration * creditsPerSecond} credits`,
                triggerLabel: workflow && uploadedReferenceVideo ? `${uploadedReferenceVideo.asset.durationSeconds?.toFixed(1) ?? 3}s clip` : `${duration} sec`,
                value: String(duration),
              }))}
              value={String(durationSeconds)}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setDurationSeconds(Number(value) as AIStudioVideoDuration);
              }}
            />);

  const hasSessionActions = Boolean(selectedHistoryVideo) || (visibleVideos.length > 0 && !isGenerating);

  return (
    <div
      id="ai-studio-videos-panel"
      role={workflow ? undefined : "tabpanel"}
      aria-labelledby={workflow ? undefined : "ai-studio-videos-tab"}
      hidden={!active}
      className={workflow ? "contents" : cn(
        "min-h-0 flex-1 flex-col",
        active ? "flex flex-col" : "hidden",
      )}
    >
      <AiStudioResults
        portalTarget={workflow?.resultsTarget}
        ariaLabel="Generated videos"
        emptyContent={recreateView?.emptyContent}
        emptyContentClassName={recreateView ? "items-start pt-8" : undefined}
        emptyDescription="Start a new video below. Your earlier generations are in History."
        gridClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 2xl:grid-cols-1"
        hasResults={visibleVideos.length > 0 || isGenerating}
        loading={resultsLoading}
        status={resultsStatus}
        statusPlacement="inline"
        scrollToLatestKey={!selectedHistoryVideoId && isSubmitting ? activeSubmittedAt : null}
        failure={resultsErrorMessage && !isGenerating ? (
          <div className="space-y-3">
            {displayedFailedJobs.length > 0 ? displayedFailedJobs.map((failedJob, index) => (
              <VideoGenerationFailure
                key={failedJob.id}
                title={failedJob.error?.code === "PROVIDER_CONTENT_MODERATION"
                  ? "Generation blocked"
                  : "Video couldn't be generated"}
                message={failedJob.error?.message || "Video generation failed. The provider did not return a failure reason."}
                jobId={failedJob.id}
                onEditPrompt={focusVideoPrompt}
                onDismiss={index === 0 ? dismissFinishedGeneration : undefined}
                dismissLabel={displayedFailedJobs.length > 1 ? "Dismiss all" : "Dismiss"}
                onRetry={failedJob.error?.retryable && !generationLocked
                  ? () => void handleRetryGeneration(failedJob.id)
                  : undefined}
                retrying={retryJob.isPending && retryJob.variables === failedJob.id}
                retryDisabled={retryJob.isPending}
              />
            )) : (
              <VideoGenerationFailure
                title={jobQueryError || resultsError === resultsErrorMessage
                  ? "Couldn't load your generation"
                  : "Video couldn't be generated"}
                message={resultsErrorMessage}
                onEditPrompt={jobQueryError || resultsError === resultsErrorMessage ? undefined : focusVideoPrompt}
                onDismiss={resultsError === resultsErrorMessage ? undefined : dismissFinishedGeneration}
              />
            )}
          </div>
        ) : undefined}
        toolbar={recreateView?.preview ? undefined : recreateView && !hasSessionActions ? undefined :
          <div className="flex items-center gap-2">
            {selectedHistoryVideo ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedHistoryVideoId(null)}>Back to session</Button>
            ) : null}
            {visibleVideos.length > 0 && !isGenerating ? (
              <Button type="button" variant="ghost" size="sm" onClick={startNewVideoSession}>
                <Plus className="size-3.5" aria-hidden="true" />
                New session
              </Button>
            ) : null}
            {!recreateView ? <Button
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
            </Button> : null}
          </div>
        }
      >
        {visibleVideos.map((video) => (
          <VideoResultCard
            key={video.id}
            video={video}
            onSelect={workflow?.onSelectVideo ? () => workflow.onSelectVideo?.(video) : undefined}
            isNew={video.id === latestCompletedVideoId}
          />
        ))}
        {isGenerating && !selectedHistoryVideoId
          ? Array.from(
              { length: Math.max(1, pendingGenerationCount) },
              (_, index) => (
                <OptimisticVideoCard
                  key={`pending-video-${index}`}
                  aspectRatio={aspectRatio}
                  avatarThumbnail={activeReferenceImageUrl}
                  avatarLabel={uploadedReference?.asset.title ?? null}
                  prompt={activeVideoPrompt}
                  modelLabel={getVideoModelLabel(model)}
                  durationSeconds={durationSeconds}
                  resolution={resolution}
                />
              ),
            )
          : null}
      </AiStudioResults>

      <VideoHistoryDrawer
        groups={historyGroups}
        onClose={() => setHistoryOpen(false)}
        onQueryChange={setHistoryQuery}
        onSelectVideo={focusHistoryVideo}
        open={!recreateView && historyOpen}
        query={historyQuery}
        selectedVideoId={selectedHistoryVideoId ?? latestCompletedVideoId}
      />

      <AiStudioComposer
        portalTarget={workflow?.controlsTarget}
        actionsTarget={workflow?.actionsTarget}
        promptHelper={workflow ? uploadedReferenceVideo ? "Add a voiceover in Edit video if needed." : workflow.format === "wall_text" ? "Describe the background; add text in Edit video." : "Scene, action and spoken words in quotes." : undefined}
        promptLabel={workflow ? "Your instructions" : undefined}
        settingsSummary={workflow ? `${uploadedReferenceVideo ? "Runway" : model === "seedance_2_5" ? "Seedance 2.5" : "Google Omni"} · ${uploadedReferenceVideo ? `${uploadedReferenceVideo.asset.durationSeconds?.toFixed(1) ?? 3}s clip` : `${durationSeconds}s`} · ${aspectRatio} · ${quantity} video${quantity === 1 ? "" : "s"}` : undefined}
        referenceControls={workflow ? <FormatGenerationReferences key={user?.uid ?? "preview"} active={workflow.controlsActive} selection={uploadedVideoReference ?? uploadedReference} onChange={handleReferenceChange} onPendingChange={setCreatorReferenceUploadPending} disabled={isGenerating || (!recreateView?.preview && generationLocked)} preview={Boolean(recreateView?.preview)} ownerId={user?.uid} styleVideo={recreateView?.styleVideo} onClearStyle={recreateView?.onClearReference} /> : undefined}
        compact={Boolean(recreateView)}
        accessMessage={composerMessage}
        active={workflow?.controlsActive ?? active}
        ariaLabel="Video prompt"
        contextBanner={
          recreateView?.contextBanner ?? (referenceContext ? (
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
          ) : null)
        }
        generateDisabled={
          !isAIStudioVideoModelAvailable(model) ||
          generationLocked ||
          hasInsufficientCredits ||
          !prompt.trim() ||
          creatorReferenceUploadPending ||
          referenceFilesPending ||
          isGenerating
        }
        generateLabel="Generate video"
        generationLocked={generationLocked}
        hasAttachments={referenceFiles.length > 0 || referenceFilesPending}
        isGenerating={isGenerating}
        layout={workflow ? "workflow" : "unified"}
        workflowDesign={workflow ? "classic" : undefined}
        showPromptHint={generationLocked || hasInsufficientCredits}
        leadingControl={workflow ? undefined :
            <ReferenceFilesUpload
              active={active}
              allowedKinds={["image"]}
              disabled={generationLocked || isGenerating || creatorReferenceUploadPending}
              maxFiles={model === "kling_3_0" ? 2 : 6}
              selections={referenceFiles}
              onChange={handleReferenceFilesChange}
              onPendingChange={setReferenceFilesPending}
            />
        }
        maxLength={workflow ? promptMaxLength : model === "kling_3_0" ? AI_STUDIO_KLING_PROMPT_MAX_LENGTH : AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH}
        name="videoPrompt"
        placeholder={workflow ? workflow.format === "wall_text" ? "A quiet café at sunset, with a slow camera pan…" : "A creator speaks to camera: “Here’s one thing I wish I knew…”" : recreateView ? "What would you like to change?" : "Describe the video you want to create…"}
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
            {generationLocked ? (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh access" title="Refresh access" disabled={refreshingAccess} onClick={() => void refreshGenerationAccess()}>
                <RefreshCw className={cn("size-3.5", refreshingAccess && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
              </Button>
            ) : null}
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
          </>
        }
        settings={
          <>
            <AiStudioSettingSelect
              ariaLabel="Video model"
              fieldLabel={workflow ? "Model" : undefined}
              fieldLayout={workflow ? "classic" : undefined}
              disabled={generationLocked && !recreateView?.preview || isGenerating || referenceFilesPending || Boolean(workflow && uploadedReferenceVideo)}
              size="sm"
              options={AI_STUDIO_VIDEO_MODELS.filter(value => !workflow || value === "google_omni").map((value) => ({
                label: workflow && uploadedReferenceVideo ? "Runway" : `${getAIStudioVideoModelLabel(value)}${isAIStudioVideoModelAvailable(value) ? "" : " · temporarily unavailable"}`,
                disabled: !isAIStudioVideoModelAvailable(value),
                value,
              }))}
              value={model}
              onChange={(value) => {
                submissionKeyRef.current = null;
                const nextModel = value as AIStudioVideoModel;
                if (!getAIStudioVideoDurations(nextModel).includes(durationSeconds)) {
                  setDurationSeconds(5);
                }
                if (value === "kling_3_0" && durationSeconds > 15) {
                  setDurationSeconds(5);
                }
                if (value === "kling_3_0" && referenceImages.length > 2) {
                  setAdditionalImageReferences(referenceImages.slice(1, 2));
                  setActionNotice("Kling 3.0 accepts a first frame and an optional last frame; extra images were removed.");
                }
                if (value === "google_omni") {
                  if (audioReferences.length) {
                    setAudioReferences([]);
                    setActionNotice("Audio references are unavailable for the current video models.");
                  }
                  if (uploadedVideoReference) {
                    setUploadedVideoReference(null);
                    setActionNotice("Video references are unavailable for the current video models.");
                  }
                  if (referenceImages.length > 6) {
                    setAdditionalImageReferences(referenceImages.slice(1, 6));
                    setActionNotice("Google Omni accepts up to 6 reference images in UGC Pilot; extra images were removed.");
                  }
                  if (durationSeconds > 10) setDurationSeconds(5);
                }
                if (!isAIStudioVideoResolutionSupported(nextModel, resolution)) {
                  setResolution("720p");
                }
                setModel(nextModel);
              }}
            />
            {workflow ? durationSetting : qualitySetting}
            {workflow ? qualitySetting : durationSetting}
            {workflow ? null : <CreatorReferencePicker
              active={active}
              iconOnly
              disabled={
                generationLocked || isGenerating || creatorReferenceUploadPending || referenceFilesPending ||
                (!uploadedReference && referenceFiles.length >= (model === "kling_3_0" ? 2 : 6))
              }
              selection={uploadedReference}
              selectedCreatorId={selectedCreatorReferenceId}
              onChange={handleReferenceChange}
              onPendingChange={setCreatorReferenceUploadPending}
              onSelectedCreatorChange={setSelectedCreatorReferenceId}
              required={isExploreRecreate}
            />}
            <AiStudioSettingSelect
              ariaLabel="Number of videos"
              fieldLabel={workflow ? "Videos" : undefined}
              fieldLayout={workflow ? "classic" : undefined}
              disabled={generationLocked && !recreateView?.preview || isGenerating}
              size="sm"
              icon={<Video className="size-3.5" aria-hidden="true" />}
              options={AI_STUDIO_GENERATION_QUANTITIES.map((count) => ({
                label: `${count} video${count === 1 ? "" : "s"}`,
                triggerLabel: workflow ? `${count} video${count === 1 ? "" : "s"}` : String(count),
                value: String(count),
              }))}
              value={String(quantity)}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setQuantity(Number(value) as AIStudioGenerationQuantity);
              }}
            />
            <AiStudioRatioPicker
              fieldLabel={workflow ? "Ratio" : undefined}
              fieldLayout={workflow ? "classic" : undefined}
              size="sm"
              value={aspectRatio}
              onChange={(value) => {
                submissionKeyRef.current = null;
                setAspectRatio(value as AIStudioVideoAspectRatio);
              }}
              allowedRatios={["9:16", "16:9"]}
              disabled={generationLocked && !recreateView?.preview || isGenerating}
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
  return getAIStudioVideoModelLabel(model ?? "kling_3_0");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function OptimisticVideoCard({
  aspectRatio,
  avatarThumbnail,
  avatarLabel,
  prompt,
  modelLabel,
  durationSeconds,
  resolution,
}: {
  aspectRatio: AIStudioVideoAspectRatio;
  avatarThumbnail?: string | null;
  avatarLabel?: string | null;
  prompt?: string;
  modelLabel: string;
  durationSeconds: number;
  resolution: AIStudioVideoResolution;
}) {
  const [createdAt] = useState(() => new Date().toISOString());

  return (
    <article className="mx-auto w-full max-w-[54rem] py-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:gap-6">
        <div
          className={cn(
            "shrink-0",
            getVideoResultWidthClassName(aspectRatio),
          )}
        >
          <div
            className="relative overflow-hidden rounded-[16px] bg-card-muted ring-1 ring-primary/20"
            style={{ aspectRatio: aspectRatio.replace(":", " / ") }}
          >
            {avatarThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarThumbnail}
                alt={avatarLabel ?? "Video reference"}
                className="absolute inset-0 size-full object-cover opacity-35"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/30 to-black/65" />
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3 text-center"
              role="status"
              aria-live="polite"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white">Creating your video</p>
                <p className="text-[11px] leading-4 text-white/70">Your result will appear here.</p>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <VideoResultMetadata
              modelLabel={modelLabel}
              durationSeconds={durationSeconds}
              resolution={resolution}
              ratio={aspectRatio}
            />
          </div>
        </div>
        <div className="w-full min-w-0 sm:max-w-[26rem] sm:flex-1 sm:pt-1">
          <VideoPromptBubble
            createdAt={createdAt}
            prompt={prompt || "Creating presenter video…"}
          />
        </div>
      </div>
    </article>
  );
}

function VideoResultCard({
  video,
  isNew = false,
  onSelect,
}: {
  video: GeneratedVideo;
  isNew?: boolean;
  onSelect?: () => void;
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
        "mx-auto w-full max-w-[54rem] scroll-mt-4 py-2",
        isNew &&
          "motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-500",
      )}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:gap-6">
        <div
          className={cn(
            "shrink-0",
            getVideoResultWidthClassName(video.ratio),
          )}
        >
          <div
            className="@container/video relative overflow-hidden rounded-[16px] bg-black ring-1 ring-white/5"
            style={{ aspectRatio: video.ratio.replace(":", " / ") }}
          >
            <video
              key={video.url}
              ref={videoRef}
              src={video.url}
              poster={video.thumbnailUrl ?? undefined}
              aria-label={`${video.title} preview`}
              className="size-full object-contain"
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
              <input
                type="range"
                aria-label="Seek video"
                aria-valuetext={`${formatVideoDuration(currentTime)} of ${formatVideoDuration(displayDuration)}`}
                min={0}
                max={displayDuration || 1}
                step={0.1}
                value={Math.min(currentTime, displayDuration || 1)}
                disabled={displayDuration <= 0}
                onChange={(event) => {
                  const nextTime = Number(event.target.value);
                  if (videoRef.current) videoRef.current.currentTime = nextTime;
                  setCurrentTime(nextTime);
                }}
                className="mb-2 block h-1 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="border-white/20 bg-black/40 text-white hover:bg-black/60 hover:text-white"
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
                    {formatVideoDuration(currentTime)}
                    <span className="hidden @min-[10rem]/video:inline"> / {formatVideoDuration(displayDuration)}</span>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="border-white/20 bg-black/40 text-white hover:bg-black/60 hover:text-white"
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
          <div className="mt-3">
            <VideoResultMetadata
              modelLabel={video.modelLabel}
              durationSeconds={displayDuration}
              resolution={video.resolution}
              ratio={video.ratio}
            />
          </div>
          {onSelect ? <Button type="button" className="mt-3" disabled={!video.mediaAssetId} onClick={onSelect}>Edit video</Button> : null}
          <AiStudioResultActions
            className="mt-3"
            kind="video"
            showOpenAction={false}
            title={video.title}
            url={video.url}
            variant="buttons"
          />
        </div>
        <div className="w-full min-w-0 sm:max-w-[26rem] sm:flex-1 sm:pt-1">
          <VideoPromptBubble createdAt={video.createdAt} prompt={video.prompt} />
        </div>
      </div>
    </article>
  );
}

function VideoResultMetadata({
  modelLabel,
  durationSeconds,
  resolution,
  ratio,
}: {
  modelLabel: string | null;
  durationSeconds: number;
  resolution: GeneratedVideo["resolution"];
  ratio: GeneratedVideo["ratio"];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-medium text-muted">
      {modelLabel ? (
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Sparkles className="size-3 text-primary" aria-hidden="true" />
          {modelLabel}
        </span>
      ) : null}
      {durationSeconds > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3" aria-hidden="true" />
          {formatVideoDuration(durationSeconds)}
        </span>
      ) : null}
      {resolution ? (
        <span className="inline-flex items-center gap-1.5">
          <Monitor className="size-3" aria-hidden="true" />
          {resolution}
        </span>
      ) : null}
      <span>{ratio}</span>
    </div>
  );
}

function VideoPromptBubble({
  createdAt,
  prompt,
}: {
  createdAt: string;
  prompt: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5 text-[11px] font-medium text-muted">
        <span className="text-foreground-strong">Prompt</span>
        <span>{formatGeneratedAt(createdAt)}</span>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse video prompt" : "Show full video prompt"}
        onClick={() => setExpanded((current) => !current)}
        className={cn(
          "group flex w-full items-start gap-3 rounded-[14px] border border-border bg-card-muted/50 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none",
          expanded && "bg-card",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 whitespace-pre-wrap text-sm font-normal leading-6 text-foreground [overflow-wrap:anywhere]",
            expanded ? "max-h-48 overflow-y-auto overscroll-contain pr-2" : "line-clamp-3",
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
      <div className="mt-1 flex justify-end"><AiStudioCopyButton kind="prompt" value={prompt} /></div>
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
                          {video.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={video.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="size-full object-cover"
                            />
                          ) : (
                            <>
                              <video
                                src={video.url}
                                muted
                                playsInline
                                preload="none"
                                className="size-full object-cover"
                                aria-hidden="true"
                              />
                              <span className="absolute inset-0 flex items-center justify-center text-muted">
                                <Play className="size-4" aria-hidden="true" />
                              </span>
                            </>
                          )}
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
