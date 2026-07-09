"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileVideo,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

const DEFAULT_PROJECT_ID = "test-project-001";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 60;
const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
const CONTENT_TYPE_BY_EXTENSION: Record<string, DemoContentType> = {
  mov: "video/quicktime",
  mp4: "video/mp4",
  webm: "video/webm",
};

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [demos, setDemos] = useState<DemoVideo[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingDemoId, setDeletingDemoId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
      const data = (await response.json()) as
        | { demos: DemoVideo[]; ok: true }
        | ApiErrorResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiErrorMessage(data, "Could not load demo videos."));
      }

      setDemos(data.demos);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not load demo videos."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDemos();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDemos]);

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

      setUploadState({
        fileName: file.name,
        message: "Preparing upload...",
        progress: 14,
        status: "creating",
      });

      const token = await getAuthToken();
      const uploadTarget = await createUploadTarget({
        contentType,
        file,
        token,
      });

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
        uploadUrl: uploadTarget.uploadUrl,
      });

      setUploadState({
        fileName: file.name,
        message: "Finishing upload...",
        progress: 96,
        status: "finalizing",
      });

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
      setUploadState({
        fileName: file.name,
        message: getErrorMessage(error, "Upload failed."),
        progress: 0,
        status: "failed",
      });
    }
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
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not delete the demo."));
    } finally {
      setDeletingDemoId(null);
    }
  }

  return (
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Demos
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Upload product footage for edits, hooks, and social-ready cuts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadDemos()}
            disabled={isLoading}
            aria-label="Refresh demos"
            title="Refresh demos"
            className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-white/80 text-[#173454] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.22)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="size-4" aria-hidden="true" />
            Upload demo
          </button>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5 pt-5">
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

        <UploadPanel
          demosCount={demos.length}
          isDragActive={isDragActive}
          uploadState={uploadState}
          onBrowse={openFilePicker}
          onDragActiveChange={setIsDragActive}
          onFiles={handleFiles}
        />

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm font-semibold text-error"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          </div>
        ) : null}

        <DemoLibrary
          deletingDemoId={deletingDemoId}
          demos={demos}
          isLoading={isLoading}
          onDeleteDemo={(demo) => void handleDeleteDemo(demo)}
        />
      </div>
    </section>
  );
}

