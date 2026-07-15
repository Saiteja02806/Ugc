"use client";

import {
  AlertCircle,
  Film,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Trash2,
  Type,
  X,
} from "lucide-react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { useEffect, useRef, useState } from "react";

import {
  createTextOverlay,
  MAX_TEXT_OVERLAYS,
  textOverlayPositions,
  textOverlayStyles,
  type EditableVideo,
  type EditableVideoDraftInput,
  type TextOverlay,
  type TextOverlayPosition,
  type TextOverlayStyle,
} from "@/lib/edit/video-library";
import {
  EDIT_OVERLAY_HORIZONTAL_INSET_PERCENT,
  EDIT_OVERLAY_VERTICAL_INSET_PERCENT,
  getEditOverlayBackgroundColor,
  getEditOverlayRenderMetrics,
} from "@/lib/edit/overlay-render-spec";
import { cn } from "@/lib/utils";

const MIN_TRIM_SECONDS = 1;
const TEXT_OVERLAY_MAX_LENGTH = 100;

type TrimHandle = "start" | "end";

export type FocusedVideoEditorDraftState = EditableVideoDraftInput;

export function FocusedVideoEditor({
  actionFooter,
  onDraftChange,
  video,
}: {
  actionFooter?: ReactNode;
  onDraftChange?: (draft: FocusedVideoEditorDraftState) => void;
  video: EditableVideo;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const initialDuration = video.durationSeconds ?? 0;
  const initialTrimStart = video.draft?.trimStartSeconds ?? 0;
  const initialTrimEnd = video.draft?.trimEndSeconds ?? initialDuration;
  const [currentTime, setCurrentTime] = useState(initialTrimStart);
  const [duration, setDuration] = useState(initialDuration);
  const [previewAspectRatio, setPreviewAspectRatio] = useState(
    getPreviewAspectRatioNumber(video.ratio),
  );
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>(
    () => video.draft?.textOverlays ?? [],
  );
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    () => video.draft?.textOverlays[0]?.id ?? null,
  );
  const [trimEnd, setTrimEnd] = useState(initialTrimEnd);
  const [trimMessage, setTrimMessage] = useState<string | null>(null);
  const [trimStart, setTrimStart] = useState(initialTrimStart);
  const [videoLoadState, setVideoLoadState] = useState<"loading" | "ready" | "error">(
    video.videoUrl ? "loading" : "error",
  );

  const selectedOverlay =
    textOverlays.find((overlay) => overlay.id === selectedOverlayId) ??
    textOverlays[0] ??
    null;
  const hasVideoSource = Boolean(video.videoUrl);
  const effectiveDuration = duration || video.durationSeconds || 0;
  const selectedDuration = Math.max(0, trimEnd - trimStart);
  const canPreviewTrim =
    hasVideoSource && effectiveDuration > 0 && selectedDuration >= MIN_TRIM_SECONDS;
  const maxPreviewWidth = 320;

  useEffect(() => {
    onDraftChange?.({
      textOverlays,
      trimEndSeconds: trimEnd > 0 ? trimEnd : null,
      trimStartSeconds: trimStart,
    });
  }, [onDraftChange, textOverlays, trimEnd, trimStart]);

  useEffect(() => {
    if (videoLoadState !== "loading") {
      return;
    }

    const timer = window.setTimeout(() => setVideoLoadState("error"), 10000);
    return () => window.clearTimeout(timer);
  }, [videoLoadState]);

  function handleLoadedMetadata() {
    const videoElement = videoRef.current;

    if (!videoElement || !Number.isFinite(videoElement.duration)) {
      return;
    }

    const metadataDuration = Math.max(0, videoElement.duration);
    const initialRange = getInitialTrimRange({
      duration: metadataDuration,
      trimEnd: video.draft?.trimEndSeconds ?? metadataDuration,
      trimStart: initialTrimStart,
    });

    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      setPreviewAspectRatio(videoElement.videoWidth / videoElement.videoHeight);
    }

    setDuration(metadataDuration);
    setTrimStart(initialRange.start);
    setTrimEnd(initialRange.end);
    setCurrentTime(initialRange.start);
    videoElement.currentTime = initialRange.start;
    setTrimMessage(null);
    setVideoLoadState("ready");
  }

  function handleTimeUpdate() {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    setCurrentTime(videoElement.currentTime);

    if (trimEnd > trimStart && videoElement.currentTime >= trimEnd) {
      videoElement.pause();
      videoElement.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
  }

  function seekPreview(nextTime: number) {
    const videoElement = videoRef.current;

    if (!videoElement) {
      setCurrentTime(nextTime);
      return;
    }

    videoElement.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function updateTrimStart(nextStart: number) {
    if (effectiveDuration <= 0) {
      return;
    }

    const maxStart = Math.max(0, trimEnd - MIN_TRIM_SECONDS);
    const safeStart = clampTime(nextStart, 0, maxStart);

    if (trimEnd - safeStart < MIN_TRIM_SECONDS) {
      setTrimMessage("Trimmed clip must be at least 1 second.");
      return;
    }

    setTrimStart(safeStart);
    setTrimMessage(null);
    seekPreview(safeStart);
  }

  function updateTrimEnd(nextEnd: number) {
    if (effectiveDuration <= 0) {
      return;
    }

    const minEnd = Math.min(effectiveDuration, trimStart + MIN_TRIM_SECONDS);
    const safeEnd = clampTime(nextEnd, minEnd, effectiveDuration);

    if (safeEnd - trimStart < MIN_TRIM_SECONDS) {
      setTrimMessage("Trimmed clip must be at least 1 second.");
      return;
    }

    setTrimEnd(safeEnd);
    setTrimMessage(null);
    seekPreview(safeEnd);
  }

  function resetTrimRange() {
    if (effectiveDuration <= 0) {
      return;
    }

    setTrimStart(0);
    setTrimEnd(effectiveDuration);
    setTrimMessage(null);
    seekPreview(0);
  }

  function playTrimmedPreview() {
    const videoElement = videoRef.current;

    if (!videoElement || !canPreviewTrim) {
      return;
    }

    videoElement.currentTime = trimStart;
    setCurrentTime(trimStart);
    void videoElement.play();
  }

  function addTextOverlay() {
    const position = getAvailableOverlayPosition(textOverlays);

    if (!position) {
      return;
    }

    const nextOverlay = createTextOverlay(position);

    setTextOverlays((currentOverlays) => [...currentOverlays, nextOverlay]);
    setSelectedOverlayId(nextOverlay.id);
  }

  function updateTextOverlay(
    overlayId: string,
    patch: Partial<Pick<TextOverlay, "position" | "style" | "text">>,
  ) {
    setTextOverlays((currentOverlays) => {
      if (
        patch.position &&
        currentOverlays.some(
          (overlay) =>
            overlay.id !== overlayId && overlay.position === patch.position,
        )
      ) {
        return currentOverlays;
      }

      return currentOverlays
        .map((overlay) =>
          overlay.id === overlayId
            ? {
                ...overlay,
                ...patch,
                text:
                  patch.text === undefined
                    ? overlay.text
                    : patch.text.slice(0, TEXT_OVERLAY_MAX_LENGTH),
              }
            : overlay,
        )
        .sort(sortTextOverlaysByPosition);
    });
  }

  function deleteTextOverlay(overlayId: string) {
    setTextOverlays((currentOverlays) => {
      return currentOverlays.filter((overlay) => overlay.id !== overlayId);
    });

    if (selectedOverlayId === overlayId) {
      setSelectedOverlayId(
        textOverlays.find((overlay) => overlay.id !== overlayId)?.id ?? null,
      );
    }
  }

  return (
    <section className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid gap-0 lg:grid-cols-[344px_minmax(0,1fr)] xl:grid-cols-[368px_minmax(0,1fr)]">
        <section className="border-b border-border bg-[#f5f5f6] px-4 py-5 sm:px-5 lg:border-b-0 lg:border-r lg:py-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Film className="size-4 text-muted" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-foreground-strong">Preview</h2>
            </div>
            <span className="text-xs font-medium text-muted">
              {formatPreciseTime(selectedDuration)} selected
            </span>
          </div>

          <div className="flex justify-center">
            <div
              className="relative overflow-hidden rounded-md bg-black text-white [container-type:size]"
              style={{
                aspectRatio: previewAspectRatio,
                maxHeight: "68vh",
                width: `min(100%, ${maxPreviewWidth}px)`,
              }}
            >
              {video.videoUrl ? (
                <video
                  ref={videoRef}
                  src={video.videoUrl}
                  poster={video.thumbnailUrl ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  onCanPlay={() => setVideoLoadState("ready")}
                  onError={() => setVideoLoadState("error")}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  className="size-full object-contain object-center"
                />
              ) : null}

              {videoLoadState === "loading" ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                  <div className="flex items-center gap-2 rounded-md bg-black/65 px-3 py-2 text-xs font-semibold text-white">
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Loading preview
                  </div>
                </div>
              ) : null}

              {videoLoadState === "error" ? (
                <div className="absolute inset-0 flex size-full items-center justify-center bg-[#17181b] px-6 text-center">
                  <div>
                    <Film className="mx-auto size-8 text-white/60" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-white/85">
                      Preview unavailable
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/60">
                      Refresh the demo to try loading it again.
                    </p>
                  </div>
                </div>
              ) : null}

              {textOverlays.map((overlay) =>
                overlay.text.trim() ? (
                  <div
                    key={overlay.id}
                    className={getOverlayPositionClass(overlay.position)}
                    style={getOverlayPositionStyle(overlay.position)}
                  >
                    <div
                      className={getOverlayStyleClass()}
                      style={getOverlayStyle(overlay.style, video.ratio)}
                    >
                      {overlay.text}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </section>

        <aside className="min-w-0 bg-card">
          <div className="space-y-7 px-4 py-5 sm:px-6 lg:py-6 xl:px-7">
            <TrimControls
              canPreviewTrim={canPreviewTrim}
              currentTime={currentTime}
              duration={effectiveDuration}
              message={trimMessage}
              selectedDuration={selectedDuration}
              trimEnd={trimEnd}
              trimStart={trimStart}
              onPlayTrimmedPreview={playTrimmedPreview}
              onResetTrim={resetTrimRange}
              onTrimEndChange={updateTrimEnd}
              onTrimStartChange={updateTrimStart}
            />

            <TextOverlayControls
              overlays={textOverlays}
              selectedOverlay={selectedOverlay}
              selectedOverlayId={selectedOverlayId}
              onAddOverlay={addTextOverlay}
              onDeleteOverlay={deleteTextOverlay}
              onSelectOverlay={setSelectedOverlayId}
              onUpdateOverlay={updateTextOverlay}
            />
          </div>
        </aside>
      </div>

      {actionFooter ? (
        <footer className="border-t border-border bg-card-muted px-4 py-3 sm:px-6">
          {actionFooter}
        </footer>
      ) : null}
    </section>
  );
}

function TrimControls({
  canPreviewTrim,
  currentTime,
  duration,
  message,
  onPlayTrimmedPreview,
  onResetTrim,
  onTrimEndChange,
  onTrimStartChange,
  selectedDuration,
  trimEnd,
  trimStart,
}: {
  canPreviewTrim: boolean;
  currentTime: number;
  duration: number;
  message: string | null;
  onPlayTrimmedPreview: () => void;
  onResetTrim: () => void;
  onTrimEndChange: (seconds: number) => void;
  onTrimStartChange: (seconds: number) => void;
  selectedDuration: number;
  trimEnd: number;
  trimStart: number;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeHandle, setActiveHandle] = useState<TrimHandle | null>(null);
  const selectedLeft = getTimePercent(trimStart, duration);
  const selectedRight = getTimePercent(trimEnd, duration);
  const canEditTrim = duration > 0;

  function updateHandleFromPointer(
    handle: TrimHandle,
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const nextTime = getPointerTime(event, trackRef.current, duration);

    if (handle === "start") {
      onTrimStartChange(nextTime);
    } else {
      onTrimEndChange(nextTime);
    }
  }

  function handleTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canEditTrim || event.button !== 0) {
      return;
    }

    const nextTime = getPointerTime(event, trackRef.current, duration);
    const nearestHandle =
      Math.abs(nextTime - trimStart) <= Math.abs(nextTime - trimEnd)
        ? "start"
        : "end";

    if (nearestHandle === "start") {
      onTrimStartChange(nextTime);
    } else {
      onTrimEndChange(nextTime);
    }
  }

  function handleHandlePointerDown(
    handle: TrimHandle,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!canEditTrim || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setActiveHandle(handle);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateHandleFromPointer(handle, event);
  }

  function handleHandlePointerMove(
    handle: TrimHandle,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (activeHandle !== handle) {
      return;
    }

    updateHandleFromPointer(handle, event);
  }

  function handleHandlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setActiveHandle(null);
  }

  function handleHandleKeyDown(
    handle: TrimHandle,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) {
    const step = event.shiftKey ? 1 : 0.1;
    let nextValue: number | null = null;

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextValue = (handle === "start" ? trimStart : trimEnd) - step;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextValue = (handle === "start" ? trimStart : trimEnd) + step;
    } else if (event.key === "Home") {
      nextValue = handle === "start" ? 0 : trimStart + MIN_TRIM_SECONDS;
    } else if (event.key === "End") {
      nextValue = handle === "start" ? trimEnd - MIN_TRIM_SECONDS : duration;
    }

    if (nextValue === null) {
      return;
    }

    event.preventDefault();

    if (handle === "start") {
      onTrimStartChange(nextValue);
    } else {
      onTrimEndChange(nextValue);
    }
  }

  return (
    <section className="border-b border-border pb-7">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scissors className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground-strong">
            Trim clip
          </h3>
        </div>
        <span className="rounded-full bg-card-muted px-2.5 py-1 text-xs font-semibold text-muted">
          {formatPreciseTime(selectedDuration)} selected
        </span>
      </div>

      <div className="mt-6">
        <div
          ref={trackRef}
          className="relative mx-5 h-[72px]"
          onPointerDown={handleTrackPointerDown}
        >
          <span
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-foreground-strong px-2 py-1 text-[11px] font-semibold text-white"
            style={{ left: `${selectedLeft}%` }}
          >
            {formatPreciseTime(trimStart)}
          </span>
          <span
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-foreground-strong px-2 py-1 text-[11px] font-semibold text-white"
            style={{ left: `${selectedRight}%` }}
          >
            {formatPreciseTime(trimEnd || duration)}
          </span>
          <div className="absolute inset-x-0 top-11 h-1 -translate-y-1/2 rounded-full bg-[#dedfe2]" />
          <div
            className="absolute top-11 h-0.5 -translate-y-1/2 rounded-full bg-brand"
            style={{
              left: `${selectedLeft}%`,
              width: `${Math.max(0, selectedRight - selectedLeft)}%`,
            }}
          />

          <button
            type="button"
            role="slider"
            aria-label="Trim start"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, trimEnd - MIN_TRIM_SECONDS)}
            aria-valuenow={Number(trimStart.toFixed(1))}
            onKeyDown={(event) => handleHandleKeyDown("start", event)}
            onPointerCancel={handleHandlePointerUp}
            onPointerDown={(event) => handleHandlePointerDown("start", event)}
            onPointerMove={(event) => handleHandlePointerMove("start", event)}
            onPointerUp={handleHandlePointerUp}
            disabled={!canEditTrim}
            className="absolute top-11 flex h-11 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
            style={{ left: `${selectedLeft}%` }}
          >
            <span
              className={cn(
                "block h-6 w-3 rounded-[4px] border border-brand bg-white shadow-sm transition",
                activeHandle === "start" && "bg-brand-soft",
              )}
              aria-hidden="true"
            />
            <span className="sr-only">Drag trim start</span>
          </button>

          <button
            type="button"
            role="slider"
            aria-label="Trim end"
            aria-valuemin={Math.min(duration, trimStart + MIN_TRIM_SECONDS)}
            aria-valuemax={duration}
            aria-valuenow={Number(trimEnd.toFixed(1))}
            onKeyDown={(event) => handleHandleKeyDown("end", event)}
            onPointerCancel={handleHandlePointerUp}
            onPointerDown={(event) => handleHandlePointerDown("end", event)}
            onPointerMove={(event) => handleHandlePointerMove("end", event)}
            onPointerUp={handleHandlePointerUp}
            disabled={!canEditTrim}
            className="absolute top-11 flex h-11 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
            style={{ left: `${selectedRight}%` }}
          >
            <span
              className={cn(
                "block h-6 w-3 rounded-[4px] border border-brand bg-white shadow-sm transition",
                activeHandle === "end" && "bg-brand-soft",
              )}
              aria-hidden="true"
            />
            <span className="sr-only">Drag trim end</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
          <span>{formatPreciseTime(0)}</span>
          <span>Current {formatPreciseTime(currentTime)}</span>
          <span>{formatPreciseTime(duration)}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(116px,1fr)_minmax(116px,1fr)_auto_auto] lg:items-end">
        <label className="block">
          <span className="text-xs font-semibold text-muted">Start</span>
          <input
            type="number"
            min={0}
            max={Math.max(0, trimEnd - MIN_TRIM_SECONDS)}
            step={0.1}
            value={formatNumberInput(trimStart)}
            onChange={(event) => onTrimStartChange(Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted">End</span>
          <input
            type="number"
            min={Math.min(duration, trimStart + MIN_TRIM_SECONDS)}
            max={duration}
            step={0.1}
            value={formatNumberInput(trimEnd)}
            onChange={(event) => onTrimEndChange(Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <button
          type="button"
          onClick={onPlayTrimmedPreview}
          disabled={!canPreviewTrim}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground-strong px-3.5 text-sm font-semibold text-white transition-colors hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1"
        >
          <Play className="size-3.5" aria-hidden="true" />
          Preview selection
        </button>
        <button
          type="button"
          onClick={onResetTrim}
          disabled={!canEditTrim}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset
        </button>
      </div>

      {message ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold text-error">
          <AlertCircle className="size-3.5" aria-hidden="true" />
          {message}
        </p>
      ) : null}
    </section>
  );
}

function TextOverlayControls({
  onAddOverlay,
  onDeleteOverlay,
  onSelectOverlay,
  onUpdateOverlay,
  overlays,
  selectedOverlay,
  selectedOverlayId,
}: {
  onAddOverlay: () => void;
  onDeleteOverlay: (overlayId: string) => void;
  onSelectOverlay: (overlayId: string) => void;
  onUpdateOverlay: (
    overlayId: string,
    patch: Partial<Pick<TextOverlay, "position" | "style" | "text">>,
  ) => void;
  overlays: TextOverlay[];
  selectedOverlay: TextOverlay | null;
  selectedOverlayId: string | null;
}) {
  const usedPositions = new Set(overlays.map((overlay) => overlay.position));
  const canAddOverlay =
    overlays.length < MAX_TEXT_OVERLAYS &&
    textOverlayPositions.some((position) => !usedPositions.has(position));
  const characterCount = selectedOverlay?.text.length ?? 0;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Type className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground-strong">
            Text overlays
          </h3>
        </div>
        <button
          type="button"
          onClick={onAddOverlay}
          disabled={!canAddOverlay}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-white px-2.5 text-xs font-semibold text-[#173454] transition hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add text
        </button>
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          {overlays.length > 0 ? (
            <ol className="space-y-2">
              {overlays.map((overlay, index) => {
                const selected = overlay.id === selectedOverlayId;

                return (
                  <li
                    key={overlay.id}
                    className={cn(
                      "flex items-stretch gap-2 rounded-md border bg-white p-2.5 transition-colors",
                      selected
                        ? "border-brand bg-brand-soft/55"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectOverlay(overlay.id)}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                    >
                      <span className="block text-xs font-semibold text-foreground-strong">
                        {index + 1}. {getPositionLabel(overlay.position)} text
                      </span>
                      <span className="mt-1 block truncate text-xs font-medium text-muted">
                        {overlay.text.trim() || "Empty text"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteOverlay(overlay.id)}
                      aria-label={`Delete ${getPositionLabel(overlay.position)} text`}
                      title="Delete overlay"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-white px-3 py-4 text-sm font-semibold text-muted">
              No text overlays.
            </div>
          )}

          {!canAddOverlay && overlays.length >= MAX_TEXT_OVERLAYS ? (
            <p className="text-xs font-semibold text-muted">
              All three positions are already used.
            </p>
          ) : null}

          {selectedOverlay ? (
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <label
                  className="text-xs font-semibold text-muted"
                  htmlFor={`text-overlay-${selectedOverlay.id}`}
                >
                  Text
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateOverlay(selectedOverlay.id, { text: "" })}
                  disabled={!selectedOverlay.text}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-white px-2 text-xs font-semibold text-muted transition hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="size-3" aria-hidden="true" />
                  Clear
                </button>
              </div>
              <textarea
                id={`text-overlay-${selectedOverlay.id}`}
                value={selectedOverlay.text}
                onChange={(event) =>
                  onUpdateOverlay(selectedOverlay.id, {
                    text: event.target.value,
                  })
                }
                maxLength={TEXT_OVERLAY_MAX_LENGTH}
                rows={4}
                className="mt-2 min-h-28 w-full resize-none rounded-md border border-border bg-white px-3 py-2.5 text-sm font-semibold leading-5 text-foreground outline-none transition placeholder:text-muted-subtle focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <div className="mt-2 flex justify-end text-xs font-medium text-muted">
                {characterCount} / {TEXT_OVERLAY_MAX_LENGTH} characters
              </div>
            </div>
          ) : null}
        </div>

        <aside className="border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          {selectedOverlay ? (
            <div className="space-y-5">
              <SegmentedControl
                disabledOptions={textOverlayPositions.filter(
                  (position) =>
                    position !== selectedOverlay.position &&
                    usedPositions.has(position),
                )}
                label="Position"
                options={textOverlayPositions}
                value={selectedOverlay.position}
                onChange={(position) =>
                  onUpdateOverlay(selectedOverlay.id, { position })
                }
              />

              <div className="border-t border-border pt-5">
                <SegmentedControl
                  label="Style"
                  layout="stack"
                  options={textOverlayStyles}
                  value={selectedOverlay.style}
                  onChange={(style) => onUpdateOverlay(selectedOverlay.id, { style })}
                />
                <p className="mt-2 text-xs font-medium leading-5 text-muted">
                  {getOverlayStyleDescription(selectedOverlay.style)}
                </p>
                <StylePreview
                  style={selectedOverlay.style}
                  text={selectedOverlay.text || "Text"}
                />
              </div>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border bg-white px-3 py-4 text-sm font-semibold text-muted">
              Add a text overlay to edit its position and style.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function SegmentedControl<TValue extends string>({
  disabledOptions,
  label,
  layout = "row",
  onChange,
  options,
  value,
}: {
  disabledOptions?: TValue[];
  label: string;
  layout?: "row" | "stack";
  onChange: (value: TValue) => void;
  options: readonly TValue[];
  value: TValue;
}) {
  const disabled = new Set(disabledOptions ?? []);

  return (
    <div>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div
        className={cn(
          "mt-1 rounded-md border border-border bg-card-muted p-1",
          layout === "row" ? "flex" : "grid gap-1",
        )}
      >
        {options.map((option) => {
          const selected = option === value;
          const isDisabled = disabled.has(option);

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              disabled={isDisabled}
              className={cn(
                "h-8 rounded-[5px] px-3 text-sm font-semibold capitalize transition",
                layout === "row" && "flex-1",
                selected
                  ? "border border-brand/45 bg-white text-primary"
                  : "text-muted hover:text-foreground",
                isDisabled && "cursor-not-allowed opacity-45 hover:text-muted",
              )}
            >
              {formatOverlayStyleLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StylePreview({
  style,
  text,
}: {
  style: TextOverlayStyle;
  text: string;
}) {
  return (
    <div className="mt-4 flex min-h-16 items-center justify-center rounded-md border border-border bg-card-muted px-4 py-5 text-center">
      <span className={getStylePreviewClass(style)}>
        {text.trim() || "Text"}
      </span>
    </div>
  );
}

function getAvailableOverlayPosition(overlays: TextOverlay[]) {
  const usedPositions = new Set(overlays.map((overlay) => overlay.position));

  return (
    textOverlayPositions.find((position) => !usedPositions.has(position)) ?? null
  );
}

function getOverlayPositionClass(position: TextOverlayPosition) {
  const base = "pointer-events-none absolute z-10 flex justify-center text-center";

  if (position === "middle") {
    return `${base} -translate-y-1/2`;
  }

  return base;
}

function getOverlayPositionStyle(
  position: TextOverlayPosition,
): CSSProperties {
  const style: CSSProperties = {
    left: `${EDIT_OVERLAY_HORIZONTAL_INSET_PERCENT}%`,
    right: `${EDIT_OVERLAY_HORIZONTAL_INSET_PERCENT}%`,
  };

  if (position === "top") {
    return {
      ...style,
      top: `${EDIT_OVERLAY_VERTICAL_INSET_PERCENT}%`,
    };
  }

  if (position === "middle") {
    return { ...style, top: "50%" };
  }

  return {
    ...style,
    bottom: `${EDIT_OVERLAY_VERTICAL_INSET_PERCENT}%`,
  };
}

function getOverlayStyleClass() {
  const base =
    "max-w-full whitespace-pre-line break-words font-semibold text-white";

  return base;
}

function getOverlayStyle(
  style: TextOverlayStyle,
  ratio: EditableVideo["ratio"],
): CSSProperties {
  const metrics = getEditOverlayRenderMetrics(style, ratio);

  return {
    backgroundColor: getEditOverlayBackgroundColor(style),
    fontFamily: metrics.fontFamily,
    fontSize: `${metrics.fontSizeContainerWidthPercent}cqw`,
    fontWeight: metrics.fontWeight,
    lineHeight: metrics.lineHeight,
    padding:
      metrics.padding > 0
        ? `${metrics.paddingContainerWidthPercent}cqw`
        : undefined,
    textShadow: metrics.textShadow,
  };
}

function getStylePreviewClass(style: TextOverlayStyle) {
  const base =
    "inline-flex max-w-full whitespace-pre-line break-words px-2 py-1 text-sm font-semibold leading-5";

  if (style === "bubble") {
    return `${base} bg-[#173454] text-white shadow-sm`;
  }

  if (style === "minimal") {
    return `${base} bg-card-muted text-foreground-strong`;
  }

  return `${base} text-foreground-strong`;
}

function getOverlayStyleDescription(style: TextOverlayStyle) {
  if (style === "bubble") {
    return "Bubble style adds a strong dark background behind the text.";
  }

  if (style === "minimal") {
    return "Minimal style adds a subtle backing for lighter footage.";
  }

  return "Clean style shows simple text without background.";
}

function getInitialTrimRange({
  duration,
  trimEnd,
  trimStart,
}: {
  duration: number;
  trimEnd: number;
  trimStart: number;
}) {
  if (duration <= 0) {
    return { end: 0, start: 0 };
  }

  const maxStart = Math.max(0, duration - MIN_TRIM_SECONDS);
  const start = clampTime(trimStart, 0, maxStart);
  const minEnd = Math.min(duration, start + MIN_TRIM_SECONDS);
  const end = clampTime(trimEnd, minEnd, duration);

  return { end, start };
}

function getPointerTime(
  event: ReactPointerEvent<HTMLElement>,
  trackElement: HTMLDivElement | null,
  duration: number,
) {
  if (!trackElement || duration <= 0) {
    return 0;
  }

  const rect = trackElement.getBoundingClientRect();
  const progress = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;

  return clampTime(progress * duration, 0, duration);
}

function getPreviewAspectRatioNumber(ratio: EditableVideo["ratio"]) {
  const [width, height] = ratio.split(":").map(Number);

  return width > 0 && height > 0 ? width / height : 9 / 16;
}

function clampTime(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function getTimePercent(seconds: number, duration: number) {
  if (!duration || duration <= 0) {
    return 0;
  }

  return clampTime((seconds / duration) * 100, 0, 100);
}

function formatNumberInput(seconds: number) {
  return (Math.round(Math.max(0, seconds) * 10) / 10).toFixed(1);
}

function formatPreciseTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const tenths = Math.floor((safeSeconds % 1) * 10);

  return `${minutes}:${wholeSeconds.toString().padStart(2, "0")}.${tenths}`;
}

function sortTextOverlaysByPosition(first: TextOverlay, second: TextOverlay) {
  return (
    textOverlayPositions.indexOf(first.position) -
    textOverlayPositions.indexOf(second.position)
  );
}

function getPositionLabel(position: TextOverlayPosition) {
  if (position === "top") {
    return "Top";
  }

  if (position === "middle") {
    return "Middle";
  }

  return "Bottom";
}

function formatOverlayStyleLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
