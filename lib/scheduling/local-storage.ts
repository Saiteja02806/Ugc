import {
  scheduleDraftStatuses,
  schedulePlatforms,
  schedulePostTypes,
  scheduleSourceTypes,
  type ScheduleDraft,
  type ScheduleDraftInput,
  type ScheduleDraftStatus,
  type SchedulePlatform,
  type SchedulePostType,
  type ScheduleSourceType,
} from "@/lib/scheduling/types";

const SCHEDULE_DRAFTS_STORAGE_KEY = "ugc-studio.schedule-drafts.v1";
const SCHEDULE_DRAFTS_CHANGED_EVENT = "ugc-studio:schedule-drafts-changed";
const MAX_SCHEDULE_DRAFTS = 80;
const EMPTY_SCHEDULE_DRAFTS: ScheduleDraft[] = [];

let cachedScheduleDraftsRawValue: string | null = null;
let cachedScheduleDrafts: ScheduleDraft[] = EMPTY_SCHEDULE_DRAFTS;

export function getScheduleDrafts(): ScheduleDraft[] {
  if (!canUseBrowserStorage()) {
    return EMPTY_SCHEDULE_DRAFTS;
  }

  try {
    const rawValue = window.localStorage.getItem(SCHEDULE_DRAFTS_STORAGE_KEY);

    if (rawValue === cachedScheduleDraftsRawValue) {
      return cachedScheduleDrafts;
    }

    if (!rawValue) {
      cachedScheduleDraftsRawValue = rawValue;
      cachedScheduleDrafts = EMPTY_SCHEDULE_DRAFTS;

      return cachedScheduleDrafts;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      cachedScheduleDraftsRawValue = rawValue;
      cachedScheduleDrafts = EMPTY_SCHEDULE_DRAFTS;

      return cachedScheduleDrafts;
    }

    cachedScheduleDraftsRawValue = rawValue;
    cachedScheduleDrafts = parsedValue
      .map((draft) => normalizeScheduleDraft(draft))
      .filter((draft): draft is ScheduleDraft => Boolean(draft));

    return cachedScheduleDrafts;
  } catch {
    cachedScheduleDraftsRawValue = null;
    cachedScheduleDrafts = EMPTY_SCHEDULE_DRAFTS;

    return cachedScheduleDrafts;
  }
}

export function getScheduleDraftById(draftId: string) {
  return getScheduleDrafts().find((draft) => draft.id === draftId) ?? null;
}

export function createScheduleDraft(input: ScheduleDraftInput = {}): ScheduleDraft {
  const now = new Date().toISOString();

  return {
    caption: input.caption ?? "",
    createdAt: now,
    id: input.id ?? createScheduleDraftId(),
    mediaTitle: normalizeOptionalString(input.mediaTitle) ?? undefined,
    mediaUrl: normalizeOptionalString(input.mediaUrl) ?? undefined,
    platforms: normalizePlatforms(input.platforms),
    postType: normalizePostType(input.postType) ?? undefined,
    scheduledDate: normalizeOptionalString(input.scheduledDate) ?? undefined,
    scheduledTime: normalizeOptionalString(input.scheduledTime) ?? undefined,
    sourceId: normalizeOptionalString(input.sourceId) ?? undefined,
    sourceType: normalizeSourceType(input.sourceType) ?? undefined,
    status: normalizeStatus(input.status) ?? "draft",
    thumbnailUrl: normalizeOptionalString(input.thumbnailUrl) ?? undefined,
    timezone: input.timezone?.trim() || getBrowserTimezone(),
    updatedAt: now,
  };
}

export function saveScheduleDraft(draft: ScheduleDraft) {
  const normalizedDraft = normalizeScheduleDraft(draft);

  if (!normalizedDraft || !canUseBrowserStorage()) {
    return getScheduleDrafts();
  }

  const currentDrafts = getScheduleDrafts();
  const nextDrafts = [
    {
      ...normalizedDraft,
      updatedAt: new Date().toISOString(),
    },
    ...currentDrafts.filter((currentDraft) => currentDraft.id !== draft.id),
  ].slice(0, MAX_SCHEDULE_DRAFTS);

  writeScheduleDrafts(nextDrafts);

  return nextDrafts;
}