function UploadPanel({
  demosCount,
  isDragActive,
  onBrowse,
  onDragActiveChange,
  onFiles,
  uploadState,
}: {
  demosCount: number;
  isDragActive: boolean;
  onBrowse: () => void;
  onDragActiveChange: (active: boolean) => void;
  onFiles: (files: FileList | File[]) => Promise<void>;
  uploadState: UploadState;
}) {
  const activeUpload = uploadState.status !== "idle";

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
        "relative overflow-hidden rounded-[28px] border bg-white/74 p-4 shadow-[0_18px_50px_rgb(16_32_51_/_0.08)] backdrop-blur sm:p-5",
        isDragActive ? "border-primary/60" : "border-border/80",
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <div className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-[#173454] text-white shadow-sm sm:flex">
            <FileVideo className="size-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-normal text-foreground">
                Upload product demo footage
              </h2>
              <span className="inline-flex h-7 items-center rounded-full bg-card-muted px-2.5 text-xs font-bold text-[#8a4b39]">
                {demosCount} {demosCount === 1 ? "demo" : "demos"}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#405977]">
              MP4 recommended. MOV and WebM are supported, and final exports will
              be rendered as MP4.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-muted">
              <span className="rounded-full border border-border bg-white px-2.5 py-1">
                MP4
              </span>
              <span className="rounded-full border border-border bg-white px-2.5 py-1">
                MOV
              </span>
              <span className="rounded-full border border-border bg-white px-2.5 py-1">
                WebM
              </span>
              <span className="rounded-full border border-border bg-white px-2.5 py-1">
                100MB max
              </span>
              <span className="rounded-full border border-border bg-white px-2.5 py-1">
                1-60s
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-[#fffaf6] p-3">
          {activeUpload ? (
            <UploadProgress uploadState={uploadState} />
          ) : (
            <button
              type="button"
              onClick={onBrowse}
              className="flex w-full flex-col items-center justify-center rounded-xl px-5 py-6 text-center transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.20)]">
                <Upload className="size-5" aria-hidden="true" />
              </span>
              <span className="mt-3 text-sm font-bold text-foreground">
                Drop or browse
              </span>
              <span className="mt-1 text-xs font-semibold text-muted">
                Product walkthroughs and screen recordings
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadProgress({ uploadState }: { uploadState: UploadState }) {
  const isFailed = uploadState.status === "failed";
  const isDone = uploadState.status === "done";

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
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
            className={cn(
              "mt-1 line-clamp-2 text-xs font-semibold leading-5",
              isFailed ? "text-error" : "text-muted",
            )}
          >
            {uploadState.message}
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf0f3]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isFailed ? "bg-error" : isDone ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${Math.max(4, uploadState.progress)}%` }}
        />
      </div>
    </div>
  );
}

function DemoLibrary({
  deletingDemoId,
  demos,
  isLoading,
  onDeleteDemo,
}: {
  deletingDemoId: string | null;
  demos: DemoVideo[];
  isLoading: boolean;
  onDeleteDemo: (demo: DemoVideo) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground">Demo library</h2>
        <span className="text-xs font-semibold text-muted">
          {isLoading
            ? "Loading"
            : `${demos.length} ${demos.length === 1 ? "asset" : "assets"}`}
        </span>
      </div>

      {isLoading ? (
        <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-[28px] border border-border/70 bg-white/40">
          <div className="flex items-center gap-3 text-sm font-semibold text-muted">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            Loading demos...
          </div>
        </div>
      ) : demos.length > 0 ? (
        <div className="grid auto-rows-min grid-cols-1 gap-4 overflow-y-auto pb-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {demos.map((demo) => (
            <DemoCard
              key={demo.id}
              demo={demo}
              deleting={deletingDemoId === demo.id}
              onDelete={() => onDeleteDemo(demo)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-[28px] border border-border/70 bg-white/35 px-6 text-center">
          <div>
            <Video className="mx-auto size-8 text-[#9aa7b8]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-[#405977]">
              No demo videos yet.
            </p>
            <p className="mt-1 text-sm font-medium text-muted">
              Upload product footage to start building your demo library.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoCard({
  deleting,
  demo,
  onDelete,
}: {
  deleting: boolean;
  demo: DemoVideo;
  onDelete: () => void;
}) {
  return (
    <article className="group min-w-0 rounded-2xl border border-border bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgb(16_32_51_/_0.10)]">
      <div className="relative overflow-hidden rounded-xl bg-[#102033] text-white">
        <div
          className="flex items-center justify-center"
          style={{ aspectRatio: getPreviewAspectRatio(demo.ratio) }}
        >
          {isPlayableDemo(demo) ? (
            <video
              src={demo.source_video_url}
              className="size-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <FileVideo className="size-8 text-white/75" aria-hidden="true" />
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-black/60 to-transparent p-3">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/16 backdrop-blur">
            <Play className="ml-0.5 size-3.5 fill-white text-white" aria-hidden="true" />
          </span>
          <StatusBadge status={demo.status} />
        </div>
      </div>

      <div className="mt-3 space-y-3 px-1 pb-1">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-foreground">
              {demo.title}
            </h3>
            <button
              type="button"
              aria-label={`Delete ${demo.title}`}
              title="Delete demo"
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" aria-hidden="true" />
              {formatDuration(demo.duration_seconds)}
            </span>
            <span>{demo.ratio === "other" ? getDimensionsLabel(demo) : demo.ratio}</span>
            <span>{formatFileSize(demo.file_size_bytes)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[#405977]">
              {getFileTypeLabel(demo.file_type)}
            </p>
            <p className="truncate text-[11px] font-semibold text-muted">
              {formatDate(demo.updated_at)}
            </p>
          </div>
          <Link
            href={`/demos/${encodeURIComponent(demo.id)}`}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-bold text-[#173454] transition hover:bg-[#fff8f4]"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Link>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: DemoStatus }) {
  const styles: Record<DemoStatus, string> = {
    draft: "bg-primary/95 text-white",
    failed: "bg-error/95 text-white",
    processing: "bg-white/90 text-[#173454]",
    ready: "bg-success/95 text-white",
    rendered: "bg-[#173454]/95 text-white",
    rendering: "bg-white/90 text-[#173454]",
    uploading: "bg-white/90 text-[#173454]",
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

function uploadFileToS3({
  contentType,
  file,
  onProgress,
  uploadUrl,
}: {
  contentType: DemoContentType;
  file: File;
  onProgress: (progress: number) => void;
  uploadUrl: string;
}) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);

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
        reject(new Error("S3 upload failed. Check bucket CORS and try again."));
      }
    };

    xhr.onerror = () => {
      reject(new Error("S3 upload failed. Check bucket CORS and try again."));
    };

    xhr.send(file);
  });
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

function getPreviewAspectRatio(ratio: DemoRatio) {
  return ratio === "other" ? "9 / 16" : ratio.replace(":", " / ");
}

function isPlayableDemo(demo: DemoVideo) {
  return Boolean(demo.source_video_url && demo.status !== "failed");
}
