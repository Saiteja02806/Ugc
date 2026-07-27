"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileVideo,
  Loader2,
  Pencil,
  Play,
  RotateCcw,
  RefreshCw,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

const DEFAULT_PROJECT_ID = "test-project-001";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const DEMO_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 60;
const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
const CONTENT_TYPE_BY_EXTENSION: Record<string, DemoContentType> = {
  mov: "video/quicktime",
  mp4: "video/mp4",
  webm: "video/webm",
};
const demoPrimaryActionClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";
const demoIconActionClassName =
  "inline-flex size-11 items-center justify-center rounded-control border border-border bg-card text-muted transition-colors hover:border-border-strong hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 sm:size-10";
const demoMetricChipClassName =
  "inline-flex min-h-10 items-center rounded-control bg-surface-subtle px-3 text-xs font-semibold text-muted ring-1 ring-inset ring-border";

type DemoContentType = "video/mp4" | "video/quicktime" | "video/webm";
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
  file_type: DemoContentType;
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

type UploadState = {
  fileName: string;
  message: string;
  progress: number;
  status: "idle" | "validating" | "creating" | "uploading" | "finalizing" | "done" | "failed";
};

type VideoMetadata = {
  durationSeconds: number;
  height: number;
  ratio: DemoRatio;
  width: number;
};

type CreateUploadResponse = {
  cloudFrontUrl: string;
  demoId: string;
  key: string;
  ok: true;
  requiredHeaders: {
    "Content-Type": DemoContentType;
  };
  uploadUrl: string;
};

type ApiErrorResponse = {
  error?: string;
  ok?: false;
};

export function DemosWorkspace() {
  return <UploadedPostsTab showPageHeader />;
}

