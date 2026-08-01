"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  FocusedVideoEditor,
  type FocusedVideoEditorDraftState,
} from "@/components/edit/focused-video-editor";
import {
  formatVideoDuration,
  normalizeEditableVideoDraftInput,
  type EditableVideo,
  type EditableVideoDraft,
  type EditableVideoDraftInput,
  type EditableVideoRatio,
  type EditableVideoStatus,
} from "@/lib/edit/video-library";
import { CONTENT_REELS_HREF } from "@/lib/edit/routes";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

const DEFAULT_PROJECT_ID = "test-project-001";

type DemoRatio = "9:16" | "1:1" | "4:5" | "16:9" | "other";
type DemoStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "draft"
  | "rendering"
  | "rendered"
  | "failed";

type DemoVideo = {
  created_at: string;
  deleted_at: string | null;
  draft_json: Record<string, unknown>;
  duration_seconds: number | null;
  error_message: string | null;
  file_name: string;
  file_size_bytes: number;
  file_type: "video/mp4" | "video/quicktime" | "video/webm";
  height: number | null;
  id: string;
  latest_render_id: string | null;
  project_id: string;
  ratio: DemoRatio;
  rendered_video_url: string | null;
  source_s3_key: string;
  source_video_url: string;
  status: DemoStatus;
  thumbnail_url: string | null;
  title: string;
  updated_at: string;
  user_id: string;
  width: number | null;
};

type DemoDetailResponse =
  | {
      demo: DemoVideo;
      ok: true;
    }
  | {
      error?: string;
      ok?: false;
    };

type SaveState = "idle" | "saving" | "saved" | "failed";
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
        output: { renderId: string | null; url: string | null } | null;
        status: string;
      };
    }
  | { error: string; ok: false };

