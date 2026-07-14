"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Film,
  Lock,
  Loader2,
  Plus,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";
import { cn } from "@/lib/utils";

type VideoRatio = "9:16" | "1:1" | "4:5" | "16:9";
type VideoCount = 1 | 2 | 4;
type GenerationState = "empty" | "generating" | "completed" | "failed";
type AvatarSource = "my" | "global";

type AvatarOption = {
  durationSeconds: number | null;
  id: string;
  label: string;
  previewUrl: string | null;
  selection: AvatarSelection;
  source: AvatarSource;
  subtitle: string;
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

export function VideoGenerationWorkspace() {
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
  const selectedAvatar =
    avatarOptions.find((avatar) => avatar.id === selectedAvatarId) ??
    avatarOptions[0] ??
    null;
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
        setAvatarErrorMessage("Sign in before choosing influencers.");
        return;
      }

      setAvatarLoading(true);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in before choosing influencers.");
        }

        const [response, personalResponse] = await Promise.all([
          fetch("/api/avatars", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/media?collection=influencer", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const data = (await response.json()) as AvatarListResponse;
        const personalData = (await personalResponse.json()) as
          | { assets: MediaAsset[]; ok: true }
          | { error?: string; ok?: false };

        if (!response.ok || data.ok !== true) {
          throw new Error(getApiErrorMessage(data, "Could not load influencers."));
        }

        if (!personalResponse.ok || personalData.ok !== true) {
          throw new Error(getApiErrorMessage(personalData, "Could not load your influencers."));
        }

        if (ignore) {
          return;
        }

        setAvatarLibrary(data.avatars);
        setPersonalAvatarAssets(personalData.assets);
        setSelectedAvatarId((currentAvatarId) =>
          currentAvatarId &&
          (data.avatars.some((avatar) => avatar.asset.id === currentAvatarId) ||
            personalData.assets.some((asset) => asset.id === currentAvatarId))
            ? currentAvatarId
            : personalData.assets[0]?.id ?? data.avatars[0]?.asset.id ?? null,
        );
      } catch (error) {
        if (!ignore) {
          setAvatarLibrary([]);
          setPersonalAvatarAssets([]);
          setSelectedAvatarId(null);
          setAvatarErrorMessage(
            getErrorMessage(error, "Could not load influencers."),
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
          ? "Influencer library is still loading."
          : "Choose an influencer before generating.",
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
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Video generation
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Create influencer-led hooks and short-form ad videos.
          </p>
        </div>

        <div className="inline-flex h-8 w-fit items-center gap-2 rounded-full border border-border/80 bg-white/70 px-3 text-xs font-semibold text-[#405977] shadow-sm">
          <span className="size-2 rounded-full bg-success" />
          Ready
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 pt-5">
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
    </section>
  );
}

function mapAvatarLibraryItemToOption(avatar: AvatarLibraryItem): AvatarOption {
  return {
    durationSeconds: avatar.asset.durationSeconds,
    id: avatar.asset.id,
    label: avatar.asset.name,
    previewUrl: avatar.asset.thumbnailUrl ?? avatar.asset.sourceVideoUrl,
    selection: avatar.avatarSelection,
    source: "global",
    subtitle: getAvatarSubtitle(avatar),
  };
}

function mapPersonalMediaToAvatarOption(asset: MediaAsset): AvatarOption {
  return {
    durationSeconds: asset.durationSeconds,
    id: asset.id,
    label: asset.title,
    previewUrl: asset.thumbnailUrl ?? asset.url,
    selection: {
      avatarAssetId: asset.id,
      isTrimmed: false,
      sourceVideoUrl: asset.url,
      trimEnd: asset.durationSeconds,
      trimStart: 0,
    },
    source: "my",
    subtitle: `${formatDuration(asset.durationSeconds)} - ${
      asset.width && asset.height ? `${asset.width}x${asset.height}` : asset.ratio
    } - Your upload`,
  };
}

function getAvatarSubtitle(avatar: AvatarLibraryItem) {
  const duration = formatDuration(avatar.asset.durationSeconds);
  const dimensions =
    avatar.asset.width && avatar.asset.height
      ? `${avatar.asset.width}x${avatar.asset.height}`
      : avatar.asset.ratio;

  return avatar.avatarSelection.isTrimmed
    ? `${duration} - ${dimensions} - Trimmed`
    : `${duration} - ${dimensions}`;
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

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "Duration pending";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.round(seconds % 60));

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
    <div className="relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-white/35 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground">Generated videos</h2>
        {generatedVideos.length > 0 ? (
          <span className="text-xs font-semibold text-muted">
            {generatedVideos.length} total
          </span>
        ) : null}
      </div>

      {generationState === "failed" ? (
        <div
          role="alert"
          className="mt-3 w-fit rounded-full border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold text-error"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-3.5" aria-hidden="true" />
            Video generation failed. Please try again.
          </div>
        </div>
      ) : null}

      {generationState === "generating" ? (
        <div
          role="status"
          className="mt-3 w-fit rounded-full border border-border bg-white/85 px-3 py-2 text-xs font-semibold text-foreground shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            Creating your video...
          </div>
        </div>
      ) : null}

      {actionNotice ? (
        <div className="mt-3 w-fit rounded-full border border-border bg-white/85 px-3 py-2 text-xs font-semibold text-[#405977] shadow-sm">
          {actionNotice}
        </div>
      ) : null}

      {generatedVideos.length > 0 ? (
        <div className="mt-4 grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto pb-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-center">
          <div>
            <Video className="mx-auto size-7 text-[#9aa7b8]" />
            <p className="mt-3 text-sm font-semibold text-[#405977]">
              Generated videos will appear here.
            </p>
            <p className="mt-1 text-sm font-medium text-muted">
              Start by describing the video you want to create.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoPromptBar({
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

    textarea.style.height = "44px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  }, [prompt]);

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="rounded-[24px] border border-border/80 bg-white/95 p-3 shadow-[0_16px_50px_rgb(16_32_51_/_0.10)] backdrop-blur sm:p-4"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Attach video reference"
          title="Attach video reference"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-[#173454] transition hover:bg-[#fff8f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={onTextareaKeyDown}
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm font-medium leading-6 text-foreground outline-none placeholder:text-[#8c9aab]"
          placeholder="Describe the video you want to create..."
        />

        <button
          type="submit"
          disabled={VIDEO_GENERATION_LOCKED || !prompt.trim() || isGenerating || !avatar}
          title={VIDEO_GENERATION_LOCKED ? "Video generation is locked" : undefined}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.22)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[118px]"
        >
          {VIDEO_GENERATION_LOCKED ? (
            <>
              <span className="hidden sm:inline">Locked</span>
              <Lock className="size-4" aria-hidden="true" />
            </>
          ) : isGenerating ? (
            <>
              <span className="hidden sm:inline">Generating</span>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            </>
          ) : (
            <>
              Generate
              <Sparkles className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
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
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-[#173454] transition hover:bg-[#fff8f4] disabled:cursor-not-allowed disabled:opacity-50"
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
        className={cn(
          "absolute bottom-[calc(100%+6px)] left-0 z-30 flex w-[96px] flex-col gap-1 overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out",
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
                "inline-flex h-8 w-fit min-w-[68px] items-center gap-2 rounded-xl border px-2.5 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                selected
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-white text-[#173454] hover:bg-[#faf7f2]",
              )}
            >
              <RatioGlyph active={selected} ratio={ratio} />
              {ratio}
            </button>
          );
        })}
      </div>

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={controlId}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-[#173454] transition hover:bg-[#fff8f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <RatioGlyph ratio={value} />
        <span>{value}</span>
        <ChevronDown
          className={cn(
            "size-4 text-[#405977] transition-transform duration-200",
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
        className={cn(
          "absolute bottom-[calc(100%+6px)] left-0 z-30 flex w-[118px] flex-col gap-1 overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out",
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
                "inline-flex h-8 w-fit min-w-[92px] items-center gap-2 rounded-xl border px-2.5 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                selected
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-white text-[#173454] hover:bg-[#faf7f2]",
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
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-[#173454] transition hover:bg-[#fff8f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Film className="size-3.5" aria-hidden="true" />
        <span>
          {value} {value === 1 ? "video" : "videos"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-[#405977] transition-transform duration-200",
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
  const controlId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useFloatingMenu(open, wrapperRef, triggerRef, setOpen);

  function selectAvatar(avatarId: string) {
    onChange(avatarId);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        id={controlId}
        className={cn(
          "absolute bottom-[calc(100%+6px)] left-0 z-30 w-[min(82vw,360px)] overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_48px_rgb(16_32_51_/_0.16)] transition-[max-height,opacity,transform] duration-200 ease-out",
          open
            ? "max-h-[420px] translate-y-0 opacity-100"
            : "pointer-events-none max-h-0 translate-y-2 opacity-0",
        )}
      >
        <div className="max-h-[420px] overflow-y-auto p-2">
          {avatarLoading ? (
            <div className="flex items-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold text-muted">
              <Loader2 className="size-4 animate-spin text-primary" />
              Loading influencer library...
            </div>
          ) : avatarErrorMessage ? (
            <div className="rounded-xl border border-error/20 bg-error/5 px-3 py-2 text-sm font-semibold text-error">
              {avatarErrorMessage}
            </div>
          ) : (
            <>
              <AvatarGroup
                emptyMessage="No personal influencers yet. Choose a global influencer to start."
                label="My influencers"
                options={personalAvatars}
                selectedAvatarId={selectedAvatarId}
                onSelect={selectAvatar}
              />
              <div className="mt-2 border-t border-border pt-2">
                <AvatarGroup
                  emptyMessage="No global influencer videos are ready yet."
                  label={`Global influencers (${globalAvatars.length})`}
                  options={globalAvatars}
                  selectedAvatarId={selectedAvatarId}
                  onSelect={selectAvatar}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <button
        ref={triggerRef}
        type="button"
          aria-expanded={open}
          aria-controls={controlId}
          onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="inline-flex h-9 max-w-[210px] items-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-[#173454] transition hover:bg-[#fff8f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {avatarLoading
            ? "Loading influencers"
            : selectedAvatar?.label ?? "Choose influencer"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[#405977] transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
    </div>
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
  return (
    <div>
      <p className="px-2 py-1 text-xs font-bold uppercase tracking-normal text-muted">
        {label}
      </p>
      {options.length > 0 ? (
        <div className="grid gap-1">
          {options.map((avatar) => {
            const selected = avatar.id === selectedAvatarId;

            return (
              <button
                key={avatar.id}
                type="button"
                onClick={() => onSelect(avatar.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition",
                  selected ? "bg-primary/10 text-primary" : "hover:bg-[#fff8f4]",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                    selected
                      ? "border-primary/30 bg-white text-primary"
                      : "border-border bg-[#fbf8f4] text-[#173454]",
                  )}
                >
                  {avatar.label.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {avatar.label}
                  </span>
                  <span className="block truncate text-xs font-medium text-muted">
                    {avatar.subtitle}
                  </span>
                </span>
                {selected ? (
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="px-2 py-2 text-xs font-semibold leading-5 text-muted">
          {emptyMessage}
        </p>
      )}
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
        "min-w-0 rounded-2xl border bg-white p-2 shadow-sm transition",
        selected ? "border-success/40" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full overflow-hidden rounded-xl bg-[#102033] text-left text-white"
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
              <Video className="mx-auto size-7 text-white/70" />
              <p className="mt-2 text-xs font-semibold text-white/70">
                Video preview
              </p>
            </div>
          </div>
        )}
      </button>

      <div className="mt-3 space-y-3 px-1 pb-1">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-bold text-foreground">
              {video.title}
            </h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[11px] font-bold",
                video.status === "Ready"
                  ? "bg-success/10 text-[#087443]"
                  : video.status === "Failed"
                    ? "bg-error/10 text-error"
                    : "bg-card-muted text-muted",
              )}
            >
              {video.status}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
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
            className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-[#173454] px-3 text-xs font-bold text-white transition hover:bg-foreground"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onUseAsHook}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-full border border-border bg-white px-3 text-xs font-bold text-[#173454] transition hover:bg-[#fff8f4]"
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
        active ? "border-primary" : "border-[#173454]",
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
