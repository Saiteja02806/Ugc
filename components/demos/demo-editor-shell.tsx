"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
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
  type FocusedVideoEditorDetail,
  type FocusedVideoEditorDraftState,
} from "@/components/edit/focused-video-editor";
import {
  formatVideoDuration,
  type EditableVideo,
  type EditableVideoDraft,
  type EditableVideoDraftInput,
  type EditableVideoRatio,
  type EditableVideoStatus,
  type TextOverlay,
  type TextOverlayPosition,
  type TextOverlayStyle,
} from "@/lib/edit/video-library";
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

export function DemoEditorShell({ demoId }: { demoId: string }) {
  const router = useRouter();
  const [demo, setDemo] = useState<DemoVideo | null>(null);
  const [draft, setDraft] = useState<FocusedVideoEditorDraftState | null>(null);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [title, setTitle] = useState("");

  const editableVideo = useMemo(
    () => (demo ? mapDemoToEditableVideo(demo) : null),
    [demo],
  );
  const editorDetails = useMemo(
    () => (demo ? getDemoEditorDetails(demo) : []),
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

    router.push("/demos");
  }

  function handleLeaveWithoutSaving() {
    setShowLeaveDialog(false);
    router.push("/demos");
  }

  function handleDiscardChanges() {
    if (!demo) {
      return;
    }

    setTitle(demo.title);
    setDraft(null);
    setEditorResetKey((current) => current + 1);
    setSaveState("idle");
    setSaveMessage(null);
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
    setSaveMessage("Saving draft...");

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in again before saving this draft.");
      }

      const response = await fetch(`/api/demo/${encodeURIComponent(demo.id)}`, {
        body: JSON.stringify({
          draft: normalizeDraftForSave(draft),
          projectId: demo.project_id,
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
      setSaveState("saved");
      setSaveMessage("Draft saved to your demo library.");
    } catch (error) {
      setSaveState("failed");
      setSaveMessage(getErrorMessage(error, "Could not save this draft."));
    }
  }

  return (
    <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <DemoEditorTopBar
        canSave={canSave}
        demo={demo}
        hasTitleChanged={hasTitleChanged}
        saveState={saveState}
        title={title}
        onBackToDemos={handleBackToDemos}
        onRefresh={() => void loadDemo()}
        onSaveDraft={() => void handleSaveDraft()}
        onTitleChange={handleTitleChange}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col pt-5">
        {isLoading ? (
          <EditorLoadingState />
        ) : errorMessage ? (
          <EditorErrorState message={errorMessage} onRetry={() => void loadDemo()} />
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
            details={editorDetails}
            video={editableVideo}
            onDraftChange={handleDraftChange}
          />
        ) : (
          <EditorErrorState
            message="This demo video could not be opened."
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
  canSave,
  demo,
  hasTitleChanged,
  onBackToDemos,
  onRefresh,
  onSaveDraft,
  onTitleChange,
  saveState,
  title,
}: {
  canSave: boolean;
  demo: DemoVideo | null;
  hasTitleChanged: boolean;
  onBackToDemos: () => void;
  onRefresh: () => void;
  onSaveDraft: () => void;
  onTitleChange: (title: string) => void;
  saveState: SaveState;
  title: string;
}) {
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 border-b border-border/70 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onBackToDemos}
          className="inline-flex h-9 items-center gap-2 rounded-md px-1 text-sm font-semibold text-muted transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Demos
        </button>

        <div className="mt-2 flex max-w-2xl flex-col gap-2">
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
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-0 py-1 text-2xl font-semibold tracking-normal text-foreground-strong outline-none transition placeholder:text-muted focus:border-border focus:bg-white focus:px-3 sm:text-3xl"
              placeholder="Untitled demo"
            />
            <Pencil className="size-4 shrink-0 text-muted-subtle transition group-focus-within:text-primary" aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
            <span className="rounded-md border border-border bg-white px-2.5 py-1">
              {demo ? getFileTypeLabel(demo.file_type) : "Video"}
            </span>
            <span className="rounded-md border border-border bg-white px-2.5 py-1">
              {demo ? getDemoRatioLabel(demo) : "Ratio"}
            </span>
            <span className="rounded-md border border-border bg-white px-2.5 py-1">
              {demo ? formatVideoDuration(demo.duration_seconds) : "Duration"}
            </span>
            {hasTitleChanged ? (
              <span className="rounded-md bg-primary/10 px-2.5 py-1 text-primary">
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
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold text-[#173454] transition hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
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
    <div className="rounded-panel border border-border bg-card p-3 shadow-sm">
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
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-semibold text-[#173454] transition hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            ? "Saving..."
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
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-semibold text-[#173454] transition hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
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
    <section className="flex min-h-[520px] flex-1 items-center justify-center rounded-[28px] border border-border/70 bg-white/35 px-5 py-10">
      <div className="flex items-center gap-3 text-sm font-semibold text-muted">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        Loading demo editor...
      </div>
    </section>
  );
}

function EditorErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="flex min-h-[520px] flex-1 items-center justify-center rounded-[28px] border border-border/70 bg-white/35 px-5 py-10 text-center">
      <div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-error/20 bg-error/5 text-error shadow-sm">
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
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-bold text-[#173454] shadow-sm transition hover:bg-[#fff8f4]"
          >
            Retry
          </button>
          <Link
            href="/demos"
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.20)] transition hover:bg-primary-hover"
          >
            Back to demos
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

  return {
    textOverlay: normalizeTextOverlay(value.textOverlay),
    trimEndSeconds: normalizeNullableNumber(value.trimEndSeconds),
    trimStartSeconds: normalizeNumber(value.trimStartSeconds) ?? 0,
    updatedAt,
  };
}

function normalizeDraftForSave(
  draft: EditableVideoDraftInput,
): EditableVideoDraftInput {
  return {
    textOverlay: normalizeTextOverlay(draft.textOverlay),
    trimEndSeconds: normalizeNullableNumber(draft.trimEndSeconds),
    trimStartSeconds: normalizeNumber(draft.trimStartSeconds) ?? 0,
  };
}

function getSavedDraftInput(demo: DemoVideo): EditableVideoDraftInput {
  const savedDraft = normalizeDemoDraft(demo.draft_json, demo.updated_at);

  if (savedDraft) {
    return normalizeDraftForSave(savedDraft);
  }

  return {
    textOverlay: {
      position: "bottom",
      style: "bubble",
      text: "",
    },
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
    first.textOverlay.text === second.textOverlay.text &&
    first.textOverlay.position === second.textOverlay.position &&
    first.textOverlay.style === second.textOverlay.style
  );
}

function getDemoEditorDetails(demo: DemoVideo): FocusedVideoEditorDetail[] {
  return [
    { label: "File type", value: getFileTypeLabel(demo.file_type) },
    { label: "Aspect ratio", value: getDemoRatioLabel(demo) },
    { label: "Duration", value: formatVideoDuration(demo.duration_seconds) },
    { label: "Status", value: getDemoStatusLabel(demo.status) },
  ];
}

function normalizeTextOverlay(value: unknown): TextOverlay {
  if (!value || typeof value !== "object") {
    return {
      position: "bottom",
      style: "bubble",
      text: "",
    };
  }

  const record = value as Record<string, unknown>;

  return {
    position: normalizeTextOverlayPosition(record.position) ?? "bottom",
    style: normalizeTextOverlayStyle(record.style) ?? "bubble",
    text: normalizeString(record.text) ?? "",
  };
}

function normalizeTextOverlayPosition(
  value: unknown,
): TextOverlayPosition | null {
  return value === "top" || value === "middle" || value === "bottom"
    ? value
    : null;
}

function normalizeTextOverlayStyle(value: unknown): TextOverlayStyle | null {
  return value === "clean" || value === "bubble" ? value : null;
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizeNullableNumber(value: unknown) {
  return value === null || value === undefined ? null : normalizeNumber(value);
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
