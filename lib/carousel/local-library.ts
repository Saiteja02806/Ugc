export type CarouselLibraryItem = {
  categorySlug: string | null;
  carouselId: string;
  generationBatchId: string;
  id: string;
  projectId: string | null;
  savedAt: string;
  slideUrls: string[];
  source: "trending_carousel";
  thumbnailUrl: string | null;
  title: string;
};

export type CarouselLibraryItemInput = {
  categorySlug?: string | null;
  carouselId: string;
  generationBatchId: string;
  id?: string;
  projectId?: string | null;
  savedAt?: string;
  slideUrls: string[];
  thumbnailUrl?: string | null;
  title: string;
};

const CAROUSEL_LIBRARY_STORAGE_KEY = "ugc-studio.carousel-library.v1";
const CAROUSEL_LIBRARY_CHANGED_EVENT = "ugc-studio:carousel-library-changed";
const MAX_CAROUSEL_LIBRARY_ITEMS = 80;
const EMPTY_CAROUSEL_LIBRARY: CarouselLibraryItem[] = [];

let cachedCarouselLibraryRawValue: string | null = null;
let cachedCarouselLibraryItems: CarouselLibraryItem[] = EMPTY_CAROUSEL_LIBRARY;

export function getCarouselLibraryItems(): CarouselLibraryItem[] {
  if (!canUseBrowserStorage()) {
    return EMPTY_CAROUSEL_LIBRARY;
  }

  try {
    const rawValue = window.localStorage.getItem(CAROUSEL_LIBRARY_STORAGE_KEY);

    if (rawValue === cachedCarouselLibraryRawValue) {
      return cachedCarouselLibraryItems;
    }

    if (!rawValue) {
      cachedCarouselLibraryRawValue = rawValue;
      cachedCarouselLibraryItems = EMPTY_CAROUSEL_LIBRARY;

      return cachedCarouselLibraryItems;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      cachedCarouselLibraryRawValue = rawValue;
      cachedCarouselLibraryItems = EMPTY_CAROUSEL_LIBRARY;

      return cachedCarouselLibraryItems;
    }

    cachedCarouselLibraryRawValue = rawValue;
    cachedCarouselLibraryItems = parsedValue
      .map((item) => normalizeCarouselLibraryItem(item))
      .filter((item): item is CarouselLibraryItem => Boolean(item));

    return cachedCarouselLibraryItems;
  } catch {
    cachedCarouselLibraryRawValue = null;
    cachedCarouselLibraryItems = EMPTY_CAROUSEL_LIBRARY;

    return cachedCarouselLibraryItems;
  }
}

export function saveCarouselLibraryItem(input: CarouselLibraryItemInput) {
  const normalizedItem = normalizeCarouselLibraryInput(input);

  if (!normalizedItem || !canUseBrowserStorage()) {
    return getCarouselLibraryItems();
  }

  const currentItems = getCarouselLibraryItems();
  const nextItems = [
    normalizedItem,
    ...currentItems.filter((item) => item.carouselId !== normalizedItem.carouselId),
  ].slice(0, MAX_CAROUSEL_LIBRARY_ITEMS);

  writeCarouselLibraryItems(nextItems);

  return nextItems;
}

export function removeCarouselLibraryItem(itemIdOrCarouselId: string) {
  if (!canUseBrowserStorage()) {
    return getCarouselLibraryItems();
  }

  const normalizedId = normalizeString(itemIdOrCarouselId);

  if (!normalizedId) {
    return getCarouselLibraryItems();
  }

  const nextItems = getCarouselLibraryItems().filter(
    (item) => item.id !== normalizedId && item.carouselId !== normalizedId,
  );

  writeCarouselLibraryItems(nextItems);

  return nextItems;
}

export function listenToCarouselLibrary(
  onChange: (items: CarouselLibraryItem[]) => void,
) {
  if (!canUseBrowserStorage()) {
    return () => {};
  }

  function handleChange() {
    onChange(getCarouselLibraryItems());
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === CAROUSEL_LIBRARY_STORAGE_KEY) {
      handleChange();
    }
  }

  window.addEventListener(CAROUSEL_LIBRARY_CHANGED_EVENT, handleChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(CAROUSEL_LIBRARY_CHANGED_EVENT, handleChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function writeCarouselLibraryItems(items: CarouselLibraryItem[]) {
  if (!canUseBrowserStorage()) {
    return;
  }

  const rawValue = JSON.stringify(items);

  cachedCarouselLibraryRawValue = rawValue;
  cachedCarouselLibraryItems = items;

  window.localStorage.setItem(CAROUSEL_LIBRARY_STORAGE_KEY, rawValue);
  window.dispatchEvent(new Event(CAROUSEL_LIBRARY_CHANGED_EVENT));
}

function normalizeCarouselLibraryInput(
  input: CarouselLibraryItemInput,
): CarouselLibraryItem | null {
  return normalizeCarouselLibraryItem({
    ...input,
    id: input.id ?? input.carouselId,
    savedAt: input.savedAt ?? new Date().toISOString(),
    source: "trending_carousel",
  });
}

function normalizeCarouselLibraryItem(value: unknown): CarouselLibraryItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const carouselId = normalizeString(record.carouselId);
  const generationBatchId = normalizeString(record.generationBatchId);
  const id = normalizeString(record.id) ?? carouselId;
  const savedAt = normalizeString(record.savedAt);
  const slideUrls = normalizeStringArray(record.slideUrls);
  const source = record.source === "trending_carousel" ? record.source : null;
  const title = normalizeString(record.title);

  if (!carouselId || !generationBatchId || !id || !savedAt || !source || !title) {
    return null;
  }

  return {
    categorySlug: normalizeString(record.categorySlug),
    carouselId,
    generationBatchId,
    id,
    projectId: normalizeString(record.projectId),
    savedAt,
    slideUrls,
    source,
    thumbnailUrl: normalizeString(record.thumbnailUrl),
    title,
  };
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
