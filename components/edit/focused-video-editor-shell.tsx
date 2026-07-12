"use client";

import {
  AlertCircle,
  ArrowLeft,
  Download,
  Loader2,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import {
  FocusedVideoEditor,
  type FocusedVideoEditorDraftState,
} from "@/components/edit/focused-video-editor";
import {
  getEditableVideoById,
  listenToEditableVideoLibrary,
  saveEditableVideoDraft,
  saveRenderedEditableVideo,
  type EditableVideo,
} from "@/lib/edit/video-library";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type RenderState = "idle" | "starting" | "rendering" | "rendered" | "failed";

type RenderStartResponse =
  | {
      backend?: "aws";
      jobId: string;
      ok: true;
      message: string;
      renderId: string;
      sourceVideoId: string;
    }
  | {
      ok: false;
      error: string;
    };

type RenderStatusResponse =
  | {
      ok: true;
      run: {
        error: string | null;
        id: string;
        isTerminal: boolean;
        output: {
          key: string | null;
          ok: boolean;
          renderId: string | null;
          sourceVideoId: string | null;
          url: string | null;
        } | null;
        status: string;
        taskIdentifier: string;
      };
    }
  | {
      ok: false;
      error: string;
    };

export function FocusedVideoEditorShell({
  videoId,
}: {
  videoId: string;
}) {
  const video = useSyncExternalStore(
    subscribeToEditableVideoLibrary,
    () => getEditableVideoById(videoId),
    getNoEditableVideo,
  );
  const [draft, setDraft] = useState<FocusedVideoEditorDraftState | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">(
    "idle",
  );
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [renderMessage, setRenderMessage] = useState<string | null>(null);

  const isRendering =
    renderState === "starting" || renderState === "rendering";

  function handleSaveDraft() {
    if (!video || !draft) {
      return;
    }

    const updatedVideo = saveEditableVideoDraft(video.id, draft);

    if (!updatedVideo) {
      setSaveState("failed");
      setSaveMessage("Could not save this draft. The video is no longer in the library.");
      return;
    }

    setSaveState("saved");
    setSaveMessage("Draft saved.");
  }

  async function handleRenderVideo() {
    if (!video?.videoUrl) {
      setRenderState("failed");
      setRenderMessage("A source video is required before rendering.");
      return;
    }

    const draftForRender = getDraftForRender(video, draft);
    const idToken = await getCurrentUserIdToken();

    if (!idToken) {
      setRenderState("failed");
      setRenderMessage("Sign in again before rendering this video.");
      return;
    }

    saveEditableVideoDraft(video.id, draftForRender);
    setSaveState("saved");
    setSaveMessage("Draft saved for render.");
    setRenderState("starting");
    setRenderMessage("Starting MP4 render...");

    try {
      const response = await fetch("/api/edit/render", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          durationSeconds: video.durationSeconds,
          projectId: video.projectId,
          source: video.source,
          sourceVideoId: video.id,
          sourceVideoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          title: video.title,
          ratio: video.ratio,
          draft: draftForRender,
        }),
      });
      const data = (await response.json()) as RenderStartResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.ok ? "Could not start render." : data.error,
        );
      }

      setRenderState("rendering");
      setRenderMessage("Rendering final MP4. This can take a minute.");

      const output = await pollEditedVideoRender(data.jobId, idToken);

      if (!output.url) {
        throw new Error("Render finished without a video URL.");
      }

      const updatedVideo = saveRenderedEditableVideo(video.id, output.url);

      if (!updatedVideo) {
        throw new Error("Rendered video could not be saved locally.");
      }

      setRenderState("rendered");
      setRenderMessage("Rendered MP4 is ready.");
    } catch (error) {
      console.error("Edited video render failed:", error);
      setRenderState("failed");
      setRenderMessage(
        error instanceof Error
          ? error.message
          : "Edited video render failed. Please try again.",
      );
    }
  }

  return (
    <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <EditorTopBar
        canSaveDraft={Boolean(video && draft)}
        canRender={Boolean(video?.videoUrl) && !isRendering}
        renderState={renderState}
        saveState={saveState}
        video={video}
        onRenderVideo={handleRenderVideo}
        onSaveDraft={handleSaveDraft}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col pt-5">
        {saveMessage ? (
          <p
            role={saveState === "failed" ? "alert" : "status"}
            className="mb-4 w-fit rounded-full border border-border bg-white/85 px-3 py-2 text-xs font-semibold text-[#405977] shadow-sm"
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

        {video ? (
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
        <Link
          href="/edit"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#405977] transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Edit
        </Link>
        <h1 className="mt-2 truncate text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
          {video ? video.title : "Video not found"}
        </h1>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={!canSaveDraft}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-bold text-[#173454] shadow-sm transition hover:bg-[#fff8f4] disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60"
        >
          <Save className="size-4" aria-hidden="true" />
          {saveState === "saved" ? "Saved" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={onRenderVideo}
          disabled={!canRender}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.20)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {renderState === "starting" || renderState === "rendering" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {getRenderButtonLabel(renderState, video)}
        </button>
      </div>
    </header>
  );
}

function RenderStatusNotice({
  renderedVideoUrl,
  renderMessage,
  renderState,
}: {
  renderedVideoUrl: string | null;
  renderMessage: string | null;
  renderState: RenderState;
}) {
  const isFailed = renderState === "failed";

  return (
    <div
      role={isFailed ? "alert" : "status"}
      className={
        isFailed
          ? "mb-4 rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm font-semibold text-error"
          : "mb-4 rounded-2xl border border-border bg-white/85 px-4 py-3 text-sm font-semibold text-[#405977] shadow-sm"
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{renderMessage ?? "Rendered MP4 is ready."}</span>
        {renderedVideoUrl ? (
          <a
            href={renderedVideoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-fit items-center justify-center rounded-full bg-[#173454] px-4 text-xs font-bold text-white transition hover:bg-foreground"
          >
            Open MP4
          </a>
        ) : null}
      </div>
    </div>
  );
}

function VideoNotFound({ videoId }: { videoId: string }) {
  return (
    <section
      aria-label="Video not found"
      className="flex min-h-[420px] flex-1 items-center justify-center rounded-[28px] border border-border/70 bg-white/35 px-5 py-10 text-center"
    >
      <div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-error/20 bg-error/5 text-error shadow-sm">
          <AlertCircle className="size-6" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-foreground">
          This video is not in your edit library.
        </h2>
        <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-muted">
          No editable video exists for ID {videoId}. Generate a video or upload a
          demo, then open it from the Edit library.
        </p>
        <Link
          href="/edit"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.20)] transition hover:bg-primary-hover"
        >
          Back to library
        </Link>
      </div>
    </section>
  );
}

function subscribeToEditableVideoLibrary(onStoreChange: () => void) {
  return listenToEditableVideoLibrary(() => {
    onStoreChange();
  });
}

function getNoEditableVideo() {
  return null;
}

function getDraftForRender(
  video: EditableVideo,
  draft: FocusedVideoEditorDraftState | null,
): FocusedVideoEditorDraftState {
  if (draft) {
    return draft;
  }

  if (video.draft) {
    return {
      textOverlays: video.draft.textOverlays,
      trimEndSeconds: video.draft.trimEndSeconds,
      trimStartSeconds: video.draft.trimStartSeconds,
    };
  }

  return {
    textOverlays: [],
    trimEndSeconds: null,
    trimStartSeconds: 0,
  };
}

function getRenderButtonLabel(renderState: RenderState, video: EditableVideo | null) {
  if (renderState === "starting") {
    return "Starting";
  }

  if (renderState === "rendering") {
    return "Rendering";
  }

  if (renderState === "rendered" || video?.renderedVideoUrl) {
    return "Render again";
  }

  return "Render MP4";
}

async function pollEditedVideoRender(
  jobId: string,
  idToken: string,
) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(attempt === 0 ? 900 : 2_500);

    const response = await fetch(
      `/api/edit/render/status?jobId=${encodeURIComponent(jobId)}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      },
    );
    const data = (await response.json()) as RenderStatusResponse;

    if (!response.ok || !data.ok) {
      throw new Error(
        data.ok ? "Render status unavailable." : data.error,
      );
    }

    if (data.run.status === "COMPLETED" && data.run.output?.url) {
      return data.run.output;
    }

    if (data.run.isTerminal) {
      throw new Error(data.run.error ?? "Edited video render failed.");
    }
  }

  throw new Error("Edited video render timed out.");
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
