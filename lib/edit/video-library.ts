import { getCreativeAssetEditorHref } from "@/lib/edit/routes";

export type EditableVideoRatio = "9:16" | "1:1" | "4:5" | "16:9";

export type EditableVideoSource = "hook" | "demo" | "draft" | "final";

export type EditableVideoStatus =
  | "ready"
  | "draft"
  | "rendering"
  | "rendered"
  | "failed";

export type TextOverlayPosition = "top" | "middle" | "bottom";

export type TextOverlayStyle = "clean" | "minimal" | "bubble";

export type TextOverlay = {
  id: string;
  position: TextOverlayPosition;
  style: TextOverlayStyle;
  text: string;
};

export type EditableVideoDraft = {
  textOverlays: TextOverlay[];
  trimEndSeconds: number | null;
  trimStartSeconds: number;
  updatedAt: string;
};

export type EditableVideoDraftInput = Omit<EditableVideoDraft, "updatedAt">;

export type EditableVideo = {
  createdAt: string | null;
  draft: EditableVideoDraft | null;
  durationSeconds: number | null;
  id: string;
  projectId: string | null;
  ratio: EditableVideoRatio;
  renderedVideoUrl: string | null;
  source: EditableVideoSource;
  status: EditableVideoStatus;
  thumbnailUrl: string | null;
  title: string;
  videoUrl: string | null;
};

export type EditableVideoInput = {
  createdAt?: string | null;
  draft?: EditableVideoDraft | null;
  durationSeconds?: number | null;
  id: string;
  projectId?: string | null;
  ratio?: EditableVideoRatio;
  renderedVideoUrl?: string | null;
  source: EditableVideoSource;
  status?: EditableVideoStatus;
  thumbnailUrl?: string | null;
  title: string;
  videoUrl: string | null;
};

export const MAX_TEXT_OVERLAYS = 3;

export const textOverlayPositions: TextOverlayPosition[] = [
  "top",
  "middle",
  "bottom",
];
export const textOverlayStyles: TextOverlayStyle[] = ["clean", "minimal", "bubble"];

export function getEditableVideoHref(video: EditableVideo) {
  return getCreativeAssetEditorHref(video.id);
}

export function createEditableVideo(input: EditableVideoInput): EditableVideo {
  return {
    createdAt: input.createdAt ?? new Date().toISOString(),
    draft: input.draft ?? null,
    durationSeconds: input.durationSeconds ?? null,
    id: input.id,
    projectId: input.projectId ?? null,
    ratio: input.ratio ?? "9:16",
    renderedVideoUrl: input.renderedVideoUrl ?? null,
    source: input.source,
    status: input.status ?? "ready",
    thumbnailUrl: input.thumbnailUrl ?? null,
    title: input.title,
    videoUrl: input.videoUrl,
  };
}

export function formatVideoDuration(seconds: number | null) {
  if (seconds === null) {
    return "Duration pending";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.floor(seconds % 60));

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function getEditableVideoSourceLabel(source: EditableVideoSource) {
  const labels: Record<EditableVideoSource, string> = {
    hook: "Opening",
    demo: "Demo",
    draft: "Video",
    final: "Saved edit",
  };

  return labels[source];
}

export function getEditableVideoStatusLabel(status: EditableVideoStatus) {
  const labels: Record<EditableVideoStatus, string> = {
    ready: "Draft",
    draft: "Draft",
    rendering: "Saving",
    rendered: "Saved",
    failed: "Save failed",
  };

  return labels[status];
}

export function createTextOverlay(
  position: TextOverlayPosition,
  input?: Partial<Pick<TextOverlay, "id" | "style" | "text">>,
): TextOverlay {
  return {
    id: normalizeString(input?.id) ?? createTextOverlayId(position),
    position,
    style: normalizeTextOverlayStyle(input?.style) ?? "bubble",
    text: normalizeStringPreserveEmpty(input?.text)?.slice(0, 100) ?? "",
  };
}

export function normalizeEditableVideoDraftInput(
  value: unknown,
): EditableVideoDraftInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    textOverlays: normalizeTextOverlays(
      record.textOverlays,
      record.textOverlay,
    ),
    trimEndSeconds: normalizeNullableNumber(record.trimEndSeconds),
    trimStartSeconds: normalizeNumber(record.trimStartSeconds) ?? 0,
  };
}

export function normalizeTextOverlays(
  value: unknown,
  legacyValue?: unknown,
): TextOverlay[] {
  const source = Array.isArray(value) ? value : legacyValue ? [legacyValue] : [];
  const overlays: TextOverlay[] = [];
  const usedPositions = new Set<TextOverlayPosition>();

  for (const item of source) {
    const overlay = normalizeTextOverlay(item);

    if (!overlay || usedPositions.has(overlay.position)) {
      continue;
    }

    overlays.push(overlay);
    usedPositions.add(overlay.position);

    if (overlays.length === MAX_TEXT_OVERLAYS) {
      break;
    }
  }

  return overlays.sort(
    (first, second) =>
      textOverlayPositions.indexOf(first.position) -
      textOverlayPositions.indexOf(second.position),
  );
}

function normalizeTextOverlay(value: unknown): TextOverlay | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const position = normalizeTextOverlayPosition(record.position) ?? "bottom";

  return {
    id: normalizeString(record.id) ?? createTextOverlayId(position),
    position,
    style: normalizeTextOverlayStyle(record.style) ?? "bubble",
    text: normalizeStringPreserveEmpty(record.text)?.slice(0, 100) ?? "",
  };
}

function normalizeTextOverlayPosition(
  value: unknown,
): TextOverlayPosition | null {
  return textOverlayPositions.includes(value as TextOverlayPosition)
    ? (value as TextOverlayPosition)
    : null;
}

function normalizeTextOverlayStyle(value: unknown): TextOverlayStyle | null {
  return textOverlayStyles.includes(value as TextOverlayStyle)
    ? (value as TextOverlayStyle)
    : null;
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function normalizeStringPreserveEmpty(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizeNullableNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeNumber(value);
}

function createTextOverlayId(position: TextOverlayPosition) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `overlay-${position}-${Math.random().toString(36).slice(2, 10)}`;
}
