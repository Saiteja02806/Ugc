"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileVideo,
  Loader2,
  Maximize2,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  RefreshCw,
  Trash2,
  Upload,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getDemoPlaybackUrl,
  isActiveDemoStatus,
  type DemoDisplayStatus,
} from "@/lib/demo/demo-display";
import { getContentDemoEditorHref } from "@/lib/edit/routes";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEFAULT_PROJECT_ID = "test-project-001";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const DEMO_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_ACTIVE_STATUS_POLL_ATTEMPTS = 120;
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
type DemoStatus = DemoDisplayStatus;

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

type UploadQueueItem = {
  error?: string | null;
  file: File;
  fileName: string;
  fileSizeBytes: number;
  id: string;
  message: string;
  progress: number;
  request?: XMLHttpRequest | null;
  status: "idle" | "validating" | "creating" | "uploading" | "finalizing" | "done" | "failed";
};

type VideoMetadata = {
  durationSeconds: number;
  height: number;
  ratio: DemoRatio;
  width: number;
};

type CreateUploadResponse = {
  publicUrl: string;
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
  const latestDemoLoadRequestIdRef = useRef(0);
  const latestBlockingDemoLoadRequestIdRef = useRef(0);
  const [demos, setDemos] = useState<DemoVideo[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingDemoId, setDeletingDemoId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playingDemoId, setPlayingDemoId] = useState<string | null>(null);
  const [previewModalDemo, setPreviewModalDemo] = useState<DemoVideo | null>(null);
  const [selectedDemoIds, setSelectedDemoIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  const hasActiveUpload = uploadQueue.some((item) =>
    ["validating", "creating", "uploading", "finalizing"].includes(item.status),
  );

  const loadErrorFallback = embeddedInLibrary
    ? "Could not load uploaded posts."
    : "Could not load demo videos.";

  const activeDemoStatusSignature = useMemo(
    () =>
      demos
        .filter((demo) => isActiveDemoStatus(demo.status))
        .map((demo) => `${demo.id}:${demo.status}:${demo.updated_at}`)
        .sort()
        .join("|"),
    [demos],
  );

  const loadDemos = useCallback(async (options?: { silent?: boolean }) => {
    const requestId = latestDemoLoadRequestIdRef.current + 1;
    latestDemoLoadRequestIdRef.current = requestId;

    if (!options?.silent) {
      latestBlockingDemoLoadRequestIdRef.current = requestId;
      setIsLoading(true);
      setErrorMessage(null);
    }

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in again to refresh your demo videos.");
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

      if (latestDemoLoadRequestIdRef.current === requestId) {
        setDemos(data.demos);
        setErrorMessage(null);
      }
    } catch (error) {
      if (latestDemoLoadRequestIdRef.current === requestId) {
        setErrorMessage(getErrorMessage(error, loadErrorFallback));
      }
    } finally {
      if (
        !options?.silent &&
        latestBlockingDemoLoadRequestIdRef.current === requestId
      ) {
        setIsLoading(false);
      }
    }
  }, [loadErrorFallback]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDemos();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDemos]);

  useEffect(() => {
    if (!activeDemoStatusSignature) {
      return;
    }

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;

      if (attempts > MAX_ACTIVE_STATUS_POLL_ATTEMPTS) {
        window.clearInterval(timer);
        return;
      }

      void loadDemos({ silent: true });
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [activeDemoStatusSignature, loadDemos]);

  useEffect(() => {
    function refreshDemosWhenVisible() {
      if (document.visibilityState === "visible") {
        void loadDemos({ silent: true });
      }
    }

    window.addEventListener("focus", refreshDemosWhenVisible);
    document.addEventListener("visibilitychange", refreshDemosWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshDemosWhenVisible);
      document.removeEventListener("visibilitychange", refreshDemosWhenVisible);
    };
  }, [loadDemos]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFiles(files: FileList | File[]) {
    const fileList = Array.from(files);
    if (fileList.length === 0) {
      return;
    }

    const newQueueItems: UploadQueueItem[] = fileList.map((file) => ({
      file,
      fileName: file.name,
      fileSizeBytes: file.size,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      message: "Queued...",
      progress: 0,
      status: "idle",
    }));

    setUploadQueue((prev) => [...prev, ...newQueueItems]);

    for (const item of newQueueItems) {
      await processUploadItem(item);
    }
  }

  async function processUploadItem(item: UploadQueueItem) {
    let token: string | null = null;
    let uploadTarget: CreateUploadResponse | null = null;

    setUploadQueue((prev) =>
      prev.map((q) =>
        q.id === item.id
          ? { ...q, message: "Checking video...", progress: 5, status: "validating" }
          : q,
      ),
    );

    try {
      const contentType = getSupportedContentType(item.file);
      const metadata = await readVideoMetadata(item.file);

      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, message: "Preparing upload...", progress: 14, status: "creating" }
            : q,
        ),
      );

      token = await getAuthToken();
      uploadTarget = await createUploadTarget({
        contentType,
        file: item.file,
        token,
      });

      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                message: "Uploading video...",
                progress: 18,
                status: "uploading",
              }
            : q,
        ),
      );

      await uploadFileToStorage({
        contentType,
        file: item.file,
        onProgress: (progress) => {
          setUploadQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, message: "Uploading video...", progress }
                : q,
            ),
          );
        },
        onRequestCreated: (request) => {
          setUploadQueue((prev) =>
            prev.map((q) =>
              q.id === item.id ? { ...q, request } : q,
            ),
          );
        },
        uploadUrl: uploadTarget.uploadUrl,
      });

      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                message: "Finishing upload...",
                progress: 96,
                request: null,
                status: "finalizing",
              }
            : q,
        ),
      );

      await completeUpload({
        demoId: uploadTarget.demoId,
        key: uploadTarget.key,
        metadata,
        token,
      });

      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                message: "Upload complete",
                progress: 100,
                status: "done",
              }
            : q,
        ),
      );

      await loadDemos({ silent: true });
    } catch (error) {
      const errMsg = getErrorMessage(error, "Upload failed.");
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                error: errMsg,
                message: errMsg,
                progress: 0,
                request: null,
                status: "failed",
              }
            : q,
        ),
      );

      if (token && uploadTarget) {
        await cleanupIncompleteUpload({
          demoId: uploadTarget.demoId,
          key: uploadTarget.key,
          token,
        });
        await loadDemos({ silent: true });
      }
    }
  }

  function handleCancelQueueItem(itemId: string) {
    const target = uploadQueue.find((q) => q.id === itemId);
    if (target?.request) {
      target.request.abort();
    }
    setUploadQueue((prev) => prev.filter((q) => q.id !== itemId));
  }

  function handleRetryQueueItem(itemId: string) {
    const target = uploadQueue.find((q) => q.id === itemId);
    if (!target) return;
    void processUploadItem(target);
  }

  function handleClearCompletedQueue() {
    setUploadQueue((prev) => prev.filter((q) => !["done"].includes(q.status)));
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
      setSelectedDemoIds((prev) => {
        const next = new Set(prev);
        next.delete(demo.id);
        return next;
      });
      setPlayingDemoId((currentDemoId) =>
        currentDemoId === demo.id ? null : currentDemoId,
      );
      if (previewModalDemo?.id === demo.id) {
        setPreviewModalDemo(null);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not delete the demo."));
    } finally {
      setDeletingDemoId(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedDemoIds.size === 0 || isBulkDeleting) {
      return;
    }

    setIsBulkDeleting(true);
    setErrorMessage(null);

    try {
      const token = await getAuthToken();
      const demosToDelete = demos.filter((d) => selectedDemoIds.has(d.id));

      await Promise.all(
        demosToDelete.map(async (demo) => {
          await fetch("/api/demo/delete", {
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
        }),
      );

      setDemos((prev) => prev.filter((d) => !selectedDemoIds.has(d.id)));
      setSelectedDemoIds(new Set());
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not delete some selected demos."));
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleRenameDemo(demoId: string, newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    setDemos((prev) =>
      prev.map((d) => (d.id === demoId ? { ...d, title: trimmed } : d)),
    );
    setPreviewModalDemo((prev) => (prev?.id === demoId ? { ...prev, title: trimmed } : prev));

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/demo/${encodeURIComponent(demoId)}`, {
        body: JSON.stringify({
          projectId: DEFAULT_PROJECT_ID,
          title: trimmed,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Could not rename video.");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not rename video."));
      void loadDemos({ silent: true });
    }
  }

  async function handleTagsChange(demoId: string, newTags: string[]) {
    setDemos((prev) =>
      prev.map((d) =>
        d.id === demoId
          ? {
              ...d,
              draft_json: { ...(d.draft_json || {}), tags: newTags },
            }
          : d,
      ),
    );
    setPreviewModalDemo((prev) =>
      prev?.id === demoId
        ? {
            ...prev,
            draft_json: { ...(prev.draft_json || {}), tags: newTags },
          }
        : prev,
    );

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/demo/${encodeURIComponent(demoId)}`, {
        body: JSON.stringify({
          projectId: DEFAULT_PROJECT_ID,
          tags: newTags,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Could not update tags.");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not update tags."));
      void loadDemos({ silent: true });
    }
  }

  function handleToggleSelect(demoId: string) {
    setSelectedDemoIds((prev) => {
      const next = new Set(prev);
      if (next.has(demoId)) {
        next.delete(demoId);
      } else {
        next.add(demoId);
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedDemoIds(new Set(demos.map((d) => d.id)));
  }

  function handleDeselectAll() {
    setSelectedDemoIds(new Set());
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
          multiple
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
            onBrowse={openFilePicker}
            onCancelQueueItem={handleCancelQueueItem}
            onClearCompletedQueue={handleClearCompletedQueue}
            onDeleteDemo={(demo) => void handleDeleteDemo(demo)}
            onDragActiveChange={setIsDragActive}
            onFiles={handleFiles}
            onOpenPreview={(demo) => setPreviewModalDemo(demo)}
            onPlayDemo={setPlayingDemoId}
            onRefresh={() => void loadDemos()}
            onRenameDemo={handleRenameDemo}
            onRetryQueueItem={handleRetryQueueItem}
            onTagsChange={handleTagsChange}
            onToggleSelect={handleToggleSelect}
            playingDemoId={playingDemoId}
            selectedDemoIds={selectedDemoIds}
            uploadQueue={uploadQueue}
          />
        ) : (
          <>
            <DemoUploadPanel
              demosCount={demos.length}
              isDragActive={isDragActive}
              onBrowse={openFilePicker}
              onCancel={() => {
                if (uploadQueue[0]) {
                  handleCancelQueueItem(uploadQueue[0].id);
                }
              }}
              onDragActiveChange={setIsDragActive}
              onFiles={handleFiles}
              onRetry={() => {
                if (uploadQueue[0]) {
                  handleRetryQueueItem(uploadQueue[0].id);
                }
              }}
              uploadState={{
                fileName: uploadQueue[0]?.fileName || "",
                message: uploadQueue[0]?.message || "",
                progress: uploadQueue[0]?.progress || 0,
                status: uploadQueue[0]?.status || "idle",
              }}
            />
            <DemoLibrary
              deletingDemoId={deletingDemoId}
              demos={demos}
              isLoading={isLoading}
              onDeleteDemo={(demo) => void handleDeleteDemo(demo)}
              onOpenPreview={(demo) => setPreviewModalDemo(demo)}
              onPlayDemo={setPlayingDemoId}
              onRenameDemo={handleRenameDemo}
              onTagsChange={handleTagsChange}
              onToggleSelect={handleToggleSelect}
              playingDemoId={playingDemoId}
              selectedDemoIds={selectedDemoIds}
            />
          </>
        )}
      </div>

      {/* Expanded Video Preview Modal & Scrub Timeline */}
      <DemoVideoPreviewModal
        key={previewModalDemo?.id ?? "closed"}
        demo={previewModalDemo}
        open={Boolean(previewModalDemo)}
        onClose={() => setPreviewModalDemo(null)}
        onRename={handleRenameDemo}
        onTagsChange={handleTagsChange}
      />

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        isDeleting={isBulkDeleting}
        onDeleteSelected={() => setShowBulkDeleteConfirm(true)}
        onDeselectAll={handleDeselectAll}
        onSelectAll={handleSelectAll}
        selectedCount={selectedDemoIds.size}
        totalCount={demos.length}
      />

      {/* Bulk Delete Confirm Dialog */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selectedDemoIds.size} demos?</DialogTitle>
            <DialogDescription>
              This will permanently delete the {selectedDemoIds.size} selected demo videos from your Content Library. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <DialogClose className="inline-flex h-10 items-center justify-center rounded-control border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-card-muted">
              Cancel
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={isBulkDeleting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-error px-4 text-sm font-semibold text-white hover:bg-error/90 disabled:opacity-50"
            >
              {isBulkDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              <span>Delete {selectedDemoIds.size} demos</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  onCancelQueueItem,
  onClearCompletedQueue,
  onDeleteDemo,
  onDragActiveChange,
  onFiles,
  onOpenPreview,
  onPlayDemo,
  onRefresh,
  onRenameDemo,
  onRetryQueueItem,
  onTagsChange,
  onToggleSelect,
  playingDemoId,
  selectedDemoIds,
  uploadQueue,
}: {
  deletingDemoId: string | null;
  demos: DemoVideo[];
  errorMessage: string | null;
  hasActiveUpload: boolean;
  isDragActive: boolean;
  isLoading: boolean;
  onBrowse: () => void;
  onCancelQueueItem: (id: string) => void;
  onClearCompletedQueue: () => void;
  onDeleteDemo: (demo: DemoVideo) => void;
  onDragActiveChange: (active: boolean) => void;
  onFiles: (files: FileList | File[]) => Promise<void>;
  onOpenPreview: (demo: DemoVideo) => void;
  onPlayDemo: (demoId: string) => void;
  onRefresh: () => void;
  onRenameDemo: (demoId: string, title: string) => Promise<void>;
  onRetryQueueItem: (id: string) => void;
  onTagsChange: (demoId: string, tags: string[]) => Promise<void>;
  onToggleSelect: (demoId: string) => void;
  playingDemoId: string | null;
  selectedDemoIds: Set<string>;
  uploadQueue: UploadQueueItem[];
}) {
  return (
    <section
      aria-labelledby="library-demo-heading"
      className="overflow-hidden rounded-panel border border-border bg-card"
    >
      <header className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
            {isLoading && demos.length === 0
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
          "relative border-t border-border bg-surface-subtle/55 p-3 transition-colors sm:p-4",
          isDragActive && "bg-brand-soft/30",
        )}
      >
        {uploadQueue.length > 0 ? (
          <BatchUploadQueuePanel
            items={uploadQueue}
            onCancelItem={onCancelQueueItem}
            onClearCompleted={onClearCompletedQueue}
            onRetryItem={onRetryQueueItem}
          />
        ) : null}

        {isLoading && demos.length === 0 ? (
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
                isPlaying={playingDemoId === demo.id}
                isSelected={selectedDemoIds.has(demo.id)}
                onDelete={() => onDeleteDemo(demo)}
                onOpenPreview={() => onOpenPreview(demo)}
                onPlay={() => onPlayDemo(demo.id)}
                onRename={(newTitle) => onRenameDemo(demo.id, newTitle)}
                onTagsChange={(newTags) => onTagsChange(demo.id, newTags)}
                onToggleSelect={() => onToggleSelect(demo.id)}
              />
            ))}
          </div>
        ) : uploadQueue.length === 0 ? (
          <div
            className={cn(
              "grid min-h-[220px] items-center gap-5 rounded-panel border border-dashed px-4 py-5 transition-colors sm:grid-cols-[minmax(0,1fr)_220px] sm:px-6",
              isDragActive
                ? "border-primary bg-brand-soft/30"
                : "border-border-strong bg-card",
            )}
          >
            <div className="max-w-xl text-left">
              <span className="flex size-10 items-center justify-center rounded-control bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
                <Upload className="size-4" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-lg font-semibold text-foreground-strong">
                {isDragActive ? "Drop your videos here" : "Add demo footage"}
              </h3>
              <p className="mt-1.5 max-w-lg text-sm leading-5 text-muted">
                Upload product walkthroughs or screen recordings. You can drop multiple files at once.
              </p>
              <button
                type="button"
                onClick={onBrowse}
                className={cn(demoPrimaryActionClassName, "mt-4")}
              >
                <Upload className="size-4" aria-hidden="true" />
                Choose video files
              </button>
              <p className="mt-2 text-xs font-medium text-muted-subtle">
                or drop multiple files anywhere in this area
              </p>
            </div>
            <div className="rounded-control bg-surface-subtle p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-subtle">
                Upload rules
              </p>
              <div className="mt-2 flex flex-col gap-1.5 text-sm font-semibold text-muted">
                <span>MP4, MOV or WebM</span>
                <span>Up to 100 MB per file</span>
                <span>1-60 seconds duration</span>
              </div>
            </div>
          </div>
        ) : null}

        {demos.length > 0 && isDragActive ? (
          <div className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center rounded-card border-2 border-dashed border-primary bg-card/95 text-sm font-semibold text-primary shadow-floating sm:inset-5">
            Drop your video files to upload
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
  uploadState: {
    fileName: string;
    message: string;
    progress: number;
    status: string;
  };
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
                  Drop video files or browse
                </span>
                <span className="mt-0.5 block text-xs font-medium text-muted">
                  Batch upload starts immediately
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
  uploadState: {
    fileName: string;
    message: string;
    progress: number;
    status: string;
  };
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

function BatchUploadQueuePanel({
  items,
  onCancelItem,
  onClearCompleted,
  onRetryItem,
}: {
  items: UploadQueueItem[];
  onCancelItem: (id: string) => void;
  onClearCompleted: () => void;
  onRetryItem: (id: string) => void;
}) {
  if (items.length === 0) return null;

  const activeCount = items.filter(
    (i) => !["done", "failed"].includes(i.status),
  ).length;
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="mb-4 rounded-panel border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between pb-2.5 border-b border-border mb-3">
        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <CheckCircle2 className="size-4 text-success" />
          )}
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground-strong">
            Upload Queue ({items.length} {items.length === 1 ? "file" : "files"})
          </h4>
        </div>
        {doneCount > 0 ? (
          <button
            type="button"
            onClick={onClearCompleted}
            className="text-xs font-semibold text-muted hover:text-foreground transition-colors"
          >
            Clear completed
          </button>
        ) : null}
      </div>

      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {items.map((item) => {
          const isFailed = item.status === "failed";
          const isDone = item.status === "done";
          const isCancellable = ["creating", "uploading", "validating"].includes(
            item.status,
          );

          return (
            <div
              key={item.id}
              className="rounded-control bg-surface-subtle p-2.5 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground">
                    {item.fileName}
                  </p>
                  <p
                    className={cn(
                      "text-[11px] font-medium leading-tight",
                      isFailed ? "text-error" : "text-muted",
                    )}
                  >
                    {item.message}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {isFailed ? (
                    <button
                      type="button"
                      onClick={() => onRetryItem(item.id)}
                      className="inline-flex size-6 items-center justify-center rounded bg-primary text-white hover:bg-primary-hover"
                      title="Retry upload"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                  ) : null}
                  {isCancellable ? (
                    <button
                      type="button"
                      onClick={() => onCancelItem(item.id)}
                      className="inline-flex size-6 items-center justify-center rounded border border-border bg-card text-muted hover:text-foreground"
                      title="Cancel upload"
                    >
                      <X className="size-3" />
                    </button>
                  ) : isDone ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : null}
                </div>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    isFailed ? "bg-error" : isDone ? "bg-success" : "bg-primary",
                  )}
                  style={{ width: `${Math.max(4, item.progress)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DemoLibrary({
  deletingDemoId,
  demos,
  description = "Preview footage, open an edit, or remove an asset.",
  emptyDescription = "Upload product footage to start building your demo library.",
  emptyTitle = "No demo videos yet.",
  heading = "Demo library",
  isLoading,
  itemLabel = "asset",
  onDeleteDemo,
  onOpenPreview,
  onPlayDemo,
  onRenameDemo,
  onTagsChange,
  onToggleSelect,
  playingDemoId,
  selectedDemoIds,
}: {
  deletingDemoId: string | null;
  demos: DemoVideo[];
  description?: string;
  emptyDescription?: string;
  emptyTitle?: string;
  heading?: string;
  isLoading: boolean;
  itemLabel?: string;
  onDeleteDemo: (demo: DemoVideo) => void;
  onOpenPreview: (demo: DemoVideo) => void;
  onPlayDemo: (demoId: string) => void;
  onRenameDemo: (demoId: string, title: string) => Promise<void>;
  onTagsChange: (demoId: string, tags: string[]) => Promise<void>;
  onToggleSelect: (demoId: string) => void;
  playingDemoId: string | null;
  selectedDemoIds: Set<string>;
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
          {isLoading && demos.length === 0
            ? "Loading"
            : `${demos.length} ${demos.length === 1 ? itemLabel : `${itemLabel}s`}`}
        </span>
      </div>

      {isLoading && demos.length === 0 ? (
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
              isPlaying={playingDemoId === demo.id}
              isSelected={selectedDemoIds.has(demo.id)}
              onDelete={() => onDeleteDemo(demo)}
              onOpenPreview={() => onOpenPreview(demo)}
              onPlay={() => onPlayDemo(demo.id)}
              onRename={(newTitle) => onRenameDemo(demo.id, newTitle)}
              onTagsChange={(newTags) => onTagsChange(demo.id, newTags)}
              onToggleSelect={() => onToggleSelect(demo.id)}
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
  isPlaying,
  isSelected,
  onDelete,
  onOpenPreview,
  onPlay,
  onRename,
  onTagsChange,
  onToggleSelect,
}: {
  deleting: boolean;
  demo: DemoVideo;
  isPlaying: boolean;
  isSelected: boolean;
  onDelete: () => void;
  onOpenPreview: () => void;
  onPlay: () => void;
  onRename: (newTitle: string) => Promise<void>;
  onTagsChange: (newTags: string[]) => Promise<void>;
  onToggleSelect: () => void;
}) {
  const playbackUrl = getDemoPlaybackUrl(demo);
  const playable = Boolean(playbackUrl);
  const tags = getDemoTags(demo);

  return (
    <article
      className={cn(
        "group min-w-0 overflow-hidden rounded-panel border bg-card transition-all",
        isSelected
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "border-border hover:border-border-strong hover:shadow-sm",
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#17181b] text-white">
        {/* Multi-select checkbox overlay */}
        <div className="absolute left-2.5 top-2.5 z-20">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className={cn(
              "flex size-6 items-center justify-center rounded-md bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer border border-white/20",
              isSelected
                ? "opacity-100 bg-primary border-primary"
                : "opacity-0 group-hover:opacity-100",
            )}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect()}
              aria-label={`Select ${demo.title}`}
              className="size-3.5 border-transparent text-white data-checked:bg-transparent"
            />
          </div>
        </div>

        {/* Expand full preview modal trigger */}
        <button
          type="button"
          onClick={onOpenPreview}
          aria-label={`Expand preview for ${demo.title}`}
          title="Expand preview"
          className="absolute right-2.5 top-2.5 z-20 inline-flex size-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-xs transition-opacity hover:bg-black/80 hover:scale-105 group-hover:opacity-100"
        >
          <Maximize2 className="size-3.5" />
        </button>

        <DemoMediaPreview
          key={`${demo.id}:${playbackUrl ?? "unavailable"}:${demo.thumbnail_url ?? "no-thumbnail"}`}
          demo={demo}
          playbackUrl={playbackUrl}
          playing={isPlaying}
        />

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-black/60 to-transparent p-3 z-10">
          <button
            type="button"
            onClick={onPlay}
            disabled={!playable}
            aria-label={`Play ${demo.title}`}
            title="Play preview"
            className="inline-flex size-10 items-center justify-center rounded-full bg-card text-foreground-strong shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="ml-0.5 size-3.5 fill-current" aria-hidden="true" />
          </button>
          <StatusBadge status={demo.status} />
        </div>
      </div>

      <div className="space-y-2.5 p-3.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <InlineTitleEditor
                key={demo.title}
                title={demo.title}
                onSave={onRename}
              />
            </div>
            <button
              type="button"
              aria-label={`Delete ${demo.title}`}
              title="Delete demo"
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Tags */}
          <div className="mt-2">
            <DemoTagBadges
              tags={tags}
              maxVisible={2}
              onAddTag={(newTag) => {
                void onTagsChange([...tags, newTag]);
              }}
              onRemoveTag={(tagToRemove) => {
                void onTagsChange(tags.filter((t) => t !== tagToRemove));
              }}
            />
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

        <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {getFileTypeLabel(demo.file_type)}
            </p>
            <p className="truncate text-[11px] font-semibold text-muted">
              {formatDate(demo.updated_at)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenPreview}
              className="inline-flex min-h-9 items-center justify-center rounded-control border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted"
              title="Preview & controls"
            >
              Preview
            </button>
            <Link
              href={getContentDemoEditorHref(demo.id)}
              className="inline-flex min-h-9 items-center justify-center gap-1 rounded-control bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Pencil className="size-3" aria-hidden="true" />
              Edit
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function InlineTitleEditor({
  className,
  onSave,
  title,
}: {
  className?: string;
  onSave: (newTitle: string) => Promise<void>;
  title: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  async function handleCommit() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setValue(title);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch {
      setValue(title);
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCommit();
    } else if (e.key === "Escape") {
      setValue(title);
      setIsEditing(false);
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={isSaving}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void handleCommit()}
          className="h-7 min-w-0 flex-1 rounded border border-primary bg-card px-1.5 text-xs font-semibold text-foreground focus:outline-none"
          maxLength={140}
        />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            void handleCommit();
          }}
          disabled={isSaving}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded bg-primary text-white hover:bg-primary-hover"
          title="Save title"
        >
          {isSaving ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setValue(title);
            setIsEditing(false);
          }}
          disabled={isSaving}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded border border-border bg-card text-muted hover:text-foreground"
          title="Cancel"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/title flex min-w-0 items-center gap-1.5 cursor-pointer",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title="Click to rename"
    >
      <h3 className="truncate text-sm font-semibold leading-5 text-foreground-strong">
        {title}
      </h3>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        aria-label="Rename title"
        title="Rename"
        className="opacity-0 transition-opacity group-hover/title:opacity-100 p-0.5 rounded text-muted hover:text-foreground"
      >
        <Pencil className="size-3" />
      </button>
    </div>
  );
}

const POPULAR_TAG_SUGGESTIONS = [
  "#Onboarding",
  "#Mobile",
  "#Feature",
  "#Checkout",
  "#B-Roll",
  "#SaaS",
  "#Demo",
  "#Tutorial",
];

function DemoTagBadges({
  maxVisible = 3,
  onAddTag,
  onRemoveTag,
  tags,
}: {
  maxVisible?: number;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  tags: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function handleAdd(tagToAdd: string) {
    const clean = tagToAdd.trim().slice(0, 32);
    if (!clean) return;
    const formatted = clean.startsWith("#") ? clean : `#${clean}`;
    if (!tags.includes(formatted)) {
      onAddTag(formatted);
    }
    setCustomTag("");
    setIsOpen(false);
  }

  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="group/tag inline-flex items-center gap-1 rounded bg-surface-subtle border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted transition-colors hover:border-border-strong hover:text-foreground"
        >
          <span>{tag}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveTag(tag);
            }}
            className="opacity-50 transition-opacity hover:opacity-100 hover:text-error"
            title={`Remove ${tag}`}
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}

      {remainingCount > 0 ? (
        <span className="rounded bg-card-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted">
          +{remainingCount}
        </span>
      ) : null}

      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="inline-flex items-center gap-0.5 rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-subtle transition-colors hover:border-primary hover:text-primary hover:bg-brand-soft"
          title="Add tag"
        >
          <Plus className="size-2.5" />
          <span>Tag</span>
        </button>

        {isOpen ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-full z-40 mt-1 w-52 rounded-card border border-border bg-card p-2.5 shadow-floating"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-subtle mb-1.5">
              Add Tag
            </p>
            <div className="flex items-center gap-1 mb-2">
              <input
                type="text"
                value={customTag}
                placeholder="e.g. #Onboarding"
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd(customTag);
                  }
                }}
                autoFocus
                className="h-6 w-full rounded border border-border px-1.5 text-xs font-medium text-foreground placeholder:text-muted-subtle focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAdd(customTag)}
                disabled={!customTag.trim()}
                className="h-6 px-2 rounded bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-subtle">Suggested:</p>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {POPULAR_TAG_SUGGESTIONS.filter((s) => !tags.includes(s)).map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleAdd(suggestion)}
                      className="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted hover:bg-brand-soft hover:text-primary transition-colors"
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DemoVideoPreviewModal({
  demo,
  onClose,
  onRename,
  onTagsChange,
  open,
}: {
  demo: DemoVideo | null;
  onClose: () => void;
  onRename: (demoId: string, newTitle: string) => Promise<void>;
  onTagsChange: (demoId: string, newTags: string[]) => Promise<void>;
  open: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const playbackUrl = demo ? getDemoPlaybackUrl(demo) : null;
  const tags = demo ? getDemoTags(demo) : [];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function handleTimeUpdate() {
      if (!isScrubbing && video) {
        setCurrentTime(video.currentTime);
      }
    }
    function handleLoadedMetadata() {
      if (video) {
        setDuration(video.duration || demo?.duration_seconds || 0);
      }
    }
    function handleEnded() {
      setIsPlaying(false);
    }

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
    };
  }, [demo, isScrubbing]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      void video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }

  function handleScrubChange(event: React.ChangeEvent<HTMLInputElement>) {
    const targetTime = Number.parseFloat(event.target.value);
    setCurrentTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  }

  function toggleMute() {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  }

  function handleSpeedChange(speed: number) {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackRate(speed);
  }

  async function handleCopyCdnLink() {
    if (!playbackUrl) return;
    try {
      await navigator.clipboard.writeText(playbackUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  }

  function handleDownload() {
    if (!playbackUrl || !demo) return;
    const a = document.createElement("a");
    a.href = playbackUrl;
    a.download = demo.file_name || `${demo.title}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (!demo) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-[840px] flex-col overflow-hidden p-0 rounded-modal border border-border bg-card shadow-floating">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="min-w-0 flex-1 pr-4">
            <InlineTitleEditor
              key={demo.title}
              title={demo.title}
              onSave={(newTitle) => onRename(demo.id, newTitle)}
            />
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1 font-medium">
                <Clock3 className="size-3" />
                {formatDuration(demo.duration_seconds)}
              </span>
              <span>•</span>
              <span>{demo.ratio === "other" ? getDimensionsLabel(demo) : demo.ratio}</span>
              <span>•</span>
              <span>{formatFileSize(demo.file_size_bytes)}</span>
              <span>•</span>
              <span>{getFileTypeLabel(demo.file_type)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={demo.status} />
            <DialogClose className="rounded-control p-1.5 text-muted hover:bg-card-muted hover:text-foreground">
              <X className="size-5" />
            </DialogClose>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div className="relative flex flex-1 items-center justify-center bg-[#0d0e11] p-4 min-h-[380px] max-h-[58vh]">
          {playbackUrl ? (
            <video
              ref={videoRef}
              src={playbackUrl}
              poster={demo.thumbnail_url ?? undefined}
              className="max-h-[54vh] max-w-full rounded-card object-contain shadow-2xl cursor-pointer"
              playsInline
              onClick={togglePlay}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-white/70">
              <FileVideo className="size-10 text-white/50" />
              <p className="text-sm font-semibold">Video preview unavailable</p>
            </div>
          )}

          {!isPlaying && playbackUrl ? (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Play video"
              className="absolute flex size-14 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs transition-transform hover:scale-110"
            >
              <Play className="ml-1 size-6 fill-current" />
            </button>
          ) : null}
        </div>

        {/* Custom Scrub Timeline & Playback Controls Bar */}
        <div className="border-t border-border bg-surface-subtle/70 px-5 py-3 space-y-2.5">
          {/* Scrub Timeline Range Slider */}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={duration || demo.duration_seconds || 100}
              step={0.05}
              value={currentTime}
              onMouseDown={() => setIsScrubbing(true)}
              onTouchStart={() => setIsScrubbing(true)}
              onChange={handleScrubChange}
              onMouseUp={() => setIsScrubbing(false)}
              onTouchEnd={() => setIsScrubbing(false)}
              aria-label="Video seek timeline"
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-card-muted accent-primary hover:bg-border transition-colors focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={togglePlay}
                className="inline-flex size-8 items-center justify-center rounded-control bg-primary text-white hover:bg-primary-hover transition-colors"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4 fill-current" />}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex size-8 items-center justify-center rounded-control border border-border bg-card text-muted hover:bg-card-muted hover:text-foreground transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>

              <span className="font-mono text-xs font-semibold text-foreground">
                {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration || demo.duration_seconds || 0))}
              </span>
            </div>

            {/* Playback speed selector */}
            <div className="flex items-center gap-1 rounded-control border border-border bg-card p-0.5">
              {[1, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => handleSpeedChange(speed)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-semibold transition-colors",
                    playbackRate === speed
                      ? "bg-primary text-white"
                      : "text-muted hover:bg-card-muted hover:text-foreground",
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Tags in modal */}
          <div className="pt-1 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-subtle">
              Tags:
            </span>
            <DemoTagBadges
              tags={tags}
              maxVisible={8}
              onAddTag={(newTag) => {
                void onTagsChange(demo.id, [...tags, newTag]);
              }}
              onRemoveTag={(tagToRemove) => {
                void onTagsChange(demo.id, tags.filter((t) => t !== tagToRemove));
              }}
            />
          </div>
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCdnLink}
              disabled={!playbackUrl}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted disabled:opacity-50"
            >
              {copiedLink ? (
                <>
                  <Check className="size-3.5 text-success" />
                  <span className="text-success">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy CDN Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!playbackUrl}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted disabled:opacity-50"
            >
              <Download className="size-3.5" />
              <span>Download MP4</span>
            </button>
          </div>

          <Link
            href={getContentDemoEditorHref(demo.id)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            <Pencil className="size-3.5" />
            <span>Edit in Studio</span>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BulkActionBar({
  isDeleting,
  onDeleteSelected,
  onDeselectAll,
  onSelectAll,
  selectedCount,
  totalCount,
}: {
  isDeleting: boolean;
  onDeleteSelected: () => void;
  onDeselectAll: () => void;
  onSelectAll: () => void;
  selectedCount: number;
  totalCount: number;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-full border border-border bg-card/95 px-5 py-2.5 shadow-floating backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
          {selectedCount}
        </span>
        <span>selected</span>
      </span>

      <div className="h-4 w-px bg-border" />

      {selectedCount < totalCount ? (
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs font-semibold text-muted hover:text-foreground transition-colors"
        >
          Select all ({totalCount})
        </button>
      ) : (
        <button
          type="button"
          onClick={onDeselectAll}
          className="text-xs font-semibold text-muted hover:text-foreground transition-colors"
        >
          Deselect all
        </button>
      )}

      <div className="h-4 w-px bg-border" />

      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={isDeleting}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-error px-3 text-xs font-bold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
      >
        {isDeleting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        <span>Delete ({selectedCount})</span>
      </button>
    </div>
  );
}

function getDemoTags(demo: DemoVideo): string[] {
  if (
    demo.draft_json &&
    typeof demo.draft_json === "object" &&
    !Array.isArray(demo.draft_json) &&
    "tags" in demo.draft_json &&
    Array.isArray((demo.draft_json as Record<string, unknown>).tags)
  ) {
    return ((demo.draft_json as Record<string, unknown>).tags as unknown[])
      .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
      .map((t) => (t.startsWith("#") ? t : `#${t}`));
  }
  return [];
}

function DemoMediaPreview({
  demo,
  playbackUrl,
  playing,
}: {
  demo: DemoVideo;
  playbackUrl: string | null;
  playing: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">(
    demo.thumbnail_url ? "ready" : "loading",
  );
  const [previewKey, setPreviewKey] = useState(0);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const playable = Boolean(playbackUrl);

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
        src={playbackUrl ?? undefined}
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
  const variants: Record<
    DemoStatus,
    "draft" | "failed" | "info" | "ready" | "rendering" | "success"
  > = {
    draft: "draft",
    failed: "failed",
    processing: "info",
    ready: "ready",
    rendered: "success",
    rendering: "rendering",
    uploading: "info",
  };
  const labels: Record<DemoStatus, string> = {
    draft: "Draft",
    failed: "Save Failed",
    processing: "Processing",
    ready: "Ready",
    rendered: "Saved",
    rendering: "Saving",
    uploading: "Uploading",
  };
  const label = labels[status];

  return (
    <Badge
      aria-label={`Demo status: ${label}`}
      aria-live="polite"
      role="status"
      variant={variants[status]}
    >
      {label}
    </Badge>
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

function uploadFileToStorage({
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
          "Demo Cloud Storage upload failed",
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
        "Demo Cloud Storage upload network error",
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
  };
}

function getUploadTargetDiagnostics(uploadUrl: string) {
  try {
    const parsedUrl = new URL(uploadUrl);

    return {
      hostname: parsedUrl.hostname,
      pathname: parsedUrl.pathname,
    };
  } catch {
    return {
      hostname: "unparseable",
      pathname: "unparseable",
    };
  }
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
    .replace(/X-Goog-Credential=[^&<\s]+/gi, "X-Goog-Credential=[redacted]")
    .replace(/X-Goog-Signature=[^&<\s]+/gi, "X-Goog-Signature=[redacted]")
    .slice(0, 1200);
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