export function removeScheduleDraft(draftId: string) {
  if (!canUseBrowserStorage()) {
    return getScheduleDrafts();
  }

  const nextDrafts = getScheduleDrafts().filter((draft) => draft.id !== draftId);

  writeScheduleDrafts(nextDrafts);

  return nextDrafts;
}

export function duplicateScheduleDraft(draftId: string) {
  const draft = getScheduleDraftById(draftId);

  if (!draft) {
    return null;
  }

  const duplicate = createScheduleDraft({
    caption: draft.caption,
    mediaTitle: draft.mediaTitle,
    mediaUrl: draft.mediaUrl,
    platforms: draft.platforms,
    postType: draft.postType,
    scheduledDate: draft.scheduledDate,
    scheduledTime: draft.scheduledTime,
    sourceId: draft.sourceId,
    sourceType: draft.sourceType,
    status: "draft",
    thumbnailUrl: draft.thumbnailUrl,
    timezone: draft.timezone,
  });

  saveScheduleDraft(duplicate);

  return duplicate;
}

export function listenToScheduleDrafts(
  onChange: (drafts: ScheduleDraft[]) => void,
) {
  if (!canUseBrowserStorage()) {
    return () => {};
  }

  function handleChange() {
    onChange(getScheduleDrafts());
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === SCHEDULE_DRAFTS_STORAGE_KEY) {
      handleChange();
    }
  }

  window.addEventListener(SCHEDULE_DRAFTS_CHANGED_EVENT, handleChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(SCHEDULE_DRAFTS_CHANGED_EVENT, handleChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function writeScheduleDrafts(drafts: ScheduleDraft[]) {
  if (!canUseBrowserStorage()) {
    return;
  }

  const rawValue = JSON.stringify(drafts);

  cachedScheduleDraftsRawValue = rawValue;
  cachedScheduleDrafts = drafts;

  // TODO: Replace localStorage schedule drafts with a Supabase scheduled_posts table later.
  window.localStorage.setItem(SCHEDULE_DRAFTS_STORAGE_KEY, rawValue);
  window.dispatchEvent(new Event(SCHEDULE_DRAFTS_CHANGED_EVENT));
}

function normalizeScheduleDraft(value: unknown): ScheduleDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeString(record.id);

  if (!id) {
    return null;
  }

  return {
    caption: normalizeString(record.caption) ?? "",
    createdAt: normalizeString(record.createdAt) ?? new Date().toISOString(),
    id,
    mediaTitle: normalizeOptionalString(record.mediaTitle) ?? undefined,
    mediaUrl: normalizeOptionalString(record.mediaUrl) ?? undefined,
    platforms: normalizePlatforms(record.platforms),
    postType: normalizePostType(record.postType) ?? undefined,
    scheduledDate: normalizeOptionalString(record.scheduledDate) ?? undefined,
    scheduledTime: normalizeOptionalString(record.scheduledTime) ?? undefined,
    sourceId: normalizeOptionalString(record.sourceId) ?? undefined,
    sourceType: normalizeSourceType(record.sourceType) ?? undefined,
    status: normalizeStatus(record.status) ?? "draft",
    thumbnailUrl: normalizeOptionalString(record.thumbnailUrl) ?? undefined,
    timezone: normalizeString(record.timezone) ?? getBrowserTimezone(),
    updatedAt: normalizeString(record.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizePlatforms(value: unknown): SchedulePlatform[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter((platform): platform is SchedulePlatform =>
        schedulePlatforms.includes(platform as SchedulePlatform),
      ),
    ),
  );
}

function normalizePostType(value: unknown): SchedulePostType | null {
  return schedulePostTypes.includes(value as SchedulePostType)
    ? (value as SchedulePostType)
    : null;
}

function normalizeSourceType(value: unknown): ScheduleSourceType | null {
  return scheduleSourceTypes.includes(value as ScheduleSourceType)
    ? (value as ScheduleSourceType)
    : null;
}

function normalizeStatus(value: unknown): ScheduleDraftStatus | null {
  return scheduleDraftStatuses.includes(value as ScheduleDraftStatus)
    ? (value as ScheduleDraftStatus)
    : null;
}

function normalizeOptionalString(value: unknown) {
  return value === undefined || value === null ? null : normalizeString(value);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function createScheduleDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `schedule-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function getBrowserTimezone() {
  if (typeof Intl === "undefined") {
    return "UTC";
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
