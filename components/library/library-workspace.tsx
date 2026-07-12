"use client";

import {
  ArrowRight,
  CalendarCheck,
  Eye,
  FileVideo,
  Images,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { UploadedPostsTab } from "@/components/demos/demos-workspace";
import {
  getCarouselLibraryItems,
  listenToCarouselLibrary,
  removeCarouselLibraryItem as removeBrowserCarouselLibraryItem,
  type CarouselLibraryItem as BrowserCarouselLibraryItem,
} from "@/lib/carousel/local-library";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  createScheduleDraft,
  saveScheduleDraft,
} from "@/lib/scheduling/local-storage";
import { cn } from "@/lib/utils";

type LibraryTab = "content" | "posts";

type LibraryCarouselSlide = {
  headline: string | null;
  id: string;
  renderedUrl: string;
  slideNumber: number;
  slideType: string | null;
  subtext: string | null;
};

type LibraryCarouselItem = {
  coverUrl: string | null;
  id: string;
  savedAt: string;
  slideCount: number;
  slides: LibraryCarouselSlide[];
  sourceId: string;
  storageSource: "browser" | "server";
  title: string;
  updatedAt: string;
};

type ServerLibraryCarouselItem = Omit<LibraryCarouselItem, "storageSource">;

type LibraryContentResponse =
  | {
      items: ServerLibraryCarouselItem[];
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

const tabs: Array<{ description: string; label: string; value: LibraryTab }> = [
  {
    description: "Uploaded footage ready to edit and schedule.",
    label: "My posts",
    value: "posts",
  },
  {
    description: "Saved carousel ideas with every slide kept together.",
    label: "My content",
    value: "content",
  },
];

export function LibraryWorkspace({ initialTab }: { initialTab: LibraryTab }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);

  function selectTab(tab: LibraryTab) {
    setActiveTab(tab);

    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.replace(`/library?${params.toString()}`);
  }

  return (
    <section className="min-h-screen flex-1 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5">
        <header className="flex flex-col gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground-strong sm:text-[28px]">
              Library
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Manage uploaded posts and saved carousel content from one focused workspace.
            </p>
          </div>
        </header>

        <div
          role="tablist"
          aria-label="Library sections"
          className="grid gap-2 rounded-lg border border-border bg-white p-1 sm:grid-cols-2 lg:w-[620px]"
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              onClick={() => selectTab(tab.value)}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                activeTab === tab.value
                  ? "bg-foreground-strong text-white"
                  : "text-muted hover:bg-surface-subtle hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  activeTab === tab.value
                    ? "bg-white/12 text-white"
                    : "bg-surface-subtle text-muted",
                )}
              >
                {tab.value === "posts" ? (
                  <FileVideo className="size-4" aria-hidden="true" />
                ) : (
                  <Images className="size-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">
                  {tab.label}
                </span>
                <span
                  className={cn(
                    "mt-0.5 hidden text-xs leading-4 sm:block",
                    activeTab === tab.value ? "text-white/72" : "text-muted",
                  )}
                >
                  {tab.description}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <div className="p-4 sm:p-5 lg:p-6">
            {activeTab === "content" ? (
              <LibraryContentTab onShowPosts={() => selectTab("posts")} />
            ) : (
              <UploadedPostsTab embeddedInLibrary />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function LibraryContentTab({ onShowPosts }: { onShowPosts: () => void }) {
  const router = useRouter();
  const [serverItems, setServerItems] = useState<LibraryCarouselItem[]>([]);
  const [browserItems, setBrowserItems] = useState<LibraryCarouselItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<LibraryCarouselItem | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        setServerItems([]);
        return;
      }

      const response = await fetch("/api/library?type=carousel", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as LibraryContentResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(
          data.ok === false ? data.message : "Could not load Library content.",
        );
      }

      setServerItems(
        data.items.map((item) => ({
          ...item,
          storageSource: "server",
        })),
      );
    } catch {
      setServerItems([]);
      setErrorMessage(
        browserItems.length > 0
          ? "Server Library is unavailable, so saved carousels from this browser are shown."
          : "Carousel Library sync is still connecting. Saved carousels from this browser will still appear here.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [browserItems.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBrowserItems(mapBrowserCarouselLibraryItems(getCarouselLibraryItems()));
    }, 0);

    const unsubscribe = listenToCarouselLibrary((nextItems) => {
      setBrowserItems(mapBrowserCarouselLibraryItems(nextItems));
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadItems]);

  const items = useMemo(
    () => mergeLibraryCarouselItems(serverItems, browserItems),
    [browserItems, serverItems],
  );

  const totalSlides = useMemo(
    () => items.reduce((total, item) => total + item.slideCount, 0),
    [items],
  );
  const showSkeleton = isLoading && items.length === 0;

  async function removeItem(item: LibraryCarouselItem) {
    if (removingItemId) {
      return;
    }

    setRemovingItemId(item.id);
    setErrorMessage(null);

    try {
      if (item.storageSource === "browser") {
        const nextBrowserItems = removeBrowserCarouselLibraryItem(item.sourceId);

        setBrowserItems(mapBrowserCarouselLibraryItems(nextBrowserItems));
        setSelectedItem((currentItem) =>
          currentItem?.id === item.id ? null : currentItem,
        );
        setNotice("Removed from this browser.");
        return;
      }

      const token = await getRequiredAuthToken();
      const response = await fetch(
        `/api/library/carousels/${encodeURIComponent(item.id)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          method: "DELETE",
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { message?: string; ok?: false }
        | { ok: true }
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(
          data && "message" in data && data.message
            ? data.message
            : "Could not remove this carousel.",
        );
      }

      setServerItems((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== item.id),
      );
      setSelectedItem((currentItem) =>
        currentItem?.id === item.id ? null : currentItem,
      );
      setNotice("Removed from Library.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not remove this carousel."));
    } finally {
      setRemovingItemId(null);
    }
  }

  function scheduleItem(item: LibraryCarouselItem) {
    const firstSlide = item.slides[0];
    const draft = createScheduleDraft({
      caption: "",
      mediaTitle: item.title,
      mediaUrl: firstSlide?.renderedUrl,
      sourceId: item.storageSource === "server" ? item.id : item.sourceId,
      sourceType: "generated_carousel",
      status: "draft",
      thumbnailUrl: item.coverUrl ?? firstSlide?.renderedUrl,
    });

    saveScheduleDraft(draft);

    const params = new URLSearchParams({
      draft: draft.id,
      tab: "drafts",
    });

    if (isPreviewMode()) {
      params.set("preview", "1");
    }

    router.push(`/scheduling?${params.toString()}`);
  }

  return (
    <section
      className="flex flex-col gap-5"
      aria-labelledby="library-content-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-primary">
            <Images className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="library-content-heading"
              className="text-xl font-semibold text-foreground-strong"
            >
              My content
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
              Complete saved carousels stay grouped with their ordered slides.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!showSkeleton && items.length > 0 ? (
            <Link
              href="/trending"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              Open Trending
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
          <span className="inline-flex min-h-9 items-center rounded-md bg-surface-subtle px-3 text-xs font-semibold text-muted ring-1 ring-border">
            {showSkeleton
              ? "Loading"
              : `${items.length} ${items.length === 1 ? "carousel" : "carousels"} - ${totalSlides} slides`}
          </span>
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={isLoading}
            aria-label="Refresh Library content"
            title="Refresh Library content"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-white text-muted transition-colors hover:border-border-strong hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={cn("size-4", isLoading && "animate-spin")}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div
          role="status"
          className="rounded-md border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-semibold text-warning"
        >
          {errorMessage}
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="rounded-md border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-success"
        >
          {notice}
        </div>
      ) : null}

      {showSkeleton ? (
        <LibraryContentSkeleton />
      ) : items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <LibraryCarouselCard
              key={item.id}
              item={item}
              removing={removingItemId === item.id}
              onRemove={() => void removeItem(item)}
              onSchedule={() => scheduleItem(item)}
              onView={() => setSelectedItem(item)}
            />
          ))}
        </div>
      ) : (
        <LibraryContentEmptyState onShowPosts={onShowPosts} />
      )}

      {selectedItem ? (
        <LibraryCarouselViewer
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </section>
  );
}

function LibraryContentEmptyState({
  onShowPosts,
}: {
  onShowPosts: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 sm:p-7">
      <div className="max-w-3xl">
        <div className="flex size-11 items-center justify-center rounded-md bg-brand-soft text-primary">
          <Images className="size-5" aria-hidden="true" />
        </div>
        <h3 className="mt-5 text-xl font-semibold text-foreground-strong">
          Save complete carousels from Trending
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Save a carousel idea from Trending and every ordered slide will appear
          here as one reusable set.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href="/trending"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Open Trending
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={onShowPosts}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <FileVideo className="size-4" aria-hidden="true" />
            View posts
          </button>
        </div>

        <dl className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
          {[
            ["Full set", "All slides stay together"],
            ["Ordered", "Slide sequence is preserved"],
            ["Ready later", "View or schedule from Library"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border border-border bg-surface-subtle px-3 py-2.5"
            >
              <dt className="text-xs font-semibold text-foreground-strong">
                {label}
              </dt>
              <dd className="mt-1 text-xs leading-4 text-muted">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function LibraryCarouselCard({
  item,
  onRemove,
  onSchedule,
  onView,
  removing,
}: {
  item: LibraryCarouselItem;
  onRemove: () => void;
  onSchedule: () => void;
  onView: () => void;
  removing: boolean;
}) {
  const coverUrl = item.coverUrl ?? item.slides[0]?.renderedUrl;

  return (
    <article className="group min-w-0 overflow-hidden rounded-lg border border-border bg-white transition-colors hover:border-border-strong">
      <button
        type="button"
        onClick={onView}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-foreground-strong text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        {coverUrl ? (
          // Saved carousel slides are already rendered media assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="size-full object-contain transition-transform duration-200 group-hover:scale-[1.015] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-white/70">
            <Images className="size-8" aria-hidden="true" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-foreground-strong shadow-sm">
            Carousel
          </span>
          <span className="rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white">
            {item.slideCount} slides
          </span>
        </div>
        {item.storageSource === "browser" ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-muted shadow-sm">
            Saved in this browser
          </span>
        ) : null}
      </button>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground-strong">
            {item.title}
          </h3>
          <p className="mt-1 text-xs font-semibold text-muted">
            Saved {formatDate(item.savedAt)}
          </p>
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onView}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-foreground-strong px-3 text-xs font-semibold text-white transition-colors hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            View
          </button>
          <button
            type="button"
            onClick={onSchedule}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <CalendarCheck className="size-3.5" aria-hidden="true" />
            Schedule
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled
            title="Carousel editing is not available yet"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-muted-subtle disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit unavailable
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-muted transition-colors hover:bg-error/5 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            {removing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-3.5" aria-hidden="true" />
            )}
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}

function LibraryCarouselViewer({
  item,
  onClose,
}: {
  item: LibraryCarouselItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/45 px-4 py-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-carousel-viewer-title"
        className="flex max-h-[calc(100vh-2.5rem)] w-full max-w-[1120px] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-[0_24px_70px_rgb(9_9_11_/_0.26)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id="library-carousel-viewer-title"
              className="truncate text-lg font-semibold text-foreground-strong"
            >
              {item.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted">
              {item.slideCount} ordered slides - saved {formatDate(item.savedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close carousel preview"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {item.slides.map((slide) => (
              <figure
                key={slide.id}
                className="overflow-hidden rounded-lg border border-border bg-surface-subtle"
              >
                <div className="aspect-[4/5] bg-foreground-strong">
                  {/* Saved carousel slides are immutable rendered assets. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.renderedUrl}
                    alt={`Slide ${slide.slideNumber} of ${item.title}`}
                    className="size-full object-contain"
                  />
                </div>
                <figcaption className="border-t border-border bg-white px-3 py-2 text-xs font-semibold text-muted">
                  Slide {slide.slideNumber}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LibraryContentSkeleton() {
  return (
    <div
      className="rounded-lg border border-border bg-white p-4"
      aria-label="Loading Library content"
    >
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-md border border-border bg-surface-subtle px-3 py-3"
          >
            <div className="size-10 shrink-0 animate-pulse rounded-md bg-[#e9eaec] motion-reduce:animate-none" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-2/3 animate-pulse rounded bg-[#e9eaec] motion-reduce:animate-none" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-[#eff0f1] motion-reduce:animate-none" />
            </div>
            <div className="hidden h-8 w-20 animate-pulse rounded-md bg-[#e9eaec] motion-reduce:animate-none sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function mapBrowserCarouselLibraryItems(items: BrowserCarouselLibraryItem[]) {
  return items.map((item): LibraryCarouselItem => {
    const slideUrls = item.slideUrls.filter(Boolean);
    const coverUrl = item.thumbnailUrl ?? slideUrls[0] ?? null;

    return {
      coverUrl,
      id: `browser:${item.id}`,
      savedAt: item.savedAt,
      slideCount: slideUrls.length,
      slides: slideUrls.map((renderedUrl, index) => ({
        headline: null,
        id: `${item.id}:slide:${index + 1}`,
        renderedUrl,
        slideNumber: index + 1,
        slideType: null,
        subtext: null,
      })),
      sourceId: item.carouselId,
      storageSource: "browser",
      title: item.title,
      updatedAt: item.savedAt,
    };
  });
}

function mergeLibraryCarouselItems(
  serverItems: LibraryCarouselItem[],
  browserItems: LibraryCarouselItem[],
) {
  const seenSourceIds = new Set<string>();
  const mergedItems: LibraryCarouselItem[] = [];

  for (const item of serverItems) {
    seenSourceIds.add(item.sourceId);
    mergedItems.push(item);
  }

  for (const item of browserItems) {
    if (!seenSourceIds.has(item.sourceId)) {
      mergedItems.push(item);
    }
  }

  return mergedItems.sort(
    (first, second) =>
      getSortableDate(second.updatedAt) - getSortableDate(first.updatedAt),
  );
}

async function getRequiredAuthToken() {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before changing your Library.");
  }

  return token;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
}

function getSortableDate(value: string) {
  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
}

function isPreviewMode() {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "1"
  );
}