export function UploadedPostsTab({
  embeddedInLibrary = false,
  showPageHeader = false,
}: {
  embeddedInLibrary?: boolean;
  showPageHeader?: boolean;
} = {}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeUploadRequestRef = useRef<XMLHttpRequest | null>(null);
  const failedUploadFileRef = useRef<File | null>(null);
  const uploadCancelledRef = useRef(false);
  const [demos, setDemos] = useState<DemoVideo[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingDemoId, setDeletingDemoId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playingDemoId, setPlayingDemoId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    fileName: "",
    message: "",
    progress: 0,
    status: "idle",
  });

  const hasActiveUpload = [
    "validating",
    "creating",
    "uploading",
    "finalizing",
  ].includes(uploadState.status);
  const loadErrorFallback = embeddedInLibrary
    ? "Could not load uploaded posts."
    : "Could not load demo videos.";

  const loadDemos = useCallback(async () => {
    setErrorMessage(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        setDemos([]);
        return;
      }

      const response = await fetch(
        `/api/demo/list?projectId=${encodeURIComponent(DEFAULT_PROJECT_ID)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await readJsonResponse<
        { demos: DemoVideo[]; ok: true } | ApiErrorResponse
      >(response, loadErrorFallback);

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiErrorMessage(data, loadErrorFallback));
      }

      setDemos(data.demos);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, loadErrorFallback));
    } finally {
      setIsLoading(false);
    }
  }, [loadErrorFallback]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDemos();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDemos]);

  useEffect(() => {
    return () => {
      activeUploadRequestRef.current?.abort();
    };
  }, []);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFiles(files: FileList | File[]) {
    const file = Array.from(files)[0];

    if (!file || hasActiveUpload) {
      return;
    }

    await uploadDemo(file);
  }

  async function uploadDemo(file: File) {
    let token: string | null = null;
    let uploadTarget: CreateUploadResponse | null = null;

    uploadCancelledRef.current = false;
    failedUploadFileRef.current = null;
    setErrorMessage(null);
    setUploadState({
      fileName: file.name,
      message: "Checking video...",
      progress: 5,
      status: "validating",
    });

    try {
      const contentType = getSupportedContentType(file);
      const metadata = await readVideoMetadata(file);
      throwIfUploadCancelled(uploadCancelledRef.current);

      setUploadState({
        fileName: file.name,
        message: "Preparing upload...",
        progress: 14,
        status: "creating",
      });

      token = await getAuthToken();
      throwIfUploadCancelled(uploadCancelledRef.current);
      uploadTarget = await createUploadTarget({
        contentType,
        file,
        token,
      });
      throwIfUploadCancelled(uploadCancelledRef.current);

      setUploadState({
        fileName: file.name,
        message: "Uploading demo...",
        progress: 18,
        status: "uploading",
      });

      await uploadFileToS3({
        contentType,
        file,
        onProgress: (progress) => {
          setUploadState({
            fileName: file.name,
            message: "Uploading demo...",
            progress,
            status: "uploading",
          });
        },
        onRequestCreated: (request) => {
          activeUploadRequestRef.current = request;
        },
        uploadUrl: uploadTarget.uploadUrl,
      }).finally(() => {
        activeUploadRequestRef.current = null;
      });
      throwIfUploadCancelled(uploadCancelledRef.current);

      setUploadState({
        fileName: file.name,
        message: "Finishing upload...",
        progress: 96,
        status: "finalizing",
      });
      failedUploadFileRef.current = null;

      await completeUpload({
        demoId: uploadTarget.demoId,
        key: uploadTarget.key,
        metadata,
        token,
      });

      setUploadState({
        fileName: file.name,
        message: "Upload complete",
        progress: 100,
        status: "done",
      });

      await loadDemos();
      window.setTimeout(() => {
        setUploadState({
          fileName: "",
          message: "",
          progress: 0,
          status: "idle",
        });
      }, 1500);
    } catch (error) {
      failedUploadFileRef.current = file;
      setUploadState({
        fileName: file.name,
        message: getErrorMessage(error, "Upload failed."),
        progress: 0,
        status: "failed",
      });

      if (token && uploadTarget) {
        await cleanupIncompleteUpload({
          demoId: uploadTarget.demoId,
          key: uploadTarget.key,
          token,
        });
        await loadDemos();
      }
    }
  }

  function handleCancelUpload() {
    if (!hasActiveUpload) {
      return;
    }

    uploadCancelledRef.current = true;
    activeUploadRequestRef.current?.abort();
  }

  function handleRetryUpload() {
    const file = failedUploadFileRef.current;

    if (!file || hasActiveUpload) {
      return;
    }

    void uploadDemo(file);
  }

  async function handleDeleteDemo(demo: DemoVideo) {
    if (deletingDemoId) {
      return;
    }

    setDeletingDemoId(demo.id);
    setErrorMessage(null);

    try {
      const token = await getAuthToken();
      const response = await fetch("/api/demo/delete", {
        body: JSON.stringify({
          demoId: demo.id,
          key: demo.source_s3_key,
          projectId: demo.project_id,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });
      const data = (await response.json()) as ApiErrorResponse | { ok: true };

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiErrorMessage(data, "Could not delete the demo."));
      }

      setDemos((currentDemos) =>
        currentDemos.filter((currentDemo) => currentDemo.id !== demo.id),
      );
      setPlayingDemoId((currentDemoId) =>
        currentDemoId === demo.id ? null : currentDemoId,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not delete the demo."));
    } finally {
      setDeletingDemoId(null);
    }
  }

  return (
    <section
      className={cn(
        "text-foreground",
        showPageHeader
          ? "min-h-screen flex-1 bg-background px-4 py-5 sm:px-6 lg:px-10 lg:py-8"
          : "w-full",
      )}
    >
      {showPageHeader ? (
        <header className="mx-auto flex w-full max-w-[1360px] flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground-strong sm:text-[28px]">
              Demos
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Keep product footage ready to pair with hook videos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadDemos()}
              disabled={isLoading}
              aria-label="Refresh demos"
              title="Refresh demos"
              className="inline-flex size-10 items-center justify-center rounded-control border border-border bg-card text-muted transition-colors hover:border-border-strong hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={cn("size-4", isLoading && "animate-spin")}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={openFilePicker}
              disabled={hasActiveUpload}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="size-4" aria-hidden="true" />
              Upload demo
            </button>
          </div>
        </header>
      ) : null}

      <div
        className={cn(
          "flex w-full flex-col",
          embeddedInLibrary ? "gap-5" : "mx-auto max-w-[1360px] gap-7",
          showPageHeader ? "pt-6" : "pt-0",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) {
              void handleFiles(event.target.files);
            }

            event.target.value = "";
          }}
        />

        {!embeddedInLibrary && errorMessage ? (
          <div
            role="alert"
            className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm font-semibold text-error"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          </div>
        ) : null}

        {embeddedInLibrary ? (
          <EmbeddedDemoWorkspace
            deletingDemoId={deletingDemoId}
            demos={demos}
            errorMessage={errorMessage}
            hasActiveUpload={hasActiveUpload}
            isDragActive={isDragActive}
            isLoading={isLoading}
            playingDemoId={playingDemoId}
            uploadState={uploadState}
            onBrowse={openFilePicker}
            onCancel={handleCancelUpload}
            onDeleteDemo={(demo) => void handleDeleteDemo(demo)}
            onDragActiveChange={setIsDragActive}
            onFiles={handleFiles}
            onPlayDemo={setPlayingDemoId}
            onRefresh={() => void loadDemos()}
            onRetry={handleRetryUpload}
          />
        ) : (
          <>
            <DemoUploadPanel
              demosCount={demos.length}
              isDragActive={isDragActive}
              uploadState={uploadState}
              onBrowse={openFilePicker}
              onCancel={handleCancelUpload}
              onDragActiveChange={setIsDragActive}
              onFiles={handleFiles}
              onRetry={handleRetryUpload}
            />
            <DemoLibrary
              deletingDemoId={deletingDemoId}
              demos={demos}
              isLoading={isLoading}
              playingDemoId={playingDemoId}
              onDeleteDemo={(demo) => void handleDeleteDemo(demo)}
              onPlayDemo={setPlayingDemoId}
            />
          </>
        )}
      </div>
    </section>
  );
}

function EmbeddedDemoWorkspace({
  deletingDemoId,
  demos,
  errorMessage,
  hasActiveUpload,
  isDragActive,
  isLoading,
  onBrowse,
  onCancel,
  onDeleteDemo,
  onDragActiveChange,
  onFiles,
  onPlayDemo,
  onRefresh,
  onRetry,
  playingDemoId,
  uploadState,
}: {
  deletingDemoId: string | null;
  demos: DemoVideo[];
  errorMessage: string | null;
  hasActiveUpload: boolean;
  isDragActive: boolean;
  isLoading: boolean;
  onBrowse: () => void;
  onCancel: () => void;
  onDeleteDemo: (demo: DemoVideo) => void;
  onDragActiveChange: (active: boolean) => void;
  onFiles: (files: FileList | File[]) => Promise<void>;
  onPlayDemo: (demoId: string) => void;
  onRefresh: () => void;
  onRetry: () => void;
  playingDemoId: string | null;
  uploadState: UploadState;
}) {
  const showUploadStatus = uploadState.status !== "idle";

  return (
    <section
      aria-labelledby="library-demo-heading"
      className="overflow-hidden rounded-panel border border-border bg-card"
    >
      <header className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
            <FileVideo className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="library-demo-heading"
              className="text-base font-semibold text-foreground-strong"
            >
              Demo footage
            </h2>
            <p className="mt-0.5 max-w-xl text-sm leading-5 text-muted">
              Product walkthroughs and screen recordings you can reuse when
              preparing posts.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className={demoMetricChipClassName}>
            {isLoading
              ? "Loading"
              : `${demos.length} ${demos.length === 1 ? "demo" : "demos"}`}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh demos"
            title="Refresh demos"
            className={demoIconActionClassName}
          >
            <RefreshCw
              className={cn(
                "size-4",
                isLoading && "animate-spin motion-reduce:animate-none",
              )}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={onBrowse}
            disabled={hasActiveUpload}
            className={cn(demoPrimaryActionClassName, "px-3.5 text-xs")}
          >
            <Upload className="size-3.5" aria-hidden="true" />
            Upload demo
          </button>
        </div>
      </header>

      {errorMessage ? (
        <div
          role="alert"
          className="border-b border-error/15 bg-error/5 px-4 py-3 text-sm font-semibold text-error sm:px-5"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        </div>
      ) : null}

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          onDragActiveChange(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onDragActiveChange(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();

          if (event.currentTarget === event.target) {
            onDragActiveChange(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDragActiveChange(false);
          void onFiles(event.dataTransfer.files);
        }}
        className={cn(
          "relative border-t border-border bg-surface-subtle/55 p-4 transition-colors sm:p-5",
          isDragActive && "bg-brand-soft/30",
        )}
      >
        {showUploadStatus ? (
          <div className="mb-4 rounded-lg border border-border bg-surface-subtle p-2 sm:max-w-xl">
            <UploadProgress
              uploadState={uploadState}
              onCancel={onCancel}
              onRetry={onRetry}
            />
          </div>
        ) : null}

        {isLoading ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
            aria-label="Loading demos"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-card border border-border bg-card"
              >
                <div className="aspect-[4/5] animate-pulse bg-card-muted motion-reduce:animate-none" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-card-muted motion-reduce:animate-none" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-surface-subtle motion-reduce:animate-none" />
                </div>
              </div>
            ))}
          </div>
        ) : demos.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {demos.map((demo) => (
              <DemoCard
                key={demo.id}
                demo={demo}
                deleting={deletingDemoId === demo.id}
                playing={playingDemoId === demo.id}
                onDelete={() => onDeleteDemo(demo)}
                onPlay={() => onPlayDemo(demo.id)}
              />
            ))}
          </div>
        ) : !showUploadStatus ? (
          <div
            className={cn(
              "grid min-h-[330px] items-center gap-8 rounded-panel border border-dashed px-5 py-8 transition-colors sm:grid-cols-[minmax(0,1fr)_250px] sm:px-8",
              isDragActive
                ? "border-primary bg-brand-soft/30"
                : "border-border-strong bg-card",
            )}
          >
            <div className="max-w-xl text-left">
              <span className="flex size-12 items-center justify-center rounded-control bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
                <Upload className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-xl font-semibold text-foreground-strong">
                {isDragActive ? "Drop your video here" : "Add demo footage"}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                Upload a product walkthrough or screen recording. It will stay
                here and can be used later when you prepare a post.
              </p>
              <button
                type="button"
                onClick={onBrowse}
                className={cn(demoPrimaryActionClassName, "mt-5")}
              >
                <Upload className="size-4" aria-hidden="true" />
                Choose video
              </button>
              <p className="mt-3 text-xs font-medium text-muted-subtle">
                or drop a file anywhere in this area
              </p>
            </div>
            <div className="rounded-panel bg-surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-subtle">
                Upload rules
              </p>
              <div className="mt-3 flex flex-col gap-2 text-sm font-semibold text-muted">
                <span>MP4, MOV or WebM</span>
                <span>Up to 100 MB</span>
                <span>1-60 seconds</span>
              </div>
            </div>
          </div>
        ) : null}

        {demos.length > 0 && isDragActive ? (
          <div className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center rounded-card border-2 border-dashed border-primary bg-card/95 text-sm font-semibold text-primary shadow-floating sm:inset-5">
            Drop your video to upload
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function DemoUploadPanel({
  demosCount,
  isDragActive,
  onBrowse,
  onCancel,
  onDragActiveChange,
  onFiles,
  onRetry,
  uploadState,
  layout = "default",
  workspaceLabel = "demo",
}: {
  demosCount: number;
  isDragActive: boolean;
  layout?: "compact" | "default";
  onBrowse: () => void;
  onCancel: () => void;
  onDragActiveChange: (active: boolean) => void;
  onFiles: (files: FileList | File[]) => Promise<void>;
  onRetry: () => void;
  uploadState: UploadState;
  workspaceLabel?: "demo" | "post";
}) {
  const activeUpload = uploadState.status !== "idle";
  const assetLabel = workspaceLabel === "post" ? "post" : "demo";
  const assetPluralLabel = workspaceLabel === "post" ? "posts" : "demos";
  const title =
    workspaceLabel === "post" ? "Add another post" : "Add product footage";
  const description =
    workspaceLabel === "post"
      ? "Upload product footage when you have another post ready to edit."
      : "Upload a walkthrough or screen recording. Final exports are MP4.";

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        onDragActiveChange(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        onDragActiveChange(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();

        if (event.currentTarget === event.target) {
          onDragActiveChange(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDragActiveChange(false);
        void onFiles(event.dataTransfer.files);
      }}
      className={cn(
        "relative rounded-panel border bg-card p-4 transition-colors sm:p-5",
        isDragActive ? "border-primary bg-brand-soft/35" : "border-border",
      )}
    >
      <div
        className={cn(
          "grid gap-4",
          layout === "default" && "lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center",
        )}
      >
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary sm:flex">
            <FileVideo className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground-strong">
                {title}
              </h2>
              <span className="inline-flex h-6 items-center rounded-full bg-card-muted px-2.5 text-xs font-semibold text-muted">
                {demosCount} {demosCount === 1 ? assetLabel : assetPluralLabel}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              {description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-subtle">
              <span>MP4, MOV or WebM</span>
              <span>Up to 100 MB</span>
              <span>1-60 seconds</span>
            </div>
          </div>
        </div>

        <div className="rounded-control border border-dashed border-border-strong bg-surface-subtle p-2">
          {activeUpload ? (
            <UploadProgress
              uploadState={uploadState}
              onCancel={onCancel}
              onRetry={onRetry}
            />
          ) : (
            <button
              type="button"
              onClick={onBrowse}
              className="flex min-h-20 w-full items-center justify-center gap-3 rounded-control px-4 py-3 text-left transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
                <Upload className="size-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground-strong">
                  Drop a video or browse
                </span>
                <span className="mt-0.5 block text-xs font-medium text-muted">
                  Your upload starts immediately
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadProgress({
  onCancel,
  onRetry,
  uploadState,
}: {
  onCancel: () => void;
  onRetry: () => void;
  uploadState: UploadState;
}) {
  const isFailed = uploadState.status === "failed";
  const isDone = uploadState.status === "done";
  const isInProgress = !isFailed && !isDone;
  const isCancellable = ["creating", "uploading", "validating"].includes(
    uploadState.status,
  );
  const progressValue = Math.max(0, Math.min(100, uploadState.progress));

  return (
    <div className="p-2">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            isFailed
              ? "bg-error/10 text-error"
              : isDone
                ? "bg-success/10 text-success"
                : "bg-primary/10 text-primary",
          )}
        >
          {isFailed ? (
            <AlertCircle className="size-5" aria-hidden="true" />
          ) : isDone ? (
            <CheckCircle2 className="size-5" aria-hidden="true" />
          ) : (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">
            {uploadState.fileName}
          </p>
          <p
            aria-live="polite"
            className={cn(
              "mt-1 line-clamp-2 text-xs font-semibold leading-5",
              isFailed ? "text-error" : "text-muted",
            )}
          >
            {uploadState.message}
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={`Upload progress for ${uploadState.fileName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressValue)}
        className="mt-4 h-2 overflow-hidden rounded-full bg-card-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isFailed ? "bg-error" : isDone ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${Math.max(4, progressValue)}%` }}
        />
      </div>
      {isFailed || isInProgress ? (
        <div className="mt-4 flex justify-end gap-2">
          {isFailed ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary-hover"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Retry
            </button>
          ) : null}
          {isCancellable ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-card-muted px-3 text-xs font-bold text-muted transition hover:border-border-strong hover:bg-card hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DemoLibrary({
  deletingDemoId,
  description = "Preview footage, open an edit, or remove an asset.",
  demos,
  emptyDescription = "Upload product footage to start building your demo library.",
  emptyTitle = "No demo videos yet.",
  heading = "Demo library",
  isLoading,
  itemLabel = "asset",
  onDeleteDemo,
  onPlayDemo,
  playingDemoId,
}: {
  deletingDemoId: string | null;
  description?: string;
  demos: DemoVideo[];
  emptyDescription?: string;
  emptyTitle?: string;
  heading?: string;
  isLoading: boolean;
  itemLabel?: string;
  onDeleteDemo: (demo: DemoVideo) => void;
  onPlayDemo: (demoId: string) => void;
  playingDemoId: string | null;
}) {
  return (
    <section aria-labelledby="demo-library-heading">
      <div className="mb-4 flex items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 id="demo-library-heading" className="text-base font-semibold text-foreground-strong">
            {heading}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {description}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted">
          {isLoading
            ? "Loading"
            : `${demos.length} ${demos.length === 1 ? itemLabel : `${itemLabel}s`}`}
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Loading demos">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-card border border-border bg-card">
              <div className="aspect-[4/5] animate-pulse bg-card-muted motion-reduce:animate-none" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-card-muted motion-reduce:animate-none" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-subtle motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </div>
      ) : demos.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {demos.map((demo) => (
            <DemoCard
              key={demo.id}
              demo={demo}
              deleting={deletingDemoId === demo.id}
              playing={playingDemoId === demo.id}
              onDelete={() => onDeleteDemo(demo)}
              onPlay={() => onPlayDemo(demo.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[260px] items-center justify-center rounded-panel border border-border bg-surface-subtle px-6 text-center">
          <div className="max-w-md">
            <div className="mx-auto flex size-11 items-center justify-center rounded-control bg-card-muted text-muted ring-1 ring-border">
              <Video className="size-5" aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground-strong">
              {emptyTitle}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {emptyDescription}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export function DemoCard({
  deleting,
  demo,
  onDelete,
  onPlay,
  playing,
}: {
  deleting: boolean;
  demo: DemoVideo;
  onDelete: () => void;
  onPlay: () => void;
  playing: boolean;
}) {
  const playable = isPlayableDemo(demo);

  return (
    <article className="group min-w-0 overflow-hidden rounded-panel border border-border bg-card transition-colors hover:border-border-strong">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#17181b] text-white">
        <DemoMediaPreview demo={demo} playing={playing} />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-black/60 to-transparent p-3">
          <button
            type="button"
            onClick={onPlay}
            disabled={!playable}
            aria-label={`Play ${demo.title}`}
            title="Play preview"
            className="inline-flex size-10 items-center justify-center rounded-full bg-card text-foreground-strong shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="ml-0.5 size-3.5 fill-current" aria-hidden="true" />
          </button>
          <StatusBadge status={demo.status} />
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground-strong">
              {demo.title}
            </h3>
            <button
              type="button"
              aria-label={`Delete ${demo.title}`}
              title="Delete demo"
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" aria-hidden="true" />
              {formatDuration(demo.duration_seconds)}
            </span>
            <span>{demo.ratio === "other" ? getDimensionsLabel(demo) : demo.ratio}</span>
            <span>{formatFileSize(demo.file_size_bytes)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {getFileTypeLabel(demo.file_type)}
            </p>
            <p className="truncate text-[11px] font-semibold text-muted">
              {formatDate(demo.updated_at)}
            </p>
          </div>
          <Link
            href={`/demos/${encodeURIComponent(demo.id)}`}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-control bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Link>
        </div>
      </div>
    </article>
  );
}

function DemoMediaPreview({
  demo,
  playing,
}: {
  demo: DemoVideo;
  playing: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">(
    demo.thumbnail_url ? "ready" : "loading",
  );
  const [previewKey, setPreviewKey] = useState(0);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const playable = isPlayableDemo(demo);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement || !playable) {
      return;
    }

    if (playing) {
      void videoElement.play().catch(() => setPreviewState("error"));
    } else {
      videoElement.pause();
    }
  }, [playable, playing, previewKey]);

  useEffect(() => {
    if ((demo.thumbnail_url && !thumbnailFailed) || previewState !== "loading") {
      return;
    }

    const timer = window.setTimeout(() => setPreviewState("error"), 8000);
    return () => window.clearTimeout(timer);
  }, [demo.thumbnail_url, previewKey, previewState, thumbnailFailed]);

  if (demo.thumbnail_url && !thumbnailFailed && !playing) {
    return (
      // Demo thumbnails are already delivered from the configured media CDN.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={demo.thumbnail_url}
        alt={`Preview of ${demo.title}`}
        className="size-full object-contain"
        onError={() => {
          setThumbnailFailed(true);
          setPreviewState("loading");
        }}
      />
    );
  }

  if (!playable || previewState === "error") {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 px-5 text-center">
        <FileVideo className="size-6 text-white/65" aria-hidden="true" />
        <p className="text-xs font-semibold text-white/80">
          {playable ? "Preview could not load" : "Video unavailable"}
        </p>
        {playable ? (
          <button
            type="button"
            onClick={() => {
              setPreviewState("loading");
              setPreviewKey((current) => current + 1);
            }}
            className="rounded-control border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-card-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Retry preview
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {previewState === "loading" ? (
        <div className="absolute inset-0 animate-pulse bg-[#25272b] motion-reduce:animate-none">
          <div className="flex size-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-white/65 motion-reduce:animate-none" aria-hidden="true" />
            <span className="sr-only">Loading video preview</span>
          </div>
        </div>
      ) : null}
      <video
        key={previewKey}
        ref={videoRef}
        src={demo.source_video_url}
        poster={demo.thumbnail_url ?? undefined}
        aria-label={`Preview of ${demo.title}`}
        className={cn(
          "size-full object-contain transition-opacity duration-200",
          previewState === "ready" ? "opacity-100" : "opacity-0",
        )}
        controls={playing}
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setPreviewState("ready")}
        onLoadedMetadata={(event) => {
          const element = event.currentTarget;
          const previewTime = Math.min(0.15, Math.max(0, element.duration / 20));

          if (previewTime > 0) {
            element.currentTime = previewTime;
          } else {
            setPreviewState("ready");
          }
        }}
        onSeeked={() => setPreviewState("ready")}
        onError={() => setPreviewState("error")}
      />
    </>
  );
}

function StatusBadge({ status }: { status: DemoStatus }) {
  const styles: Record<DemoStatus, string> = {
    draft: "bg-primary/95 text-white",
    failed: "bg-error/95 text-white",
    processing: "bg-card-muted/95 text-foreground",
    ready: "bg-success/95 text-white",
    rendered: "bg-brand-soft text-primary",
    rendering: "bg-card-muted/95 text-foreground",
    uploading: "bg-card-muted/95 text-foreground",
  };

  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-[11px] font-bold capitalize shadow-sm",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}

async function getAuthToken() {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before uploading demo videos.");
  }

  return token;
}

async function createUploadTarget({
  contentType,
  file,
  token,
}: {
  contentType: DemoContentType;
  file: File;
  token: string;
}) {
  const response = await fetch("/api/demo/create-upload-url", {
    body: JSON.stringify({
      contentType,
      fileName: file.name,
      fileSize: file.size,
      projectId: DEFAULT_PROJECT_ID,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as CreateUploadResponse | ApiErrorResponse;

  if (!response.ok || data.ok !== true) {
    throw new Error(getApiErrorMessage(data, "Could not prepare the upload."));
  }

  return data;
}

async function completeUpload({
  demoId,
  key,
  metadata,
  token,
}: {
  demoId: string;
  key: string;
  metadata: VideoMetadata;
  token: string;
}) {
  const response = await fetch("/api/demo/complete-upload", {
    body: JSON.stringify({
      demoId,
      durationSeconds: metadata.durationSeconds,
      height: metadata.height,
      key,
      projectId: DEFAULT_PROJECT_ID,
      ratio: metadata.ratio,
      width: metadata.width,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as ApiErrorResponse | { ok: true };

  if (!response.ok || data.ok !== true) {
    throw new Error(getApiErrorMessage(data, "Could not finish the upload."));
  }
}

async function cleanupIncompleteUpload({
  demoId,
  key,
  token,
}: {
  demoId: string;
  key: string;
  token: string;
}) {
  try {
    const response = await fetch("/api/demo/delete", {
      body: JSON.stringify({
        demoId,
        key,
        projectId: DEFAULT_PROJECT_ID,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "DELETE",
    });

    if (!response.ok) {
      console.error("Could not clean up incomplete demo upload", {
        demoId,
        status: response.status,
      });
    }
  } catch (error) {
    console.error("Could not clean up incomplete demo upload", {
      demoId,
      error,
    });
  }
}

function uploadFileToS3({
  contentType,
  file,
  onProgress,
  onRequestCreated,
  uploadUrl,
}: {
  contentType: DemoContentType;
  file: File;
  onProgress: (progress: number) => void;
  onRequestCreated: (request: XMLHttpRequest) => void;
  uploadUrl: string;
}) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", uploadUrl);
    xhr.timeout = DEMO_UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader("Content-Type", contentType);
    onRequestCreated(xhr);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const rawProgress = (event.loaded / event.total) * 76;
      onProgress(Math.min(94, Math.max(18, Math.round(rawProgress + 18))));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        console.error(
          "Demo S3 upload failed",
          getStorageUploadDiagnostics({
            contentType,
            responseBody: getSafeXhrResponseText(xhr),
            uploadUrl,
            xhr,
          }),
        );
        reject(
          new Error(
            `Storage upload failed with status ${xhr.status}. Please try again.`,
          ),
        );
      }
    };

    xhr.onerror = () => {
      console.error(
        "Demo S3 upload network error",
        getStorageUploadDiagnostics({
          contentType,
          uploadUrl,
          xhr,
        }),
      );
      reject(
        new Error(
          "Storage blocked the upload before it reached UGC Pilot. Check the storage connection and try again.",
        ),
      );
    };

    xhr.onabort = () => {
      reject(new Error("Upload cancelled."));
    };

    xhr.ontimeout = () => {
      reject(
        new Error(
          "The upload stopped responding. Check your connection and retry.",
        ),
      );
    };

    xhr.send(file);
  });
}

function getStorageUploadDiagnostics({
  contentType,
  responseBody,
  uploadUrl,
  xhr,
}: {
  contentType: DemoContentType;
  responseBody?: string;
  uploadUrl: string;
  xhr: XMLHttpRequest;
}) {
  const uploadTarget = getUploadTargetDiagnostics(uploadUrl);

  return {
    browserOnline: navigator.onLine,
    contentType,
    readyState: xhr.readyState,
    responseBody: responseBody ? sanitizeStorageResponse(responseBody) : undefined,
    status: xhr.status,
    statusText: xhr.statusText,
    uploadHostname: uploadTarget.hostname,
    uploadPathname: uploadTarget.pathname,
    uploadRegion: uploadTarget.region,
  };
}

function getUploadTargetDiagnostics(uploadUrl: string) {
  try {
    const parsedUrl = new URL(uploadUrl);

    return {
      hostname: parsedUrl.hostname,
      pathname: parsedUrl.pathname,
      region: getS3RegionFromHostname(parsedUrl.hostname),
    };
  } catch {
    return {
      hostname: "unparseable",
      pathname: "unparseable",
      region: "unknown",
    };
  }
}

function getS3RegionFromHostname(hostname: string) {
  const match = hostname.match(/\.s3[.-]([a-z0-9-]+)\.amazonaws\.com$/i);

  return match?.[1] ?? "unknown";
}

function getSafeXhrResponseText(xhr: XMLHttpRequest) {
  try {
    return xhr.responseText;
  } catch {
    return "";
  }
}

function sanitizeStorageResponse(responseText: string) {
  return responseText
    .replace(/<AWSAccessKeyId>[^<]*<\/AWSAccessKeyId>/gi, "<AWSAccessKeyId>[redacted]</AWSAccessKeyId>")
    .replace(/X-Amz-Credential=[^&<\s]+/gi, "X-Amz-Credential=[redacted]")
    .slice(0, 1200);
}

function throwIfUploadCancelled(cancelled: boolean) {
  if (cancelled) {
    throw new Error("Upload cancelled.");
  }
}

function getSupportedContentType(file: File): DemoContentType {
  if (file.size <= 0) {
    throw new Error("Demo video file is empty.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Demo video is too large. Maximum size is 100 MB.");
  }

  const extension = getFileExtension(file.name);

  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Demo video must be MP4, MOV, or WebM.");
  }

  const inferredContentType = CONTENT_TYPE_BY_EXTENSION[extension];
  const browserContentType = file.type.trim().toLowerCase();

  if (browserContentType && browserContentType !== inferredContentType) {
    const browserExtension = Object.entries(CONTENT_TYPE_BY_EXTENSION).find(
      ([, contentType]) => contentType === browserContentType,
    )?.[0];

    if (browserExtension !== extension) {
      throw new Error("Demo video file extension and content type do not match.");
    }
  }

  return inferredContentType;
}

function readVideoMetadata(file: File) {
  return new Promise<VideoMetadata>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");

    function cleanup() {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    }

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const durationSeconds = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      cleanup();

      if (
        !Number.isFinite(durationSeconds) ||
        durationSeconds < MIN_DURATION_SECONDS ||
        durationSeconds > MAX_DURATION_SECONDS
      ) {
        reject(
          new Error(
            `Demo video duration must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS} seconds.`,
          ),
        );
        return;
      }

      if (!width || !height) {
        reject(new Error("Could not read video dimensions."));
        return;
      }

      resolve({
        durationSeconds,
        height,
        ratio: getRatioFromDimensions(width, height),
        width,
      });
    };
    video.onerror = () => {
      cleanup();
      reject(
        new Error(
          "Could not read video metadata. MP4 is the safest upload format.",
        ),
      );
    };
    video.src = objectUrl;
  });
}

function getRatioFromDimensions(width: number, height: number): DemoRatio {
  const aspectRatio = width / height;
  const knownRatios: Array<[DemoRatio, number]> = [
    ["9:16", 9 / 16],
    ["1:1", 1],
    ["4:5", 4 / 5],
    ["16:9", 16 / 9],
  ];

  for (const [ratio, targetAspectRatio] of knownRatios) {
    if (Math.abs(aspectRatio - targetAspectRatio) <= 0.03) {
      return ratio;
    }
  }

  return "other";
}

function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return null;
  }

  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function readJsonResponse<T>(response: Response, fallback: string) {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallback);
  }
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

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "Pending";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.floor(seconds % 60));

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  const megabytes = bytes / (1024 * 1024);

  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
}

function getFileTypeLabel(contentType: DemoContentType) {
  const labels: Record<DemoContentType, string> = {
    "video/mp4": "MP4",
    "video/quicktime": "MOV",
    "video/webm": "WebM",
  };

  return labels[contentType];
}

function getDimensionsLabel(demo: DemoVideo) {
  return demo.width && demo.height ? `${demo.width}x${demo.height}` : "Custom";
}

function isPlayableDemo(demo: DemoVideo) {
  return Boolean(demo.source_video_url && demo.status !== "failed");
}
