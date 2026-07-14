"use client";

import { AlertCircle, ArrowLeft, Download, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  FocusedVideoEditor,
  type FocusedVideoEditorDraftState,
} from "@/components/edit/focused-video-editor";
import { buttonClassName } from "@/components/ui/button";
import type { EditableVideo } from "@/lib/edit/video-library";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { mediaAssetToEditableVideo } from "@/lib/media/editable-video";
import type { MediaAsset } from "@/lib/media/types";

type RenderState = "idle" | "starting" | "rendering" | "rendered" | "failed";

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
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle");
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [renderMessage, setRenderMessage] = useState<string | null>(null);

  const loadVideo = useCallback(async () => {
    setIsLoading(true);

    try {
      const token = await requireToken();
      const response = await fetch(`/api/media/${encodeURIComponent(videoId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as
        | { asset: MediaAsset; ok: true }
        | { error?: string; ok?: false };

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiError(data, "Video not found."));
      }

      if (data.asset.collection === "image") {
        throw new Error("This asset is not an editable video.");
      }

      setVideo(mediaAssetToEditableVideo(data.asset));
      setSaveMessage(null);
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

  async function persistDraft(
    currentVideo: EditableVideo,
    currentDraft: FocusedVideoEditorDraftState,
  ) {
    const token = await requireToken();
    const response = await fetch(`/api/media/${encodeURIComponent(currentVideo.id)}`, {
      body: JSON.stringify({ draft: currentDraft }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
    const data = (await response.json()) as
      | { asset: MediaAsset; ok: true }
      | { error?: string; ok?: false };

    if (!response.ok || data.ok !== true) {
      throw new Error(getApiError(data, "Could not save this draft."));
    }

    const updatedVideo = mediaAssetToEditableVideo(data.asset);
    setVideo(updatedVideo);
    return updatedVideo;
  }

  async function handleSaveDraft() {
    if (!video || !draft) return;

    try {
      await persistDraft(video, draft);
      setSaveState("saved");
      setSaveMessage("Draft saved to your account.");
    } catch (error) {
      setSaveState("failed");
      setSaveMessage(getErrorMessage(error, "Could not save this draft."));
    }
  }

  async function handleRenderVideo() {
    if (!video?.videoUrl) {
      setRenderState("failed");
      setRenderMessage("A source video is required before rendering.");
      return;
    }

    const draftForRender = getDraftForRender(video, draft);
    setRenderState("starting");
    setRenderMessage("Preparing MP4 export…");

    try {
      await persistDraft(video, draftForRender);
      setSaveState("saved");
      setSaveMessage("Draft saved for render.");
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
        throw new Error(data.ok ? "Could not start render." : data.error);
      }

      setRenderState("rendering");
      setRenderMessage("Exporting final MP4. This can take a minute.");
      const output = await pollEditedVideoRender(data.jobId, idToken);

      if (!output.url) throw new Error("Render finished without a video URL.");

      setVideo((current) =>
        current
          ? { ...current, renderedVideoUrl: output.url, status: "rendered" }
          : current,
      );
      setRenderState("rendered");
      setRenderMessage("MP4 export is ready and saved in User videos.");
    } catch (error) {
      console.error("Edited video render failed:", error);
      setRenderState("failed");
      setRenderMessage(getErrorMessage(error, "Edited video render failed."));
    }
  }

  const isRendering = renderState === "starting" || renderState === "rendering";

  return (
    <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <EditorTopBar
        canSaveDraft={Boolean(video && draft)}
        canRender={Boolean(video?.videoUrl) && !isRendering}
        renderState={renderState}
        saveState={saveState}
        video={video}
        onRenderVideo={() => void handleRenderVideo()}
        onSaveDraft={() => void handleSaveDraft()}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col pt-5">
        {saveMessage ? (
          <p
            role={saveState === "failed" ? "alert" : "status"}
            className="mb-4 w-fit rounded-control border border-border bg-card px-3 py-2 text-xs font-semibold text-muted"
          >
            {saveMessage}
          </p>
        ) : null}

        {renderMessage || video?.renderedVideoUrl ? (
          <RenderStatusNotice
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
  canSaveDraft,
  canRender,
  onSaveDraft,
  onRenderVideo,
  renderState,
  saveState,
  video,
}: {
  canSaveDraft: boolean;
  canRender: boolean;
  onSaveDraft: () => void;
  onRenderVideo: () => void;
  renderState: RenderState;
  saveState: "idle" | "saved" | "failed";
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
        <button type="button" onClick={onSaveDraft} disabled={!canSaveDraft} className={buttonClassName({ variant: "secondary", className: "gap-2" })}>
          <Save className="size-4" aria-hidden="true" />
          {saveState === "saved" ? "Saved" : "Save draft"}
        </button>
        <button type="button" onClick={onRenderVideo} disabled={!canRender} className={buttonClassName({ variant: "primary", className: "gap-2" })}>
          {renderState === "starting" || renderState === "rendering" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
          {getRenderButtonLabel(renderState, video)}
        </button>
      </div>
    </header>
  );
}

function RenderStatusNotice({ renderedVideoUrl, renderMessage, renderState }: { renderedVideoUrl: string | null; renderMessage: string | null; renderState: RenderState }) {
  const isFailed = renderState === "failed";
  return (
    <div role={isFailed ? "alert" : "status"} className={isFailed ? "mb-4 rounded-card border border-error/20 bg-error/5 px-4 py-3 text-sm font-semibold text-error" : "mb-4 rounded-card border border-border bg-card px-4 py-3 text-sm font-semibold text-muted"}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{renderMessage ?? "MP4 export is ready."}</span>
        {renderedVideoUrl ? <a href={renderedVideoUrl} target="_blank" rel="noreferrer" className={buttonClassName({ variant: "primary", className: "h-9 w-fit px-3 text-xs" })}>Open MP4</a> : null}
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

function getRenderButtonLabel(renderState: RenderState, video: EditableVideo | null) {
  if (renderState === "starting") return "Preparing export…";
  if (renderState === "rendering") return "Exporting…";
  if (renderState === "rendered" || video?.renderedVideoUrl) return "Export again";
  return "Export MP4";
}

async function pollEditedVideoRender(jobId: string, idToken: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(attempt === 0 ? 900 : 2_500);
    const response = await fetch(`/api/edit/render/status?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store", headers: { Authorization: `Bearer ${idToken}` } });
    const data = (await response.json()) as RenderStatusResponse;
    if (!response.ok || !data.ok) throw new Error(data.ok ? "Render status unavailable." : data.error);
    if (data.run.status === "COMPLETED" && data.run.output?.url) return data.run.output;
    if (data.run.isTerminal) throw new Error(data.run.error ?? "Edited video render failed.");
  }
  throw new Error("Edited video render timed out.");
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

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
