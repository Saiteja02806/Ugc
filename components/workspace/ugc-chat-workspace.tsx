"use client";

import { ExternalLink, ImageIcon, Loader2, Sparkles } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  AiStudioComposer,
  AiStudioSetting,
} from "@/components/generation/ai-studio-composer";
import {
  AiStudioResults,
  type AiStudioResultsStatus,
} from "@/components/generation/ai-studio-results";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import type { AIStudioAccessState } from "@/lib/ai-studio/access-policy";
import {
  fetchAIStudioMediaAsset,
  fetchAIStudioMediaAssets,
} from "@/lib/ai-studio/media-client";
import {
  getAIStudioImageResults,
  type AIStudioImageResult,
  upsertAIStudioResult,
} from "@/lib/ai-studio/media-results";
import {
  AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH,
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "@/lib/ai-studio/prompt-policy";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  persistJobIdInUrl,
  useBackgroundJob,
  usePersistedJobIdFromUrl,
} from "@/lib/jobs/background-job-client";
import type { Json } from "@/lib/jobs/background-jobs";
import { cn } from "@/lib/utils";

type GenerateResponse =
  | {
      generationId: string;
      jobId: string;
      message: string;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

const IMAGE_JOB_STORAGE_PREFIX = "ugc-ai-studio.latest-image-job.v2.";
const IMAGE_JOB_METADATA_PREFIX = "ugc-ai-studio.image-job.v2.";
const IMAGE_JOB_URL_PARAMETER = "imageJob";
const activeJobStatuses = new Set([
  "cancel_requested",
  "created",
  "processing",
  "queued",
  "rendering",
  "stalled",
  "uploading_output",
  "waiting_external_service",
]);

function getImageJobOutput(output: Json | null) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  return {
    generationId:
      typeof output.generationId === "string" ? output.generationId : null,
    mediaAssetId:
      typeof output.mediaAssetId === "string" ? output.mediaAssetId : null,
    url: typeof output.url === "string" ? output.url : null,
  };
}

function persistImageJob(userId: string, jobId: string, prompt: string) {
  try {
    window.localStorage.setItem(`${IMAGE_JOB_STORAGE_PREFIX}${userId}`, jobId);
    window.localStorage.setItem(
      `${IMAGE_JOB_METADATA_PREFIX}${userId}.${jobId}`,
      JSON.stringify({ prompt }),
    );
  } catch {
    // The owner-scoped URL remains the resume fallback when storage is blocked.
  }
}

function getImageJobPrompt(userId: string, jobId: string) {
  try {
    const rawValue = window.localStorage.getItem(
      `${IMAGE_JOB_METADATA_PREFIX}${userId}.${jobId}`,
    );
    const value = rawValue ? (JSON.parse(rawValue) as unknown) : null;

    return value &&
      typeof value === "object" &&
      "prompt" in value &&
      typeof value.prompt === "string"
      ? value.prompt
      : "Generated image";
  } catch {
    return "Generated image";
  }
}

