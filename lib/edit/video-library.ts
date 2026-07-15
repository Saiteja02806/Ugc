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

const EDITABLE_VIDEO_LIBRARY_STORAGE_KEY = "ugc-studio.editable-videos.v1";
const EDITABLE_VIDEO_LIBRARY_CHANGED_EVENT =
  "ugc-studio:editable-video-library-changed";
const MAX_EDITABLE_VIDEO_LIBRARY_ITEMS = 80;
const EMPTY_EDITABLE_VIDEOS: EditableVideo[] = [];
export const MAX_TEXT_OVERLAYS = 3;

const editableVideoRatios: EditableVideoRatio[] = ["9:16", "1:1", "4:5", "16:9"];
const editableVideoSources: EditableVideoSource[] = [
  "hook",
  "demo",
  "draft",
  "final",
];
const editableVideoStatuses: EditableVideoStatus[] = [
  "ready",
  "draft",
  "rendering",
  "rendered",
  "failed",
];
export const textOverlayPositions: TextOverlayPosition[] = [
  "top",
  "middle",
  "bottom",
];
export const textOverlayStyles: TextOverlayStyle[] = ["clean", "minimal", "bubble"];

let cachedEditableVideoRawValue: string | null = null;
let cachedEditableVideos: EditableVideo[] = EMPTY_EDITABLE_VIDEOS;

export function getEditableVideos(): EditableVideo[] {
  if (!canUseBrowserStorage()) {
    return EMPTY_EDITABLE_VIDEOS;
  }

  try {
    const rawValue = window.localStorage.getItem(
      EDITABLE_VIDEO_LIBRARY_STORAGE_KEY,
    );

    if (rawValue === cachedEditableVideoRawValue) {
      return cachedEditableVideos;
    }

    if (!rawValue) {
      cachedEditableVideoRawValue = rawValue;
      cachedEditableVideos = EMPTY_EDITABLE_VIDEOS;

      return cachedEditableVideos;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      cachedEditableVideoRawValue = rawValue;
      cachedEditableVideos = EMPTY_EDITABLE_VIDEOS;

      return cachedEditableVideos;
    }

    cachedEditableVideoRawValue = rawValue;
    cachedEditableVideos = parsedValue
      .map((video) => normalizeEditableVideo(video))
      .filter((video): video is EditableVideo => Boolean(video));

    return cachedEditableVideos;
  } catch {
    cachedEditableVideoRawValue = null;
    cachedEditableVideos = EMPTY_EDITABLE_VIDEOS;

    return cachedEditableVideos;
  }
}

export function getEditableVideoById(videoId: string) {
  return getEditableVideos().find((video) => video.id === videoId) ?? null;
}

