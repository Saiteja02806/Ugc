"use client";

import {
  AlertCircle,
  Clock3,
  Film,
  Play,
  Scissors,
  Type,
} from "lucide-react";
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

const overlayPositions: TextOverlayPosition[] = ["top", "middle", "bottom"];
const overlayStyles: TextOverlayStyle[] = ["clean", "bubble"];

export type FocusedVideoEditorDraftState = EditableVideoDraftInput;

export function FocusedVideoEditor({
  onDraftChange,
  video,
}: {
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
    hasVideoSource && effectiveDuration > 0 && selectedDuration >= 1;

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

    setDuration(videoElement.duration);
    const nextTrimStart = clampTime(initialTrimStart, 0, videoElement.duration);
    const nextTrimEnd = clampTime(
      video.draft?.trimEndSeconds ?? videoElement.duration,
      nextTrimStart,
      videoElement.duration,
    );

    setTrimStart(nextTrimStart);
    setTrimEnd(nextTrimEnd);
    setCurrentTime(nextTrimStart);
    videoElement.currentTime = nextTrimStart;
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

  function setStartFromCurrentTime() {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    const nextStart = clampTime(videoElement.currentTime, 0, effectiveDuration);

    if (nextStart >= trimEnd) {
      setTrimMessage("End time must be after start time.");
      return;
    }

    if (trimEnd - nextStart < 1) {
      setTrimMessage("Trimmed clip must be at least 1 second.");
      return;
    }

    setTrimStart(nextStart);
    setTrimMessage(null);
  }

  function setEndFromCurrentTime() {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    const nextEnd = clampTime(videoElement.currentTime, 0, effectiveDuration);

    if (nextEnd <= trimStart) {
      setTrimMessage("End time must be after start time.");
      return;
    }

    if (nextEnd - trimStart < 1) {
      setTrimMessage("Trimmed clip must be at least 1 second.");
      return;
    }

    setTrimEnd(nextEnd);
    setTrimMessage(null);
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
    <section className="flex flex-1 flex-col items-center gap-5 rounded-[28px] border border-border/70 bg-white/35 px-5 py-6">
      <VideoMetadataChips video={video} />

      <div
        className="relative flex max-h-[58vh] w-full max-w-[360px] items-center justify-center overflow-hidden rounded-[28px] bg-[#102033] text-white shadow-[0_24px_70px_rgb(16_32_51_/_0.20)]"
        style={{ aspectRatio: video.ratio.replace(":", " / ") }}
      >
        {video.videoUrl ? (
          <video
            ref={videoRef}
            src={video.videoUrl}
            controls
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            className="size-full object-cover"
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

      <div className="grid w-full max-w-3xl gap-4">
        <TrimControls
          canPreviewTrim={canPreviewTrim}
          currentTime={currentTime}
          duration={effectiveDuration}
          message={trimMessage}
          trimEnd={trimEnd}
          trimStart={trimStart}
          onPlayTrimmedPreview={playTrimmedPreview}
          onSetEnd={setEndFromCurrentTime}
          onSetStart={setStartFromCurrentTime}
        />

        <TextOverlayControls
          textOverlay={textOverlay}
          onChange={setTextOverlay}
        />
      </div>
    </section>
  );
}

function VideoMetadataChips({ video }: { video: EditableVideo }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-muted">
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5">
        <Film className="size-3" aria-hidden="true" />
        {getEditableVideoSourceLabel(video.source)}
      </span>
      <span className="rounded-full border border-border bg-white px-3 py-1.5">
        {video.ratio}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5">
        <Clock3 className="size-3" aria-hidden="true" />
        {formatVideoDuration(video.durationSeconds)}
      </span>
      <span
        className={cn(
          "rounded-full px-3 py-1.5",
          video.status === "ready"
            ? "bg-success/10 text-[#087443]"
            : video.status === "rendered"
              ? "bg-primary/10 text-primary"
              : "bg-card-muted text-muted",
        )}
      >
        {getEditableVideoStatusLabel(video.status)}
      </span>
    </div>
  );
}

function TrimControls({
  canPreviewTrim,
  currentTime,
  duration,
  message,
  onPlayTrimmedPreview,
  onSetEnd,
  onSetStart,
  trimEnd,
  trimStart,
}: {
  canPreviewTrim: boolean;
  currentTime: number;
  duration: number;
  message: string | null;
  onPlayTrimmedPreview: () => void;
  onSetEnd: () => void;
  onSetStart: () => void;
  trimEnd: number;
  trimStart: number;
}) {
  const selectedLeft = getTimePercent(trimStart, duration);
  const selectedRight = getTimePercent(trimEnd, duration);
  const currentLeft = getTimePercent(currentTime, duration);

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card-muted text-primary">
          <Scissors className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Trim preview</h2>
              <p className="mt-1 text-xs font-semibold text-muted">
                Current time {formatPreciseTime(currentTime)}
              </p>
            </div>
            <button
              type="button"
              onClick={onPlayTrimmedPreview}
              disabled={!canPreviewTrim}
              className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-full bg-[#173454] px-4 text-sm font-bold text-white transition hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="size-3.5" aria-hidden="true" />
              Preview trim
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm font-bold text-foreground">
            <span>{formatPreciseTime(trimStart)}</span>
            <span>{formatPreciseTime(trimEnd)}</span>
          </div>

          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-card-muted">
            <div
              className="absolute inset-y-0 rounded-full bg-primary"
              style={{
                left: `${selectedLeft}%`,
                width: `${Math.max(0, selectedRight - selectedLeft)}%`,
              }}
            />
            <div
              className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-white bg-[#173454] shadow-sm"
              style={{
                left: `calc(${currentLeft}% - 6px)`,
              }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onSetStart}
              disabled={!canPreviewTrim}
              className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-bold text-[#173454] transition hover:bg-[#fff8f4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Set start
            </button>
            <span className="text-xs font-semibold text-muted">
              {formatPreciseTime(Math.max(0, trimEnd - trimStart))} selected
            </span>
            <button
              type="button"
              onClick={onSetEnd}
              disabled={!canPreviewTrim}
              className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-bold text-[#173454] transition hover:bg-[#fff8f4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Set end
            </button>
          </div>

          {message ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold text-error">
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
  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card-muted text-primary">
          <Type className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <label className="block">
            <span className="text-sm font-bold text-foreground">Text overlay</span>
            <textarea
              value={textOverlay.text}
              onChange={(event) =>
                onChange({ ...textOverlay, text: event.target.value })
              }
              maxLength={180}
              placeholder="Stop wasting time switching tools"
              rows={3}
              className="mt-2 min-h-24 w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold leading-5 text-foreground outline-none transition placeholder:text-[#8c9aab] focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-normal text-muted">
        {label}
      </span>
      <div className="flex rounded-full border border-border bg-card-muted p-1">
        {options.map((option) => {
          const selected = option === value;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                "h-8 rounded-full px-3 text-sm font-bold capitalize transition",
                selected
                  ? "bg-white text-primary shadow-sm"
                  : "text-[#405977] hover:text-foreground",
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
    return "max-w-[90%] whitespace-pre-line break-words rounded-2xl bg-black/60 px-4 py-2 text-xl font-semibold leading-tight text-white shadow-lg";
  }

  return "max-w-[90%] whitespace-pre-line break-words text-xl font-semibold leading-tight text-white drop-shadow-lg";
}

function clampTime(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTimePercent(seconds: number, duration: number) {
  if (!duration || duration <= 0) {
    return 0;
  }

  return clampTime((seconds / duration) * 100, 0, 100);
}

function formatPreciseTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const tenths = Math.floor((safeSeconds % 1) * 10);

  return `${minutes}:${wholeSeconds.toString().padStart(2, "0")}.${tenths}`;
}
