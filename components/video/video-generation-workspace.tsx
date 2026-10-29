"use client";
import { wallTextProfile } from "../../worker/src/lib/wall-initial-text-layout.ts";

import { pendingGenerationKey, readPendingGeneration, submitPendingGeneration, mergeStoredGenerationJobIds, type PendingGeneration, type RecoveredGeneration } from "@/lib/ai-studio/pending-generation";
import { useGenerationDiscovery } from "@/components/generation/use-generation-discovery";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { combineReferenceVideoPrompt } from "../../lib/explore/reference-video-prompts.ts";
import { formatMotionPromptTimes } from "../../lib/explore/motion-phase-display.ts";

import {
  Clock3,
  History,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

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
import { VideoPromptBubble } from "@/components/video/video-result-prompt";
import { Input } from "@/components/ui/input";
import { ReferenceFilesUpload } from "@/components/video/reference-files-upload";
import { FormatGenerationReferences } from "@/components/explore/format-generation-references";
import { StartingFrameAnimationReferences } from "@/components/explore/starting-frame-animation-references";
import { startingFrameAnimationInput, startingFrameFaceReferenceError } from "@/lib/explore/starting-frame-animation-input";
import { useStartingFramePhotos } from "@/components/explore/use-starting-frame-photos";
import { WorkflowDurationControl } from "@/components/explore/workflow-duration-control";
import creation from "@/components/explore/workflow-creation.module.css";
import { CreatorReferencePicker } from "@/components/video/creator-reference-picker";
import { VideoGenerationFailure } from "@/components/video/video-generation-failure";
import { VideoGenerationPlaceholder } from "@/components/video/video-generation-placeholder";
import resultLayout from "@/components/video/video-results.module.css";
import { isHookStartingFrameVideoModel, hookStartingFrameVideoDurations, hookStartingFrameDefaultDuration, hookStartingFrameFaceReferenceLimit } from "@/worker/src/lib/hook-starting-frame-video";
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
import { getExploreVideoPromptMaxLength } from "@/lib/explore/format-generation-prompt";
import type { ExploreImagePurpose } from "@/lib/explore/person-reference";
import { getVideoReferencePolicy, getVideoReferenceTypeError, getVideoTimedReferenceError } from "@/lib/ai-studio/video-reference-policy";
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
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "@/lib/ai-studio/prompt-policy";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  persistJobIdInUrl,
  useRecoverableWorkflowJobs,
  useStoredBackgroundJobIds,
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
  "4:5": "w-[min(100%,calc((100dvh-260px)*4/5),28rem)]",
  "1:1": "w-[min(100%,calc(100dvh-260px),30rem)]",
  "9:16": "w-[min(100%,calc((100dvh-260px)*9/16),22rem)]",
  "16:9": "w-[min(100%,calc((100dvh-260px)*16/9),42rem)]",
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
  merge = false,
) {
  try {
    const storageKey = `${VIDEO_JOB_STORAGE_PREFIX}${userId}`;
    const jobIds = merge ? mergeStoredGenerationJobIds(window.localStorage, storageKey, jobs) : jobs.map((job) => job.jobId);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(jobIds),
    );
    for (const { jobId } of jobs) {
      window.localStorage.setItem(
        `${VIDEO_JOB_METADATA_PREFIX}${userId}.${jobId}`,
        JSON.stringify(metadata),
      );
    }
    return true;
  } catch {
    // Supabase remains authoritative; this metadata only restores local labels.
    return false;
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
  const startingFramePreparation = workflowFormat === "hook" || workflowFormat === "wall_text" ? recreateView?.startingFramePreparation : undefined;
  const supportsWorkflowSound = workflowFormat === "hook" || workflowFormat === "wall_text";
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
    !startingFramePreparation && referenceParamKey && dismissedReferenceKey !== referenceParamKey
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
  const [soundPreference, setSoundPreference] = useState<{ owner: string; format: string; enabled: boolean } | null>(null);
  const generateAudio = soundPreference?.owner === (user?.uid ?? "preview") && soundPreference?.format === workflowFormat ? soundPreference.enabled : false;
  const metadataOwnerId = user ? workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid : null;
  const discoveredJobIdsRef = useRef(new Set<string>());
  const restoreDiscoveredJobs = useCallback((result: RecoveredGeneration, input: Record<string, unknown>) => {
    if (!metadataOwnerId || !persistPendingVideoMetadata(metadataOwnerId, result.jobs, { aspectRatio: input.aspectRatio as AIStudioVideoAspectRatio, avatarName: input.avatarImageUrl ? "Reference image" : "", model: input.model as AIStudioVideoModel, prompt: String(input.prompt), resolution: input.resolution as AIStudioVideoResolution }, true)) throw new Error("Could not save earlier job identities. Their recovery records are preserved.");
    for (const job of result.jobs) { discoveredJobIdsRef.current.add(job.jobId); foregroundJobIdsRef.current.delete(job.jobId); }
  }, [metadataOwnerId]);
  const earlierRequests = useGenerationDiscovery({ ownerId: user?.uid ?? null, kind: "video", scope: workflowFormat ?? "studio", enabled: active && !recreateView?.preview, onRecovered: restoreDiscoveredJobs });
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
  const [imagePurpose, setImagePurpose] = useState<ExploreImagePurpose>("person");
  const [workflowSourceMode, setWorkflowSourceMode] = useState<"edit" | "reference">("edit");
  const [uploadedVideoReference, setUploadedVideoReference] =
    useState<AIStudioReferenceMedia | null>(null);
  const [galleryVideoMetadata, setGalleryVideoMetadata] = useState<{ url: string; duration: number } | null>(null);
  const activeGalleryVideoUrl = useRef<string | undefined>(undefined);
  const gallerySelectionKey = workflow && !startingFramePreparation && recreateView?.styleVideo
    ? `${recreateView.styleVideo.id ?? recreateView.styleVideo.url}:${recreateView.styleVideo.selectionRevision ?? 0}` : null;
  const [previousGallerySelectionKey, setPreviousGallerySelectionKey] = useState(gallerySelectionKey);
  const referencePromptKey = `${user?.uid ?? "preview"}:${gallerySelectionKey ?? "none"}`;
  const [referencePromptDraft, setReferencePromptDraft] = useState<{ key: string; text: string } | null>(null);
  const [referenceRecoveryOwner, setReferenceRecoveryOwner] = useState<string | null>(null);
  const suggestedReferencePrompt = workflow && !startingFramePreparation ? recreateView?.styleVideo?.generationPrompt ?? "" : "";
  const referencePrompt = gallerySelectionKey && suggestedReferencePrompt && referenceRecoveryOwner !== user?.uid
    ? referencePromptDraft?.key === referencePromptKey ? referencePromptDraft.text : suggestedReferencePrompt : "";
  const combinedPrompt = combineReferenceVideoPrompt(referencePrompt, prompt);
  const [audioReferences, setAudioReferences] = useState<AIStudioReferenceMedia[]>([]);
  const [referenceFilesPending, setReferenceFilesPending] = useState(false);
  const [selectedCreatorReferenceId, setSelectedCreatorReferenceId] =
    useState<string | null>(null);
  const [creatorReferenceUploadPending, setCreatorReferenceUploadPending] =
    useState(false);
  const [referenceSelectionError, setReferenceSelectionError] = useState<{ key: string | null; message: string } | null>(null);
  const referenceError = referenceSelectionError?.key === gallerySelectionKey ? referenceSelectionError.message : null;
  function reportReferenceError(message: string | null) {
    setReferenceSelectionError(message ? { key: gallerySelectionKey, message } : null);
  }
  if (previousGallerySelectionKey !== gallerySelectionKey) {
    setPreviousGallerySelectionKey(gallerySelectionKey);
    setReferenceRecoveryOwner(null);
    if (gallerySelectionKey) {
      // Recreate is an explicit replacement of the source video, including
      // clicking the same card again after an earlier upload.
      setUploadedVideoReference(null);
      setReferenceSelectionError(null);
    }
  }
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
  const [savedSubmission, setPendingSubmission] = useState<PendingGeneration | null>(null);
  const pendingSubmission = savedSubmission?.ownerId === user?.uid && savedSubmission?.scope === (workflowFormat ?? "studio") && !recreateView?.preview ? savedSubmission : null;
  const startingFrame = (workflowFormat === "hook" || workflowFormat === "wall_text") && recreateView?.startingFrame &&
    (recreateView.startingFrame.ownerId === user?.uid || process.env.NODE_ENV === "development" && recreateView.preview)
    ? recreateView.startingFrame : undefined;
  const startingFrameKey = startingFrame ? `${startingFrame.draftId}:${startingFrame.jobId}:${startingFrame.assetId}` : null;
  const awaitingStartingFrame = Boolean(startingFramePreparation && !startingFrame);
  const [previousStartingFrameKey, setPreviousStartingFrameKey] = useState<string | null>(null);
  if (startingFrameKey !== previousStartingFrameKey) {
    setPreviousStartingFrameKey(startingFrameKey);
    if (startingFrame) {
      // Keep a supported model choice when changing the approved scene.
      setPrompt(formatMotionPromptTimes(startingFrame.motionInstructions));
      if (!isHookStartingFrameVideoModel(model) || !isAIStudioVideoModelAvailable(model)) setModel("google_omni");
      setDurationSeconds(startingFrame.durationSeconds === 6 ? 6 : hookStartingFrameDefaultDuration(model)); setQuantity(1);
      setAspectRatio(startingFrame.width > startingFrame.height ? "16:9" : "9:16");
      setSoundPreference({ owner: startingFrame.ownerId, format: workflowFormat ?? "hook", enabled: startingFrame.generateAudio });
      // Clear stale URLs; restore this frame's owned photos and explicit
      // selection overrides through useStartingFramePhotos below.
      setUploadedVideoReference(null); setAudioReferences([]); setImagePurpose("person");
      setUploadedReference(null); setAdditionalImageReferences([]);
      setReferencePromptDraft(null); setReferenceSelectionError(null); setSelectedCreatorReferenceId(null);
      setWorkflowSourceMode("reference");
    }
  }
  const startingFramePhotos = useStartingFramePhotos(startingFrame, model, Boolean(user && !recreateView?.preview), photos => {
    setUploadedReference(photos[0] ?? null); setAdditionalImageReferences(photos.slice(1));
  });
  const storedJobIds = useStoredBackgroundJobIds(user ? `${VIDEO_JOB_STORAGE_PREFIX}${workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid}` : null);
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
  const pendingOwnerId = user?.uid;
  useEffect(() => {
    let stopped = false;
    void Promise.resolve().then(() => {
      if (stopped) return;
      try {
        const saved = pendingOwnerId && !recreateView?.preview ? readPendingGeneration(localStorage.getItem(pendingGenerationKey(pendingOwnerId, "video", workflowFormat ?? "studio")), pendingOwnerId, "video", workflowFormat ?? "studio") : null;
        setPendingSubmission(saved);
        if (saved) {
          // Saved requests already contain their exact combined instructions.
          setReferenceRecoveryOwner(pendingOwnerId ?? null);
          setWorkflowSourceMode(saved.input.referenceVideoMode === "edit" ? "edit" : "reference");
          if (workflowFormat === "hook" || workflowFormat === "wall_text") setSoundPreference({ owner: pendingOwnerId ?? "preview", format: workflowFormat, enabled: saved.input.generateAudio === true });
          setPrompt(String(saved.input.prompt)); setActionNotice("A previous video submission needs confirmation. Recover saved request checks its original instructions and settings.");
        }
      } catch { setActionError("The saved video request could not be verified. Keep its recovery record."); }
    });
    return () => { stopped = true; };
  }, [pendingOwnerId, workflowFormat, recreateView?.preview]);
  const persistedJobId = usePersistedJobIdFromUrl(workflowFormat ? `explore-${workflowFormat}Job` : VIDEO_JOB_URL_PARAMETER);
  const urlJobId =
    persistedJobId && persistedJobId !== ignoredPersistedJobId
      ? persistedJobId
      : null;
  const openingGenerationJobIdsRef = useRef(new Set(urlJobId ? [urlJobId] : []));
  const onGeneratedVideoRef = useRef(workflow?.onGeneratedVideo);
  useEffect(() => { onGeneratedVideoRef.current = workflow?.onGeneratedVideo; }, [workflow?.onGeneratedVideo]);
  useEffect(() => {
    if (!urlJobId) openingGenerationJobIdsRef.current.clear();
    else if (!openingGenerationJobIdsRef.current.has(urlJobId)) openingGenerationJobIdsRef.current = new Set([urlJobId]);
  }, [urlJobId]);
  const activeJobIds = recreateView?.preview ? [] : Array.from(
    new Set([
      ...submittedJobIds,
      ...(urlJobId ? [urlJobId] : []),
      ...storedJobIds,
    ]),
  );
  const { queries: activeJobQueries, recovering: recoveringJobs, recoveryError } = useRecoverableWorkflowJobs(activeJobIds, {
    enabled: active && !recreateView?.preview,
    exploreFormat: workflowFormat,
    jobType: "video_generation",
  });
  const cancelJob = useCancelBackgroundJob();
  const retryJob = useRetryBackgroundJob();
  const generationLocked = recreateView?.preview === true || accessState !== "pro";
  const galleryVideoReference = workflow && !startingFrame && !startingFramePreparation ? recreateView?.styleVideo : undefined;
  const [automaticHookText, setAutomaticHookText] = useState(true);
  const automaticTextReferenceId = startingFrame?.referenceId ?? galleryVideoReference?.id ?? referenceContext?.id;
  const automaticHookTextAvailable = Boolean(automaticTextReferenceId) && (workflowFormat === "hook" && process.env.NEXT_PUBLIC_EXPLORE_AUTOMATIC_HOOK_TEXT_ENABLED === "true" ||
    workflowFormat === "wall_text" && process.env.NEXT_PUBLIC_EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED === "true" && Boolean(wallTextProfile(automaticTextReferenceId!)));
  const automaticTextReadiness = useQuery({ queryKey: ["automatic-hook-text-readiness", user?.uid, automaticTextReferenceId],
    enabled: automaticHookTextAvailable && automaticHookText && Boolean(user) && !recreateView?.preview,
    staleTime: 30000, retry: false,
    queryFn: async ({ signal }) => {
      const value = await withReadDeadline(async boundedSignal => {
        const token = await getCurrentUserIdToken(user?.uid);
        if (!token) throw new Error("Sign in to prepare automatic text.");
        const response = await fetch(`/api/explore/reference-text?${new URLSearchParams({ referenceId: automaticTextReferenceId!, automatic: "true" })}`, { signal: boundedSignal, cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
        const value = await response.json();
        if (!response.ok || !value.ok) throw new Error("Could not check automatic text. Retry or turn it off.");
        return value;
      }, signal);
      if (!value.automaticTextEnabled) return "Automatic text is unavailable. Turn it off to generate footage only.";
      if (value.source?.status !== "ready" || value.source?.format !== workflowFormat) return "This reference's text is not prepared. Choose another reference or turn off automatic text.";
      if (!value.businessContext?.ready) return "Add your business context in Settings, or turn off automatic text.";
      if (!(value.automaticTextRemaining > 0)) return "You've used today's 20 text remixes. Turn off automatic text or try again tomorrow.";
      return null;
    } });
  const automaticTextProblem = automaticHookTextAvailable && automaticHookText && !recreateView?.preview
    ? automaticTextReadiness.isPending ? "Checking automatic text…" : automaticTextReadiness.isError ? "Could not check automatic text. Retry or turn it off." : automaticTextReadiness.data : null;
  useEffect(() => { activeGalleryVideoUrl.current = galleryVideoReference?.url; }, [galleryVideoReference?.url]);
  const uploadedReferenceVideo = startingFrame || awaitingStartingFrame || galleryVideoReference ? null : uploadedVideoReference;
  const hasWorkflowVideoReference = Boolean(workflow && workflowSourceMode === "edit" && (uploadedReferenceVideo || galleryVideoReference));
  const sourceDuration = uploadedReferenceVideo?.asset.durationSeconds
    ?? (galleryVideoMetadata?.url === galleryVideoReference?.url ? galleryVideoMetadata?.duration : null)
    ?? galleryVideoReference?.duration;
  const sourceDurationLabel = sourceDuration ? `${Number(sourceDuration.toFixed(3))} sec` : "Reading…";
  function reportGalleryVideoDuration(url: string, duration: number) {
    if (url !== activeGalleryVideoUrl.current || !Number.isFinite(duration) || duration <= 0) return;
    setGalleryVideoMetadata(previous => previous?.url === url && previous.duration === duration ? previous : { url, duration });
  }
  const billedDuration = hasWorkflowVideoReference && sourceDuration ? model === "seedance_2_5" ? Math.ceil(sourceDuration) : Math.max(3, Math.round(sourceDuration)) : durationSeconds;
  const creditsPerVideo = billedDuration * creditsPerSecond;
  const requiredCredits = creditsPerVideo * quantity;
  const hasInsufficientCredits =
    accessState === "pro" &&
    (!hasWorkflowVideoReference || Boolean(sourceDuration)) &&
    creditsRemaining !== null &&
    creditsRemaining < requiredCredits;
  const composerMessage = generationLocked
    ? accessMessage
    : hasInsufficientCredits
      ? `This generation needs ${requiredCredits} AI credits. You have ${creditsRemaining}.`
      : hasWorkflowVideoReference && !sourceDuration ? "Credits are based on the source clip's duration, checked before generation."
      : `This generation uses ${requiredCredits} AI credits (${creditsPerSecond} per second).`;

  const referenceImages = awaitingStartingFrame || startingFrame && !hookStartingFrameFaceReferenceLimit(model) ? [] : [
    ...(uploadedReference ? [uploadedReference] : []),
    ...additionalImageReferences,
  ];
  const hasVideoReference = Boolean(uploadedReferenceVideo || galleryVideoReference);
  const referencePolicyOptions = { allowOmniVideo: Boolean(workflow), hasTimedReferences: hasVideoReference || audioReferences.length > 0 };
  const referencePolicy = getVideoReferencePolicy(model, referencePolicyOptions);
  const workflowImageLimit = startingFrame ? hookStartingFrameFaceReferenceLimit(model) || hookStartingFrameFaceReferenceLimit("google_omni") : referencePolicy.maxImages;
  const referenceLimitError = referenceImages.length > workflowImageLimit ? `Use up to ${workflowImageLimit} image references with these inputs. Remove an image before generating.` : null;
  const referenceTypeError = getVideoReferenceTypeError(model, hasVideoReference, audioReferences.length > 0, referencePolicyOptions);
  const timedReferenceError = referenceTypeError ?? (audioReferences.length > 1 ? "Use one audio reference. Remove an audio before generating." : null)
    ?? (hasVideoReference && (uploadedReferenceVideo || sourceDuration != null)
      ? getVideoTimedReferenceError(model, "video", sourceDuration, uploadedReferenceVideo?.asset.fileSizeBytes ?? undefined, referencePolicyOptions) : null)
    ?? audioReferences.map(audio => getVideoTimedReferenceError(model, "audio", audio.asset.durationSeconds, audio.asset.fileSizeBytes ?? undefined, referencePolicyOptions)).find(Boolean) ?? null;
  const imageReferenceError = referenceImages.some(image => image.asset.fileSizeBytes != null && image.asset.fileSizeBytes > referencePolicy.maxImageBytes)
    ? `Use reference images up to ${referencePolicy.maxImageBytes / 1024 ** 2} MB with these inputs. Remove or replace the oversized image.` : null;
  const editReferenceError = hasWorkflowVideoReference
    ? model !== "seedance_2_5" && model !== "google_omni" ? "Choose Seedance 2.5 or Google Omni to edit the source video, or choose Create from reference."
      : !sourceDuration && model === "seedance_2_5" ? "Reading the source video duration before generation."
      : model === "seedance_2_5" && sourceDuration && (sourceDuration < 4 || sourceDuration > 30) ? "Seedance editing needs a 4–30 second source. A longer output setting does not lengthen the source. Choose a longer clip or Create from reference."
      : model === "google_omni" && sourceDuration && sourceDuration > 10 ? "Google Omni editing needs a source up to 10 seconds. The clip will not be shortened automatically."
      : null
    : null;
  const referenceCreationError = workflow && hasVideoReference && !hasWorkflowVideoReference && model === "google_omni" &&
    (referenceImages.length > 0 || (sourceDuration != null && sourceDuration > 3))
    ? "Choose Seedance 2.5 or WAN 3.0 to create from this reference, or choose Edit source video with Google Omni." : null;
  const startingFrameError = startingFrame && !isHookStartingFrameVideoModel(model) ? "Choose Omni Flash 1.1, Seedance 2.5 or WAN 3.0 to animate this starting frame."
    : startingFrame && (startingFrame.width / startingFrame.height < .54 || startingFrame.width / startingFrame.height > 1.82 || startingFrame.width === startingFrame.height) ? "Use a 9:16 or 16:9 starting image for this animation."
    : startingFrame && !hookStartingFrameVideoDurations(model).includes(durationSeconds) ? `Choose a starting-frame duration from ${hookStartingFrameVideoDurations(model)[0]} to ${model === "google_omni" ? 10 : 15} seconds.`
    : startingFrame && aspectRatio !== (startingFrame.width > startingFrame.height ? "16:9" : "9:16") ? "Keep the starting image’s ratio to preserve its composition." : null;
  const startingFramePhotosError = startingFrame ? startingFrameFaceReferenceError(model, startingFrame, referenceImages) : null;
  const generationReferenceError = (awaitingStartingFrame ? "Create and approve a starting frame before generating this video." : null)
    ?? (startingFramePhotos.pending ? "Restoring your selected face photos…" : startingFramePhotos.error)
    ?? startingFrameError ?? startingFramePhotosError ?? referenceError ?? editReferenceError ?? referenceLimitError ?? timedReferenceError ?? imageReferenceError ?? referenceCreationError;
  const activeReferenceImageUrl = startingFrame?.url ?? (awaitingStartingFrame ? null : uploadedReference?.asset.url ?? (workflow && !uploadedVideoReference ? recreateView?.referenceImageUrl : null)) ?? null;
  const promptMaxLength = getExploreVideoPromptMaxLength({ model, hasReferenceVideo: Boolean(uploadedReferenceVideo || galleryVideoReference), referenceVideoMode: hasWorkflowVideoReference ? "edit" : undefined, format: workflowFormat === "slideshow" ? undefined : workflowFormat, personPhotos: Boolean(workflow && imagePurpose === "person" && referenceImages.length), imageCount: referenceImages.length, generateAudio: supportsWorkflowSound ? generateAudio : undefined });
  const referenceFiles = [...referenceImages, ...(uploadedVideoReference ? [uploadedVideoReference] : []), ...audioReferences];

  function handleReferenceFilesChange(selections: AIStudioReferenceMedia[]) {
    handleImageReferencesChange(selections.filter((selection) => selection.kind === "image"));
    const video = selections.find((selection) => selection.kind === "video") ?? null;
    if (video?.asset.id !== uploadedVideoReference?.asset.id) handleVideoReferenceChange(video);
    setAudioReferences(selections.filter((selection) => selection.kind === "audio"));
  }

  function handleReferenceChange(selection: AIStudioReferenceMedia | null, kind?: "image" | "video" | "audio") {
    submissionKeyRef.current = null;
    setReferenceSelectionError(null);
    setSelectedCreatorReferenceId(null);
    if (workflow) {
      const changedKind = selection?.kind ?? kind;
      if (changedKind === "image") {
        const images = selection ? [...referenceImages.filter(image => image.asset.id !== selection.asset.id), selection] : [];
        startingFramePhotos.remember(images);
        setUploadedReference(images[0] ?? null); setAdditionalImageReferences(images.slice(1));
      }
      if (changedKind === "video") setUploadedVideoReference(selection);
      if (changedKind === "audio") setAudioReferences(selection ? [selection] : []);
      if (!selection && !changedKind) { setUploadedReference(null); setAdditionalImageReferences([]); setUploadedVideoReference(null); }
      if (selection?.kind === "video") {
        recreateView?.onClearReference?.();
        if (model === "google_omni" && (selection.asset.ratio === "9:16" || selection.asset.ratio === "16:9")) setAspectRatio(selection.asset.ratio);
      }
      return;
    }
    setUploadedReference(selection);
    if (!selection) setAdditionalImageReferences([]);
  }

  function handleImageReferencesChange(selections: AIStudioReferenceMedia[]) {
    startingFramePhotos.remember(selections);
    submissionKeyRef.current = null;
    setReferenceSelectionError(null);
    setSelectedCreatorReferenceId(null);
    setUploadedReference(selections[0] ?? null);
    setAdditionalImageReferences(selections.slice(1));
  }

  function handleVideoReferenceChange(selection: AIStudioReferenceMedia | null) {
    submissionKeyRef.current = null;
    setUploadedVideoReference(selection);
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
  useEffect(() => { onWorkflowBusyChange?.(isGenerating || creatorReferenceUploadPending || referenceFilesPending); }, [isGenerating, creatorReferenceUploadPending, referenceFilesPending, onWorkflowBusyChange]);
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
          setGeneratedVideos(current => Array.from(new Map([
            ...getAIStudioVideoResults(assets, assets.length), ...current,
          ].map(video => [video.id, video])).values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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
      if (!discoveredJobIdsRef.current.has(job.id) && (!["cancelled", "completed", "failed"].includes(job.status) || job.id === urlJobId)) {
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
      const isForeground = () => !discoveredJobIdsRef.current.has(completedJob.id) && isAIStudioSessionCompletion(
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
              remixTextSource: completedJob.remixTextSource ?? null,
              modelLabel: getVideoModelLabel(metadata?.model),
              prompt: metadata?.prompt || persistedVideo.prompt,
              resolution: metadata?.resolution ?? persistedVideo.resolution,
            }
          : {
              createdAt: completedJob.completedAt ?? completedJob.updatedAt,
              remixTextSource: completedJob.remixTextSource ?? null,
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
          if (openingGenerationJobIdsRef.current.has(completedJob.id)) onGeneratedVideoRef.current?.(nextVideo);
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

    const trimmedPrompt = normalizeAIStudioPrompt(combinedPrompt);
    const promptLengthError = getAIStudioPromptLengthError(
      trimmedPrompt,
      promptMaxLength,
    );

    if (
      recreateView?.preview || (!pendingSubmission && (generationLocked || hasInsufficientCredits || !trimmedPrompt || referenceFilesPending || creatorReferenceUploadPending)) ||
      isGenerating || recoveringJobs || submittingRef.current
    ) {
      return;
    }

    if (!pendingSubmission && isExploreRecreate && !activeReferenceImageUrl) {
      setReferenceImageRequiredDialogOpen(true);
      return;
    }

    if (!pendingSubmission && promptLengthError) {
      setActionError(promptLengthError);
      return;
    }
    if (!pendingSubmission && generationReferenceError) {
      setActionError(generationReferenceError);
      return;
    }

    if (!pendingSubmission && model === "kling_3_0" && trimmedPrompt.length < 2) {
      setActionError("Kling 3.0 requires a prompt of at least 2 characters.");
      return;
    }

    if (!pendingSubmission && !isAIStudioVideoModelAvailable(model)) {
      setActionError(`${getAIStudioVideoModelLabel(model)} is temporarily unavailable. Choose another video model.`);
      return;
    }
    if (!pendingSubmission && editReferenceError) {
      setActionError(editReferenceError);
      return;
    }

    setActionNotice(null);
    setActionError(null);
    setActiveVideoPrompt(trimmedPrompt);
    setActiveSubmittedAt(new Date().toISOString());
    setSelectedHistoryVideoId(null);
    foregroundAutoResumeRef.current = false;
    openingGenerationJobIdsRef.current.clear();
    const submissionEpoch = foregroundEpochRef.current;
    setGenerationState("generating");
    submittingRef.current = true;
    setIsSubmitting(true);
    workflow?.onGenerationStart();

    try {
      const token = await withReadDeadline(() => getCurrentUserIdToken(user?.uid));

      if (!token || !user) {
        throw new Error("Sign in before generating a video.");
      }

      if (!navigator.locks) throw new Error("Use a browser with Web Locks support to recover generation safely.");
      const admitted = await submitPendingGeneration({ ownerId: user.uid, kind: "video", scope: workflowFormat ?? "studio", token, storage: localStorage, locks: navigator.locks,
        fetch, uuid: () => crypto.randomUUID(), assertActive() { if (activeUserIdRef.current !== user.uid) throw new Error("This account's generation is no longer active."); },
        onStored(saved) { setPendingSubmission(saved); submissionKeyRef.current = saved.requestKey; }, input: {
          aspectRatio,
          exploreFormat: workflow?.format,
          ...(automaticHookTextAvailable ? { automaticHookText } : {}),
          ...(supportsWorkflowSound ? { generateAudio } : {}),
          ...(startingFrame ? startingFrameAnimationInput(startingFrame, referenceImages) : {
            avatarImageUrl: activeReferenceImageUrl,
            referenceImageUrls: referenceImages.length ? referenceImages.map((image) => image.asset.url) : activeReferenceImageUrl ? [activeReferenceImageUrl] : [],
            ...(workflow && referenceImages.length ? { imageReferencePurpose: imagePurpose } : {}),
            referenceAudioUrls: audioReferences.map((audio) => audio.asset.url),
            referenceAudioAssetIds: audioReferences.map((audio) => audio.asset.id),
            referenceVideoDurationSeconds: uploadedReferenceVideo?.asset.durationSeconds ?? null,
            referenceVideoUrl: uploadedReferenceVideo?.asset.url ?? null,
            referenceVideoAssetId: uploadedReferenceVideo?.asset.id ?? null,
            ...(workflow && hasVideoReference ? { referenceVideoMode: hasWorkflowVideoReference ? "edit" : "reference" } : {}),
            ...(hasWorkflowVideoReference || galleryVideoReference ? { useGalleryVideoReference: Boolean(galleryVideoReference) } : {}),
            referenceId: galleryVideoReference?.id ?? referenceContext?.id ?? null,
            referenceType: referenceContext?.type ?? null,
            referenceUrl: referenceContext?.sourceUrl ?? null,
          }),
          durationSeconds: billedDuration,
          model,
          prompt: trimmedPrompt,
          quantity,
          resolution,
        }, acknowledge(result, input) {
          if (!persistPendingVideoMetadata(workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid, result.jobs, {
            aspectRatio: input.aspectRatio as AIStudioVideoAspectRatio, avatarName: input.avatarImageUrl ? "Reference image" : "", model: input.model as AIStudioVideoModel, prompt: String(input.prompt), resolution: input.resolution as AIStudioVideoResolution,
          })) throw new Error("Your generation is saved on the server. Its browser recovery record is preserved; recover it again.");
        } });
      if (!admitted) throw new Error("Could not confirm the generation lock.");
      const data = admitted.result as Extract<GenerateVideoResponse, { ok: true }>;
      setPendingSubmission(null); setActiveVideoPrompt(String(admitted.input.prompt));
      void queryClient.invalidateQueries({
        queryKey: ["billing-subscription", user.uid],
      });
      if (activeUserIdRef.current !== user.uid) return;
      persistJobIdInUrl(data.jobId, workflowFormat ? `explore-${workflowFormat}Job` : VIDEO_JOB_URL_PARAMETER);
      if (submissionEpoch === foregroundEpochRef.current) openingGenerationJobIdsRef.current = new Set(data.jobs.map(job => job.jobId));
      for (const job of data.jobs) {
        resolvedJobIdsRef.current.delete(job.jobId);
        if (submissionEpoch === foregroundEpochRef.current) {
          foregroundJobIdsRef.current.add(job.jobId);
        }
      }
      const jobIds = data.jobs.map((job) => job.jobId);
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
      if (user && activeUserIdRef.current === user.uid) {
        try { setPendingSubmission(readPendingGeneration(localStorage.getItem(pendingGenerationKey(user.uid, "video", workflowFormat ?? "studio")), user.uid, "video", workflowFormat ?? "studio")); }
        catch { setActionError("Could not read the saved request. Its server result remains recoverable."); }
      }
      setIsSubmitting(false);
    }
  }

  function dismissFinishedGeneration() {
    if (isGenerating) return;
    setSubmittedJobIds([]);
    setIgnoredPersistedJobId(persistedJobId);
    if (user) {
      try {
        window.localStorage.removeItem(`${VIDEO_JOB_STORAGE_PREFIX}${workflowFormat ? `${user.uid}.${workflowFormat}` : user.uid}`);
      } catch { /* Local storage can be unavailable; the job remains saved on the server. */ }
    }
    persistJobIdInUrl(null, workflowFormat ? `explore-${workflowFormat}Job` : VIDEO_JOB_URL_PARAMETER);
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
    (isGenerating ? null : resultsError ?? recoveryError);
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
    setSoundPreference(null);
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
              disabled={generationLocked && !recreateView?.preview || isGenerating}
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
  const durationSetting = startingFrame ? <AiStudioSettingSelect ariaLabel="Video duration" fieldLabel="Duration" fieldLayout="classic" size="sm"
    disabled={generationLocked && !recreateView?.preview || isGenerating} icon={<Clock3 className="size-3.5" aria-hidden="true" />}
    options={hookStartingFrameVideoDurations(model).map(seconds => ({ value: String(seconds), label: `${seconds} sec · ${seconds * creditsPerSecond} credits`, triggerLabel: `${seconds} sec` }))}
    value={String(durationSeconds)} onChange={value => { const seconds = Number(value); if (hookStartingFrameVideoDurations(model).includes(seconds)) { submissionKeyRef.current = null; setDurationSeconds(seconds as AIStudioVideoDuration); } }} />
    : hasWorkflowVideoReference ? <div className={creation.settingField}><span>Duration</span><output aria-label="Reference video duration" aria-live="polite" title="Editing follows the source timeline. App credits use the source duration estimate; Seedance rounds this up to a whole second." className={creation.referenceDuration}><Clock3 className="size-3.5 shrink-0 text-muted" aria-hidden="true" /><span>{sourceDurationLabel}</span></output><small className={creation.referenceTimingHint}>{sourceDuration ? `${Number(sourceDuration.toFixed(1))}s reference · source timing kept` : "Reading reference length…"}</small></div> : workflow ? (
    <WorkflowDurationControl
      key={model}
      ariaLabel="Video duration"
      fieldLabel="Duration"
      fieldLayout="classic"
      model={model}
      value={durationSeconds}
      creditsPerSecond={creditsPerSecond}
      disabled={generationLocked && !recreateView?.preview || isGenerating}
      size="sm"
      icon={<Clock3 className="size-3.5" aria-hidden="true" />}
      onChange={(seconds) => {
        submissionKeyRef.current = null;
        setDurationSeconds(seconds);
      }}
    />
  ) : (<AiStudioSettingSelect
              ariaLabel="Video duration"
              fieldLabel={workflow ? "Duration" : undefined}
              fieldLayout={workflow ? "classic" : undefined}
              disabled={generationLocked && !recreateView?.preview || isGenerating}
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
        emptyContentClassName={workflow ? "justify-center" : recreateView ? "items-start pt-8" : undefined}
        emptyDescription="Start a new video below. Your earlier generations are in History."
        gridClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 2xl:grid-cols-1"
        hasResults={visibleVideos.length > 0 || isGenerating}
        loading={(resultsLoading || recoveringJobs) && !isGenerating && generatedVideos.length === 0}
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
        toolbar={recreateView?.preview ? undefined :
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
          </div>
        }
      >
        {visibleVideos.map((video) => (
          <VideoResultCard
            formatMotionTimes={workflowFormat === "hook" || workflowFormat === "wall_text"}
            key={video.id}
            video={video}
            compact={Boolean(workflow)}
            onSelect={workflow?.onSelectVideo ? () => workflow.onSelectVideo?.(video) : undefined}
            selectLabel={workflowFormat === "hook" ? "Edit hook video" : "Edit video"}
            isNew={video.id === latestCompletedVideoId}
          />
        ))}
        {isGenerating && !selectedHistoryVideoId
          ? Array.from(
              { length: Math.max(1, pendingGenerationCount) },
              (_, index) => (
                <OptimisticVideoCard
                  key={`pending-video-${index}`}
                  compact={Boolean(workflow)}
                  aspectRatio={aspectRatio}
                  avatarThumbnail={activeReferenceImageUrl}
                  avatarLabel={uploadedReference?.asset.title ?? null}
                  prompt={activeVideoPrompt}
                  modelLabel={getVideoModelLabel(model)}
                  durationSeconds={hasWorkflowVideoReference ? sourceDuration ?? 0 : durationSeconds}
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
        open={!recreateView?.preview && active && historyOpen}
        query={historyQuery}
        selectedVideoId={selectedHistoryVideoId ?? latestCompletedVideoId}
      />

      <AiStudioComposer
        portalTarget={workflow?.controlsTarget}
        actionsTarget={workflow?.actionsTarget}
        promptHelper={awaitingStartingFrame ? "Choose and approve your starting image first. Then review the motion instructions here." : startingFrame ? "The approved starting frame supplies the person and scene. Describe the actions, expression and camera movement. Sound starts off." : workflow ? hasWorkflowVideoReference ? "Describe your changes. The video supplies the performance; person photos supply facial identity. Enable Sound for audio." : workflow.format === "wall_text" ? "Describe the background; add your text in Edit. Enable Sound for audio." : "Describe the scene and actions. Enable Sound for speech or music." : undefined}
        promptLabel={workflow ? "Your instructions" : undefined}
        promptAction={supportsWorkflowSound ? <button type="button" role="switch" aria-checked={generateAudio} aria-label="Generate sound" title={generateAudio ? "Sound on: use your instructions and chosen audio references" : "Sound off: the finished video will be completely silent"} disabled={isGenerating || Boolean(pendingSubmission) || (generationLocked && !recreateView?.preview)} onClick={() => {
          submissionKeyRef.current = null;
          setActionError(null);
          setSoundPreference({ owner: user?.uid ?? "preview", format: workflowFormat, enabled: !generateAudio });
        }} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-xs focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50", generateAudio ? "text-primary" : "text-muted")}>
          {generateAudio ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
          Sound {generateAudio ? "on" : "off"}
        </button> : undefined}
        promptSupplement={workflow ? <>
          {hasVideoReference ? <div className="mb-3 space-y-1.5">
            <label className="flex flex-wrap items-center justify-between gap-2 text-sm">Use source video
              <select aria-label="Source video task" value={workflowSourceMode} disabled={isGenerating || Boolean(pendingSubmission)} onChange={event => {
                submissionKeyRef.current = null;
                setActionError(null);
                setWorkflowSourceMode(event.target.value === "edit" ? "edit" : "reference");
              }} className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-focus">
                <option value="edit">Edit source video</option><option value="reference">Create from reference</option>
              </select>
            </label>
            <p className="text-xs leading-5 text-muted">{hasWorkflowVideoReference ? "Change the person’s face using your main photo and supporting views, while following the source performance and scene. Check the generated result before using it." : "Generate a new clip inspired by this video. The original footage and timing may change."}</p>
          </div> : null}
          {suggestedReferencePrompt && gallerySelectionKey ? <section aria-label="Reference prompt" className={cn(creation.referencePromptSection, "mb-3 space-y-2 rounded-lg border border-border p-3")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Reference prompt</span>
            <button type="button" disabled={isGenerating || Boolean(pendingSubmission)} className={cn(creation.referencePromptAction, "rounded underline focus-visible:outline-2 focus-visible:outline-focus")} onClick={() => {
              submissionKeyRef.current = null;
              setActionError(null);
              setReferenceRecoveryOwner(null);
              setReferencePromptDraft({ key: referencePromptKey, text: referencePrompt ? "" : suggestedReferencePrompt });
            }}>{referencePrompt ? "Remove prompt" : "Restore prompt"}</button>
          </div>
          <details className="text-xs leading-5 text-muted"><summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-focus">ⓘ About this prompt</summary><p>Describes this reference’s actions and expressions to guide generation. You can edit or remove it while keeping the video attached. Your additional instructions are sent after it.</p></details>
          {referencePrompt ? <label className="block text-xs text-muted">Reference instructions<textarea aria-label="Reference instructions" name="referenceVideoPrompt" rows={6} value={referencePrompt} disabled={isGenerating || Boolean(pendingSubmission)} onChange={event => {
            submissionKeyRef.current = null;
            setActionError(null);
            setReferencePromptDraft({ key: referencePromptKey, text: event.target.value });
          }} className="mt-1 block max-h-64 min-h-32 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6 text-foreground focus-visible:outline-2 focus-visible:outline-focus" /></label> : <p className="text-xs text-muted">Reference prompt removed. The video remains attached.</p>}
          {getAIStudioPromptLengthError(combinedPrompt, promptMaxLength) ? <p role="alert" className="text-xs text-destructive">{getAIStudioPromptLengthError(combinedPrompt, promptMaxLength)}</p> : null}
        </section> : null}</> : undefined}
        estimatedCredits={workflow && !awaitingStartingFrame && !generationLocked && !recreateView?.preview && (!hasWorkflowVideoReference || sourceDuration) ? requiredCredits : undefined}
        outputSummary={workflow ? `${resolution} · ${quantity} video${quantity === 1 ? "" : "s"}` : undefined}
        settingsSummary={workflow ? `${model === "wan_3_0" ? "WAN 3.0" : model === "seedance_2_5" ? "Seedance 2.5" : "Google Omni"} · ${hasWorkflowVideoReference ? `${sourceDuration ? `${sourceDuration.toFixed(1)}s clip` : "Source clip"} · Edit` : `${durationSeconds}s`} · ${hasWorkflowVideoReference && model === "seedance_2_5" ? "Source shape" : aspectRatio} · ${quantity} video${quantity === 1 ? "" : "s"}` : undefined}
        referenceControls={awaitingStartingFrame ? <section aria-label="Starting frame required" className="space-y-3 rounded-xl border border-border p-3"><p className="text-sm font-medium">Start with your image</p><p className="text-xs leading-5 text-muted">Create a starting frame from this reference, then choose the image you want to animate.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={isGenerating || Boolean(pendingSubmission)} onClick={startingFramePreparation?.onOpen}>Create starting frame</Button><Button type="button" variant="ghost" size="sm" disabled={isGenerating || Boolean(pendingSubmission)} onClick={recreateView?.onClearReference}>Clear reference</Button></div></section> : workflow && startingFrame ? <StartingFrameAnimationReferences key={user?.uid ?? "preview"}
          compact frame={startingFrame} model={model} photos={referenceImages} onPhotosChange={handleImageReferencesChange}
          onSelectFrame={recreateView?.onSelectStartingFrame} onClearFrame={recreateView?.onClearStartingFrame}
          previewFrames={recreateView?.previewStartingFrames} previewInfluencers={recreateView?.previewFaceReferenceImages}
          ownerId={user?.uid} preview={Boolean(recreateView?.preview)} active={workflow.controlsActive}
          disabled={isGenerating || Boolean(pendingSubmission) || (!recreateView?.preview && generationLocked)}
          onPendingChange={setCreatorReferenceUploadPending} onErrorChange={reportReferenceError} /> : workflow ? <FormatGenerationReferences startingFrame={startingFrame} onSelectStartingFrame={recreateView?.onSelectStartingFrame} onClearStartingFrame={recreateView?.onClearStartingFrame} previewStartingFrames={recreateView?.previewStartingFrames} heading={startingFrame ? "Starting frame" : "Optional references"} imagePurpose={imagePurpose} onImagePurposeChange={setImagePurpose} key={user?.uid ?? "preview"} active={workflow.controlsActive} selection={uploadedReference} imageSelection={uploadedReference} imageSelections={referenceImages} onImagesChange={handleImageReferencesChange} maxImages={workflowImageLimit} maxImageBytes={referencePolicy.maxImageBytes} videoSelection={uploadedReferenceVideo} audioSelection={audioReferences[0] ?? null} onChange={handleReferenceChange} onPendingChange={setCreatorReferenceUploadPending} onErrorChange={reportReferenceError} disabled={isGenerating || Boolean(pendingSubmission) || (!recreateView?.preview && generationLocked)} preview={Boolean(recreateView?.preview)} ownerId={user?.uid} styleVideo={galleryVideoReference} onStyleVideoDurationChange={reportGalleryVideoDuration} onClearStyle={recreateView?.onClearReference} videoInputEnabled={!startingFrame && referencePolicy.allowedKinds.includes("video")} audioInputEnabled={!startingFrame && referencePolicy.allowedKinds.includes("audio")} maxVideoDuration={referencePolicy.maxVideoDuration} maxAudioDuration={referencePolicy.maxAudioDuration} maxVideoBytes={referencePolicy.maxVideoBytes} maxAudioBytes={referencePolicy.maxAudioBytes} preserveVideoTiming={hasWorkflowVideoReference} /> : undefined}
        compact={Boolean(recreateView)}
        accessMessage={!generationLocked && generationReferenceError ? generationReferenceError : workflow && !generationLocked && !hasInsufficientCredits ? null : composerMessage}
        active={workflow?.controlsActive ?? active}
        ariaLabel="Video prompt"
        contextBanner={
          <>{automaticHookTextAvailable ? <div><label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={automaticHookText} onChange={event => setAutomaticHookText(event.target.checked)} disabled={isGenerating || Boolean(pendingSubmission)} className="mt-1 accent-primary" /><span>Automatically adapt and add {workflowFormat === "wall_text" ? "Wall" : "Hook"} text<span className="block text-xs text-muted">Uses your business context and one text remix per batch. You can edit the text on the video.</span></span></label>{automaticTextProblem ? <p role="status" className="mt-2 text-xs text-muted">{automaticTextProblem}{automaticTextReadiness.isError ? <button type="button" onClick={() => void automaticTextReadiness.refetch()} className="ml-2 underline">Retry</button> : null}</p> : null}</div> : null}{recreateView?.contextBanner ?? (referenceContext ? (
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
          ) : null)}</>
        }
        generateDisabled={
          recreateView?.preview || (!pendingSubmission && (!isAIStudioVideoModelAvailable(model) ||
          generationLocked ||
          hasInsufficientCredits ||
          !combinedPrompt.trim() ||
          Boolean(getAIStudioPromptLengthError(combinedPrompt, promptMaxLength)) ||
          creatorReferenceUploadPending ||
          Boolean(generationReferenceError) || Boolean(automaticTextProblem) ||
          referenceFilesPending)) ||
          isGenerating || recoveringJobs
        }
        generateLabel={pendingSubmission ? "Recover saved request" : "Generate video"}
        generationLocked={generationLocked && !pendingSubmission}
        hasAttachments={referenceFiles.length > 0 || referenceFilesPending}
        isGenerating={isGenerating}
        layout={workflow ? "workflow" : "unified"}
        workflowDesign={workflow ? "classic" : undefined}
        showPromptHint={generationLocked || hasInsufficientCredits}
        leadingControl={workflow ? undefined :
            <ReferenceFilesUpload
              key={user?.uid ?? "signed-out"}
              active={active}
              allowedKinds={referencePolicy.allowedKinds}
              disabled={generationLocked || isGenerating || creatorReferenceUploadPending}
              expectedUserId={user?.uid}
              maxFiles={referencePolicy.maxFiles}
              maxImages={referencePolicy.maxImages}
              maxImageBytes={referencePolicy.maxImageBytes}
              maxTimedImageBytes={getVideoReferencePolicy(model, { ...referencePolicyOptions, hasTimedReferences: true }).maxImageBytes}
              maxVideoDurationSeconds={referencePolicy.maxVideoDuration}
              maxAudioDurationSeconds={referencePolicy.maxAudioDuration}
              maxVideoBytes={referencePolicy.maxVideoBytes}
              maxAudioBytes={referencePolicy.maxAudioBytes}
              selections={referenceFiles}
              onChange={handleReferenceFilesChange}
              onPendingChange={setReferenceFilesPending}
              onErrorChange={reportReferenceError}
            />
        }
        maxLength={promptMaxLength === undefined ? undefined : Math.max(0, promptMaxLength - (referencePrompt.trim() ? referencePrompt.trim().length + 2 : 0))}
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
            {earlierRequests.available ? <Button type="button" variant="ghost" size="sm" disabled={earlierRequests.checking || isSubmitting} onClick={() => void earlierRequests.check()}>{earlierRequests.checking ? "Checking earlier requests…" : "Check earlier requests"}</Button> : null}
            {earlierRequests.error ? <span role="alert" className="text-xs text-destructive">{earlierRequests.error}</span> : null}
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
              disabled={generationLocked && !recreateView?.preview || isGenerating || referenceFilesPending || creatorReferenceUploadPending}
              size="sm"
              options={AI_STUDIO_VIDEO_MODELS.filter(value => !workflow || value === "google_omni" || value === "seedance_2_5" || value === "wan_3_0").map((value) => ({
                label: `${getAIStudioVideoModelLabel(value)}${isAIStudioVideoModelAvailable(value) ? "" : " · temporarily unavailable"}`,
                disabled: !isAIStudioVideoModelAvailable(value) || Boolean(startingFrame && !isHookStartingFrameVideoModel(value)),
                value,
              }))}
              value={model}
              onChange={(value) => {
                if (isGenerating || referenceFilesPending || creatorReferenceUploadPending) return;
                submissionKeyRef.current = null;
                const nextModel = value as AIStudioVideoModel;
                if (!isAIStudioVideoModelAvailable(nextModel) || startingFrame && !isHookStartingFrameVideoModel(nextModel)) return;
                const durations = startingFrame ? hookStartingFrameVideoDurations(nextModel) : getAIStudioVideoDurations(nextModel);
                if (startingFrame) {
                  setDurationSeconds(startingFrame.durationSeconds === 6 ? 6 : hookStartingFrameDefaultDuration(nextModel));
                } else if (!durations.includes(durationSeconds)) {
                  setDurationSeconds(Math.min(Math.max(durationSeconds, durations[0]), durations[durations.length - 1]) as AIStudioVideoDuration);
                }
                if (value === "kling_3_0" && durationSeconds > 15) {
                  setDurationSeconds(5);
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
                (!uploadedReference && referenceImages.length >= referencePolicy.maxImages)
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
              allowedRatios={startingFrame ? [startingFrame.width > startingFrame.height ? "16:9" : "9:16"] : ["9:16", "16:9"]}
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
  compact = false,
  aspectRatio,
  avatarThumbnail,
  avatarLabel,
  prompt,
  modelLabel,
  durationSeconds,
  resolution,
}: {
  compact?: boolean;
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
    <article data-compact={compact || undefined} className={cn(resultLayout.card, "mx-auto w-full max-w-[64rem] py-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300")}>
      <div className={resultLayout.row} data-ratio={aspectRatio}>
        <div
          className={cn(
            resultLayout.media,
            getVideoResultWidthClassName(aspectRatio),
          )}
        >
          <VideoGenerationPlaceholder aspectRatio={aspectRatio} referenceImageUrl={avatarThumbnail} referenceImageLabel={avatarLabel} />
          <div className="mt-3">
            <VideoResultMetadata
              modelLabel={modelLabel}
              durationSeconds={durationSeconds}
              resolution={resolution}
              ratio={aspectRatio}
            />
          </div>
        </div>
        <div className={resultLayout.prompt}>
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
  formatMotionTimes = false,
  compact = false,
  isNew = false,
  onSelect,
  selectLabel = "Edit video",
}: {
  video: GeneratedVideo;
  formatMotionTimes?: boolean;
  compact?: boolean;
  isNew?: boolean;
  onSelect?: () => void;
  selectLabel?: string;
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
      data-compact={compact || undefined}
      className={cn(
        resultLayout.card, "mx-auto w-full max-w-[64rem] scroll-mt-4 py-2",
        isNew &&
          "motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-500",
      )}
    >
      <div className={resultLayout.row} data-ratio={video.ratio}>
        <div
          className={cn(
            resultLayout.media,
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
          {onSelect ? <Button type="button" className="mt-3" disabled={!video.mediaAssetId} onClick={onSelect}>{selectLabel}</Button> : null}
          <AiStudioResultActions
            className="mt-3"
            kind="video"
            showOpenAction={false}
            title={video.title}
            url={video.url}
            variant="buttons"
          />
        </div>
        <div className={resultLayout.prompt}>
          <VideoPromptBubble createdAt={video.createdAt} prompt={formatMotionTimes ? formatMotionPromptTimes(video.prompt) : video.prompt} />
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
