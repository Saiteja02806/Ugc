"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Film,
  Lock,
  Loader2,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { ReferenceImageAttachment } from "@/components/generation/reference-image-attachment";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";
import { cn } from "@/lib/utils";
import {
  getAvatarDisplayName,
  getAvatarFallbackText,
} from "@/lib/video/avatar-display";

type VideoRatio = "9:16" | "1:1" | "4:5" | "16:9";
type VideoCount = 1 | 2 | 4;
type GenerationState = "empty" | "generating" | "completed" | "failed";

type AvatarOption = {
  id: string;
  label: string;
  selection: AvatarSelection;
  thumbnailUrl: string | null;
};

type AvatarRatio = "9:16" | "1:1" | "4:5" | "16:9" | "other";
type AvatarStatus = "ready" | "disabled" | "processing" | "failed";

type AvatarAsset = {
  avatarType: "global";
  createdAt: string;
  description: string | null;
  durationSeconds: number | null;
  height: number | null;
  id: string;
  metadata: unknown;
  name: string;
  ratio: AvatarRatio;
  sourceVideoUrl: string;
  status: AvatarStatus;
  thumbnailUrl: string | null;
  updatedAt: string;
  width: number | null;
};

type AvatarPreference = {
  avatarAssetId: string;
  id: string;
  isTrimmed: boolean;
  lastUsedAt: string | null;
  trimEnd: number | null;
  trimStart: number | null;
  updatedAt: string;
} | null;

type AvatarSelection = {
  avatarAssetId: string;
  isTrimmed: boolean;
  sourceVideoUrl: string;
  trimEnd: number | null;
  trimStart: number;
};

type AvatarLibraryItem = {
  asset: AvatarAsset;
  avatarSelection: AvatarSelection;
  preference: AvatarPreference;
};

type AvatarListResponse =
  | {
      avatars: AvatarLibraryItem[];
      ok: true;
    }
  | {
      error?: string;
      ok?: false;
    };

type GeneratedVideo = {
  avatarName: string;
  createdAt?: string;
  duration?: string;
  id: string;
  prompt: string;
  ratio: VideoRatio;
  status: "Ready" | "Processing" | "Failed";
  title: string;
  url?: string;
};

const videoRatios: VideoRatio[] = ["9:16", "1:1", "4:5", "16:9"];
const videoCountOptions: VideoCount[] = [1, 2, 4];
const VIDEO_GENERATION_LOCKED = true;
const instagramVideoFormatLabels: Record<VideoRatio, string> = {
  "9:16": "Reel",
  "1:1": "Square",
  "4:5": "Feed",
  "16:9": "Landscape",
};