export function getEditableVideoHref(video: EditableVideo) {
  return `/edit/${encodeURIComponent(video.id)}`;
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

export function saveEditableVideo(video: EditableVideo) {
  const normalizedVideo = normalizeEditableVideo(video);

  if (!normalizedVideo || !canUseBrowserStorage()) {
    return getEditableVideos();
  }

  const currentVideos = getEditableVideos();
  const nextVideos = [
    normalizedVideo,
    ...currentVideos.filter((currentVideo) => currentVideo.id !== video.id),
  ].slice(0, MAX_EDITABLE_VIDEO_LIBRARY_ITEMS);

  writeEditableVideos(nextVideos);

  return nextVideos;
}

export function saveEditableVideoDraft(
  videoId: string,
  draft: EditableVideoDraftInput,
) {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const currentVideos = getEditableVideos();
  const videoIndex = currentVideos.findIndex((video) => video.id === videoId);

  if (videoIndex === -1) {
    return null;
  }

  const normalizedDraft = normalizeEditableVideoDraftInput(draft) ?? {
    textOverlays: [],
    trimEndSeconds: null,
    trimStartSeconds: 0,
  };
  const updatedVideo: EditableVideo = {
    ...currentVideos[videoIndex],
    draft: {
      ...normalizedDraft,
      updatedAt: new Date().toISOString(),
    },
    status: "draft",
  };

  const nextVideos = [
    updatedVideo,
    ...currentVideos.filter((video) => video.id !== videoId),
  ];

  writeEditableVideos(nextVideos);

  return updatedVideo;
}

export function saveRenderedEditableVideo(
  videoId: string,
  renderedVideoUrl: string,
) {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const currentVideos = getEditableVideos();
  const videoIndex = currentVideos.findIndex((video) => video.id === videoId);
  const normalizedUrl = normalizeString(renderedVideoUrl);

  if (videoIndex === -1 || !normalizedUrl) {
    return null;
  }

  const updatedVideo: EditableVideo = {
    ...currentVideos[videoIndex],
    renderedVideoUrl: normalizedUrl,
    status: "rendered",
  };

  const nextVideos = [
    updatedVideo,
    ...currentVideos.filter((video) => video.id !== videoId),
  ];

  writeEditableVideos(nextVideos);

  return updatedVideo;
}

export function listenToEditableVideoLibrary(
  onChange: (videos: EditableVideo[]) => void,
) {
  if (!canUseBrowserStorage()) {
    return () => {};
  }

  function handleChange() {
    onChange(getEditableVideos());
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === EDITABLE_VIDEO_LIBRARY_STORAGE_KEY) {
      handleChange();
    }
  }

  window.addEventListener(EDITABLE_VIDEO_LIBRARY_CHANGED_EVENT, handleChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(
      EDITABLE_VIDEO_LIBRARY_CHANGED_EVENT,
      handleChange,
    );
    window.removeEventListener("storage", handleStorageChange);
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

function writeEditableVideos(videos: EditableVideo[]) {
  if (!canUseBrowserStorage()) {
    return;
  }

  const rawValue = JSON.stringify(videos);

  cachedEditableVideoRawValue = rawValue;
  cachedEditableVideos = videos;

  window.localStorage.setItem(EDITABLE_VIDEO_LIBRARY_STORAGE_KEY, rawValue);
  window.dispatchEvent(new Event(EDITABLE_VIDEO_LIBRARY_CHANGED_EVENT));
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeEditableVideo(value: unknown): EditableVideo | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeString(record.id);
  const title = normalizeString(record.title);
  const projectId = normalizeStringOrNull(record.projectId);
  const source = normalizeSource(record.source);
  const videoUrl = normalizeStringOrNull(record.videoUrl);

  if (!id || !title || !source) {
    return null;
  }

  return {
    createdAt: normalizeStringOrNull(record.createdAt),
    draft: normalizeDraft(record.draft),
    durationSeconds: normalizeNullableNumber(record.durationSeconds),
    id,
    projectId,
    ratio: normalizeRatio(record.ratio) ?? "9:16",
    renderedVideoUrl: normalizeStringOrNull(record.renderedVideoUrl),
    source,
    status: normalizeStatus(record.status) ?? "ready",
    thumbnailUrl: normalizeStringOrNull(record.thumbnailUrl),
    title,
    videoUrl,
  };
}

function normalizeDraft(value: unknown): EditableVideoDraft | null {
  const draft = normalizeEditableVideoDraftInput(value);

  if (!draft || !value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    ...draft,
    updatedAt: normalizeStringOrNull(record.updatedAt) ?? new Date().toISOString(),
  };
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

function normalizeRatio(value: unknown): EditableVideoRatio | null {
  return editableVideoRatios.includes(value as EditableVideoRatio)
    ? (value as EditableVideoRatio)
    : null;
}

function normalizeSource(value: unknown): EditableVideoSource | null {
  return editableVideoSources.includes(value as EditableVideoSource)
    ? (value as EditableVideoSource)
    : null;
}

function normalizeStatus(value: unknown): EditableVideoStatus | null {
  return editableVideoStatuses.includes(value as EditableVideoStatus)
    ? (value as EditableVideoStatus)
    : null;
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

function normalizeStringOrNull(value: unknown) {
  return normalizeString(value);
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
