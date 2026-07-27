"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  ExternalLink,
  Loader2,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  FocusedVideoEditor,
  type FocusedVideoEditorDraftState,
} from "@/components/edit/focused-video-editor";
import { buttonClassName } from "@/components/ui/button";
import type { EditableVideo } from "@/lib/edit/video-library";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type RenderState = "idle" | "starting" | "rendering" | "rendered" | "failed";
type SaveState = "idle" | "saving" | "saved" | "failed";

type RenderStartResponse =
  | { jobId: string; ok: true; renderId: string; sourceVideoId: string }
  | { error: string; ok: false };

type RenderStatusResponse =
  | {
      ok: true;
      run: {
        error: string | null;
        isTerminal: boolean;
        output: { url: string | null } | null;
        status: string;
      };
    }
  | { error: string; ok: false };

export function FocusedVideoEditorShell({ videoId }: { videoId: string }) {
  const [video, setVideo] = useState<EditableVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState<FocusedVideoEditorDraftState | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastRenderedDraftKey, setLastRenderedDraftKey] = useState<string | null>(
    null,
  );
  const [isDraftValid, setIsDraftValid] = useState(true);
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [renderMessage, setRenderMessage] = useState<string | null>(null);
  const [resumePollGeneration, setResumePollGeneration] = useState(0);
  const activeRenderDraftKeyRef = useRef<string | null>(null);
  const localRenderPollActiveRef = useRef(false);
  const currentDraftKeyRef = useRef<string | null>(null);
  const lastSavedDraftKeyRef = useRef<string | null>(null);
  const lastRenderedDraftKeyRef = useRef<string | null>(null);

  const loadVideo = useCallback(async () => {
    setIsLoading(true);

    try {
      const token = await requireToken();
      let response = await fetch(
        `/api/edit/videos/${encodeURIComponent(videoId)}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.status === 404) {
        response = await fetch("/api/edit/videos", {
          body: JSON.stringify({ sourceVideoId: videoId }),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });
      }

      const data = (await response.json()) as
        | { ok: true; video: EditableVideo }
        | { error?: string; ok?: false };

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiError(data, "Video not found."));
      }

      const initialDraft = getDraftForRender(data.video, null);

      const initialDraftKey = serializeDraft(initialDraft);
      const initialRenderedDraftKey =
        data.video.status === "rendered" ? initialDraftKey : null;
      currentDraftKeyRef.current = initialDraftKey;
      activeRenderDraftKeyRef.current =
        data.video.status === "rendering" ? initialDraftKey : null;
      lastSavedDraftKeyRef.current = initialDraftKey;
      lastRenderedDraftKeyRef.current = initialRenderedDraftKey;
      setLastRenderedDraftKey(initialRenderedDraftKey);
      setDraft(initialDraft);
      setVideo(data.video);
      setSaveState("saved");
      setSaveMessage(null);

      if (data.video.status === "rendering") {
        setRenderState("rendering");
        setRenderMessage("Exporting continues in the background.");
      } else if (data.video.status === "failed") {
        setRenderState("failed");
        setRenderMessage("The latest save failed. You can try again.");
      } else if (data.video.status === "rendered") {
        setRenderState("rendered");
        setRenderMessage(null);
      } else {
        setRenderState("idle");
        setRenderMessage(null);
      }
    } catch (error) {
      setVideo(null);
      setSaveState("failed");
      setSaveMessage(getErrorMessage(error, "Could not load this video."));
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadVideo(), 0);
    return () => window.clearTimeout(timer);
  }, [loadVideo]);

  const persistDraft = useCallback(
    async (
      currentVideo: EditableVideo,
      currentDraft: FocusedVideoEditorDraftState,
    ) => {
      const token = await requireToken();
      const response = await fetch(
        `/api/edit/videos/${encodeURIComponent(currentVideo.id)}`,
        {
          body: JSON.stringify({ draft: currentDraft }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );
      const data = (await response.json()) as
        | { ok: true; video: EditableVideo }
        | { error?: string; ok?: false };

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiError(data, "Could not save these changes."));
      }

      setVideo(data.video);
      return data.video;
    },
    [],
  );

  useEffect(() => {
    if (!video || !draft) {
      return;
    }

    const draftKey = serializeDraft(draft);
    currentDraftKeyRef.current = draftKey;

    if (draftKey === lastSavedDraftKeyRef.current) {
      return;
    }

    setSaveState("idle");
    setSaveMessage(null);

    const isSavingVideo =
      renderState === "starting" || renderState === "rendering";

    if (draftKey !== lastRenderedDraftKeyRef.current && !isSavingVideo) {
      setRenderState("idle");
      setRenderMessage(null);
    }

    const timer = window.setTimeout(() => {
      setSaveState("saving");

      void persistDraft(video, draft)
        .then(() => {
          lastSavedDraftKeyRef.current = draftKey;
          setSaveState("saved");
          setSaveMessage(null);
        })
        .catch((error) => {
          setSaveState("failed");
          setSaveMessage(
            getErrorMessage(error, "Could not save your editing changes."),
          );
        });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draft, persistDraft, renderState, video]);

  useEffect(() => {
    if (
      !video ||
      video.status !== "rendering" ||
      localRenderPollActiveRef.current
    ) {
      return;
    }

    const controller = new AbortController();
    const sourceVideoId = video.id;
    const renderDraftKey =
      activeRenderDraftKeyRef.current ?? currentDraftKeyRef.current;

    setRenderState("rendering");
    setRenderMessage("Exporting continues in the background.");

    void requireToken()
      .then((idToken) =>
        pollEditedVideoRender(sourceVideoId, idToken, controller.signal),
      )
      .then((output) => {
        if (controller.signal.aborted || !output.url) {
          return;
        }

        const completedDraftKey = renderDraftKey;
        const isCurrentSave =
          completedDraftKey !== null &&
          completedDraftKey === currentDraftKeyRef.current;

        lastRenderedDraftKeyRef.current = completedDraftKey;
        setLastRenderedDraftKey(completedDraftKey);
        if (activeRenderDraftKeyRef.current === renderDraftKey) {
          activeRenderDraftKeyRef.current = null;
        }

        setVideo((current) =>
          current
            ? {
                ...current,
                renderedVideoUrl: output.url,
                status: isCurrentSave ? "rendered" : "draft",
              }
            : current,
        );
        setRenderState("rendered");
        setRenderMessage(
          isCurrentSave ? "Saved video is ready." : "Previous save finished.",
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof RenderPollTransientError) {
          setRenderState("rendering");
          setRenderMessage("Export is still running. Reconnecting to status...");
          setResumePollGeneration((current) => current + 1);
          return;
        }

        setVideo((current) =>
          current ? { ...current, status: "failed" } : current,
        );
        if (activeRenderDraftKeyRef.current === renderDraftKey) {
          activeRenderDraftKeyRef.current = null;
        }
        setRenderState("failed");
        setRenderMessage(
          getErrorMessage(error, "Could not resume this save."),
        );
      });

    return () => controller.abort();
  }, [resumePollGeneration, video]);

  async function handleRenderVideo() {
    if (!isDraftValid) {
      setRenderState("failed");
      setRenderMessage(
        "A text layer has too many line breaks. Shorten it before exporting.",
      );
      return;
    }

    if (!video?.videoUrl) {
      setRenderState("failed");
      setRenderMessage("A source video is required before saving.");
      return;
    }

    const draftForRender = getDraftForRender(video, draft);
    const draftForRenderKey = serializeDraft(draftForRender);
    localRenderPollActiveRef.current = true;
    activeRenderDraftKeyRef.current = draftForRenderKey;
    setRenderState("starting");
    setRenderMessage("Preparing export...");

    try {
      await persistDraft(video, draftForRender);
      lastSavedDraftKeyRef.current = draftForRenderKey;
      setSaveState("saved");
      setSaveMessage(null);
      const idToken = await requireToken();
      const response = await fetch("/api/edit/render", {
        body: JSON.stringify({
          draft: draftForRender,
          durationSeconds: video.durationSeconds,
          projectId: video.projectId,
          ratio: video.ratio,
          source: video.source,
          sourceVideoId: video.id,
          sourceVideoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          title: video.title,
        }),
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as RenderStartResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.ok ? "Could not start saving." : data.error);
      }

      setVideo((current) =>
        current ? { ...current, status: "rendering" } : current,
      );
      setRenderState("rendering");
      setRenderMessage("Exporting video. This can take a minute.");
      const output = await pollEditedVideoRender(
        video.id,
        idToken,
        undefined,
        data.jobId,
      );

      if (!output.url) throw new Error("Save finished without a video URL.");

      const isCurrentSave = currentDraftKeyRef.current === draftForRenderKey;
      lastRenderedDraftKeyRef.current = draftForRenderKey;
      setLastRenderedDraftKey(draftForRenderKey);
      if (activeRenderDraftKeyRef.current === draftForRenderKey) {
        activeRenderDraftKeyRef.current = null;
      }
      localRenderPollActiveRef.current = false;

      setVideo((current) =>
        current
          ? {
              ...current,
              renderedVideoUrl: output.url,
              status: isCurrentSave ? "rendered" : "draft",
            }
          : current,
      );
      setRenderState("rendered");
      setRenderMessage(
        isCurrentSave ? "Saved video is ready." : "Previous save finished.",
      );
    } catch (error) {
      console.error("Edited video render failed:", error);
      localRenderPollActiveRef.current = false;

      if (error instanceof RenderPollTransientError) {
        setVideo((current) =>
          current ? { ...current, status: "rendering" } : current,
        );
        setRenderState("rendering");
        setRenderMessage("Export is still running. Reconnecting to status...");
        setResumePollGeneration((current) => current + 1);
        return;
      }

      if (activeRenderDraftKeyRef.current === draftForRenderKey) {
        activeRenderDraftKeyRef.current = null;
      }
      setVideo((current) =>
        current ? { ...current, status: "failed" } : current,
      );
      setRenderState("failed");
      setRenderMessage(getErrorMessage(error, "Could not save this video."));
    }
  }

  const isRendering = renderState === "starting" || renderState === "rendering";
  const currentDraftKey = draft ? serializeDraft(draft) : null;
  const hasSavedVideoWithNewerChanges =
    video?.status === "draft" && Boolean(video.renderedVideoUrl);
  const shouldShowRenderStatus =
    isRendering ||
    renderState === "failed" ||
    hasSavedVideoWithNewerChanges;
  const isCurrentVersionSaved =
    Boolean(video?.renderedVideoUrl) &&
    renderState === "rendered" &&
    currentDraftKey !== null &&
    currentDraftKey === lastRenderedDraftKey;

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] min-w-0 w-full flex-1 flex-col overflow-x-hidden bg-background text-foreground md:min-h-dvh lg:h-dvh lg:overflow-hidden">
      <EditorTopBar
        canSaveVideo={
          Boolean(video?.videoUrl) &&
          isDraftValid &&
          !isRendering &&
          !isCurrentVersionSaved
        }
        isCurrentVersionSaved={isCurrentVersionSaved}
        renderState={renderState}
        renderedVideoUrl={video?.renderedVideoUrl ?? null}
        saveState={saveState}
        video={video}
        onRenderVideo={() => void handleRenderVideo()}
      />

      <div className="flex min-h-0 w-full flex-1 flex-col p-3 sm:p-4">
        {saveMessage ? (
          <p
            role="alert"
            className="mb-4 w-fit rounded-control border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold text-error"
          >
            {saveMessage}
          </p>
        ) : null}

        {shouldShowRenderStatus ? (
          <RenderStatusNotice
            hasSavedVideoWithNewerChanges={hasSavedVideoWithNewerChanges}
            renderedVideoUrl={video?.renderedVideoUrl ?? null}
            renderMessage={renderMessage}
            renderState={renderState}
          />
        ) : null}

        {isLoading ? (
          <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-card border border-border bg-card">
            <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading video" />
          </div>
        ) : video ? (
          <FocusedVideoEditor
            hasSavedVideoWithNewerChanges={hasSavedVideoWithNewerChanges}
            isCurrentVersionSaved={isCurrentVersionSaved}
            renderedVideoUrl={video.renderedVideoUrl}
            video={video}
            onDraftChange={setDraft}
            onDraftValidityChange={setIsDraftValid}
          />
        ) : (
          <VideoNotFound videoId={videoId} />
        )}
      </div>
    </section>
  );
}

function EditorTopBar({
  canSaveVideo,
  isCurrentVersionSaved,
  onRenderVideo,
  renderState,
  renderedVideoUrl,
  saveState,
  video,
}: {
  canSaveVideo: boolean;
  isCurrentVersionSaved: boolean;
  onRenderVideo: () => void;
  renderState: RenderState;
  renderedVideoUrl: string | null;
  saveState: SaveState;
  video: EditableVideo | null;
}) {
  const isRendering = renderState === "starting" || renderState === "rendering";

  return (
    <header className="flex w-full shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          href="/edit"
          aria-label="Back to video library"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-control border border-border text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Edit video</span>
            <span aria-hidden="true" className="text-border-strong">/</span>
            <span className="text-xs font-semibold text-muted">
              {video?.ratio ?? "9:16"}
            </span>
          </div>
          <h1 className="truncate text-lg font-bold tracking-[-0.02em] text-foreground-strong sm:text-xl">
            {video ? video.title : "Video editor"}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <div
          role="status"
          aria-live="polite"
          className="mr-1 inline-flex h-10 items-center gap-2 text-xs font-semibold text-muted"
        >
          {saveState === "saving" ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : saveState === "failed" ? (
            <AlertCircle className="text-error" aria-hidden="true" />
          ) : saveState === "saved" ? (
            <CheckCircle2 className="text-success" aria-hidden="true" />
          ) : (
            <Cloud aria-hidden="true" />
          )}
          {getDraftSaveLabel(saveState)}
        </div>

        {renderedVideoUrl ? (
          <a
            href={renderedVideoUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonClassName({
              variant: "secondary",
              className: "gap-2",
            })}
          >
            <ExternalLink aria-hidden="true" />
            Open export
          </a>
        ) : null}

        {!isCurrentVersionSaved || isRendering ? (
          <button
            type="button"
            onClick={onRenderVideo}
            disabled={!canSaveVideo}
            className={buttonClassName({
              variant: "primary",
              className: "min-w-32 gap-2",
            })}
          >
            {isRendering ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {getSaveButtonLabel(renderState, isCurrentVersionSaved)}
          </button>
        ) : null}
      </div>
    </header>
  );
}

function RenderStatusNotice({
  hasSavedVideoWithNewerChanges,
  renderedVideoUrl,
  renderMessage,
  renderState,
}: {
  hasSavedVideoWithNewerChanges: boolean;
  renderedVideoUrl: string | null;
  renderMessage: string | null;
  renderState: RenderState;
}) {
  const isFailed = renderState === "failed";
  const message =
    renderMessage ??
    (hasSavedVideoWithNewerChanges
      ? "Changes not saved."
      : "Saved video is ready.");
  return (
    <div
      role={isFailed ? "alert" : "status"}
      className={cn(
        "mb-3 flex min-h-10 items-center rounded-control px-3 text-xs font-semibold",
        isFailed
          ? "border border-error/20 bg-error/5 text-error"
          : hasSavedVideoWithNewerChanges
            ? "border border-warning/25 bg-warning/10 text-foreground"
            : "bg-selected text-muted",
      )}
    >
      <span>{message}</span>
      {renderedVideoUrl && hasSavedVideoWithNewerChanges ? (
        <span className="ml-1 text-muted">The stage can still review the previous export.</span>
      ) : null}
    </div>
  );
}

function VideoNotFound({ videoId }: { videoId: string }) {
  return (
    <section aria-label="Video not found" className="flex min-h-[420px] flex-1 items-center justify-center rounded-[28px] border border-border/70 bg-white/35 px-5 py-10 text-center">
      <div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-error/20 bg-error/5 text-error shadow-sm"><AlertCircle className="size-6" aria-hidden="true" /></div>
        <h2 className="mt-5 text-lg font-bold text-foreground">This video is not in your account.</h2>
        <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-muted">No server media asset exists for ID {videoId}. Add a video from the Influencers workspace, then open it here.</p>
        <Link href="/edit" className={buttonClassName({ variant: "primary", className: "mt-5" })}>Back to library</Link>
      </div>
    </section>
  );
}

function getDraftForRender(video: EditableVideo, draft: FocusedVideoEditorDraftState | null): FocusedVideoEditorDraftState {
  if (draft) return draft;
  if (video.draft) return { textOverlays: video.draft.textOverlays, trimEndSeconds: video.draft.trimEndSeconds, trimStartSeconds: video.draft.trimStartSeconds };
  return { textOverlays: [], trimEndSeconds: null, trimStartSeconds: 0 };
}

function serializeDraft(draft: FocusedVideoEditorDraftState) {
  return JSON.stringify(draft);
}

function getSaveButtonLabel(
  renderState: RenderState,
  isCurrentVersionSaved: boolean,
) {
  if (renderState === "starting" || renderState === "rendering") {
    return "Exporting...";
  }

  if (isCurrentVersionSaved) {
    return "Exported";
  }

  return "Export video";
}

function getDraftSaveLabel(saveState: SaveState) {
  if (saveState === "saving") {
    return "Saving draft";
  }

  if (saveState === "failed") {
    return "Draft save failed";
  }

  if (saveState === "saved") {
    return "Draft saved";
  }

  return "Unsaved changes";
}

async function pollEditedVideoRender(
  sourceVideoId: string,
  idToken: string,
  signal?: AbortSignal,
  jobId?: string,
) {
  let lastTransientError: Error | null = null;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(attempt === 0 ? 900 : 2_500, signal);
    const query = jobId
      ? `jobId=${encodeURIComponent(jobId)}`
      : `sourceVideoId=${encodeURIComponent(sourceVideoId)}`;
    try {
      const response = await fetch(`/api/edit/render/status?${query}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${idToken}` },
        signal,
      });
      const data = (await response.json()) as RenderStatusResponse;

      if (!response.ok || !data.ok) {
        const message = data.ok
          ? "Export status is temporarily unavailable."
          : data.error;

        if (isTransientHttpStatus(response.status)) {
          lastTransientError = new Error(message);
          continue;
        }

        throw new RenderPollFatalError(message);
      }

      lastTransientError = null;

      if (data.run.status === "COMPLETED" && data.run.output?.url) {
        return data.run.output;
      }

      if (data.run.isTerminal) {
        throw new RenderPollFatalError(
          data.run.error ?? "Video export failed.",
        );
      }
    } catch (error) {
      if (
        signal?.aborted ||
        error instanceof RenderPollFatalError ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        throw error;
      }

      lastTransientError =
        error instanceof Error
          ? error
          : new Error("Export status is temporarily unavailable.");
    }
  }

  throw new RenderPollTransientError(
    lastTransientError?.message ?? "Export status polling timed out.",
  );
}

class RenderPollFatalError extends Error {}

class RenderPollTransientError extends Error {}

function isTransientHttpStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function requireToken() {
  const token = await getCurrentUserIdToken();
  if (!token) throw new Error("Sign in again to edit this video.");
  return token;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getApiError(value: unknown, fallback: string) {
  return value && typeof value === "object" && "error" in value && typeof value.error === "string"
    ? value.error
    : fallback;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);

    function handleAbort() {
      window.clearTimeout(timer);
      reject(new DOMException("Save polling was cancelled.", "AbortError"));
    }

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}