export function DemoEditorShell({
  demoId,
  returnHref = CONTENT_REELS_HREF,
  returnLabel = "Back to Content",
}: {
  demoId: string;
  returnHref?: string;
  returnLabel?: string;
}) {
  const router = useRouter();
  const [demo, setDemo] = useState<DemoVideo | null>(null);
  const [draft, setDraft] = useState<FocusedVideoEditorDraftState | null>(null);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [renderMessage, setRenderMessage] = useState<string | null>(null);
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [title, setTitle] = useState("");

  const editableVideo = useMemo(
    () => (demo ? mapDemoToEditableVideo(demo) : null),
    [demo],
  );
  const hasTitleChanged = Boolean(demo && title.trim() !== demo.title);
  const hasDraftChanged = Boolean(
    demo &&
      draft &&
      !areDraftInputsEqual(normalizeDraftForSave(draft), getSavedDraftInput(demo)),
  );
  const hasUnsavedChanges = hasTitleChanged || hasDraftChanged;
  const canSave = Boolean(
    demo && draft && hasUnsavedChanges && saveState !== "saving",
  );
  const isRendering = renderState === "starting" || renderState === "rendering";
  const canRender = Boolean(demo?.source_video_url) && !isRendering && saveState !== "saving";

  const loadDemo = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before editing demo videos.");
      }

      const response = await fetch(
        `/api/demo/${encodeURIComponent(demoId)}?projectId=${encodeURIComponent(
          DEFAULT_PROJECT_ID,
        )}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = (await response.json()) as DemoDetailResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiErrorMessage(data, "Could not load this demo."));
      }

      setDemo(data.demo);
      setTitle(data.demo.title);
      setDraft(null);
      setEditorResetKey((current) => current + 1);
      setRenderState(data.demo.rendered_video_url ? "rendered" : "idle");
      setRenderMessage(null);
      setSaveState("idle");
      setSaveMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not load this demo."));
    } finally {
      setIsLoading(false);
    }
  }, [demoId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDemo();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDemo]);

  function handleDraftChange(nextDraft: FocusedVideoEditorDraftState) {
    setDraft(nextDraft);

    if (saveState === "saved") {
      setSaveState("idle");
      setSaveMessage(null);
    }

    if (renderState === "rendered") {
      setRenderState("idle");
      setRenderMessage(null);
    }
  }

  function handleTitleChange(nextTitle: string) {
    setTitle(nextTitle);

    if (saveState === "saved") {
      setSaveState("idle");
      setSaveMessage(null);
    }
  }

  function handleBackToDemos() {
    if (hasUnsavedChanges) {
      setShowLeaveDialog(true);
      return;
    }

    router.push(returnHref);
  }

  function handleLeaveWithoutSaving() {
    setShowLeaveDialog(false);
    router.push(returnHref);
  }

  function handleDiscardChanges() {
    if (!demo) {
      return;
    }

    setTitle(demo.title);
    setDraft(null);
    setEditorResetKey((current) => current + 1);
    setRenderState(demo.rendered_video_url ? "rendered" : "idle");
    setRenderMessage(null);
    setSaveState("idle");
    setSaveMessage(null);
  }

  async function persistDemoDraft(
    currentDemo: DemoVideo,
    draftForSave: FocusedVideoEditorDraftState,
  ) {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      throw new Error("Demo title cannot be empty.");
    }

    const token = await getCurrentUserIdToken();

    if (!token) {
      throw new Error("Sign in again before saving this draft.");
    }

    const response = await fetch(`/api/demo/${encodeURIComponent(currentDemo.id)}`, {
      body: JSON.stringify({
        draft: normalizeDraftForSave(draftForSave),
        projectId: currentDemo.project_id,
        status: "draft",
        title: cleanTitle,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
    const data = (await response.json()) as DemoDetailResponse;

    if (!response.ok || data.ok !== true) {
      throw new Error(getApiErrorMessage(data, "Could not save this draft."));
    }

    setDemo(data.demo);
    setTitle(data.demo.title);

    return {
      demo: data.demo,
      token,
    };
  }

  async function handleSaveDraft() {
    if (!demo || !draft || saveState === "saving") {
      return;
    }

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setSaveState("failed");
      setSaveMessage("Demo title cannot be empty.");
      return;
    }

    setSaveState("saving");
    setSaveMessage("Saving draft…");

    try {
      await persistDemoDraft(demo, draft);
      setSaveState("saved");
      setSaveMessage("Draft saved to your demo library.");
    } catch (error) {
      setSaveState("failed");
      setSaveMessage(getErrorMessage(error, "Could not save this draft."));
    }
  }

  async function handleRenderDemo() {
    if (!demo || isRendering) {
      return;
    }

    const draftForRender = normalizeDraftForSave(draft ?? getSavedDraftInput(demo));
    setRenderState("starting");
    setRenderMessage("Preparing demo MP4 export…");

    try {
      const saved = await persistDemoDraft(demo, draftForRender);

      setSaveState("saved");
      setSaveMessage("Draft saved for export.");

      const response = await fetch("/api/edit/render", {
        body: JSON.stringify({
          draft: draftForRender,
          durationSeconds: saved.demo.duration_seconds,
          projectId: saved.demo.project_id,
          ratio: mapDemoRatioToEditableRatio(saved.demo),
          source: "demo",
          sourceVideoId: saved.demo.id,
          sourceVideoUrl: saved.demo.source_video_url,
          thumbnailUrl: saved.demo.thumbnail_url,
          title: saved.demo.title,
        }),
        headers: {
          Authorization: `Bearer ${saved.token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as RenderStartResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(data.ok ? "Could not start demo export." : data.error);
      }

      setRenderState("rendering");
      setRenderMessage("Exporting demo MP4. This can take a minute.");
      const output = await pollDemoRender(data.jobId, saved.token);

      if (!output.url) {
        throw new Error("Demo export finished without a video URL.");
      }

      setDemo((current) =>
        current
          ? {
              ...current,
              latest_render_id: output.renderId,
              rendered_video_url: output.url,
              status: "rendered",
            }
          : current,
      );
      setRenderState("rendered");
      setRenderMessage("Demo MP4 export is ready for Scheduling.");
    } catch (error) {
      setRenderState("failed");
      setRenderMessage(getErrorMessage(error, "Demo export failed."));
    }
  }

  return (
    <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-5 text-foreground sm:px-6 lg:px-10 lg:py-8">
      <DemoEditorTopBar
        canSave={canSave}
        canRender={canRender}
        demo={demo}
        hasTitleChanged={hasTitleChanged}
        renderState={renderState}
        returnLabel={returnLabel}
        saveState={saveState}
        title={title}
        onBackToDemos={handleBackToDemos}
        onRenderDemo={() => void handleRenderDemo()}
        onRefresh={() => void loadDemo()}
        onSaveDraft={() => void handleSaveDraft()}
        onTitleChange={handleTitleChange}
      />

      <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col pb-8 pt-4">
        {renderMessage || demo?.rendered_video_url ? (
          <DemoRenderStatusNotice
            renderedVideoUrl={demo?.rendered_video_url ?? null}
            renderMessage={renderMessage}
            renderState={renderState}
          />
        ) : null}

        {isLoading ? (
          <EditorLoadingState />
        ) : errorMessage ? (
          <EditorErrorState
            message={errorMessage}
            returnHref={returnHref}
            returnLabel={returnLabel}
            onRetry={() => void loadDemo()}
          />
        ) : editableVideo ? (
          <FocusedVideoEditor
            key={`${editableVideo.id}-${editorResetKey}`}
            actionFooter={
              <DemoEditorActionFooter
                canDiscard={hasUnsavedChanges && saveState !== "saving"}
                canSave={canSave}
                message={saveMessage}
                saveState={saveState}
                onDiscard={handleDiscardChanges}
                onSaveDraft={() => void handleSaveDraft()}
              />
            }
            video={editableVideo}
            onDraftChange={handleDraftChange}
          />
        ) : (
          <EditorErrorState
            message="This demo video could not be opened."
            returnHref={returnHref}
            returnLabel={returnLabel}
            onRetry={() => void loadDemo()}
          />
        )}
      </div>

      {showLeaveDialog ? (
        <UnsavedChangesDialog
          onLeave={handleLeaveWithoutSaving}
          onStay={() => setShowLeaveDialog(false)}
        />
      ) : null}
    </section>
  );
}