export function ImageGenerationStudioPanel({
  accessMessage,
  accessState = "locked",
  active = true,
}: {
  accessMessage?: string | null;
  accessState?: AIStudioAccessState;
  active?: boolean;
}) {
  const { loading: authLoading, user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [latestCompletedId, setLatestCompletedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<
    AIStudioImageResult[]
  >([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [storedJobId, setStoredJobId] = useState<string | null>(null);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [ignoredPersistedJobId, setIgnoredPersistedJobId] = useState<
    string | null
  >(null);
  const resolvedJobIdsRef = useRef(new Set<string>());
  const persistedJobId = usePersistedJobIdFromUrl(IMAGE_JOB_URL_PARAMETER);
  const urlJobId =
    persistedJobId && persistedJobId !== ignoredPersistedJobId
      ? persistedJobId
      : null;
  const activeJobId = submittedJobId ?? urlJobId ?? storedJobId;
  const activeJobQuery = useBackgroundJob(activeJobId);
  const queriedJob = activeJobQuery.data;
  const durableJob =
    queriedJob?.jobType === "image_generation" ? queriedJob : null;
  const generationLocked = accessState !== "pro";
  const isGenerating =
    isSubmitting ||
    Boolean(activeJobId && activeJobQuery.isPending) ||
    Boolean(durableJob && activeJobStatuses.has(durableJob.status));

  useEffect(() => {
    if (!active || authLoading) {
      return;
    }

    let ignore = false;

    async function loadResults() {
      if (!user) {
        if (!ignore) {
          setGeneratedAssets([]);
          setStoredJobId(null);
          setResultsError("Sign in to view your generated images.");
          setResultsLoading(false);
        }
        return;
      }

      setResultsLoading(true);
      setResultsError(null);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in to view your generated images.");
        }

        const assets = await fetchAIStudioMediaAssets({
          collection: "image",
          sourceType: "generated_image",
          token,
        });

        if (!ignore) {
          setGeneratedAssets(getAIStudioImageResults(assets));
          setSubmittedJobId(null);
          setIgnoredPersistedJobId(null);
          setStoredJobId(
            window.localStorage.getItem(
              `${IMAGE_JOB_STORAGE_PREFIX}${user.uid}`,
            ),
          );
        }
      } catch (error) {
        if (!ignore) {
          setResultsError(
            getErrorMessage(error, "Could not load your generated images."),
          );
        }
      } finally {
        if (!ignore) {
          setResultsLoading(false);
        }
      }
    }

    void loadResults();

    return () => {
      ignore = true;
    };
  }, [active, authLoading, user]);

  useEffect(() => {
    if (
      queriedJob &&
      queriedJob.jobType !== "image_generation" &&
      activeJobId === persistedJobId
    ) {
      const timeoutId = window.setTimeout(
        () => setIgnoredPersistedJobId(persistedJobId),
        0,
      );

      return () => window.clearTimeout(timeoutId);
    }
  }, [activeJobId, persistedJobId, queriedJob]);

  useEffect(() => {
    if (
      !durableJob ||
      durableJob.status !== "completed" ||
      resolvedJobIdsRef.current.has(durableJob.id) ||
      !user
    ) {
      return;
    }

    const completedJob = durableJob;
    const output = getImageJobOutput(completedJob.output);
    const userId = user.uid;
    let ignore = false;

    async function reconcileCompletedImage() {
      if (!output?.url) {
        if (!ignore) {
          setActionError("Image generation completed without a usable output.");
        }
        return;
      }

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in to restore the generated image.");
        }

        let persistedResult: AIStudioImageResult | null = null;

        try {
          if (output.mediaAssetId) {
            const asset = await fetchAIStudioMediaAsset(
              output.mediaAssetId,
              token,
            );
            persistedResult = getAIStudioImageResults([asset], 1)[0] ?? null;
          } else {
            const assets = await fetchAIStudioMediaAssets({
              collection: "image",
              sourceType: "generated_image",
              token,
            });
            persistedResult =
              getAIStudioImageResults(
                assets.filter(
                  (asset) => asset.sourceRecordId === completedJob.id,
                ),
                1,
              )[0] ?? null;
          }
        } catch {
          // The durable job output is still usable while media persistence
          // catches up or the media endpoint is temporarily unavailable.
        }

        const nextResult: AIStudioImageResult =
          persistedResult ?? {
            aspectRatio: "4:5",
            createdAt: completedJob.completedAt ?? completedJob.updatedAt,
            id: output.generationId ?? completedJob.id,
            title: getImageJobPrompt(userId, completedJob.id),
            url: output.url,
          };

        if (!ignore) {
          resolvedJobIdsRef.current.add(completedJob.id);
          setGeneratedAssets((current) =>
            upsertAIStudioResult(current, nextResult),
          );
          setLatestCompletedId(nextResult.id);
          window.setTimeout(() => setLatestCompletedId(null), 3_500);
          setActivePrompt("");
          setActionError(null);
        }
      } catch (error) {
        if (!ignore) {
          setActionError(
            getErrorMessage(error, "Could not restore the generated image."),
          );
        }
      }
    }

    void reconcileCompletedImage();

    return () => {
      ignore = true;
    };
  }, [durableJob, user]);

  async function generateFromPrompt(rawPrompt: string) {
    const trimmedPrompt = normalizeAIStudioPrompt(rawPrompt);
    const promptLengthError = getAIStudioPromptLengthError(
      trimmedPrompt,
      AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH,
    );

    if (generationLocked || !trimmedPrompt || isGenerating) {
      return;
    }

    if (promptLengthError) {
      setActionError(promptLengthError);
      return;
    }

    setIsSubmitting(true);
    setActivePrompt(trimmedPrompt);
    setActionError(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token || !user) {
        throw new Error("Sign in before generating images.");
      }

      const response = await fetch("/api/ai-studio/images/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });
      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.ok === false ? data.message : "Generation could not start.",
        );
      }

      persistImageJob(user.uid, data.jobId, trimmedPrompt);
      persistJobIdInUrl(data.jobId, IMAGE_JOB_URL_PARAMETER);
      resolvedJobIdsRef.current.delete(data.jobId);
      setStoredJobId(data.jobId);
      setSubmittedJobId(data.jobId);
      setPrompt("");
    } catch (error) {
      console.error("Image generation failed:", error);
      setActionError(
        getErrorMessage(error, "Image generation failed. Try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    void generateFromPrompt(prompt);
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void generateFromPrompt(prompt);
    }
  }

  function handleEnhancePrompt() {
    const trimmedPrompt = normalizeAIStudioPrompt(prompt);
    const enhancement =
      "Production notes: preserve the subject and intent, improve composition, lighting, clarity, and platform-ready framing without adding unrequested text or objects.";

    if (generationLocked || !trimmedPrompt || trimmedPrompt.includes("Production notes:")) {
      return;
    }

    const enhancedPrompt = `${trimmedPrompt}\n\n${enhancement}`;
    const promptLengthError = getAIStudioPromptLengthError(
      enhancedPrompt,
      AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH,
    );

    if (promptLengthError) {
      setActionError(promptLengthError);
      return;
    }

    setActionError(null);
    setPrompt(enhancedPrompt);
  }

  const jobQueryError = activeJobQuery.isError
    ? getErrorMessage(
        activeJobQuery.error,
        "Could not retrieve the image generation job.",
      )
    : null;
  const durableError =
    durableJob?.status === "failed"
      ? durableJob.error?.message || "Image generation failed. Try again."
      : durableJob?.status === "cancelled"
        ? "Image generation was cancelled."
        : null;
  const resultsErrorMessage = actionError ?? jobQueryError ?? durableError ?? resultsError;
  const resultsStatus: AiStudioResultsStatus | null = resultsErrorMessage
    ? { label: resultsErrorMessage, tone: "error" }
    : isGenerating
      ? { label: "Creating your image…", tone: "progress" }
      : null;

  return (
    <div
      id="ai-studio-images-panel"
      role="tabpanel"
      aria-labelledby="ai-studio-images-tab"
      hidden={!active}
      className={cn(
        "min-h-0 flex-1 flex-col",
        active ? "flex flex-col" : "hidden",
      )}
    >
      <AiStudioResults
        ariaLabel="Generated images"
        emptyDescription="Describe the image you want below. Finished generations are saved to your account."
        hasResults={generatedAssets.length > 0 || isGenerating}
        loading={resultsLoading}
        status={resultsStatus}
      >
        {isGenerating ? <OptimisticImageCard prompt={activePrompt} /> : null}
        {generatedAssets.map((asset) => (
          <GeneratedAssetCard
            key={asset.id}
            asset={asset}
            isNew={asset.id === latestCompletedId}
          />
        ))}
      </AiStudioResults>

      <AiStudioComposer
        accessMessage={accessMessage}
        active={active}
        ariaLabel="Image prompt"
        generateDisabled={generationLocked || !prompt.trim() || isGenerating}
        generateLabel="Generate image"
        generationLocked={generationLocked}
        isGenerating={isGenerating}
        layout="unified"
        maxLength={AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH}
        name="imagePrompt"
        placeholder="Describe the image you want to create…"
        prompt={prompt}
        onPromptChange={(nextPrompt) => {
          setActionError(null);
          setPrompt(nextPrompt);
        }}
        onSubmit={handleSubmit}
        onTextareaKeyDown={handleTextareaKeyDown}
        settings={
          <>
            <AiStudioSetting
              icon={
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-3.5 shrink-0 rounded-[4px] border-2 border-muted"
                />
              }
              label="4:5 portrait"
            />
            <AiStudioSetting
              icon={<ImageIcon className="size-4" aria-hidden="true" />}
              label="1 image"
            />
            <Button
              type="button"
              variant="muted"
              size="lg"
              onClick={handleEnhancePrompt}
              disabled={generationLocked || !prompt.trim() || isGenerating}
              aria-label={
                generationLocked
                  ? "Image prompt enhancement locked"
                  : "Enhance image prompt"
              }
              title={generationLocked ? accessMessage ?? undefined : undefined}
            >
              <Sparkles data-icon="inline-start" aria-hidden="true" />
              Enhance
            </Button>
          </>
        }
      />
    </div>
  );
}

