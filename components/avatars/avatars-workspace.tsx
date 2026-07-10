"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  RefreshCw,
  Scissors,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

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
  | ApiErrorResponse;

type AvatarActionResponse =
  | {
      avatar: AvatarAsset;
      avatarSelection: AvatarSelection;
      ok: true;
      preference: AvatarPreference;
    }
  | ApiErrorResponse;

type ApiErrorResponse = {
  error?: string;
  ok?: false;
};

type TrimDraft = {
  end: string;
  start: string;
};

export function AvatarsWorkspace() {
  const [avatars, setAvatars] = useState<AvatarLibraryItem[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [trimDraft, setTrimDraft] = useState<TrimDraft>({
    end: "",
    start: "0",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [savingTrim, setSavingTrim] = useState(false);
  const [usingAvatar, setUsingAvatar] = useState(false);
  const selectedAvatarIdRef = useRef<string | null>(null);

  const selectedAvatar = useMemo(() => {
    return avatars.find((avatar) => avatar.asset.id === selectedAvatarId) ?? null;
  }, [avatars, selectedAvatarId]);

  const commitSelectedAvatarId = useCallback((avatarId: string | null) => {
    selectedAvatarIdRef.current = avatarId;
    setSelectedAvatarId(avatarId);
  }, []);

  const loadAvatars = useCallback(async () => {
    setErrorMessage(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        setAvatars([]);
        commitSelectedAvatarId(null);
        setTrimDraft(getAvatarTrimDraft(null));
        setErrorMessage("Sign in before managing avatars.");
        return;
      }

      const response = await fetch("/api/avatars", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as AvatarListResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiErrorMessage(data, "Could not load avatars."));
      }

      setAvatars(data.avatars);
      const currentSelectedAvatarId = selectedAvatarIdRef.current;
      const nextSelectedAvatarId =
        currentSelectedAvatarId &&
        data.avatars.some((avatar) => avatar.asset.id === currentSelectedAvatarId)
          ? currentSelectedAvatarId
          : data.avatars[0]?.asset.id ?? null;

      commitSelectedAvatarId(nextSelectedAvatarId);
      setTrimDraft(
        getAvatarTrimDraft(
          data.avatars.find(
            (avatar) => avatar.asset.id === nextSelectedAvatarId,
          ) ?? null,
        ),
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not load avatars."));
    } finally {
      setIsLoading(false);
    }
  }, [commitSelectedAvatarId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAvatars();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAvatars]);

  async function handleSaveTrim() {
    if (!selectedAvatar || savingTrim) {
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);

    const trimStart = Number(trimDraft.start);
    const trimEnd = Number(trimDraft.end);

    if (!Number.isFinite(trimStart) || !Number.isFinite(trimEnd)) {
      setErrorMessage("Trim start and trim end are required.");
      return;
    }

    if (trimEnd <= trimStart) {
      setErrorMessage("Trim end must be after trim start.");
      return;
    }

    setSavingTrim(true);

    try {
      const data = await patchAvatarPreference({
        avatarId: selectedAvatar.asset.id,
        body: {
          isTrimmed: true,
          trimEnd,
          trimStart,
        },
      });

      updateAvatar(data);
      setNoticeMessage("Avatar trim saved.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not save avatar trim."));
    } finally {
      setSavingTrim(false);
    }
  }

  async function handleResetTrim() {
    if (!selectedAvatar || savingTrim) {
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    setSavingTrim(true);

    try {
      const data = await patchAvatarPreference({
        avatarId: selectedAvatar.asset.id,
        body: {
          isTrimmed: false,
        },
      });

      updateAvatar(data);
      setNoticeMessage("Avatar trim reset.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not reset avatar trim."));
    } finally {
      setSavingTrim(false);
    }
  }

  async function handleUseAvatar() {
    if (!selectedAvatar || usingAvatar) {
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    setUsingAvatar(true);

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/api/avatars/${encodeURIComponent(selectedAvatar.asset.id)}/use`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          method: "POST",
        },
      );
      const data = (await response.json()) as AvatarActionResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiErrorMessage(data, "Could not use avatar."));
      }

      updateAvatar(data);
      setNoticeMessage("Avatar selected for generation.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not use avatar."));
    } finally {
      setUsingAvatar(false);
    }
  }

  function updateAvatar(data: Extract<AvatarActionResponse, { ok: true }>) {
    const updatedAvatar = {
      asset: data.avatar,
      avatarSelection: data.avatarSelection,
      preference: data.preference,
    };

    setAvatars((currentAvatars) =>
      currentAvatars.map((avatar) =>
        avatar.asset.id === data.avatar.id ? updatedAvatar : avatar,
      ),
    );

    if (selectedAvatarIdRef.current === data.avatar.id) {
      setTrimDraft(getAvatarTrimDraft(updatedAvatar));
    }
  }

  function handleSelectAvatar(avatarId: string) {
    commitSelectedAvatarId(avatarId);
    setTrimDraft(
      getAvatarTrimDraft(
        avatars.find((avatar) => avatar.asset.id === avatarId) ?? null,
      ),
    );
  }

  return (
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Avatars
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Choose and trim reusable avatar videos for UGC creation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-8 w-fit items-center gap-2 rounded-full border border-border/80 bg-white/70 px-3 text-xs font-semibold text-[#405977] shadow-sm">
            <span className="size-2 rounded-full bg-success" />
            Library ready
          </div>
          <button
            type="button"
            onClick={() => void loadAvatars()}
            disabled={isLoading}
            aria-label="Refresh avatars"
            title="Refresh avatars"
            className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-white/80 text-[#173454] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={cn("size-4", isLoading && "animate-spin")}
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-5 pt-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <AvatarLibrary
          avatars={avatars}
          isLoading={isLoading}
          selectedAvatarId={selectedAvatarId}
          onSelectAvatar={handleSelectAvatar}
        />

        <AvatarDetailPanel
          avatar={selectedAvatar}
          errorMessage={errorMessage}
          noticeMessage={noticeMessage}
          savingTrim={savingTrim}
          trimDraft={trimDraft}
          usingAvatar={usingAvatar}
          onResetTrim={() => void handleResetTrim()}
          onSaveTrim={() => void handleSaveTrim()}
          onTrimDraftChange={setTrimDraft}
          onUseAvatar={() => void handleUseAvatar()}
        />
      </div>
    </section>
  );
}

function AvatarLibrary({
  avatars,
  isLoading,
  onSelectAvatar,
  selectedAvatarId,
}: {
  avatars: AvatarLibraryItem[];
  isLoading: boolean;
  onSelectAvatar: (avatarId: string) => void;
  selectedAvatarId: string | null;
}) {
  return (
    <div className="flex min-h-[360px] flex-col overflow-hidden rounded-[28px] border border-border/70 bg-white/40 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Avatar library</h2>
          <p className="mt-1 text-xs font-semibold text-muted">
            Global avatar videos available to this workspace.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted shadow-sm">
          {isLoading
            ? "Loading"
            : `${avatars.length} ${avatars.length === 1 ? "avatar" : "avatars"}`}
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center rounded-3xl border border-border/70 bg-white/45">
          <div className="flex items-center gap-3 text-sm font-semibold text-muted">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            Loading avatars...
          </div>
        </div>
      ) : avatars.length > 0 ? (
        <div className="grid auto-rows-min grid-cols-1 gap-4 overflow-y-auto pb-1 sm:grid-cols-2 xl:grid-cols-3">
          {avatars.map((avatar) => (
            <AvatarCard
              key={avatar.asset.id}
              avatar={avatar}
              selected={avatar.asset.id === selectedAvatarId}
              onSelect={() => onSelectAvatar(avatar.asset.id)}
            />
          ))}
        </div>
      ) : (
        <AvatarEmptyState />
      )}
    </div>
  );
}

function AvatarEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-3xl border border-border/70 bg-white/45 px-6 py-12 text-center">
      <div className="max-w-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#173454] text-white shadow-sm">
          <UserRound className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-base font-bold text-foreground">
          No avatar videos yet.
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-muted">
          Once global avatar videos are added to the avatar library, they will
          appear here for preview, trimming, and selection.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-bold text-[#405977] shadow-sm">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Ready for real avatar assets
        </div>
      </div>
    </div>
  );
}

function AvatarCard({
  avatar,
  onSelect,
  selected,
}: {
  avatar: AvatarLibraryItem;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group min-w-0 rounded-2xl border bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgb(16_32_51_/_0.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected ? "border-primary/60 ring-2 ring-primary/15" : "border-border",
      )}
    >
      <div className="relative overflow-hidden rounded-xl bg-[#102033] text-white">
        <div
          className="flex items-center justify-center"
          style={{ aspectRatio: getPreviewAspectRatio(avatar.asset.ratio) }}
        >
          {avatar.asset.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar.asset.thumbnailUrl}
              alt=""
              className="size-full object-cover"
              decoding="async"
              loading="lazy"
            />
          ) : (
            <video
              src={avatar.asset.sourceVideoUrl}
              className="size-full object-cover"
              muted
              playsInline
              preload="none"
            />
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-black/60 to-transparent p-3">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/16 backdrop-blur">
            <Play className="ml-0.5 size-3.5 fill-white text-white" aria-hidden="true" />
          </span>
          {avatar.avatarSelection.isTrimmed ? (
            <span className="rounded-full bg-primary px-2 py-1 text-[11px] font-bold text-white shadow-sm">
              Trimmed
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-2 px-1 pb-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-foreground">
            {avatar.asset.name}
          </h3>
          {selected ? (
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3" aria-hidden="true" />
            {formatDuration(avatar.asset.durationSeconds)}
          </span>
          <span>
            {avatar.asset.ratio === "other"
              ? getDimensionsLabel(avatar.asset)
              : avatar.asset.ratio}
          </span>
        </div>
      </div>
    </button>
  );
}

function AvatarDetailPanel({
  avatar,
  errorMessage,
  noticeMessage,
  onResetTrim,
  onSaveTrim,
  onTrimDraftChange,
  onUseAvatar,
  savingTrim,
  trimDraft,
  usingAvatar,
}: {
  avatar: AvatarLibraryItem | null;
  errorMessage: string | null;
  noticeMessage: string | null;
  onResetTrim: () => void;
  onSaveTrim: () => void;
  onTrimDraftChange: (draft: TrimDraft) => void;
  onUseAvatar: () => void;
  savingTrim: boolean;
  trimDraft: TrimDraft;
  usingAvatar: boolean;
}) {
  const [measuredVideoRatio, setMeasuredVideoRatio] = useState<{
    avatarId: string;
    ratio: number;
  } | null>(null);
  const [loadingPreviewAvatarId, setLoadingPreviewAvatarId] = useState<
    string | null
  >(null);
  const fallbackVideoRatio = getNumericPreviewAspectRatio(
    avatar?.asset.ratio ?? "9:16",
  );
  const previewVideoRatio =
    avatar && measuredVideoRatio?.avatarId === avatar.asset.id
      ? measuredVideoRatio.ratio
      : fallbackVideoRatio;
  const previewWidth =
    previewVideoRatio < 1
      ? `min(100%, ${Math.round(520 * previewVideoRatio)}px, calc(52vh * ${previewVideoRatio}))`
      : "100%";

  return (
    <aside className="flex min-h-[360px] flex-col overflow-y-auto rounded-[28px] border border-border/70 bg-white/72 p-4 shadow-[0_18px_50px_rgb(16_32_51_/_0.08)] backdrop-blur sm:p-5 lg:min-h-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Preview and trim</h2>
          <p className="mt-1 text-xs font-semibold text-muted">
            Save the usable segment before generation.
          </p>
        </div>
        <Scissors className="size-4 text-primary" aria-hidden="true" />
      </div>

      {avatar ? (
        <>
          <div className="flex w-full justify-center">
            <div
              className="relative flex max-h-[520px] items-center justify-center overflow-hidden rounded-2xl bg-[#102033] text-white shadow-sm"
              style={{
                aspectRatio: previewVideoRatio,
                width: previewWidth,
              }}
            >
              <video
                key={avatar.asset.id}
                src={avatar.asset.sourceVideoUrl}
                poster={avatar.asset.thumbnailUrl ?? undefined}
                className="block size-full object-contain object-center"
                controls
                playsInline
                preload="auto"
                onCanPlay={() => {
                  setLoadingPreviewAvatarId((currentAvatarId) =>
                    currentAvatarId === avatar.asset.id ? null : currentAvatarId,
                  );
                }}
                onError={() => {
                  setLoadingPreviewAvatarId((currentAvatarId) =>
                    currentAvatarId === avatar.asset.id ? null : currentAvatarId,
                  );
                }}
                onLoadStart={() => {
                  setLoadingPreviewAvatarId(avatar.asset.id);
                }}
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;

                  if (video.videoWidth > 0 && video.videoHeight > 0) {
                    setMeasuredVideoRatio({
                      avatarId: avatar.asset.id,
                      ratio: video.videoWidth / video.videoHeight,
                    });
                  }
                }}
              />
              {loadingPreviewAvatarId === avatar.asset.id ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#102033]/45 backdrop-blur-[1px]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white">
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    Loading preview
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-base font-bold tracking-normal text-foreground">
              {avatar.asset.name}
            </h3>
            {avatar.asset.description ? (
              <p className="mt-1 text-sm font-medium leading-6 text-muted">
                {avatar.asset.description}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-muted">
              <span className="rounded-full border border-border bg-white px-2.5 py-1">
                {formatDuration(avatar.asset.durationSeconds)}
              </span>
              <span className="rounded-full border border-border bg-white px-2.5 py-1">
                {avatar.asset.ratio === "other"
                  ? getDimensionsLabel(avatar.asset)
                  : avatar.asset.ratio}
              </span>
              <span className="rounded-full border border-border bg-white px-2.5 py-1 capitalize">
                {avatar.asset.avatarType}
              </span>
            </div>
          </div>

          <TrimControls
            avatar={avatar}
            savingTrim={savingTrim}
            trimDraft={trimDraft}
            onResetTrim={onResetTrim}
            onSaveTrim={onSaveTrim}
            onTrimDraftChange={onTrimDraftChange}
          />

          <button
            type="button"
            onClick={onUseAvatar}
            disabled={usingAvatar}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.22)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {usingAvatar ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Selecting
              </>
            ) : (
              <>
                <UserRound className="size-4" aria-hidden="true" />
                Use avatar
              </>
            )}
          </button>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-border bg-[#fffaf6] px-6 py-10 text-center">
          <div>
            <Video className="mx-auto size-8 text-[#9aa7b8]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-[#405977]">
              Select an avatar to preview it.
            </p>
            <p className="mt-1 text-sm font-medium text-muted">
              The preview panel will activate when avatar assets are available.
            </p>
          </div>
        </div>
      )}

      <StatusMessages errorMessage={errorMessage} noticeMessage={noticeMessage} />
    </aside>
  );
}

function TrimControls({
  avatar,
  onResetTrim,
  onSaveTrim,
  onTrimDraftChange,
  savingTrim,
  trimDraft,
}: {
  avatar: AvatarLibraryItem;
  onResetTrim: () => void;
  onSaveTrim: () => void;
  onTrimDraftChange: (draft: TrimDraft) => void;
  savingTrim: boolean;
  trimDraft: TrimDraft;
}) {
  const trimStart = Number(trimDraft.start);
  const trimEnd = Number(trimDraft.end);
  const duration = avatar.asset.durationSeconds;
  const hasValidDraft =
    Number.isFinite(trimStart) &&
    Number.isFinite(trimEnd) &&
    trimStart >= 0 &&
    trimEnd > trimStart &&
    (duration === null || trimEnd <= duration);

  return (
    <div className="mt-5 rounded-2xl border border-border bg-[#fffaf6] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Trim window</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">
            {avatar.avatarSelection.isTrimmed ? "Saved custom trim" : "Full clip"}
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#405977] shadow-sm">
          {hasValidDraft
            ? `${formatSeconds(trimEnd - trimStart)} selected`
            : "Set trim"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold text-muted">Start</span>
          <input
            type="number"
            min={0}
            max={duration ?? undefined}
            step="0.1"
            value={trimDraft.start}
            onChange={(event) =>
              onTrimDraftChange({
                ...trimDraft,
                start: event.target.value,
              })
            }
            className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-bold text-foreground outline-none transition focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-muted">End</span>
          <input
            type="number"
            min={0}
            max={duration ?? undefined}
            step="0.1"
            value={trimDraft.end}
            onChange={(event) =>
              onTrimDraftChange({
                ...trimDraft,
                end: event.target.value,
              })
            }
            className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-bold text-foreground outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <TrimRangePreview
        duration={duration}
        trimEnd={Number.isFinite(trimEnd) ? trimEnd : null}
        trimStart={Number.isFinite(trimStart) ? trimStart : null}
      />

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onResetTrim}
          disabled={savingTrim || !avatar.avatarSelection.isTrimmed}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-border bg-white px-3 text-xs font-bold text-[#173454] transition hover:bg-[#fff8f4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSaveTrim}
          disabled={savingTrim || !hasValidDraft}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-[#173454] px-3 text-xs font-bold text-white transition hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingTrim ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          Save trim
        </button>
      </div>
    </div>
  );
}

function TrimRangePreview({
  duration,
  trimEnd,
  trimStart,
}: {
  duration: number | null;
  trimEnd: number | null;
  trimStart: number | null;
}) {
  const startPercent =
    duration && trimStart !== null ? Math.min(100, (trimStart / duration) * 100) : 0;
  const endPercent =
    duration && trimEnd !== null ? Math.min(100, (trimEnd / duration) * 100) : 100;
  const widthPercent = Math.max(4, endPercent - startPercent);

  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-[#e9edf1]">
        <div
          className="h-full rounded-full bg-primary"
          style={{
            marginLeft: `${Math.max(0, startPercent)}%`,
            width: `${widthPercent}%`,
          }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-muted">
        <span>{formatSeconds(trimStart ?? 0)}</span>
        <span>{duration ? formatSeconds(duration) : "Duration pending"}</span>
      </div>
    </div>
  );
}

function StatusMessages({
  errorMessage,
  noticeMessage,
}: {
  errorMessage: string | null;
  noticeMessage: string | null;
}) {
  if (!errorMessage && !noticeMessage) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-2xl border border-error/20 bg-error/5 px-3 py-2 text-sm font-semibold text-error"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        </div>
      ) : null}
      {noticeMessage ? (
        <div className="rounded-2xl border border-success/20 bg-success/5 px-3 py-2 text-sm font-semibold text-[#087443]">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{noticeMessage}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function patchAvatarPreference({
  avatarId,
  body,
}: {
  avatarId: string;
  body: {
    isTrimmed: boolean;
    trimEnd?: number;
    trimStart?: number;
  };
}) {
  const token = await getAuthToken();
  const response = await fetch(
    `/api/avatars/${encodeURIComponent(avatarId)}/preference`,
    {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "PATCH",
    },
  );
  const data = (await response.json()) as AvatarActionResponse;

  if (!response.ok || data.ok !== true) {
    throw new Error(getApiErrorMessage(data, "Could not save avatar preference."));
  }

  return data;
}

async function getAuthToken() {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before managing avatars.");
  }

  return token;
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

function getAvatarTrimDraft(avatar: AvatarLibraryItem | null): TrimDraft {
  if (!avatar) {
    return {
      end: "",
      start: "0",
    };
  }

  return {
    end:
      avatar.avatarSelection.trimEnd !== null
        ? formatTrimInput(avatar.avatarSelection.trimEnd)
        : avatar.asset.durationSeconds !== null
          ? formatTrimInput(avatar.asset.durationSeconds)
          : "",
    start: formatTrimInput(avatar.avatarSelection.trimStart),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "Pending";
  }

  return formatSeconds(seconds);
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.round(seconds % 60));

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatTrimInput(seconds: number) {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

function getPreviewAspectRatio(ratio: AvatarRatio) {
  return ratio === "other" ? "9 / 16" : ratio.replace(":", " / ");
}

function getNumericPreviewAspectRatio(ratio: AvatarRatio) {
  const ratios: Record<AvatarRatio, number> = {
    "1:1": 1,
    "4:5": 4 / 5,
    "9:16": 9 / 16,
    "16:9": 16 / 9,
    other: 9 / 16,
  };

  return ratios[ratio];
}

function getDimensionsLabel(asset: AvatarAsset) {
  return asset.width && asset.height ? `${asset.width}x${asset.height}` : "Custom";
}