export function VideoGenerationWorkspace() {
  return (
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-[#1F1F1F] px-4 py-4 text-[#F5F3F0] sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-[#F5F3F0] sm:text-3xl">
            AI Studio
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#B9B5AF]">
            Generate images and videos from one focused workspace.
          </p>
        </div>

        <div className="inline-flex h-8 w-fit items-center gap-2 rounded-[var(--radius-control)] border border-[#383838] bg-[#242424] px-3 text-xs font-semibold text-[#B9B5AF]">
          <Lock className="size-3.5" aria-hidden="true" />
          Preview mode
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col pt-5">
        <VideoGenerationStudioPanel />
      </div>
    </section>
  );
}

export function VideoGenerationStudioPanel({
  active = true,
}: {
  active?: boolean;
}) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<VideoRatio>("9:16");
  const [videoCount, setVideoCount] = useState<VideoCount>(2);
  const [avatarLibrary, setAvatarLibrary] = useState<AvatarLibraryItem[]>([]);
  const [personalAvatarAssets, setPersonalAvatarAssets] = useState<MediaAsset[]>([]);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarErrorMessage, setAvatarErrorMessage] = useState<string | null>(
    null,
  );
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [generationState, setGenerationState] =
    useState<GenerationState>("empty");
  const [generatedVideos] = useState<GeneratedVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const generationTimerRef = useRef<number | null>(null);

  const personalAvatars = useMemo(
    () => personalAvatarAssets.map(mapPersonalMediaToAvatarOption),
    [personalAvatarAssets],
  );
  const globalAvatars = useMemo(
    () => avatarLibrary.map(mapAvatarLibraryItemToOption),
    [avatarLibrary],
  );
  const avatarOptions = useMemo(
    () => [...personalAvatars, ...globalAvatars],
    [globalAvatars, personalAvatars],
  );
  const selectedAvatar = selectedAvatarId
    ? avatarOptions.find((avatar) => avatar.id === selectedAvatarId) ?? null
    : null;
  const isGenerating = generationState === "generating";

  useEffect(() => {
    return () => {
      if (generationTimerRef.current) {
        window.clearTimeout(generationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadAvatarLibrary() {
      if (authLoading) {
        return;
      }

      setAvatarErrorMessage(null);

      if (!user) {
        setAvatarLibrary([]);
        setPersonalAvatarAssets([]);
        setSelectedAvatarId(null);
        setAvatarLoading(false);
        setAvatarErrorMessage("Sign in before choosing a presenter.");
        return;
      }

      setAvatarLoading(true);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in before choosing a presenter.");
        }

        const [libraryResult, personalResult] = await Promise.allSettled([
          fetchAvatarLibrary(token),
          fetchPersonalInfluencers(token),
        ]);

        if (ignore) {
          return;
        }

        const nextAvatarLibrary =
          libraryResult.status === "fulfilled" ? libraryResult.value : [];
        const nextPersonalAssets =
          personalResult.status === "fulfilled" ? personalResult.value : [];
        const partialErrors = [libraryResult, personalResult]
          .filter(
            (result): result is PromiseRejectedResult =>
              result.status === "rejected",
          )
          .map((result) =>
            getErrorMessage(result.reason, "Could not load presenters."),
          );

        setAvatarLibrary(nextAvatarLibrary);
        setPersonalAvatarAssets(nextPersonalAssets);
        setAvatarErrorMessage(
          partialErrors.length > 0 ? partialErrors.join(" ") : null,
        );
        setSelectedAvatarId((currentAvatarId) =>
          currentAvatarId &&
          (nextAvatarLibrary.some(
            (avatar) => avatar.asset.id === currentAvatarId,
          ) || nextPersonalAssets.some((asset) => asset.id === currentAvatarId))
            ? currentAvatarId
            : nextPersonalAssets[0]?.id ??
              nextAvatarLibrary[0]?.asset.id ??
              null,
        );
      } catch (error) {
        if (!ignore) {
          setAvatarLibrary([]);
          setPersonalAvatarAssets([]);
          setSelectedAvatarId(null);
          setAvatarErrorMessage(
            getErrorMessage(error, "Could not load presenters."),
          );
        }
      } finally {
        if (!ignore) {
          setAvatarLoading(false);
        }
      }
    }

    void loadAvatarLibrary();

    return () => {
      ignore = true;
    };
  }, [authLoading, user]);

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (VIDEO_GENERATION_LOCKED || !prompt.trim() || isGenerating) {
      return;
    }

    if (!selectedAvatar) {
      setActionNotice(
        avatarLoading
          ? "Presenter library is still loading."
          : "Choose a presenter before generating.",
      );
      return;
    }

    setActionNotice(null);
    setGenerationState("generating");

    if (generationTimerRef.current) {
      window.clearTimeout(generationTimerRef.current);
    }

    generationTimerRef.current = window.setTimeout(() => {
      setGenerationState("failed");
    }, 900);
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleEnhancePrompt() {
    const trimmedPrompt = prompt.trim();
    const enhancement =
      "Hook structure: open with a sharp pain point, show the SaaS product in context, use founder-style direct language, keep it under 20 seconds, end with one clear action.";

    if (!trimmedPrompt) {
      setPrompt(
        "Create a short UGC hook for a productivity SaaS that helps teams organize docs, tasks, and workflows.",
      );
      return;
    }

    if (trimmedPrompt.includes("Hook structure:")) {
      return;
    }

    setPrompt(`${trimmedPrompt}\n\n${enhancement}`);
  }

  function handleEditVideo(video: GeneratedVideo) {
    setSelectedVideoId(video.id);

    if (!video.url) {
      setActionNotice("This video needs to finish generating before editing.");
      return;
    }

    router.push(`/edit/${encodeURIComponent(video.id)}`);
  }

  function handleUseAsHook(video: GeneratedVideo) {
    setSelectedVideoId(video.id);
    setActionNotice("Hook asset selection will connect when generation storage is ready.");
  }

  return (
    <div
      id="ai-studio-videos-panel"
      role="tabpanel"
      aria-labelledby="ai-studio-videos-tab"
      hidden={!active}
      className={cn("min-h-0 flex-1 flex-col gap-4", active ? "flex" : "hidden")}
    >
        <VideoResultsArea
          actionNotice={actionNotice}
          generatedVideos={generatedVideos}
          generationState={generationState}
          selectedVideoId={selectedVideoId}
          onEditVideo={handleEditVideo}
          onSelectVideo={setSelectedVideoId}
          onUseAsHook={handleUseAsHook}
        />

        <VideoPromptBar
          active={active}
          avatarErrorMessage={avatarErrorMessage}
          avatarLoading={avatarLoading}
          avatar={selectedAvatar}
          globalAvatars={globalAvatars}
          isGenerating={isGenerating}
          personalAvatars={personalAvatars}
          prompt={prompt}
          ratio={ratio}
          selectedAvatarId={selectedAvatarId}
          videoCount={videoCount}
          onAvatarChange={setSelectedAvatarId}
          onEnhancePrompt={handleEnhancePrompt}
          onPromptChange={setPrompt}
          onRatioChange={setRatio}
          onSubmit={handleSubmit}
          onTextareaKeyDown={handleTextareaKeyDown}
          onVideoCountChange={setVideoCount}
        />
    </div>
  );
}