function DemoEditorTopBar({
  canRender,
  canSave,
  demo,
  hasTitleChanged,
  onBackToDemos,
  onRenderDemo,
  onRefresh,
  onSaveDraft,
  onTitleChange,
  renderState,
  returnLabel,
  saveState,
  title,
}: {
  canRender: boolean;
  canSave: boolean;
  demo: DemoVideo | null;
  hasTitleChanged: boolean;
  onBackToDemos: () => void;
  onRenderDemo: () => void;
  onRefresh: () => void;
  onSaveDraft: () => void;
  onTitleChange: (title: string) => void;
  renderState: RenderState;
  returnLabel: string;
  saveState: SaveState;
  title: string;
}) {
  return (
    <header className="mx-auto flex w-full max-w-[1360px] flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onBackToDemos}
          className="inline-flex h-8 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {returnLabel}
        </button>

        <div className="mt-2 flex max-w-3xl flex-col gap-2">
          <div className="group flex max-w-2xl items-center gap-2">
            <label className="sr-only" htmlFor="demo-title">
              Demo title
            </label>
            <input
              id="demo-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              disabled={!demo}
              maxLength={140}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-0 py-1 text-xl font-semibold text-foreground-strong outline-none transition-[border-color,background-color,padding] placeholder:text-muted focus:border-border focus:bg-background focus:px-3 focus-visible:ring-2 focus-visible:ring-focus sm:text-2xl"
              placeholder="Untitled demo"
            />
            <Pencil className="size-4 shrink-0 text-muted-subtle transition group-focus-within:text-primary" aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center gap-y-1 text-xs font-medium text-muted">
            <span className="border-r border-border pr-3">
              {demo ? getFileTypeLabel(demo.file_type) : "Video"}
            </span>
            <span className="border-r border-border px-3">
              {demo ? getDemoRatioLabel(demo) : "Ratio"}
            </span>
            <span className="border-r border-border px-3">
              {demo ? formatVideoDuration(demo.duration_seconds) : "Duration"}
            </span>
            <span className="px-3">
              {demo ? getDemoStatusLabel(demo.status) : "Status"}
            </span>
            {hasTitleChanged ? (
              <span className="ml-2 rounded-full bg-brand-soft px-2.5 py-1 font-semibold text-primary">
                Unsaved title
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </button>
        <button
          type="button"
          onClick={onRenderDemo}
          disabled={!canRender}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {renderState === "starting" || renderState === "rendering" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {getRenderButtonLabel(renderState, demo)}
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={!canSave}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveState === "saving" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : saveState === "saved" ? (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {saveState === "saving"
            ? "Saving"
            : saveState === "saved"
              ? "Saved"
              : "Save draft"}
        </button>
      </div>
    </header>
  );
}

function DemoRenderStatusNotice({
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
      className={cn(
        "mb-4 rounded-md border px-4 py-3 text-sm font-semibold",
        isFailed
          ? "border-error/20 bg-error/5 text-error"
          : "border-border bg-card-muted text-muted",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{renderMessage ?? "Demo MP4 export is ready for Scheduling."}</span>
        {renderedVideoUrl ? (
          <a
            href={renderedVideoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-fit items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Open MP4
          </a>
        ) : null}
      </div>
    </div>
  );
}

function DemoEditorActionFooter({
  canDiscard,
  canSave,
  message,
  onDiscard,
  onSaveDraft,
  saveState,
}: {
  canDiscard: boolean;
  canSave: boolean;
  message: string | null;
  onDiscard: () => void;
  onSaveDraft: () => void;
  saveState: SaveState;
}) {
  const failed = saveState === "failed";

  return (
    <div>
      {message ? (
        <div
          role={failed ? "alert" : "status"}
          className={cn(
            "mb-3 rounded-md border px-3 py-2 text-xs font-semibold",
            failed
              ? "border-error/20 bg-error/5 text-error"
              : "border-border bg-card-muted text-muted",
          )}
        >
          {message}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onDiscard}
          disabled={!canDiscard}
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Discard changes
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={!canSave}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveState === "saving" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : saveState === "saved" ? (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : "Save draft"}
        </button>
      </div>
    </div>
  );
}

function UnsavedChangesDialog({
  onLeave,
  onStay,
}: {
  onLeave: () => void;
  onStay: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/45 px-4"
      role="presentation"
    >
      <section
        aria-labelledby="unsaved-demo-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-panel bg-card p-5 shadow-floating"
        role="dialog"
      >
        <h2 id="unsaved-demo-title" className="text-base font-semibold text-foreground-strong">
          You have unsaved changes.
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Leaving now will discard the edits you made to this demo draft.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Stay here
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Leave without saving
          </button>
        </div>
      </section>
    </div>
  );
}

function EditorLoadingState() {
  return (
    <section className="grid min-h-[560px] flex-1 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[344px_minmax(0,1fr)]">
      <div className="border-b border-border bg-[#f5f5f6] p-6 lg:border-b-0 lg:border-r">
        <div className="mx-auto aspect-[9/16] w-full max-w-[280px] animate-pulse rounded-md bg-[#dedfe2] motion-reduce:animate-none" />
      </div>
      <div className="space-y-8 p-6">
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-[#dedfe2] motion-reduce:animate-none" />
          <div className="h-16 animate-pulse rounded-md bg-[#eff0f1] motion-reduce:animate-none" />
          <div className="h-10 animate-pulse rounded-md bg-[#eff0f1] motion-reduce:animate-none" />
        </div>
        <div className="space-y-3 border-t border-border pt-6">
          <div className="h-4 w-32 animate-pulse rounded bg-[#dedfe2] motion-reduce:animate-none" />
          <div className="h-20 animate-pulse rounded-md bg-[#eff0f1] motion-reduce:animate-none" />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          Loading editor
        </div>
      </div>
    </section>
  );
}

function EditorErrorState({
  message,
  onRetry,
  returnHref,
  returnLabel,
}: {
  message: string;
  onRetry: () => void;
  returnHref: string;
  returnLabel: string;
}) {
  return (
    <section className="flex min-h-[520px] flex-1 items-center justify-center rounded-lg border border-border bg-card px-5 py-10 text-center">
      <div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-error/10 text-error">
          <AlertCircle className="size-6" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-foreground">
          Could not open demo
        </h2>
        <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-muted">
          {message}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted"
          >
            Retry
          </button>
          <Link
            href={returnHref}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {returnLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

function mapDemoToEditableVideo(demo: DemoVideo): EditableVideo {
  return {
    createdAt: demo.created_at,
    draft: normalizeDemoDraft(demo.draft_json, demo.updated_at),
    durationSeconds: demo.duration_seconds,
    id: demo.id,
    projectId: demo.project_id,
    ratio: mapDemoRatioToEditableRatio(demo),
    renderedVideoUrl: demo.rendered_video_url,
    source: "demo",
    status: mapDemoStatusToEditableStatus(demo.status),
    thumbnailUrl: demo.thumbnail_url,
    title: demo.title,
    videoUrl: demo.source_video_url,
  };
}

function normalizeDemoDraft(
  value: Record<string, unknown> | null | undefined,
  updatedAt: string,
): EditableVideoDraft | null {
  if (!value || Object.keys(value).length === 0) {
    return null;
  }

  const draft = normalizeEditableVideoDraftInput(value);

  if (!draft) {
    return null;
  }

  return {
    ...draft,
    updatedAt,
  };
}

function normalizeDraftForSave(
  draft: EditableVideoDraftInput,
): EditableVideoDraftInput {
  return (
    normalizeEditableVideoDraftInput(draft) ?? {
      textOverlays: [],
      trimEndSeconds: null,
      trimStartSeconds: 0,
    }
  );
}

function getSavedDraftInput(demo: DemoVideo): EditableVideoDraftInput {
  const savedDraft = normalizeDemoDraft(demo.draft_json, demo.updated_at);

  if (savedDraft) {
    return normalizeDraftForSave(savedDraft);
  }

  return {
    textOverlays: [],
    trimEndSeconds: demo.duration_seconds,
    trimStartSeconds: 0,
  };
}

function areDraftInputsEqual(
  first: EditableVideoDraftInput,
  second: EditableVideoDraftInput,
) {
  return (
    first.trimStartSeconds === second.trimStartSeconds &&
    first.trimEndSeconds === second.trimEndSeconds &&
    areTextOverlaysEqual(first.textOverlays, second.textOverlays)
  );
}

function areTextOverlaysEqual(
  first: EditableVideoDraftInput["textOverlays"],
  second: EditableVideoDraftInput["textOverlays"],
) {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((overlay, index) => {
    const otherOverlay = second[index];

    return (
      otherOverlay &&
      overlay.position === otherOverlay.position &&
      overlay.style === otherOverlay.style &&
      overlay.text === otherOverlay.text
    );
  });
}

function mapDemoRatioToEditableRatio(demo: DemoVideo): EditableVideoRatio {
  if (demo.ratio !== "other") {
    return demo.ratio;
  }

  if (!demo.width || !demo.height) {
    return "9:16";
  }

  const aspectRatio = demo.width / demo.height;

  if (aspectRatio > 1.35) {
    return "16:9";
  }

  if (aspectRatio > 0.9) {
    return "1:1";
  }

  if (aspectRatio > 0.68) {
    return "4:5";
  }

  return "9:16";
}

function mapDemoStatusToEditableStatus(status: DemoStatus): EditableVideoStatus {
  if (status === "rendered") {
    return "rendered";
  }

  if (status === "draft") {
    return "draft";
  }

  return "ready";
}

function getDemoRatioLabel(demo: DemoVideo) {
  return demo.ratio === "other" && demo.width && demo.height
    ? `${demo.width}x${demo.height}`
    : demo.ratio;
}

function getFileTypeLabel(contentType: DemoVideo["file_type"]) {
  const labels: Record<DemoVideo["file_type"], string> = {
    "video/mp4": "MP4",
    "video/quicktime": "MOV",
    "video/webm": "WebM",
  };

  return labels[contentType];
}

function getDemoStatusLabel(status: DemoStatus) {
  const labels: Record<DemoStatus, string> = {
    draft: "Draft",
    failed: "Failed",
    processing: "Processing",
    ready: "Ready",
    rendered: "Rendered",
    rendering: "Rendering",
    uploading: "Uploading",
  };

  return labels[status];
}

function getRenderButtonLabel(renderState: RenderState, demo: DemoVideo | null) {
  if (renderState === "starting") {
    return "Preparing";
  }

  if (renderState === "rendering") {
    return "Exporting";
  }

  if (renderState === "rendered" || demo?.rendered_video_url) {
    return "Export again";
  }

  return "Export MP4";
}

async function pollDemoRender(jobId: string, token: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(attempt === 0 ? 900 : 2_500);

    const response = await fetch(
      `/api/edit/render/status?jobId=${encodeURIComponent(jobId)}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const data = (await response.json()) as RenderStatusResponse;

    if (!response.ok || data.ok !== true) {
      throw new Error(data.ok ? "Render status unavailable." : data.error);
    }

    if (data.run.status === "COMPLETED" && data.run.output?.url) {
      return data.run.output;
    }

    if (data.run.isTerminal) {
      throw new Error(data.run.error ?? "Demo export failed.");
    }
  }

  throw new Error("Demo export timed out.");
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
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
