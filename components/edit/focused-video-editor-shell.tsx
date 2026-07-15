"use client";

import { AlertCircle, ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  FocusedVideoEditor,
  type FocusedVideoEditorDraftState,
} from "@/components/edit/focused-video-editor";
import { buttonClassName } from "@/components/ui/button";
import type { EditableVideo } from "@/lib/edit/video-library";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

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
  const [, setSaveState] = useState<SaveState>("idle");
  const [lastRenderedDraftKey, setLastRenderedDraftKey] = useState<string | null>(
    null,
  );
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [renderMessage, setRenderMessage] = useState<string | null>(null);
  const activeRenderDraftKeyRef = useRef<string | null>(null);
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
        setRenderMessage("Saving continues in the background.");
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
    if (!video || video.status !== "rendering") {
      return;
    }

    const controller = new AbortController();
    const sourceVideoId = video.id;

    void requireToken()
      .then((idToken) =>
        pollEditedVideoRender(sourceVideoId, idToken, controller.signal),
      )
      .then((output) => {
        if (controller.signal.aborted || !output.url) {
          return;
        }

        const completedDraftKey =
          activeRenderDraftKeyRef.current ?? currentDraftKeyRef.current;
        const isCurrentSave =
          completedDraftKey !== null &&
          completedDraftKey === currentDraftKeyRef.current;

        lastRenderedDraftKeyRef.current = completedDraftKey;
        setLastRenderedDraftKey(completedDraftKey);
        activeRenderDraftKeyRef.current = null;

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

        setVideo((current) =>
          current ? { ...current, status: "failed" } : current,
        );
        activeRenderDraftKeyRef.current = null;
        setRenderState("failed");
        setRenderMessage(
          getErrorMessage(error, "Could not resume this save."),
        );
      });

    return () => controller.abort();
  }, [video]);

  async function handleRenderVideo() {
    if (!video?.videoUrl) {
      setRenderState("failed");
      setRenderMessage("A source video is required before saving.");
      return;
    }

    const draftForRender = getDraftForRender(video, draft);
    const draftForRenderKey = serializeDraft(draftForRender);
    activeRenderDraftKeyRef.current = draftForRenderKey;
    setRenderState("starting");
    setRenderMessage("Saving video...");

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

      setRenderState("rendering");
      setRenderMessage("Saving video. This can take a minute.");
      const output = await pollEditedVideoRender(video.id, idToken);

      if (!output.url) throw new Error("Save finished without a video URL.");

      const isCurrentSave = currentDraftKeyRef.current === draftForRenderKey;
      lastRenderedDraftKeyRef.current = draftForRenderKey;
      setLastRenderedDraftKey(draftForRenderKey);
      activeRenderDraftKeyRef.current = null;

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
      activeRenderDraftKeyRef.current = null;
      setRenderState("failed");
      setRenderMessage(getErrorMessage(error, "Could not save this video."));
    }
  }

  const isRendering = renderState === "starting" || renderState === "rendering";
  const currentDraftKey = draft ? serializeDraft(draft) : null;
  const hasSavedVideoWithNewerChanges =
    video?.status === "draft" && Boolean(video.renderedVideoUrl);
  const isCurrentVersionSaved =
    Boolean(video?.renderedVideoUrl) &&
    renderState === "rendered" &&
    currentDraftKey !== null &&
    currentDraftKey === lastRenderedDraftKey;

  return (
    <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <EditorTopBar
        canSaveVideo={Boolean(video?.videoUrl) && !isRendering && !isCurrentVersionSaved}
        isCurrentVersionSaved={isCurrentVersionSaved}
        renderState={renderState}
        video={video}
        onRenderVideo={() => void handleRenderVideo()}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col pt-5">
        {saveMessage ? (
          <p
            role="alert"
            className="mb-4 w-fit rounded-control border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold text-error"
          >
            {saveMessage}
          </p>
        ) : null}

        {renderMessage || video?.renderedVideoUrl ? (
          <RenderStatusNotice
            hasSavedVideoWithNewerChanges={hasSavedVideoWithNewerChanges}
            renderedVideoUrl={video?.renderedVideoUrl ?? null}
            renderMessage={renderMessage}
            renderState={renderState}
          />
        ) : null}

        {isLoading ? (
          <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-[28px] border border-border/70 bg-white/35">
            <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading video" />
          </div>
        ) : video ? (
          <FocusedVideoEditor video={video} onDraftChange={setDraft} />
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
  video,
}: {
  canSaveVideo: boolean;
  isCurrentVersionSaved: boolean;
  onRenderVideo: () => void;
  renderState: RenderState;
  video: EditableVideo | null;
}) {
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href="/edit" className="inline-flex items-center gap-2 text-sm font-bold text-[#405977] transition hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Edit
        </Link>
        <h1 className="mt-2 truncate text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
          {video ? video.title : "Video editor"}
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onRenderVideo} disabled={!canSaveVideo} className={buttonClassName({ variant: "primary", className: "gap-2" })}>
          {renderState === "starting" || renderState === "rendering" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {getSaveButtonLabel(renderState, isCurrentVersionSaved)}
        </button>
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
    <div role={isFailed ? "alert" : "status"} className={isFailed ? "mb-4 rounded-card border border-error/20 bg-error/5 px-4 py-3 text-sm font-semibold text-error" : "mb-4 rounded-card border border-border bg-card px-4 py-3 text-sm font-semibold text-muted"}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        {renderedVideoUrl ? <a href={renderedVideoUrl} target="_blank" rel="noreferrer" className={buttonClassName({ variant: "primary", className: "h-9 w-fit px-3 text-xs" })}>Open video</a> : null}
      </div>
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
    return "Saving...";
  }

  if (isCurrentVersionSaved) {
    return "Saved";
  }

  return "Save";
}

async function pollEditedVideoRender(
  sourceVideoId: string,
  idToken: string,
  signal?: AbortSignal,
) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(attempt === 0 ? 900 : 2_500, signal);
    const response = await fetch(
      `/api/edit/render/status?sourceVideoId=${encodeURIComponent(sourceVideoId)}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${idToken}` },
        signal,
      },
    );
    const data = (await response.json()) as RenderStatusResponse;
    if (!response.ok || !data.ok) throw new Error(data.ok ? "Save status unavailable." : data.error);
    if (data.run.status === "COMPLETED" && data.run.output?.url) return data.run.output;
    if (data.run.isTerminal) throw new Error(data.run.error ?? "Video save failed.");
  }
  throw new Error("Video save timed out.");
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
