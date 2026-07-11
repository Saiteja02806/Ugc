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
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [trimDraft, setTrimDraft] = useState<TrimDraft>({
    end: "",
    start: "0",
  });
  const [thumbnailFailures, setThumbnailFailures] = useState<
    Record<string, true>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [savingTrim, setSavingTrim] = useState(false);
  const [usingAvatar, setUsingAvatar] = useState(false);
  const selectedAvatarIdRef = useRef<string | null>(null);

  const selectedAvatar = useMemo(() => {
    return avatars.find((avatar) => avatar.asset.id === selectedAvatarId) ?? null;
  }, [avatars, selectedAvatarId]);
  const missingThumbnailCount = useMemo(() => {
    return avatars.filter((avatar) => !avatar.asset.thumbnailUrl).length;
  }, [avatars]);
  const thumbnailFailureCount = useMemo(() => {
    return Object.keys(thumbnailFailures).filter((avatarId) =>
      avatars.some((avatar) => avatar.asset.id === avatarId),
    ).length;
  }, [avatars, thumbnailFailures]);
  const hasUnsavedTrimChanges = useMemo(() => {
    return selectedAvatar
      ? !isSameTrimDraft(trimDraft, getAvatarTrimDraft(selectedAvatar))
      : false;
  }, [selectedAvatar, trimDraft]);

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
      setThumbnailFailures({});
      logAvatarLibraryDiagnostics(data.avatars);

      const currentSelectedAvatarId = selectedAvatarIdRef.current;
      const nextSelectedAvatarId =
        currentSelectedAvatarId &&
        data.avatars.some((avatar) => avatar.asset.id === currentSelectedAvatarId)
          ? currentSelectedAvatarId
          : null;

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
    if (
      isPreviewOpen &&
      selectedAvatarId !== avatarId &&
      hasUnsavedTrimChanges &&
      !window.confirm("Discard unsaved trim changes?")
    ) {
      return;
    }

    commitSelectedAvatarId(avatarId);
    setTrimDraft(
      getAvatarTrimDraft(
        avatars.find((avatar) => avatar.asset.id === avatarId) ?? null,
      ),
    );
    setErrorMessage(null);
    setNoticeMessage(null);
    setIsPreviewOpen(true);
  }

  function handleRequestClosePreview() {
    if (
      hasUnsavedTrimChanges &&
      !window.confirm("Discard unsaved trim changes?")
    ) {
      return;
    }

    if (selectedAvatar) {
      setTrimDraft(getAvatarTrimDraft(selectedAvatar));
    }

    setIsPreviewOpen(false);
  }

  const handleThumbnailError = useCallback(
    (avatarId: string, thumbnailUrl: string) => {
      setThumbnailFailures((currentFailures) => {
        if (currentFailures[avatarId]) {
          return currentFailures;
        }

        return {
          ...currentFailures,
          [avatarId]: true,
        };
      });

      console.warn("[avatar-thumbnail] failed", {
        avatarId,
        hostname: getSafeUrlHostname(thumbnailUrl),
      });
    },
    [],
  );

  const libraryStatus = getLibraryStatus({
    avatarCount: avatars.length,
    isLoading,
    missingThumbnailCount,
    thumbnailFailureCount,
  });

  const previewHealthLabel = getPreviewHealthLabel({
    avatarCount: avatars.length,
    isLoading,
    missingThumbnailCount,
    thumbnailFailureCount,
  });

  const shouldShowPageStatus = !isPreviewOpen && Boolean(errorMessage || noticeMessage);

  const thumbnailIssueCount = missingThumbnailCount + thumbnailFailureCount;

  const selectedAvatarThumbnailFailed =
    selectedAvatarId !== null && thumbnailFailures[selectedAvatarId] === true;

  const selectedAvatarForModal =
    isPreviewOpen && selectedAvatar ? selectedAvatar : null;

  const selectedAvatarHasThumbnailIssue =
    selectedAvatarForModal !== null &&
    (!selectedAvatarForModal.asset.thumbnailUrl || selectedAvatarThumbnailFailed);

  const selectedAvatarIssueLabel = selectedAvatarHasThumbnailIssue
    ? !selectedAvatarForModal?.asset.thumbnailUrl
      ? "Thumbnail missing"
      : "Thumbnail failed"
    : null;

  const pageStatus = shouldShowPageStatus ? (
    <div className="mx-auto mt-4 w-full max-w-7xl">
      <StatusMessages errorMessage={errorMessage} noticeMessage={noticeMessage} />
    </div>
  ) : null;

  const previewModal = selectedAvatarForModal ? (
    <AvatarPreviewModal
      avatar={selectedAvatarForModal}
      errorMessage={errorMessage}
      hasUnsavedTrimChanges={hasUnsavedTrimChanges}
      noticeMessage={noticeMessage}
      savingTrim={savingTrim}
      thumbnailIssueLabel={selectedAvatarIssueLabel}
      trimDraft={trimDraft}
      usingAvatar={usingAvatar}
      onClose={handleRequestClosePreview}
      onResetTrim={() => void handleResetTrim()}
      onSaveTrim={() => void handleSaveTrim()}
      onTrimDraftChange={setTrimDraft}
      onUseAvatar={() => void handleUseAvatar()}
    />
  ) : null;

  const refreshDisabled = isLoading;

  const refreshIconClassName = cn("size-4", isLoading && "animate-spin");

  const libraryBadgeClassName = getLibraryStatusBadgeClassName(libraryStatus.kind);

  const libraryDotClassName = getLibraryStatusDotClassName(libraryStatus.kind);

  const libraryButtonTitle =
    thumbnailIssueCount > 0
      ? `${thumbnailIssueCount} avatar preview issue${
          thumbnailIssueCount === 1 ? "" : "s"
        } detected`
      : "Avatar library media status";

  return (
    <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8 lg:py-6">
      <header className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Avatars
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Choose and trim reusable avatar videos for UGC creation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={libraryBadgeClassName}
            title={libraryButtonTitle}
          >
            <span className={libraryDotClassName} />
            {libraryStatus.label}
          </div>
          <button
            type="button"
            onClick={() => void loadAvatars()}
            disabled={refreshDisabled}
            aria-label="Refresh avatars"
            title="Refresh avatars"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-white text-[#173454] transition-colors hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={refreshIconClassName}
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      {pageStatus}

      <div className="mx-auto w-full max-w-7xl flex-1 pt-5">
        <AvatarLibrary
          avatars={avatars}
          isLoading={isLoading}
          previewHealthLabel={previewHealthLabel}
          selectedAvatarId={selectedAvatarId}
          thumbnailFailures={thumbnailFailures}
          onThumbnailError={handleThumbnailError}
          onSelectAvatar={handleSelectAvatar}
        />
      </div>

      {previewModal}
    </section>
  );
}