function OptimisticImageCard({ prompt }: { prompt?: string }) {
  return (
    <article className="group min-w-0 animate-in fade-in-0 duration-300">
      <div
        className="relative overflow-hidden rounded-[var(--radius-card)] bg-card-muted/70 ring-1 ring-primary/30"
        style={{ aspectRatio: "4 / 5" }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.04] via-transparent to-primary/[0.08]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded-full border border-primary/30 bg-card/90 shadow-sm backdrop-blur-md">
            <Loader2
              className="size-4 animate-spin text-primary"
              aria-hidden="true"
            />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-card/85 px-2.5 py-1 text-[11px] font-semibold text-foreground-strong shadow-xs backdrop-blur-md">
            <Sparkles className="size-3 text-primary" aria-hidden="true" />
            Generating image…
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xs font-semibold text-foreground/85">
            {prompt || "Creating image…"}
          </h3>
          <p className="mt-0.5 animate-pulse text-xs text-muted-subtle">
            Polishing details…
          </p>
        </div>
      </div>
    </article>
  );
}

function GeneratedAssetCard({
  asset,
  isNew = false,
}: {
  asset: AIStudioImageResult;
  isNew?: boolean;
}) {
  return (
    <article
      className={cn(
        "group min-w-0 transition-[transform,box-shadow] duration-300",
        isNew &&
          "animate-in fade-in-50 zoom-in-[0.98] rounded-[var(--radius-card)] duration-500 ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background",
      )}
    >
      <div
        className="overflow-hidden rounded-[var(--radius-card)] bg-card-muted ring-1 ring-border"
        style={{ aspectRatio: asset.aspectRatio.replace(":", " / ") }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.title}
          width={1200}
          height={getGeneratedImageHeight(asset.aspectRatio)}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-semibold text-foreground">
            {asset.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-subtle">
            {formatGeneratedAt(asset.createdAt)}
          </p>
        </div>
        <a
          href={asset.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${asset.title} in a new tab`}
          title="Open image in a new tab"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-subtle transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function getGeneratedImageHeight(
  aspectRatio: AIStudioImageResult["aspectRatio"],
) {
  const heights: Record<AIStudioImageResult["aspectRatio"], number> = {
    "4:5": 1500,
    "1:1": 1200,
    "9:16": 2133,
    "16:9": 675,
  };

  return heights[aspectRatio];
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
