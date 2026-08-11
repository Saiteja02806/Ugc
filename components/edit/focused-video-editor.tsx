"use client";

import {
  AlertCircle,
  Clock3,
  Film,
  Loader2,
  Pause,
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
} from "@/lib/edit/video-library";
import { normalizeEditableVideoDraftForDuration } from "@/lib/edit/editor-draft";
import {
  EDIT_OVERLAY_HORIZONTAL_INSET_PERCENT,
  EDIT_OVERLAY_SHADOW_OFFSET_PX,
  EDIT_OVERLAY_VERTICAL_INSET_PERCENT,
  buildEditOverlayTextLayout,
} from "@/lib/edit/overlay-render-spec";
import { cn } from "@/lib/utils";

const MIN_TRIM_SECONDS = 1;
const TEXT_OVERLAY_MAX_LENGTH = 100;

type TrimHandle = "start" | "end";

export type FocusedVideoEditorDraftState = EditableVideoDraftInput;

export function FocusedVideoEditor({
  actionFooter,
  hasSavedVideoWithNewerChanges = false,
  isCurrentVersionSaved = false,
  onDraftChange,
  onDraftValidityChange,
  renderedVideoUrl,
  video,
}: {
  actionFooter?: ReactNode;
  hasSavedVideoWithNewerChanges?: boolean;
  isCurrentVersionSaved?: boolean;
  onDraftChange?: (draft: FocusedVideoEditorDraftState) => void;
  onDraftValidityChange?: (isValid: boolean) => void;
  renderedVideoUrl?: string | null;
  video: EditableVideo;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasInitializedMetadataRef = useRef(false);
  const draftPreviewTabRef = useRef<HTMLButtonElement | null>(null);
  const renderedPreviewTabRef = useRef<HTMLButtonElement | null>(null);
  const initialDuration = video.durationSeconds ?? 0;
  const initialTrimStart = video.draft?.trimStartSeconds ?? 0;
  const initialTrimEnd = video.draft?.trimEndSeconds ?? initialDuration;
  const [currentTime, setCurrentTime] = useState(initialTrimStart);
  const [duration, setDuration] = useState(initialDuration);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewMode, setPreviewMode] = useState<"draft" | "rendered">("draft");
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
  const previewAspectRatio = getPreviewAspectRatioNumber(video.ratio);
  const activePreviewMode = renderedVideoUrl ? previewMode : "draft";
  const truncatedOverlayIds = new Set(
    textOverlays
      .filter(
        (overlay) =>
          overlay.text.trim() &&
          buildEditOverlayTextLayout(overlay.text, overlay.style, video.ratio)
            .isTruncated,
      )
      .map((overlay) => overlay.id),
  );
  const hasTruncatedOverlay = truncatedOverlayIds.size > 0;

  useEffect(() => {
    onDraftValidityChange?.(!hasTruncatedOverlay);
  }, [hasTruncatedOverlay, onDraftValidityChange]);

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

    if (hasInitializedMetadataRef.current) {
      setDuration(metadataDuration);
      setVideoLoadState("ready");
      return;
    }

    const initialRange = getInitialTrimRange({
      duration: metadataDuration,
      trimEnd: video.draft?.trimEndSeconds ?? metadataDuration,
      trimStart: initialTrimStart,
    });

    hasInitializedMetadataRef.current = true;
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
      setIsPreviewPlaying(false);
    }
  }

  function togglePreviewPlayback() {
    const videoElement = videoRef.current;

    if (!videoElement || !canPreviewTrim) {
      return;
    }

    if (!videoElement.paused) {
      videoElement.pause();
      setIsPreviewPlaying(false);
      return;
    }

    if (videoElement.currentTime < trimStart || videoElement.currentTime >= trimEnd) {
      videoElement.currentTime = trimStart;
      setCurrentTime(trimStart);
    }

    void videoElement.play();
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

  function emitDraftChange({
    nextTextOverlays = textOverlays,
    nextTrimEnd = trimEnd,
    nextTrimStart = trimStart,
  }: {
    nextTextOverlays?: TextOverlay[];
    nextTrimEnd?: number;
    nextTrimStart?: number;
  }) {
    onDraftChange?.(
      normalizeEditableVideoDraftForDuration(
        {
          textOverlays: nextTextOverlays,
          trimEndSeconds: nextTrimEnd > 0 ? nextTrimEnd : null,
          trimStartSeconds: nextTrimStart,
        },
        effectiveDuration,
      ),
    );
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
    emitDraftChange({ nextTrimStart: safeStart });
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
    emitDraftChange({ nextTrimEnd: safeEnd });
  }

  function resetTrimRange() {
    if (effectiveDuration <= 0) {
      return;
    }

    setTrimStart(0);
    setTrimEnd(effectiveDuration);
    setTrimMessage(null);
    seekPreview(0);
    emitDraftChange({
      nextTrimEnd: effectiveDuration,
      nextTrimStart: 0,
    });
  }

  function switchPreviewMode(nextMode: "draft" | "rendered") {
    if (nextMode === "rendered") {
      videoRef.current?.pause();
    }

    setPreviewMode(nextMode);
  }

  function handlePreviewTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) {
    let nextMode: "draft" | "rendered" | null = null;

    if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Home") {
      nextMode = "draft";
    } else if (
      event.key === "ArrowRight" ||
      event.key === "ArrowDown" ||
      event.key === "End"
    ) {
      nextMode = "rendered";
    }

    if (!nextMode) {
      return;
    }

    event.preventDefault();
    switchPreviewMode(nextMode);
    (nextMode === "draft"
      ? draftPreviewTabRef.current
      : renderedPreviewTabRef.current
    )?.focus();
  }

  function addTextOverlay() {
    const position = getAvailableOverlayPosition(textOverlays);

    if (!position) {
      return;
    }

    const nextOverlay = createTextOverlay(position);
    const nextTextOverlays = [...textOverlays, nextOverlay];

    setTextOverlays(nextTextOverlays);
    setSelectedOverlayId(nextOverlay.id);
    emitDraftChange({ nextTextOverlays });
  }

  function updateTextOverlay(
    overlayId: string,
    patch: Partial<Pick<TextOverlay, "position" | "style" | "text">>,
  ) {
    if (
      patch.position &&
      textOverlays.some(
        (overlay) =>
          overlay.id !== overlayId && overlay.position === patch.position,
      )
    ) {
      return;
    }

    const nextTextOverlays = textOverlays
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

    setTextOverlays(nextTextOverlays);
    emitDraftChange({ nextTextOverlays });
  }

  function deleteTextOverlay(overlayId: string) {
    const nextTextOverlays = textOverlays.filter(
      (overlay) => overlay.id !== overlayId,
    );

    setTextOverlays(nextTextOverlays);
    emitDraftChange({ nextTextOverlays });

    if (selectedOverlayId === overlayId) {
      setSelectedOverlayId(
        textOverlays.find((overlay) => overlay.id !== overlayId)?.id ?? null,
      );
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-[14px] border border-border bg-card">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,500px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(380px,560px)_minmax(0,1fr)]">
        <div className="grid min-w-0 self-start bg-card">
          <section className="flex h-[min(58dvh,600px)] min-h-[360px] flex-col overflow-hidden px-3 py-2 sm:px-4 sm:py-3">
            {renderedVideoUrl ? (
              <div className="mb-1 flex items-center justify-end">
                <div
                  role="tablist"
                  aria-label="Preview version"
                  className="flex rounded-control border border-border bg-card p-0.5"
                >
                  <button
                    ref={draftPreviewTabRef}
                    id="edit-preview-tab-draft"
                    type="button"
                    role="tab"
                    aria-controls="edit-preview-panel"
                    aria-selected={activePreviewMode === "draft"}
                    onClick={() => switchPreviewMode("draft")}
                    onKeyDown={handlePreviewTabKeyDown}
                    tabIndex={activePreviewMode === "draft" ? 0 : -1}
                    className={cn(
                      "h-8 rounded-[6px] px-3 text-xs font-semibold transition-colors",
                      activePreviewMode === "draft"
                        ? "bg-foreground-strong text-white"
                        : "text-muted hover:bg-card-muted hover:text-foreground",
                    )}
                  >
                    Draft
                  </button>
                  <button
                    ref={renderedPreviewTabRef}
                    id="edit-preview-tab-rendered"
                    type="button"
                    role="tab"
                    aria-controls="edit-preview-panel"
                    aria-selected={activePreviewMode === "rendered"}
                    onClick={() => switchPreviewMode("rendered")}
                    onKeyDown={handlePreviewTabKeyDown}
                    tabIndex={activePreviewMode === "rendered" ? 0 : -1}
                    className={cn(
                      "h-8 rounded-[6px] px-3 text-xs font-semibold transition-colors",
                      activePreviewMode === "rendered"
                        ? "bg-foreground-strong text-white"
                        : "text-muted hover:bg-card-muted hover:text-foreground",
                    )}
                  >
                    {isCurrentVersionSaved
                      ? "Export"
                      : hasSavedVideoWithNewerChanges
                        ? "Previous export"
                        : "Export"}
                  </button>
                </div>
              </div>
            ) : null}

            <div
              id={renderedVideoUrl ? "edit-preview-panel" : undefined}
              role={renderedVideoUrl ? "tabpanel" : undefined}
              aria-labelledby={
                renderedVideoUrl
                  ? `edit-preview-tab-${activePreviewMode}`
                  : undefined
              }
              className="flex min-h-0 flex-1 items-center justify-center"
            >
              <div
                className="relative max-h-full max-w-full overflow-hidden rounded-[6px] bg-black text-white ring-1 ring-black/10 shadow-[0_8px_18px_rgb(15_23_42_/_0.12)] [container-type:size]"
                style={{
                  aspectRatio: previewAspectRatio,
                  height: "min(100%, 520px)",
                }}
              >
                {video.videoUrl ? (
                  <video
                    ref={videoRef}
                    src={video.videoUrl}
                    poster={video.thumbnailUrl ?? undefined}
                    playsInline
                    preload="metadata"
                    onCanPlay={() => setVideoLoadState("ready")}
                    onError={() => setVideoLoadState("error")}
                    onLoadedMetadata={handleLoadedMetadata}
                    onPause={() => setIsPreviewPlaying(false)}
                    onPlay={() => setIsPreviewPlaying(true)}
                    onTimeUpdate={handleTimeUpdate}
                    className={cn(
                      "size-full object-cover object-center",
                      activePreviewMode === "draft" ? "block" : "hidden",
                    )}
                  />
                ) : null}

                {activePreviewMode === "rendered" && renderedVideoUrl ? (
                  <video
                    key={renderedVideoUrl}
                    src={renderedVideoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="size-full object-cover object-center"
                  />
                ) : null}

                {activePreviewMode === "draft" ? (
                  <>
                    {videoLoadState === "loading" ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                        <div className="flex items-center gap-2 rounded-control bg-black/70 px-3 py-2 text-xs font-semibold text-white">
                          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                          Loading preview
                        </div>
                      </div>
                    ) : null}

                    {videoLoadState === "error" ? (
                      <div className="absolute inset-0 flex size-full items-center justify-center bg-black px-6 text-center">
                        <div>
                          <Film className="mx-auto size-8 text-white/60" aria-hidden="true" />
                          <p className="mt-3 text-sm font-semibold text-white">
                            Preview unavailable
                          </p>
                          <p className="mt-1 max-w-56 text-xs leading-5 text-white/65">
                            The source video could not be loaded. Check the media file and try again.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {videoLoadState === "ready"
                      ? textOverlays.map((overlay) =>
                          overlay.text.trim() ? (
                            <div
                              key={overlay.id}
                              className={getOverlayPositionClass(overlay.position)}
                              style={getOverlayPositionStyle(overlay.position)}
                            >
                              <button
                                type="button"
                                aria-label={`Edit ${getPositionLabel(overlay.position)} text`}
                                aria-pressed={overlay.id === selectedOverlayId}
                                onClick={() => setSelectedOverlayId(overlay.id)}
                                className={cn(
                                  getOverlayStyleClass(),
                                  "pointer-events-auto rounded-[3px] outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                                  overlay.id === selectedOverlayId &&
                                    "ring-2 ring-brand ring-offset-2 ring-offset-black",
                                )}
                                style={getOverlayStyle(overlay, video.ratio)}
                              >
                                {getOverlayPreviewGraphic(overlay, video.ratio)}
                              </button>
                            </div>
                          ) : null,
                        )
                      : null}
                  </>
                ) : null}
              </div>
            </div>

            {activePreviewMode === "draft" ? (
              <div className="mx-auto mt-2 flex w-full max-w-xl items-center gap-2.5 text-foreground">
                <button
                  type="button"
                  onClick={togglePreviewPlayback}
                  disabled={!canPreviewTrim}
                  aria-label={isPreviewPlaying ? "Pause preview" : "Play preview"}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isPreviewPlaying ? (
                    <Pause className="size-4" aria-hidden="true" />
                  ) : (
                    <Play className="size-4 translate-x-px" aria-hidden="true" />
                  )}
                </button>
                <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-muted">
                  {formatPreciseTime(currentTime)}
                </span>
                <input
                  type="range"
                  aria-label="Preview playhead"
                  min={trimStart}
                  max={Math.max(trimStart, trimEnd)}
                  step={0.01}
                  value={clampTime(currentTime, trimStart, Math.max(trimStart, trimEnd))}
                  onChange={(event) => seekPreview(Number(event.target.value))}
                  disabled={!canPreviewTrim}
                  className="h-1 min-w-0 flex-1 cursor-pointer accent-brand disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">
                  {formatPreciseTime(trimEnd)}
                </span>
              </div>
            ) : null}
          </section>

          <div className="border-t border-border bg-card px-3 py-2 sm:px-4">
            <TrimControls
              currentTime={currentTime}
              duration={effectiveDuration}
              message={trimMessage}
              selectedDuration={selectedDuration}
              thumbnailUrl={video.thumbnailUrl}
              trimEnd={trimEnd}
              trimStart={trimStart}
              onResetTrim={resetTrimRange}
              onTrimEndChange={updateTrimEnd}
              onTrimStartChange={updateTrimStart}
            />
          </div>
        </div>

        <aside className="min-h-0 min-w-0 overflow-y-auto border-t border-border bg-card lg:border-l lg:border-t-0">
          <div className="px-4 py-3">
            <TextOverlayControls
              overlays={textOverlays}
              selectedOverlay={selectedOverlay}
              selectedOverlayId={selectedOverlayId}
              selectedOverlayIsTruncated={
                selectedOverlay
                  ? truncatedOverlayIds.has(selectedOverlay.id)
                  : false
              }
              onAddOverlay={addTextOverlay}
              onDeleteOverlay={deleteTextOverlay}
              onSelectOverlay={setSelectedOverlayId}
              onUpdateOverlay={updateTextOverlay}
            />
          </div>

          {actionFooter ? (
            <footer className="sticky bottom-0 border-t border-border bg-card px-4 py-3">
              {actionFooter}
            </footer>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function TrimControls({
  currentTime,
  duration,
  message,
  onResetTrim,
  onTrimEndChange,
  onTrimStartChange,
  selectedDuration,
  thumbnailUrl,
  trimEnd,
  trimStart,
}: {
  currentTime: number;
  duration: number;
  message: string | null;
  onResetTrim: () => void;
  onTrimEndChange: (seconds: number) => void;
  onTrimStartChange: (seconds: number) => void;
  selectedDuration: number;
  thumbnailUrl: string | null;
  trimEnd: number;
  trimStart: number;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isEditingStartRef = useRef(false);
  const isEditingEndRef = useRef(false);
  const [activeHandle, setActiveHandle] = useState<TrimHandle | null>(null);
  const [startInput, setStartInput] = useState(() => formatNumberInput(trimStart));
  const [endInput, setEndInput] = useState(() => formatNumberInput(trimEnd));
  const selectedLeft = getTimePercent(trimStart, duration);
  const selectedRight = getTimePercent(trimEnd, duration);
  const currentPercent = getTimePercent(currentTime, duration);
  const canEditTrim = duration > 0;

  useEffect(() => {
    if (!isEditingStartRef.current) {
      setStartInput(formatNumberInput(trimStart));
    }
  }, [trimStart]);

  useEffect(() => {
    if (!isEditingEndRef.current) {
      setEndInput(formatNumberInput(trimEnd));
    }
  }, [trimEnd]);

  function commitTimeInput(
    input: string,
    currentValue: number,
    onCommit: (seconds: number) => void,
    setInput: (value: string) => void,
  ) {
    const nextValue = Number(input);

    if (!input.trim() || !Number.isFinite(nextValue)) {
      setInput(formatNumberInput(currentValue));
      return;
    }

    onCommit(nextValue);
  }

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
    <section aria-labelledby="trim-heading">
      <div className="flex flex-wrap items-end gap-2">
        <div className="mr-auto flex min-w-0 items-center gap-2 pb-1">
          <Scissors className="size-4 text-primary" aria-hidden="true" />
          <h3 id="trim-heading" className="text-sm font-semibold text-foreground-strong">
            Trim clip
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card-muted px-2.5 py-1 text-xs font-semibold text-muted">
          <Clock3 className="size-3" aria-hidden="true" />
          {formatPreciseTime(selectedDuration)} selected
        </span>
        <label className="block w-20">
          <span className="text-xs font-semibold text-muted">Start</span>
          <input
            type="number"
            min={0}
            max={Math.max(0, trimEnd - MIN_TRIM_SECONDS)}
            step={0.1}
            value={startInput}
            onFocus={() => {
              isEditingStartRef.current = true;
            }}
            onChange={(event) => setStartInput(event.target.value)}
            onBlur={() => {
              isEditingStartRef.current = false;
              commitTimeInput(
                startInput,
                trimStart,
                onTrimStartChange,
                setStartInput,
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            className="mt-1 h-8 w-full rounded-control border border-border bg-card px-2.5 text-sm font-semibold tabular-nums text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <label className="block w-20">
          <span className="text-xs font-semibold text-muted">End</span>
          <input
            type="number"
            min={Math.min(duration, trimStart + MIN_TRIM_SECONDS)}
            max={duration}
            step={0.1}
            value={endInput}
            onFocus={() => {
              isEditingEndRef.current = true;
            }}
            onChange={(event) => setEndInput(event.target.value)}
            onBlur={() => {
              isEditingEndRef.current = false;
              commitTimeInput(
                endInput,
                trimEnd,
                onTrimEndChange,
                setEndInput,
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            className="mt-1 h-8 w-full rounded-control border border-border bg-card px-2.5 text-sm font-semibold tabular-nums text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <button
          type="button"
          onClick={onResetTrim}
          disabled={!canEditTrim}
          aria-label="Reset trim"
          title="Reset trim"
          className="inline-flex size-8 items-center justify-center rounded-control border border-border bg-card text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Reset trim</span>
        </button>
      </div>

      <div className="mt-2">
        <div
          ref={trackRef}
          className="relative mx-2 h-9 touch-none select-none"
          onPointerDown={handleTrackPointerDown}
        >
          <div className="pointer-events-none absolute inset-x-0 top-2 h-5 overflow-hidden rounded-control border border-border bg-card-muted">
            {thumbnailUrl ? (
              <span
                className="absolute inset-0 bg-cover bg-center opacity-15 grayscale"
                style={{
                  backgroundImage: `url(${JSON.stringify(thumbnailUrl)})`,
                }}
              />
            ) : null}
            <span className="absolute inset-0 bg-card-muted/45" />
          </div>
          <div
            className="pointer-events-none absolute bottom-2 top-2 rounded-l-control bg-background/85"
            style={{ left: 0, width: `${selectedLeft}%` }}
          />
          <div
            className="pointer-events-none absolute bottom-2 top-2 rounded-r-control bg-background/85"
            style={{ left: `${selectedRight}%`, right: 0 }}
          />
          <div
            className="pointer-events-none absolute bottom-2 top-2 rounded-[5px] border-y-2 border-brand"
            style={{
              left: `${selectedLeft}%`,
              width: `${Math.max(0, selectedRight - selectedLeft)}%`,
            }}
          />
          <div
            className="pointer-events-none absolute bottom-1 top-1 z-10 w-px -translate-x-1/2 bg-foreground shadow-[0_0_0_1px_rgb(255_255_255_/_0.65)]"
            style={{ left: `${currentPercent}%` }}
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
            className="absolute bottom-1 top-1 z-20 flex w-9 -translate-x-1/2 items-center justify-center rounded-control bg-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
            style={{ left: `${selectedLeft}%` }}
          >
            <span
              className={cn(
                "block h-full w-2 rounded-l-[5px] border-2 border-brand bg-white shadow-sm transition",
                activeHandle === "start" && "bg-brand-soft ring-2 ring-brand/20",
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
            className="absolute bottom-1 top-1 z-20 flex w-9 -translate-x-1/2 items-center justify-center rounded-control bg-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
            style={{ left: `${selectedRight}%` }}
          >
            <span
              className={cn(
                "block h-full w-2 rounded-r-[5px] border-2 border-brand bg-white shadow-sm transition",
                activeHandle === "end" && "bg-brand-soft ring-2 ring-brand/20",
              )}
              aria-hidden="true"
            />
            <span className="sr-only">Drag trim end</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] font-semibold tabular-nums text-muted">
          <span>{formatPreciseTime(0)}</span>
          <span>{formatPreciseTime(duration)}</span>
        </div>
      </div>

      {message ? (
        <p role="alert" className="mt-2 inline-flex items-center gap-2 rounded-control border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold text-error">
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
  selectedOverlayIsTruncated,
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
  selectedOverlayIsTruncated: boolean;
}) {
  const usedPositions = new Set(overlays.map((overlay) => overlay.position));
  const canAddOverlay =
    overlays.length < MAX_TEXT_OVERLAYS &&
    textOverlayPositions.some((position) => !usedPositions.has(position));
  const characterCount = selectedOverlay?.text.length ?? 0;

  return (
    <section aria-labelledby="text-layers-heading">
      <div
        className={cn(
          "grid gap-4",
          selectedOverlay &&
            "xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:gap-5",
        )}
      >
        <div className="min-w-0 xl:order-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Type className="size-4 text-primary" aria-hidden="true" />
              <h3 id="text-layers-heading" className="text-sm font-semibold text-foreground-strong">
                Layers
              </h3>
              <span className="text-xs font-medium text-muted">{overlays.length}/{MAX_TEXT_OVERLAYS}</span>
            </div>
            <button
              type="button"
              onClick={onAddOverlay}
              disabled={!canAddOverlay}
              title={canAddOverlay ? "Add text layer" : "All three text positions are in use"}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-control border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:border-primary-hover hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add text
            </button>
          </div>
          {overlays.length > 0 ? (
        <ol className="mt-3 divide-y divide-border border-y border-border">
          {overlays.map((overlay) => {
            const selected = overlay.id === selectedOverlayId;

            return (
              <li key={overlay.id} className={cn("flex items-center gap-2 transition-colors", selected && "bg-selected")}>
                <button
                  type="button"
                  onClick={() => onSelectOverlay(overlay.id)}
                  aria-pressed={selected}
                  className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-8 shrink-0 items-center justify-center rounded-control text-xs font-bold uppercase",
                      selected ? "bg-brand text-white" : "bg-card-muted text-muted",
                    )}
                  >
                    {overlay.position.slice(0, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground-strong">
                      {getPositionLabel(overlay.position)} - {formatOverlayStyleLabel(overlay.style)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-medium text-muted">
                      {overlay.text.trim() || "Empty text"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteOverlay(overlay.id)}
                  aria-label={`Delete ${getPositionLabel(overlay.position)} text`}
                  title="Delete layer"
                  className="mr-1 inline-flex size-10 shrink-0 items-center justify-center rounded-control text-muted transition hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="border-y border-dashed border-border px-2 py-5 text-sm text-muted">
          Add a text layer, then choose where it sits on the video.
        </div>
      )}
        </div>

      {selectedOverlay ? (
        <div className="min-w-0 flex flex-col gap-4 xl:order-1 xl:border-r xl:border-border xl:pr-5">
          <div>
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
                className="inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-muted transition hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-50"
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
              className="mt-2 min-h-24 w-full resize-y rounded-control border border-border bg-card px-3 py-2.5 text-sm font-semibold leading-5 text-foreground outline-none transition placeholder:text-muted-subtle focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <div className="mt-1.5 flex justify-end text-xs font-medium text-muted">
              <span className="tabular-nums">{characterCount}/{TEXT_OVERLAY_MAX_LENGTH}</span>
            </div>
            {selectedOverlayIsTruncated ? (
              <p
                role="alert"
                className="mt-2 inline-flex items-start gap-2 rounded-control border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold leading-5 text-error"
              >
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Too many line breaks for this output. Shorten the layer before exporting.
              </p>
            ) : null}
          </div>

          <div className="border-t border-border pt-4">
            <SegmentedControl
              disabledOptions={textOverlayPositions.filter(
                (position) =>
                  position !== selectedOverlay.position && usedPositions.has(position),
              )}
              label="Position"
              options={textOverlayPositions}
              value={selectedOverlay.position}
              onChange={(position) => onUpdateOverlay(selectedOverlay.id, { position })}
            />
          </div>

          <div className="border-t border-border pt-4">
            <SegmentedControl
              label="Style"
              options={textOverlayStyles}
              value={selectedOverlay.style}
              onChange={(style) => onUpdateOverlay(selectedOverlay.id, { style })}
            />
          </div>
        </div>
      ) : null}
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

  function handleKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentOption: TValue,
  ) {
    const enabledOptions = options.filter((option) => !disabled.has(option));
    const currentIndex = enabledOptions.indexOf(currentOption);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % enabledOptions.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex =
        (currentIndex - 1 + enabledOptions.length) % enabledOptions.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = enabledOptions.length - 1;
    }

    if (nextIndex === null || enabledOptions.length === 0) {
      return;
    }

    event.preventDefault();
    const nextOption = enabledOptions[nextIndex];
    const group = event.currentTarget.parentElement;
    onChange(nextOption);
    window.requestAnimationFrame(() => {
      const buttons = group?.querySelectorAll<HTMLButtonElement>('[role="radio"]');

      Array.from(buttons ?? []).find(
        (button) => button.dataset.segmentValue === nextOption,
      )?.focus();
    });
  }

  return (
    <fieldset>
      <legend className="text-xs font-semibold text-muted">{label}</legend>
      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          "mt-2 rounded-control bg-card-muted p-1",
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
              role="radio"
              aria-checked={selected}
              data-segment-value={option}
              onClick={() => onChange(option)}
              onKeyDown={(event) => handleKeyDown(event, option)}
              disabled={isDisabled}
              tabIndex={selected ? 0 : -1}
              title={isDisabled ? `${formatOverlayStyleLabel(option)} is already used by another layer` : undefined}
              className={cn(
                "min-h-10 rounded-[6px] px-3 text-sm font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                layout === "row" && "flex-1",
                selected
                  ? "bg-card text-primary shadow-[0_1px_2px_rgb(23_23_27_/_0.08)]"
                  : "text-muted hover:text-foreground",
                isDisabled && "cursor-not-allowed opacity-45 hover:text-muted",
              )}
            >
              {formatOverlayStyleLabel(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
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
    "m-0 block max-w-full appearance-none border-0 bg-transparent p-0 text-white";

  return base;
}

function getOverlayStyle(
  overlay: TextOverlay,
  ratio: EditableVideo["ratio"],
): CSSProperties {
  const layout = buildEditOverlayTextLayout(overlay.text, overlay.style, ratio);
  const { canvasWidth, containerWidth } = layout.bounds;
  const unit = 100 / canvasWidth;
  const cornerRadius =
    layout.fontSize * (overlay.style === "bubble" ? 0.32 : 0.18) * unit;

  return {
    backgroundColor: "transparent",
    borderRadius: `${cornerRadius}cqw`,
    boxSizing: "border-box",
    height: `${layout.bounds.containerHeight * unit}cqw`,
    width: `${containerWidth * unit}cqw`,
  };
}

function getOverlayPreviewGraphic(
  overlay: TextOverlay,
  ratio: EditableVideo["ratio"],
) {
  const layout = buildEditOverlayTextLayout(overlay.text, overlay.style, ratio);
  const { containerHeight, containerWidth } = layout.bounds;
  const centerX = containerWidth / 2;
  const fontFamily =
    'var(--font-edit-overlay), var(--font-geist-sans), "Noto Sans CJK SC", "Noto Sans CJK JP", ui-sans-serif, system-ui, sans-serif';

  return (
    <svg
      aria-hidden="true"
      className="block size-full overflow-visible"
      viewBox={`0 0 ${containerWidth} ${containerHeight}`}
    >
      {layout.backgroundOpacity !== null ? (
        <rect
          width={containerWidth}
          height={containerHeight}
          rx={Math.round(
            layout.fontSize * (overlay.style === "bubble" ? 0.32 : 0.18),
          )}
          fill="#000000"
          fillOpacity={layout.backgroundOpacity}
        />
      ) : null}

      {layout.lines.map((line, index) => {
        if (!line) {
          return null;
        }

        const baselineY = Math.round(
          layout.padding + layout.fontSize * 0.82 + index * layout.lineHeight,
        );
        const textProps = {
          fontFamily,
          fontSize: layout.fontSize,
          fontWeight: layout.fontWeight,
          textAnchor: "middle" as const,
        };

        return (
          <g key={`${overlay.id}-line-${index}`}>
            <text
              {...textProps}
              x={centerX + EDIT_OVERLAY_SHADOW_OFFSET_PX}
              y={baselineY + EDIT_OVERLAY_SHADOW_OFFSET_PX}
              fill="rgba(0, 0, 0, 0.45)"
            >
              {line}
            </text>
            <text {...textProps} x={centerX} y={baselineY} fill={layout.textColor}>
              {line}
            </text>
          </g>
        );
      })}
    </svg>
  );
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