function AvatarLibrary({
  avatars,
  isLoading,
  onSelectAvatar,
  onThumbnailError,
  previewHealthLabel,
  selectedAvatarId,
  thumbnailFailures,
}: {
  avatars: AvatarLibraryItem[];
  isLoading: boolean;
  onSelectAvatar: (avatarId: string) => void;
  onThumbnailError: (avatarId: string, thumbnailUrl: string) => void;
  previewHealthLabel: string;
  selectedAvatarId: string | null;
  thumbnailFailures: Record<string, true>;
}) {
  return (
    <div className="flex min-h-[360px] flex-col rounded-[var(--radius-panel)] border border-border bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Avatar library</h2>
          <p className="mt-1 text-xs font-semibold text-muted">
            {previewHealthLabel}
          </p>
        </div>
        <span className="rounded-md border border-border bg-card-muted px-2.5 py-1 text-xs font-bold text-muted">
          {isLoading
            ? "Loading"
            : `${avatars.length} ${avatars.length === 1 ? "avatar" : "avatars"}`}
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center rounded-[var(--radius-panel)] border border-border bg-card-muted">
          <div className="flex items-center gap-3 text-sm font-semibold text-muted">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            Loading avatars...
          </div>
        </div>
      ) : avatars.length > 0 ? (
        <div className="grid auto-rows-min grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {avatars.map((avatar) => (
            <AvatarCard
              key={avatar.asset.id}
              avatar={avatar}
              selected={avatar.asset.id === selectedAvatarId}
              thumbnailFailed={thumbnailFailures[avatar.asset.id] === true}
              onThumbnailError={onThumbnailError}
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
    <div className="flex flex-1 items-center justify-center rounded-[var(--radius-panel)] border border-border bg-card-muted px-6 py-12 text-center">
      <div className="max-w-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-md bg-[#173454] text-white">
          <UserRound className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-base font-bold text-foreground">
          No avatar videos yet.
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-muted">
          Once global avatar videos are added to the avatar library, they will
          appear here for preview, trimming, and selection.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-bold text-[#405977]">
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
  onThumbnailError,
  selected,
  thumbnailFailed,
}: {
  avatar: AvatarLibraryItem;
  onSelect: () => void;
  onThumbnailError: (avatarId: string, thumbnailUrl: string) => void;
  selected: boolean;
  thumbnailFailed: boolean;
}) {
  const [loadedThumbnailUrl, setLoadedThumbnailUrl] = useState<string | null>(
    null,
  );
  const thumbnailUrl = avatar.asset.thumbnailUrl;
  const shouldRenderThumbnail = Boolean(thumbnailUrl) && !thumbnailFailed;
  const thumbnailLoaded =
    thumbnailUrl !== null && loadedThumbnailUrl === thumbnailUrl;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group min-w-0 rounded-[var(--radius-panel)] border bg-white p-2 text-left transition hover:border-border-strong hover:bg-card-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected ? "border-primary/60 ring-2 ring-primary/15" : "border-border",
      )}
    >
      <div className="relative overflow-hidden rounded-md bg-[#102033] text-white">
        <div
          className="relative flex items-center justify-center"
          style={{ aspectRatio: getPreviewAspectRatio(avatar.asset.ratio) }}
        >
          {shouldRenderThumbnail && thumbnailUrl ? (
            <>
              {!thumbnailLoaded ? <AvatarThumbnailSkeleton /> : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt=""
                className={cn(
                  "size-full object-cover transition-opacity duration-200 motion-reduce:transition-none",
                  thumbnailLoaded ? "opacity-100" : "opacity-0",
                )}
                decoding="async"
                loading="lazy"
                onLoad={() => setLoadedThumbnailUrl(thumbnailUrl)}
                onError={() => onThumbnailError(avatar.asset.id, thumbnailUrl)}
              />
            </>
          ) : (
            <AvatarPreviewFallback
              label={thumbnailUrl ? "Preview unavailable" : "Thumbnail missing"}
            />
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-black/60 to-transparent p-3">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/16">
            <Play className="ml-0.5 size-3.5 fill-white text-white" aria-hidden="true" />
          </span>
          {avatar.avatarSelection.isTrimmed ? (
            <span className="rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-white">
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

function AvatarThumbnailSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#14263b]">
      <div className="size-9 animate-pulse rounded-full bg-white/15 motion-reduce:animate-none" />
    </div>
  );
}

function AvatarPreviewFallback({ label }: { label: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center">
      <UserRound className="size-8 text-white/60" aria-hidden="true" />
      <span className="text-xs font-semibold text-white/72">{label}</span>
    </div>
  );
}

function AvatarPreviewModal({
  avatar,
  errorMessage,
  hasUnsavedTrimChanges,
  noticeMessage,
  onClose,
  onResetTrim,
  onSaveTrim,
  onTrimDraftChange,
  onUseAvatar,
  savingTrim,
  thumbnailIssueLabel,
  trimDraft,
  usingAvatar,
}: {
  avatar: AvatarLibraryItem;
  errorMessage: string | null;
  hasUnsavedTrimChanges: boolean;
  noticeMessage: string | null;
  onClose: () => void;
  onResetTrim: () => void;
  onSaveTrim: () => void;
  onTrimDraftChange: (draft: TrimDraft) => void;
  onUseAvatar: () => void;
  savingTrim: boolean;
  thumbnailIssueLabel: string | null;
  trimDraft: TrimDraft;
  usingAvatar: boolean;
}) {
  const dialogTitleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCloseRef = useRef(onClose);
  const [measuredVideoRatio, setMeasuredVideoRatio] = useState<{
    avatarId: string;
    ratio: number;
  } | null>(null);
  const [loadingPreviewAvatarId, setLoadingPreviewAvatarId] = useState<
    string | null
  >(null);
  const fallbackVideoRatio = getNumericPreviewAspectRatio(avatar.asset.ratio);
  const previewVideoRatio =
    measuredVideoRatio?.avatarId === avatar.asset.id
      ? measuredVideoRatio.ratio
      : fallbackVideoRatio;
  const previewWidth =
    previewVideoRatio < 1
      ? `min(100%, ${Math.round(620 * previewVideoRatio)}px, calc(66vh * ${previewVideoRatio}))`
      : "100%";

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    const videoElement = videoRef.current;

    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
      );

      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      releaseVideoElement(videoElement);
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current;

    return () => releaseVideoElement(videoElement);
  }, [avatar.asset.id]);

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/48 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close avatar preview"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-floating sm:h-[min(760px,90vh)] sm:w-[min(1050px,92vw)] sm:rounded-[var(--radius-panel)]"
      >
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-5">
          <div className="min-w-0">
            <h2
              id={dialogTitleId}
              className="truncate text-base font-bold text-foreground"
            >
              {avatar.asset.name}
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-muted">
              Preview, trim, and choose this avatar.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            title="Close preview"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:grid lg:grid-cols-[minmax(300px,0.44fr)_minmax(360px,0.56fr)] lg:gap-5 lg:overflow-hidden">
          <div className="flex min-h-[340px] items-center justify-center rounded-[var(--radius-panel)] bg-[#102033] p-3 text-white lg:min-h-0">
            <div
              className="relative flex max-h-[620px] items-center justify-center overflow-hidden rounded-md bg-[#102033] text-white"
              style={{
                aspectRatio: previewVideoRatio,
                width: previewWidth,
              }}
            >
              <video
                ref={videoRef}
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
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#102033]/55">
                  <span className="inline-flex items-center gap-2 rounded-md bg-black/55 px-3 py-2 text-xs font-semibold text-white">
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

          <div className="mt-4 min-h-0 lg:mt-0 lg:overflow-y-auto lg:pr-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold tracking-normal text-foreground">
                  {avatar.asset.name}
                </h3>
                {avatar.asset.description ? (
                  <p className="mt-1 text-sm font-medium leading-6 text-muted">
                    {avatar.asset.description}
                  </p>
                ) : null}
              </div>
              <Scissors
                className="mt-1 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-muted">
              <span className="rounded-md border border-border bg-white px-2.5 py-1">
                {formatDuration(avatar.asset.durationSeconds)}
              </span>
              <span className="rounded-md border border-border bg-white px-2.5 py-1">
                {avatar.asset.ratio === "other"
                  ? getDimensionsLabel(avatar.asset)
                  : avatar.asset.ratio}
              </span>
              <span className="rounded-md border border-border bg-white px-2.5 py-1 capitalize">
                {avatar.asset.avatarType}
              </span>
              {thumbnailIssueLabel ? (
                <span className="rounded-md border border-warning/25 bg-warning/10 px-2.5 py-1 text-warning">
                  {thumbnailIssueLabel}
                </span>
              ) : null}
              {hasUnsavedTrimChanges ? (
                <span className="rounded-md border border-info/25 bg-info/10 px-2.5 py-1 text-info">
                  Unsaved trim
                </span>
              ) : null}
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
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
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

            <StatusMessages
              errorMessage={errorMessage}
              noticeMessage={noticeMessage}
            />
          </div>
        </div>
      </div>
    </div>
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
    <div className="mt-5 rounded-[var(--radius-panel)] border border-border bg-card-muted p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Trim window</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">
            {avatar.avatarSelection.isTrimmed ? "Saved custom trim" : "Full clip"}
          </p>
        </div>
        <span className="rounded-md border border-border bg-white px-2.5 py-1 text-xs font-bold text-[#405977]">
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
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-bold text-foreground outline-none transition focus:border-primary"
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
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-bold text-foreground outline-none transition focus:border-primary"
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
          className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-border bg-white px-3 text-xs font-bold text-[#173454] transition-colors hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSaveTrim}
          disabled={savingTrim || !hasValidDraft}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-[#173454] px-3 text-xs font-bold text-white transition-colors hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
          className="rounded-[var(--radius-panel)] border border-error/20 bg-error/5 px-3 py-2 text-sm font-semibold text-error"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        </div>
      ) : null}
      {noticeMessage ? (
        <div className="rounded-[var(--radius-panel)] border border-success/20 bg-success/5 px-3 py-2 text-sm font-semibold text-[#087443]">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{noticeMessage}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getLibraryStatus({
  avatarCount,
  isLoading,
  missingThumbnailCount,
  thumbnailFailureCount,
}: {
  avatarCount: number;
  isLoading: boolean;
  missingThumbnailCount: number;
  thumbnailFailureCount: number;
}) {
  if (isLoading) {
    return {
      kind: "loading",
      label: "Loading avatars",
    } as const;
  }

  if (avatarCount === 0) {
    return {
      kind: "empty",
      label: "No avatars",
    } as const;
  }

  const issueCount = missingThumbnailCount + thumbnailFailureCount;

  if (issueCount > 0) {
    return {
      kind: "warning",
      label: `${issueCount} preview ${issueCount === 1 ? "issue" : "issues"}`,
    } as const;
  }

  return {
    kind: "ready",
    label: "Library ready",
  } as const;
}

function getPreviewHealthLabel({
  avatarCount,
  isLoading,
  missingThumbnailCount,
  thumbnailFailureCount,
}: {
  avatarCount: number;
  isLoading: boolean;
  missingThumbnailCount: number;
  thumbnailFailureCount: number;
}) {
  if (isLoading) {
    return "Checking avatar thumbnails.";
  }

  if (avatarCount === 0) {
    return "Global avatar videos available to this workspace.";
  }

  const availableThumbnailCount = Math.max(0, avatarCount - missingThumbnailCount);

  if (missingThumbnailCount > 0 || thumbnailFailureCount > 0) {
    return `${availableThumbnailCount}/${avatarCount} avatars have thumbnail URLs. Repair missing or failed previews without loading source videos in the library.`;
  }

  return `${avatarCount} avatars loaded with thumbnail previews.`;
}

function getLibraryStatusBadgeClassName(kind: ReturnType<typeof getLibraryStatus>["kind"]) {
  return cn(
    "inline-flex h-8 w-fit items-center gap-2 rounded-md border px-3 text-xs font-semibold",
    kind === "ready" &&
      "border-success/20 bg-success/10 text-[#087443]",
    kind === "warning" &&
      "border-warning/25 bg-warning/10 text-warning",
    kind === "loading" &&
      "border-info/25 bg-info/10 text-info",
    kind === "empty" && "border-border bg-white text-muted",
  );
}

function getLibraryStatusDotClassName(kind: ReturnType<typeof getLibraryStatus>["kind"]) {
  return cn(
    "size-2 rounded-full",
    kind === "ready" && "bg-success",
    kind === "warning" && "bg-warning",
    kind === "loading" && "bg-info",
    kind === "empty" && "bg-muted-subtle",
  );
}

function logAvatarLibraryDiagnostics(avatars: AvatarLibraryItem[]) {
  const withoutThumbnail = avatars.filter((avatar) => !avatar.asset.thumbnailUrl);

  console.info("[avatars] library diagnostics", {
    total: avatars.length,
    withThumbnail: avatars.length - withoutThumbnail.length,
    withoutThumbnail: withoutThumbnail.length,
  });
}

function getSafeUrlHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-url";
  }
}

function releaseVideoElement(video: HTMLVideoElement | null) {
  if (!video) {
    return;
  }

  video.pause();
  video.removeAttribute("src");
  video.load();
}

function isSameTrimDraft(left: TrimDraft, right: TrimDraft) {
  return left.start === right.start && left.end === right.end;
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