function mapAvatarLibraryItemToOption(avatar: AvatarLibraryItem): AvatarOption {
  return {
    id: avatar.asset.id,
    label: avatar.asset.name,
    selection: avatar.avatarSelection,
    thumbnailUrl: avatar.asset.thumbnailUrl,
  };
}

async function fetchAvatarLibrary(token: string) {
  const response = await fetch("/api/avatars", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as AvatarListResponse;

  if (!response.ok || data.ok !== true) {
    throw new Error(getApiErrorMessage(data, "Could not load the presenter library."));
  }

  return data.avatars;
}

async function fetchPersonalInfluencers(token: string) {
  const response = await fetch("/api/media?collection=influencer", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as
    | { assets: MediaAsset[]; ok: true }
    | { error?: string; ok?: false };

  if (!response.ok || data.ok !== true) {
    throw new Error(getApiErrorMessage(data, "Could not load your source videos."));
  }

  return data.assets;
}

function mapPersonalMediaToAvatarOption(asset: MediaAsset): AvatarOption {
  return {
    id: asset.id,
    label: asset.title,
    selection: {
      avatarAssetId: asset.id,
      isTrimmed: false,
      sourceVideoUrl: asset.url,
      trimEnd: asset.durationSeconds,
      trimStart: 0,
    },
    thumbnailUrl: asset.thumbnailUrl,
  };
}

function getApiErrorMessage(response: unknown, fallback: string) {
  if (
    response &&
    typeof response === "object" &&
    "error" in response &&
    typeof response.error === "string"
  ) {
    return response.error;
  }

  return fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function VideoResultsArea({
  actionNotice,
  generatedVideos,
  generationState,
  onEditVideo,
  onSelectVideo,
  onUseAsHook,
  selectedVideoId,
}: {
  actionNotice: string | null;
  generatedVideos: GeneratedVideo[];
  generationState: GenerationState;
  onEditVideo: (video: GeneratedVideo) => void;
  onSelectVideo: (videoId: string) => void;
  onUseAsHook: (video: GeneratedVideo) => void;
  selectedVideoId: string | null;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card-muted/35 px-4 sm:px-6",
        generatedVideos.length > 0
          ? "min-h-[360px] py-8 sm:min-h-[430px]"
          : "min-h-[220px] py-6 sm:min-h-[250px]",
      )}
    >
      <h2 className="sr-only">Generated videos</h2>

      {generatedVideos.length > 0 ? (
        <span className="absolute right-4 top-4 text-xs font-semibold text-[#B9B5AF] sm:right-6">
          {generatedVideos.length} total
        </span>
      ) : null}

      {generationState === "failed" ? (
        <div
          role="alert"
          className="absolute left-4 top-4 w-fit rounded-full border border-[#E15A5A]/35 bg-[#2A2020] px-3 py-2 text-xs font-semibold text-[#E15A5A] shadow-[0_10px_28px_rgb(0_0_0_/_0.18)] sm:left-6"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-3.5" aria-hidden="true" />
            Video generation failed. Review the prompt and try again.
          </div>
        </div>
      ) : null}

      {generationState === "generating" ? (
        <div
          role="status"
          className="absolute left-4 top-4 w-fit rounded-full border border-[#383838] bg-[#242424] px-3 py-2 text-xs font-semibold text-[#F5F3F0] shadow-[0_10px_28px_rgb(0_0_0_/_0.18)] sm:left-6"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            Creating your video…
          </div>
        </div>
      ) : null}

      {actionNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-4 top-4 w-fit rounded-[var(--radius-control)] border border-border bg-card px-3 py-2 text-xs font-medium text-muted shadow-card sm:left-6"
        >
          {actionNotice}
        </div>
      ) : null}

      {generatedVideos.length > 0 ? (
        <div className="grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto pb-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {generatedVideos.map((video) => (
            <VideoResultCard
              key={video.id}
              selected={selectedVideoId === video.id}
              video={video}
              onEdit={() => onEditVideo(video)}
              onSelect={() => onSelectVideo(video.id)}
              onUseAsHook={() => onUseAsHook(video)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 py-6 text-center">
          <div className="max-w-sm">
            <span className="mx-auto flex size-10 items-center justify-center rounded-[var(--radius-control)] border border-primary/20 bg-brand-soft text-primary">
              <Video className="size-4.5" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              Reel workspace
            </h3>
            <p className="mt-1 text-sm leading-5 text-muted">
              Generated Instagram videos will appear here when generation is enabled.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoPromptBar({
  active,
  avatar,
  avatarErrorMessage,
  avatarLoading,
  globalAvatars,
  isGenerating,
  onAvatarChange,
  onEnhancePrompt,
  onPromptChange,
  onRatioChange,
  onSubmit,
  onTextareaKeyDown,
  onVideoCountChange,
  personalAvatars,
  prompt,
  ratio,
  selectedAvatarId,
  videoCount,
}: {
  active: boolean;
  avatar: AvatarOption | null;
  avatarErrorMessage: string | null;
  avatarLoading: boolean;
  globalAvatars: AvatarOption[];
  isGenerating: boolean;
  onAvatarChange: (avatarId: string | null) => void;
  onEnhancePrompt: () => void;
  onPromptChange: (prompt: string) => void;
  onRatioChange: (ratio: VideoRatio) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onVideoCountChange: (count: VideoCount) => void;
  personalAvatars: AvatarOption[];
  prompt: string;
  ratio: VideoRatio;
  selectedAvatarId: string | null;
  videoCount: VideoCount;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    if (!active) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 132)}px`;
  }, [active, prompt]);

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-[1120px] rounded-[var(--radius-card)] border border-border bg-card p-3 shadow-card transition-[border-color,box-shadow] focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10 sm:p-4"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
        <ReferenceImageAttachment disabled={isGenerating} />

        <textarea
          ref={textareaRef}
          rows={1}
          aria-label="Video prompt"
          autoComplete="off"
          name="videoPrompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={onTextareaKeyDown}
          className="col-start-2 row-start-1 max-h-32 min-h-11 min-w-0 resize-none overflow-y-hidden bg-transparent px-1 py-2.5 text-sm font-medium leading-6 text-foreground outline-none placeholder:text-muted-subtle"
          placeholder="Describe your Reel…"
        />

        <button
          type="submit"
          disabled={VIDEO_GENERATION_LOCKED || !prompt.trim() || isGenerating || !avatar}
          aria-label={VIDEO_GENERATION_LOCKED ? "Video generation locked" : "Generate video"}
          title={VIDEO_GENERATION_LOCKED ? "Video generation is locked" : undefined}
          className="col-start-3 row-start-1 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[118px]"
        >
          {VIDEO_GENERATION_LOCKED ? (
            <>
              <span className="hidden sm:inline">Locked</span>
              <Lock className="size-4" aria-hidden="true" />
            </>
          ) : isGenerating ? (
            <>
              <span className="hidden sm:inline">Generating…</span>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            </>
          ) : (
            <>
              Generate video
              <Sparkles className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <RatioSelector value={ratio} onChange={onRatioChange} />
        <VideoCountSelector value={videoCount} onChange={onVideoCountChange} />
        <AvatarPicker
          avatarErrorMessage={avatarErrorMessage}
          avatarLoading={avatarLoading}
          globalAvatars={globalAvatars}
          personalAvatars={personalAvatars}
          selectedAvatarId={selectedAvatarId}
          selectedAvatar={avatar}
          onChange={onAvatarChange}
        />
        <button
          type="button"
          onClick={onEnhancePrompt}
          disabled={isGenerating}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-selected hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Enhance
        </button>
      </div>
    </form>
  );
}

function RatioSelector({
  onChange,
  value,
}: {
  onChange: (ratio: VideoRatio) => void;
  value: VideoRatio;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(() =>
    videoRatios.indexOf(value),
  );
  const controlId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useFloatingMenu(open, wrapperRef, triggerRef, setOpen);

  function openAndFocus(index = videoRatios.indexOf(value)) {
    setOpen(true);
    setFocusedIndex(index);
    window.requestAnimationFrame(() => {
      optionRefs.current[index]?.focus();
    });
  }

  function selectRatio(ratio: VideoRatio) {
    onChange(ratio);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      openAndFocus(videoRatios.indexOf(value));
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const nextIndex = (index + direction + videoRatios.length) % videoRatios.length;
      setFocusedIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        id={controlId}
        role="radiogroup"
        aria-label="Video ratio"
        aria-hidden={!open}
        className={cn(
          "absolute bottom-[calc(100%+6px)] left-0 z-30 flex w-[140px] flex-col gap-1 overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          open
            ? "max-h-44 translate-y-0 opacity-100"
            : "pointer-events-none max-h-0 translate-y-2 opacity-0",
        )}
      >
        {videoRatios.map((ratio, index) => {
          const selected = ratio === value;

          return (
            <button
              key={ratio}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={open && index === focusedIndex ? 0 : -1}
              onClick={() => selectRatio(ratio)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              className={cn(
                "inline-flex h-8 w-full items-center gap-2 rounded-[var(--radius-control)] border px-2.5 text-sm font-medium shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                selected
                  ? "border-primary/40 bg-brand-soft text-primary"
                  : "border-border bg-card text-foreground hover:border-border-strong hover:bg-card-muted",
              )}
            >
              <RatioGlyph active={selected} ratio={ratio} />
              <span>{ratio}</span>
              <span className="text-xs text-muted">{instagramVideoFormatLabels[ratio]}</span>
            </button>
          );
        })}
      </div>

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={controlId}
        aria-haspopup="menu"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <RatioGlyph ratio={value} />
        <span>{value} {instagramVideoFormatLabels[value]}</span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-subtle transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

function VideoCountSelector({
  onChange,
  value,
}: {
  onChange: (count: VideoCount) => void;
  value: VideoCount;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(() =>
    videoCountOptions.indexOf(value),
  );
  const controlId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useFloatingMenu(open, wrapperRef, triggerRef, setOpen);

  function openAndFocus(index = videoCountOptions.indexOf(value)) {
    setOpen(true);
    setFocusedIndex(index);
    window.requestAnimationFrame(() => {
      optionRefs.current[index]?.focus();
    });
  }

  function selectCount(count: VideoCount) {
    onChange(count);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      openAndFocus(videoCountOptions.indexOf(value));
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const nextIndex =
        (index + direction + videoCountOptions.length) % videoCountOptions.length;
      setFocusedIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        id={controlId}
        role="listbox"
        aria-label="Number of videos"
        aria-hidden={!open}
        className={cn(
          "absolute bottom-[calc(100%+6px)] left-0 z-30 flex w-[120px] flex-col gap-1 overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          open
            ? "max-h-32 translate-y-0 opacity-100"
            : "pointer-events-none max-h-0 translate-y-2 opacity-0",
        )}
      >
        {videoCountOptions.map((count, index) => {
          const selected = count === value;

          return (
            <button
              key={count}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={open && index === focusedIndex ? 0 : -1}
              onClick={() => selectCount(count)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              className={cn(
                "inline-flex h-8 w-full items-center gap-2 rounded-[var(--radius-control)] border px-2.5 text-sm font-medium shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                selected
                  ? "border-primary/40 bg-brand-soft text-primary"
                  : "border-border bg-card text-foreground hover:border-border-strong hover:bg-card-muted",
              )}
            >
              <Film className="size-3.5" aria-hidden="true" />
              {count} {count === 1 ? "video" : "videos"}
            </button>
          );
        })}
      </div>

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={controlId}
        aria-haspopup="listbox"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Film className="size-3.5" aria-hidden="true" />
        <span>
          {value} {value === 1 ? "video" : "videos"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-subtle transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

function AvatarPicker({
  avatarErrorMessage,
  avatarLoading,
  globalAvatars,
  onChange,
  personalAvatars,
  selectedAvatar,
  selectedAvatarId,
}: {
  avatarErrorMessage: string | null;
  avatarLoading: boolean;
  globalAvatars: AvatarOption[];
  onChange: (avatarId: string | null) => void;
  personalAvatars: AvatarOption[];
  selectedAvatar: AvatarOption | null;
  selectedAvatarId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const hasOptions = personalAvatars.length > 0 || globalAvatars.length > 0;
  const triggerLabel = avatarLoading
    ? "Loading presenters"
    : selectedAvatar
      ? `Choose presenter, currently ${selectedAvatar.label}`
      : "Choose presenter";

  function selectAvatar(avatarId: string) {
    onChange(avatarId);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="max-w-[190px]"
            aria-label={triggerLabel}
            title={selectedAvatar?.label ?? "Choose presenter"}
          />
        }
      >
        {avatarLoading ? (
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : selectedAvatar ? (
          <Avatar size="sm">
            {selectedAvatar.thumbnailUrl ? (
              <AvatarImage src={selectedAvatar.thumbnailUrl} alt="" />
            ) : null}
            <AvatarFallback>
              {getAvatarFallbackText(selectedAvatar.label)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <UserRound aria-hidden="true" />
        )}
        <span className="truncate">
          {avatarLoading ? "Loading…" : "Presenter"}
        </span>
        <ChevronDown
          data-icon="inline-end"
          className={cn(
            "transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[min(92vw,440px)] gap-0 p-0"
      >
        <PopoverHeader className="border-b border-border p-3">
          <PopoverTitle>Choose a presenter</PopoverTitle>
          <PopoverDescription>
            Select by face so the on-camera style is easy to compare.
          </PopoverDescription>
        </PopoverHeader>

        {avatarLoading ? <AvatarPickerSkeleton /> : null}

        {!avatarLoading && avatarErrorMessage ? (
          <Alert variant="destructive" className="m-3 w-auto">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>
              {hasOptions
                ? "Some presenters unavailable"
                : "Presenters unavailable"}
            </AlertTitle>
            <AlertDescription>{avatarErrorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {!avatarLoading && hasOptions ? (
          <ScrollArea className="h-[min(62vh,430px)]">
            <div className="flex flex-col gap-5 p-3">
              <AvatarGroup
                emptyMessage="No uploaded source videos yet."
                label="Your source videos"
                options={personalAvatars}
                selectedAvatarId={selectedAvatarId}
                onSelect={selectAvatar}
              />
              <AvatarGroup
                emptyMessage="No library presenters are available yet."
                label="Presenter library"
                options={globalAvatars}
                selectedAvatarId={selectedAvatarId}
                onSelect={selectAvatar}
              />
            </div>
          </ScrollArea>
        ) : null}

        {!avatarLoading && !avatarErrorMessage && !hasOptions ? (
          <div className="p-4 text-sm font-medium text-muted">
            No presenters are available yet.
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function AvatarGroup({
  emptyMessage,
  label,
  onSelect,
  options,
  selectedAvatarId,
}: {
  emptyMessage?: string;
  label: string;
  onSelect: (avatarId: string) => void;
  options: AvatarOption[];
  selectedAvatarId: string | null;
}) {
  const groupId = useId();

  return (
    <section aria-labelledby={groupId}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id={groupId} className="text-sm font-semibold text-foreground">
          {label}
        </h3>
        <span className="text-xs font-medium text-muted-subtle tabular-nums">
          {options.length}
        </span>
      </div>
      {options.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {options.map((avatar) => {
            const selected = avatar.id === selectedAvatarId;
            const displayName = getAvatarDisplayName(avatar.label);

            return (
              <button
                key={avatar.id}
                type="button"
                aria-label={`Choose ${avatar.label}`}
                aria-pressed={selected}
                title={avatar.label}
                onClick={() => onSelect(avatar.id)}
                className={cn(
                  "group min-w-0 rounded-lg p-1.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                  selected
                    ? "bg-brand-soft ring-2 ring-primary"
                    : "hover:bg-card-muted",
                )}
              >
                <span className="relative block aspect-[3/4] overflow-hidden rounded-md bg-[#1F1F1F]">
                  <Avatar className="size-full rounded-[inherit] after:rounded-[inherit]">
                    {avatar.thumbnailUrl ? (
                      <AvatarImage
                        src={avatar.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="rounded-[inherit]"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-[inherit] text-base font-semibold">
                      {getAvatarFallbackText(avatar.label)}
                    </AvatarFallback>
                  </Avatar>
                  {selected ? (
                    <span className="absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
                <span className="mt-1.5 block truncate px-0.5 text-xs font-medium text-foreground">
                  {displayName}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-[var(--radius-control)] bg-card-muted px-3 py-2 text-xs font-medium leading-5 text-muted">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

function AvatarPickerSkeleton() {
  return (
    <div className="p-3" role="status" aria-label="Loading presenter library">
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="aspect-[3/4] w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoResultCard({
  onEdit,
  onSelect,
  onUseAsHook,
  selected,
  video,
}: {
  onEdit: () => void;
  onSelect: () => void;
  onUseAsHook: () => void;
  selected: boolean;
  video: GeneratedVideo;
}) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-[var(--radius-card)] border bg-card p-2 shadow-card transition-colors",
        selected ? "border-success/45" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="block w-full overflow-hidden rounded-[var(--radius-control)] bg-card-muted text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        style={{ aspectRatio: video.ratio.replace(":", " / ") }}
      >
        {video.url ? (
          <video
            src={video.url}
            className="size-full object-cover"
            muted
            playsInline
            controls
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <div className="text-center">
              <Video className="mx-auto size-7 text-muted" aria-hidden="true" />
              <p className="mt-2 text-xs font-medium text-muted">
                Video preview
              </p>
            </div>
          </div>
        )}
      </button>

      <div className="mt-3 flex flex-col gap-3 px-1 pb-1">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {video.title}
            </h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[11px] font-medium",
                video.status === "Ready"
                  ? "bg-success/10 text-success"
                  : video.status === "Failed"
                    ? "bg-error/10 text-error"
                    : "bg-card-muted text-muted",
              )}
            >
              {video.status}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
            {video.duration ? (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3" aria-hidden="true" />
                {video.duration}
              </span>
            ) : null}
            {video.createdAt ? <span>{video.createdAt}</span> : null}
            <span>{video.avatarName}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--radius-control)] bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onUseAsHook}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Use hook
          </button>
        </div>
      </div>
    </article>
  );
}

function RatioGlyph({
  active,
  ratio,
}: {
  active?: boolean;
  ratio: VideoRatio;
}) {
  const shapeClassName: Record<VideoRatio, string> = {
    "9:16": "h-5 w-3",
    "1:1": "size-3.5",
    "4:5": "h-4 w-3.5",
    "16:9": "h-3 w-5",
  };

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 rounded-[4px] border-2",
        shapeClassName[ratio],
        active ? "border-primary" : "border-muted",
      )}
    />
  );
}

function useFloatingMenu(
  open: boolean,
  wrapperRef: RefObject<HTMLDivElement | null>,
  triggerRef: RefObject<HTMLButtonElement | null>,
  setOpen: (open: boolean) => void,
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen, triggerRef, wrapperRef]);
}
