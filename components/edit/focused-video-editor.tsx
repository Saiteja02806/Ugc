"use client";

import {
  AlertCircle,
  Film,
  Play,
  RotateCcw,
  Scissors,
  Type,
  X,
} from "lucide-react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { useEffect, useRef, useState } from "react";

import {
  formatVideoDuration,
  getEditableVideoSourceLabel,
  getEditableVideoStatusLabel,
  type EditableVideo,
  type EditableVideoDraftInput,
  type TextOverlay,
  type TextOverlayPosition,
  type TextOverlayStyle,
} from "@/lib/edit/video-library";
import { cn } from "@/lib/utils";

const MIN_TRIM_SECONDS = 1;
const TEXT_OVERLAY_MAX_LENGTH = 100;
const overlayPositions: TextOverlayPosition[] = ["top", "middle", "bottom"];
const overlayStyles: TextOverlayStyle[] = ["clean", "bubble"];

type TrimHandle = "start" | "end";

export type FocusedVideoEditorDraftState = EditableVideoDraftInput;

export type FocusedVideoEditorDetail = {
  label: string;
  value: string;
};

export function FocusedVideoEditor({
  actionFooter,
  details,
  onDraftChange,
  video,
}: {
  actionFooter?: ReactNode;
  details?: FocusedVideoEditorDetail[];
  onDraftChange?: (draft: FocusedVideoEditorDraftState) => void;
  video: EditableVideo;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const initialDuration = video.durationSeconds ?? 0;
  const initialTrimStart = video.draft?.trimStartSeconds ?? 0;
  const initialTrimEnd = video.draft?.trimEndSeconds ?? initialDuration;
  const [duration, setDuration] = useState(initialDuration);
  const [currentTime, setCurrentTime] = useState(initialTrimStart);
  const [trimStart, setTrimStart] = useState(initialTrimStart);
  const [trimEnd, setTrimEnd] = useState(initialTrimEnd);
  const [trimMessage, setTrimMessage] = useState<string | null>(null);
  const [textOverlay, setTextOverlay] = useState<TextOverlay>({
    position: video.draft?.textOverlay.position ?? "bottom",
    style: video.draft?.textOverlay.style ?? "bubble",
    text: video.draft?.textOverlay.text ?? "",
  });

  const hasVideoSource = Boolean(video.videoUrl);
  const effectiveDuration = duration || video.durationSeconds || 0;
  const selectedDuration = Math.max(0, trimEnd - trimStart);
  const canPreviewTrim =
    hasVideoSource && effectiveDuration > 0 && selectedDuration >= MIN_TRIM_SECONDS;
  const editorDetails = details ?? getDefaultVideoDetails(video);

  useEffect(() => {
    onDraftChange?.({
      textOverlay,
      trimEndSeconds: trimEnd > 0 ? trimEnd : null,
      trimStartSeconds: trimStart,
    });
  }, [onDraftChange, textOverlay, trimEnd, trimStart]);

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

    setDuration(metadataDuration);
    setTrimStart(initialRange.start);
    setTrimEnd(initialRange.end);
    setCurrentTime(initialRange.start);
    videoElement.currentTime = initialRange.start;
    setTrimMessage(null);
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

    if (currentTime < safeStart || currentTime >= trimEnd) {
      seekPreview(safeStart);
    }
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

    if (currentTime > safeEnd || currentTime < trimStart) {
      seekPreview(trimStart);
    }
  }

  function setStartFromCurrentTime() {
    if (currentTime >= trimEnd) {
      setTrimMessage("End time must be after start time.");
      return;
    }

    updateTrimStart(currentTime);
  }

  function setEndFromCurrentTime() {
    if (currentTime <= trimStart) {
      setTrimMessage("End time must be after start time.");
      return;
    }

    updateTrimEnd(currentTime);
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

  return (
    <section className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(320px,0.88fr)_minmax(420px,1.12fr)] lg:items-start lg:gap-6">
      <div className="min-w-0 lg:sticky lg:top-4">
        <section className="rounded-panel border border-border bg-card p-3 shadow-sm">
          <div
            className="relative flex max-h-[60vh] min-h-[260px] w-full items-center justify-center overflow-hidden rounded-panel bg-[#101828] text-white lg:max-h-[calc(100vh-190px)]"
            style={{ aspectRatio: getPreviewAspectRatio(video.ratio) }}
          >
            {video.videoUrl ? (
              <video
                ref={videoRef}
                src={video.videoUrl}
                controls
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                className="size-full object-contain object-center"
              />
            ) : (
              <div className="px-6 text-center">
                <Film className="mx-auto size-9 text-white/75" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-white/75">
                  Video preview will appear here.
                </p>
              </div>
            )}

            {textOverlay.text.trim() ? (
              <div className={getOverlayPositionClass(textOverlay.position)}>
                <div className={getOverlayStyleClass(textOverlay.style)}>
                  {textOverlay.text}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <aside className="min-h-0 lg:max-h-[calc(100vh-166px)] lg:overflow-y-auto lg:pr-1">
        <div className="space-y-4 pb-4">
          <VideoDetailsPanel details={editorDetails} />

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
            onSetEnd={setEndFromCurrentTime}
            onSetStart={setStartFromCurrentTime}
            onTrimEndChange={updateTrimEnd}
            onTrimStartChange={updateTrimStart}
          />

          <TextOverlayControls
            textOverlay={textOverlay}
            onChange={setTextOverlay}
          />
        </div>

        {actionFooter ? (
          <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 py-3 backdrop-blur">
            {actionFooter}
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function VideoDetailsPanel({ details }: { details: FocusedVideoEditorDetail[] }) {
  return (
    <section className="rounded-panel border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card-muted text-primary">
          <Film className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground-strong">
            Video details
          </h2>
          <p className="mt-1 text-xs text-muted">
            Source information for this editable preview.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {details.map((detail) => (
          <div key={detail.label} className="min-w-0">
            <dt className="text-xs font-medium text-muted">{detail.label}</dt>
            <dd className="mt-1 truncate font-semibold text-foreground">
              {detail.value}
            </dd>
          </div>
        ))}
      </dl>
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
  onSetEnd,
  onSetStart,
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
  onSetEnd: () => void;
  onSetStart: () => void;
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
  const currentLeft = getTimePercent(currentTime, duration);
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
    <section className="rounded-panel border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card-muted text-primary">
          <Scissors className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground-strong">
                Trim settings
              </h2>
              <p className="mt-1 text-xs text-muted">
                Drag the handles or type exact times.
              </p>
            </div>
            <button
              type="button"
              onClick={onPlayTrimmedPreview}
              disabled={!canPreviewTrim}
              className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md bg-[#173454] px-3 text-sm font-semibold text-white transition hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="size-3.5" aria-hidden="true" />
              Preview trim
            </button>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted">
              <span>{formatPreciseTime(0)}</span>
              <span>Current {formatPreciseTime(currentTime)}</span>
              <span>{formatPreciseTime(duration)}</span>
            </div>

            <div
              ref={trackRef}
              className="relative mt-3 h-10 rounded-md bg-card-muted px-1"
              onPointerDown={handleTrackPointerDown}
            >
              <div className="absolute left-2 right-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-border" />
              <div
                className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary"
                style={{
                  left: `calc(${selectedLeft}% + 2px)`,
                  width: `calc(${Math.max(0, selectedRight - selectedLeft)}% - 4px)`,
                }}
              />
              <div
                className="pointer-events-none absolute top-1/2 h-6 w-px -translate-y-1/2 bg-[#173454]"
                style={{ left: `${currentLeft}%` }}
              >
                <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-[#173454]" />
              </div>

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
                className="absolute top-1/2 h-7 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-primary bg-white shadow-sm transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
                style={{ left: `${selectedLeft}%` }}
              >
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
                className="absolute top-1/2 h-7 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-primary bg-white shadow-sm transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
                style={{ left: `${selectedRight}%` }}
              >
                <span className="sr-only">Drag trim end</span>
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold text-muted">
              {formatPreciseTime(selectedDuration)} selected
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onSetStart}
                disabled={!canPreviewTrim}
                className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-3 text-xs font-semibold text-[#173454] transition hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Set start
              </button>
              <button
                type="button"
                onClick={onSetEnd}
                disabled={!canPreviewTrim}
                className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-3 text-xs font-semibold text-[#173454] transition hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Set end
              </button>
              <button
                type="button"
                onClick={onResetTrim}
                disabled={!canEditTrim}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-semibold text-[#173454] transition hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>

          {message ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold text-error">
              <AlertCircle className="size-3.5" aria-hidden="true" />
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TextOverlayControls({
  onChange,
  textOverlay,
}: {
  onChange: (overlay: TextOverlay) => void;
  textOverlay: TextOverlay;
}) {
  const characterCount = textOverlay.text.length;

  return (
    <section className="rounded-panel border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card-muted text-primary">
          <Type className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-foreground-strong" htmlFor="demo-text-overlay">
              Text overlay
            </label>
            <button
              type="button"
              onClick={() => onChange({ ...textOverlay, text: "" })}
              disabled={!textOverlay.text}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 text-xs font-semibold text-muted transition hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="size-3" aria-hidden="true" />
              Clear
            </button>
          </div>
          <textarea
            id="demo-text-overlay"
            value={textOverlay.text}
            onChange={(event) =>
              onChange({
                ...textOverlay,
                text: event.target.value.slice(0, TEXT_OVERLAY_MAX_LENGTH),
              })
            }
            maxLength={TEXT_OVERLAY_MAX_LENGTH}
            placeholder="Stop wasting time switching tools"
            rows={2}
            className="mt-2 min-h-16 w-full resize-none rounded-md border border-border bg-white px-3 py-2.5 text-sm font-semibold leading-5 text-foreground outline-none transition placeholder:text-muted-subtle focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <div className="mt-2 flex justify-end text-xs font-medium text-muted">
            {characterCount} / {TEXT_OVERLAY_MAX_LENGTH} characters
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <SegmentedControl
              label="Position"
              options={overlayPositions}
              value={textOverlay.position}
              onChange={(position) => onChange({ ...textOverlay, position })}
            />
            <SegmentedControl
              label="Style"
              options={overlayStyles}
              value={textOverlay.style}
              onChange={(style) => onChange({ ...textOverlay, style })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SegmentedControl<TValue extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: TValue) => void;
  options: TValue[];
  value: TValue;
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div className="mt-1 flex rounded-md border border-border bg-card-muted p-1">
        {options.map((option) => {
          const selected = option === value;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                "h-8 flex-1 rounded-[5px] px-3 text-sm font-semibold capitalize transition",
                selected
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getDefaultVideoDetails(video: EditableVideo): FocusedVideoEditorDetail[] {
  return [
    { label: "Source", value: getEditableVideoSourceLabel(video.source) },
    { label: "Aspect ratio", value: video.ratio },
    { label: "Duration", value: formatVideoDuration(video.durationSeconds) },
    { label: "Status", value: getEditableVideoStatusLabel(video.status) },
  ];
}

function getOverlayPositionClass(position: TextOverlayPosition) {
  const base =
    "pointer-events-none absolute left-4 right-4 z-10 flex justify-center text-center";

  if (position === "top") {
    return `${base} top-8`;
  }

  if (position === "middle") {
    return `${base} top-1/2 -translate-y-1/2`;
  }

  return `${base} bottom-12`;
}

function getOverlayStyleClass(style: TextOverlayStyle) {
  if (style === "bubble") {
    return "max-w-[90%] whitespace-pre-line break-words rounded-md bg-black/65 px-4 py-2 text-xl font-semibold leading-tight text-white shadow-lg";
  }

  return "max-w-[90%] whitespace-pre-line break-words text-xl font-semibold leading-tight text-white drop-shadow-lg";
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

function getPreviewAspectRatio(ratio: EditableVideo["ratio"]) {
  return ratio.includes(":") ? ratio.replace(":", " / ") : "9 / 16";
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
