"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileImage,
  Film,
  Loader2,
  Pencil,
  Scissors,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { UserMediaCollection } from "@/components/media/user-media-collection";
import { getCreativeAssetEditorHref } from "@/lib/edit/routes";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaCollection, MediaSourceType } from "@/lib/media/types";
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

export function AvatarsWorkspace({
  editorAvatarId = null,
  initialTab = "videos",
}: {
  editorAvatarId?: string | null;
  initialTab?: MediaWorkspaceTab;
}) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const isEditorMode = editorAvatarId !== null;
  const [avatars, setAvatars] = useState<AvatarLibraryItem[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [trimDraft, setTrimDraft] = useState<TrimDraft>({
    end: "",
    start: "0",
  });
  const [isLoading, setIsLoading] = useState(isEditorMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [savingTrim, setSavingTrim] = useState(false);
  const [usingAvatar, setUsingAvatar] = useState(false);
  const [openingInEdit, setOpeningInEdit] = useState(false);
  const [activeTab, setActiveTab] = useState<MediaWorkspaceTab>(initialTab);
  const selectedAvatarIdRef = useRef<string | null>(null);

  function handleTabChange(tab: MediaWorkspaceTab) {
    setActiveTab(tab);
    window.history.replaceState(null, "", tab === "videos" ? "/avatars" : `/avatars?tab=${tab}`);
  }

  const selectedAvatar = useMemo(() => {
    return avatars.find((avatar) => avatar.asset.id === selectedAvatarId) ?? null;
  }, [avatars, selectedAvatarId]);
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
    if (authLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!user) {
        setAvatars([]);
        commitSelectedAvatarId(null);
        setTrimDraft(getAvatarTrimDraft(null));
        setErrorMessage("Sign in before managing this source video.");
        return;
      }

      const token = await getCurrentUserIdToken();

      if (!token) {
          throw new Error("Sign in before managing this source video.");
      }

      const response = await fetch("/api/avatars", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as AvatarListResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiErrorMessage(data, "Could not load this source video."));
      }

      setAvatars(data.avatars);

      const currentSelectedAvatarId = selectedAvatarIdRef.current;
      const nextSelectedAvatarId =
        editorAvatarId &&
        data.avatars.some((avatar) => avatar.asset.id === editorAvatarId)
          ? editorAvatarId
          : currentSelectedAvatarId &&
              data.avatars.some(
                (avatar) => avatar.asset.id === currentSelectedAvatarId,
              )
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
      setErrorMessage(getErrorMessage(error, "Could not load this source video."));
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, commitSelectedAvatarId, editorAvatarId, user]);

  useEffect(() => {
    if (!isEditorMode) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadAvatars();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isEditorMode, loadAvatars]);

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
      setNoticeMessage("Source video trim saved.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not save the source video trim."));
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
      setNoticeMessage("Source video trim reset.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not reset the source video trim."));
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
        throw new Error(getApiErrorMessage(data, "Could not select this source video."));
      }

      updateAvatar(data);
      setNoticeMessage("Source video selected for generation.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not select this source video."));
    } finally {
      setUsingAvatar(false);
    }
  }

  async function handleOpenAvatarInEdit() {
    if (!selectedAvatar || openingInEdit) {
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    setOpeningInEdit(true);

    try {
      const token = await getAuthToken();
      const response = await fetch("/api/media/from-avatar", {
        body: JSON.stringify({ avatarId: selectedAvatar.asset.id }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as
        | { asset: { id: string }; ok: true }
        | { error?: string; ok?: false };

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiErrorMessage(data, "Could not open this source video in the editor."));
      }

      router.push(getCreativeAssetEditorHref(data.asset.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not open this source video in the editor."));
    } finally {
      setOpeningInEdit(false);
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

  function handleRequestBackToLibrary() {
    if (
      hasUnsavedTrimChanges &&
      !window.confirm("Discard unsaved trim changes?")
    ) {
      return;
    }

    if (selectedAvatar) {
      setTrimDraft(getAvatarTrimDraft(selectedAvatar));
    }

    router.push("/avatars");
  }

  const selectedAvatarHasThumbnailIssue =
    selectedAvatar !== null &&
    !selectedAvatar.asset.thumbnailUrl;

  const selectedAvatarIssueLabel = selectedAvatarHasThumbnailIssue
    ? "Thumbnail missing"
    : null;

  if (isEditorMode) {
    const editorAvatarWasNotFound =
      !isLoading && editorAvatarId !== null && selectedAvatar === null;

    return (
      <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8 lg:py-6">
        {selectedAvatar ? (
          <AvatarFullPageEditor
            avatar={selectedAvatar}
            errorMessage={errorMessage}
            hasUnsavedTrimChanges={hasUnsavedTrimChanges}
            noticeMessage={noticeMessage}
            openingInEdit={openingInEdit}
            savingTrim={savingTrim}
            thumbnailIssueLabel={selectedAvatarIssueLabel}
            trimDraft={trimDraft}
            usingAvatar={usingAvatar}
            onBack={handleRequestBackToLibrary}
            onOpenInEdit={() => void handleOpenAvatarInEdit()}
            onResetTrim={() => void handleResetTrim()}
            onSaveTrim={() => void handleSaveTrim()}
            onTrimDraftChange={setTrimDraft}
            onUseAvatar={() => void handleUseAvatar()}
          />
        ) : (
          <AvatarEditorShell
            isLoading={isLoading}
            notFound={editorAvatarWasNotFound}
            errorMessage={errorMessage}
            onBack={handleRequestBackToLibrary}
          />
        )}
      </section>
    );
  }

  return (
    <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col">
        <header className="flex flex-col gap-5 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Instagram workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-[2rem]">
              Creative Assets
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Keep the real videos and images you use to build Instagram content in one focused library.
            </p>
          </div>

          <nav
            aria-label="Creative asset collections"
            className="inline-flex w-full rounded-[var(--radius-control)] border border-border bg-card-muted p-1 md:w-auto"
          >
            {mediaWorkspaceTabs.map((tab) => {
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:flex-none",
                    activeTab === tab.id
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="flex-1 pt-5">
          {activeTab === "videos" ? (
            <UserMediaCollection
              collection="video"
              displayCollections={creativeAssetVideoCollections}
              sourceTypes={hookVideoSourceTypes}
              title="Video library"
              description="Uploaded footage and generated videos ready for your Instagram workflow."
              emptyTitle="No videos yet"
              emptyDescription="Upload a video or create one in the workspace. Your real assets will appear here."
              variant="dark"
            />
          ) : (
            <UserMediaCollection
              collection="image"
              title="Image library"
              description="Uploaded and generated images ready for posts, carousels, and covers."
              emptyTitle="No images yet"
              emptyDescription="Upload an image or create one in the workspace. Your real assets will appear here."
              variant="dark"
            />
          )}
        </div>
      </div>
    </section>
  );
}

type MediaWorkspaceTab = "videos" | "images";

const hookVideoSourceTypes: MediaSourceType[] = [
  "upload",
  "influencer_upload",
  "catalog_influencer",
  "generated_video",
];

const creativeAssetVideoCollections: MediaCollection[] = [
  "video",
  "influencer",
];

const mediaWorkspaceTabs: {
  icon: typeof Film;
  id: MediaWorkspaceTab;
  label: string;
}[] = [
  { icon: Film, id: "videos", label: "Videos" },
  { icon: FileImage, id: "images", label: "Images" },
];

function AvatarEditorShell({
  errorMessage,
  isLoading,
  notFound,
  onBack,
}: {
  errorMessage: string | null;
  isLoading: boolean;
  notFound: boolean;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-1 flex-col">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 w-fit items-center gap-2 rounded-control border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Creative Assets
        </button>
      </header>

      <div className="mt-5 flex min-h-[420px] flex-1 items-center justify-center rounded-[var(--radius-panel)] border border-border bg-card px-6 py-12 text-center shadow-card">
        <div className="max-w-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-control bg-selected text-primary">
            {isLoading ? (
              <Loader2
                className="size-5 animate-spin text-primary motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <UserRound className="size-5" aria-hidden="true" />
            )}
          </div>
          <p className="mt-4 text-base font-bold text-foreground">
            {isLoading
              ? "Loading source video"
              : notFound
                ? "Source video not found"
                : "Source video unavailable"}
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-muted">
            {errorMessage ??
              (notFound
                ? "This source video is no longer available."
                : "Return to Creative Assets and choose another video.")}
          </p>
        </div>
      </div>
    </div>
  );
}

function AvatarFullPageEditor({
  avatar,
  errorMessage,
  hasUnsavedTrimChanges,
  noticeMessage,
  onBack,
  onOpenInEdit,
  onResetTrim,
  onSaveTrim,
  onTrimDraftChange,
  onUseAvatar,
  savingTrim,
  thumbnailIssueLabel,
  trimDraft,
  usingAvatar,
  openingInEdit,
}: {
  avatar: AvatarLibraryItem;
  errorMessage: string | null;
  hasUnsavedTrimChanges: boolean;
  noticeMessage: string | null;
  onBack: () => void;
  onOpenInEdit: () => void;
  onResetTrim: () => void;
  onSaveTrim: () => void;
  onTrimDraftChange: (draft: TrimDraft) => void;
  onUseAvatar: () => void;
  savingTrim: boolean;
  thumbnailIssueLabel: string | null;
  trimDraft: TrimDraft;
  usingAvatar: boolean;
  openingInEdit: boolean;
}) {
  const editorTitleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
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
      ? `min(100%, 420px, calc(74vh * ${previewVideoRatio}))`
      : "min(100%, 420px)";

  useEffect(() => {
    const videoElement = videoRef.current;

    return () => releaseVideoElement(videoElement);
  }, [avatar.asset.id]);

  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-1 flex-col">
      <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-control border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Creative Assets
          </button>
          <div className="min-w-0">
            <h1
              id={editorTitleId}
              className="truncate text-xl font-bold tracking-normal text-foreground sm:text-2xl"
            >
              {avatar.asset.name}
            </h1>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              Preview and trim this source video before using it in your content.
            </p>
          </div>
        </div>
        {hasUnsavedTrimChanges ? (
          <span className="inline-flex h-8 w-fit items-center rounded-md border border-info/25 bg-info/10 px-3 text-xs font-semibold text-info">
            Unsaved trim
          </span>
        ) : null}
      </header>

      <div
        aria-labelledby={editorTitleId}
        className="mt-5 grid flex-1 gap-5 rounded-[var(--radius-panel)] border border-border bg-card p-4 shadow-card sm:p-5 lg:min-h-[calc(100vh-190px)] lg:grid-cols-[minmax(320px,0.44fr)_minmax(420px,0.56fr)] lg:gap-6 lg:overflow-hidden"
      >
        <div className="flex min-h-[360px] items-center justify-center rounded-[var(--radius-panel)] bg-[#102033] p-3 text-white sm:min-h-[460px] lg:min-h-0">
          <div
            className="relative flex max-h-[75vh] items-center justify-center overflow-hidden rounded-md bg-[#102033] text-white"
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
              preload="metadata"
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
                  Loading preview…
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto lg:pr-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-normal text-foreground">
                Source video information
              </h2>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {avatar.asset.name}
              </p>
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
            <span className="rounded-control border border-border bg-card-muted px-2.5 py-1">
              {formatDuration(avatar.asset.durationSeconds)}
            </span>
            <span className="rounded-control border border-border bg-card-muted px-2.5 py-1">
              {avatar.asset.ratio === "other"
                ? getDimensionsLabel(avatar.asset)
                : avatar.asset.ratio}
            </span>
            <span className="rounded-control border border-border bg-card-muted px-2.5 py-1 capitalize">
              {avatar.asset.avatarType}
            </span>
            {thumbnailIssueLabel ? (
              <span className="rounded-md border border-warning/25 bg-warning/10 px-2.5 py-1 text-warning">
                {thumbnailIssueLabel}
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

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onOpenInEdit}
              disabled={openingInEdit}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-border bg-card-muted px-5 text-sm font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card hover:text-foreground-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {openingInEdit ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Pencil className="size-4" aria-hidden="true" />
              )}
              {openingInEdit ? "Opening" : "Edit video"}
            </button>
            <button
              type="button"
              onClick={onUseAvatar}
              disabled={usingAvatar}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {usingAvatar ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Selecting
                </>
              ) : (
                <>
                  <UserRound className="size-4" aria-hidden="true" />
                  Use source video
                </>
              )}
            </button>
          </div>

          <StatusMessages
            errorMessage={errorMessage}
            noticeMessage={noticeMessage}
          />
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
        <span className="rounded-control border border-border bg-card px-2.5 py-1 text-xs font-bold text-muted">
          {hasValidDraft
            ? `${formatSeconds(trimEnd - trimStart)} selected`
            : "Set trim"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold text-muted">Start</span>
          <input
            name="trim-start"
            autoComplete="off"
            inputMode="decimal"
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
            className="mt-1 h-10 w-full rounded-control border border-border bg-card px-3 text-sm font-bold text-foreground outline-none transition placeholder:text-muted-subtle hover:border-border-strong focus:border-focus focus-visible:ring-2 focus-visible:ring-focus/25"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-muted">End</span>
          <input
            name="trim-end"
            autoComplete="off"
            inputMode="decimal"
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
            className="mt-1 h-10 w-full rounded-control border border-border bg-card px-3 text-sm font-bold text-foreground outline-none transition placeholder:text-muted-subtle hover:border-border-strong focus:border-focus focus-visible:ring-2 focus-visible:ring-focus/25"
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
          className="inline-flex h-9 flex-1 items-center justify-center rounded-control border border-border bg-card px-3 text-xs font-bold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSaveTrim}
          disabled={savingTrim || !hasValidDraft}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-control bg-primary px-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingTrim ? (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
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
      <div className="h-2 overflow-hidden rounded-full bg-card">
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
    <div className="mt-4 flex flex-col gap-2">
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
        <div className="rounded-[var(--radius-panel)] border border-success/20 bg-success/10 px-3 py-2 text-sm font-semibold text-success">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{noticeMessage}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
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
    throw new Error(getApiErrorMessage(data, "Could not save the source video preference."));
  }

  return data;
}

async function getAuthToken() {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before managing this source video.");
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
