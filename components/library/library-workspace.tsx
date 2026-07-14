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
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { UploadedPostsTab } from "@/components/demos/demos-workspace";
import {
  PlatformSelectionModal,
  type SchedulePlatformContext,
} from "@/components/social/platform-selection-modal";
import {
  getCarouselLibraryItems,
  listenToCarouselLibrary,
  removeCarouselLibraryItem as removeBrowserCarouselLibraryItem,
  type CarouselLibraryItem as BrowserCarouselLibraryItem,
} from "@/lib/carousel/local-library";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { SocialPlatform } from "@/lib/social/types";
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

const tabs: Array<{ label: string; value: LibraryTab }> = [
  {
    label: "Demo",
    value: "posts",
  },
  {
    label: "Saved",
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

  function handleTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    selectTab(nextTab.value);
    window.requestAnimationFrame(() => {
      document.getElementById(`library-tab-${nextTab.value}`)?.focus();
    });
  }

  return (
    <section className="min-h-screen flex-1 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-4">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground-strong sm:text-[28px]">
              Library
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Keep product footage and saved carousels ready for your next post.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Library sections"
            className="inline-flex w-fit items-center rounded-control bg-card-muted p-1 ring-1 ring-inset ring-border"
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.value}
                id={`library-tab-${tab.value}`}
                type="button"
                role="tab"
                aria-controls={`library-panel-${tab.value}`}
                aria-selected={activeTab === tab.value}
                tabIndex={activeTab === tab.value ? 0 : -1}
                onClick={() => selectTab(tab.value)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={cn(
                  "inline-flex h-9 min-w-[76px] items-center justify-center rounded-small px-3 text-sm font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 motion-reduce:transition-none",
                  activeTab === tab.value
                    ? "bg-card text-foreground-strong shadow-[0_1px_2px_rgb(23_23_27_/_0.08)]"
                    : "text-muted hover:text-foreground-strong",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div
          id={`library-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`library-tab-${activeTab}`}
          className="min-w-0 pt-1"
        >
          {activeTab === "content" ? (
            <LibraryContentTab onShowPosts={() => selectTab("posts")} />
          ) : (
            <UploadedPostsTab embeddedInLibrary />
          )}
        </div>
      </div>
    </section>
  );
}

function LibraryContentTab({ onShowPosts }: { onShowPosts: () => void }) {
  const [serverItems, setServerItems] = useState<LibraryCarouselItem[]>([]);
  const [browserItems, setBrowserItems] = useState<LibraryCarouselItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<LibraryCarouselItem | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduleContext, setScheduleContext] =
    useState<SchedulePlatformContext | null>(null);

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
    if (item.storageSource !== "server") {
      setErrorMessage(
        "Save this carousel to your online Library before scheduling.",
      );
      return;
    }

    setErrorMessage(null);
    setNotice(null);
    setScheduleContext({
      carouselId: item.sourceId,
      libraryItemId: item.id,
      returnTo: "library",
    });
  }

  function confirmPlatforms(platforms: SocialPlatform[]) {
    setNotice(
      `${formatPlatformList(platforms)} selected. No post has been scheduled yet.`,
    );
    setScheduleContext(null);
  }

  return (
    <section
      className="overflow-hidden rounded-card border border-border bg-card shadow-[0_1px_2px_rgb(23_23_27_/_0.03)]"
      aria-labelledby="library-content-heading"
    >
      <header className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-small bg-brand-soft text-primary">
            <Images className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="library-content-heading"
              className="text-base font-semibold text-foreground-strong"
            >
              Saved carousels
            </h2>
            <p className="mt-0.5 max-w-xl text-sm leading-5 text-muted">
              Reusable carousel ideas, with every slide kept in order.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!showSkeleton && items.length > 0 ? (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              Open Trending
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
          <span className="inline-flex h-9 items-center rounded-md bg-surface-subtle px-3 text-xs font-semibold text-muted ring-1 ring-inset ring-border">
            {showSkeleton
              ? "Loading"
              : `${items.length} ${items.length === 1 ? "carousel" : "carousels"} · ${totalSlides} slides`}
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
            className={cn(
              "size-4",
              isLoading && "animate-spin motion-reduce:animate-none",
            )}
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <LibraryCarouselCard
                key={item.id}
                item={item}
                removing={removingItemId === item.id}
                scheduleDisabled={item.storageSource !== "server"}
                onRemove={() => void removeItem(item)}
                onSchedule={() => scheduleItem(item)}
                onView={() => setSelectedItem(item)}
              />
            ))}
          </div>
        ) : (
          <LibraryContentEmptyState onShowPosts={onShowPosts} />
        )}
      </div>

      {selectedItem ? (
        <LibraryCarouselViewer
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
      <PlatformSelectionModal
        context={scheduleContext}
        open={Boolean(scheduleContext)}
        onConfirmed={confirmPlatforms}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleContext(null);
          }
        }}
      />
    </section>
  );
}

function LibraryContentEmptyState({
  onShowPosts,
}: {
  onShowPosts: () => void;
}) {
  return (
    <div className="flex min-h-[330px] items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-subtle px-5 py-10 text-center sm:px-8">
      <div className="max-w-lg">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-white text-primary ring-1 ring-border shadow-[0_1px_2px_rgb(23_23_27_/_0.05)]">
          <Images className="size-5" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground-strong">
          Build your saved carousel library
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Save a carousel from Trending and the complete slide set will stay here,
          ready to review and schedule when you need it.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/dashboard"
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
            View demos
          </button>
        </div>
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
  scheduleDisabled,
}: {
  item: LibraryCarouselItem;
  onRemove: () => void;
  onSchedule: () => void;
  onView: () => void;
  removing: boolean;
  scheduleDisabled: boolean;
}) {
  const coverUrl = item.coverUrl ?? item.slides[0]?.renderedUrl;

  return (
    <article className="group min-w-0 overflow-hidden rounded-lg border border-border bg-white transition-colors hover:border-border-strong">
      <button
        type="button"
        onClick={onView}
        className="relative block aspect-[4/5] max-h-[440px] w-full overflow-hidden bg-foreground-strong text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
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
            disabled={scheduleDisabled}
            title={
              scheduleDisabled
                ? "Available after this carousel is saved to your online Library"
                : "Select platforms"
            }
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
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
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      aria-label="Loading Library content"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-border bg-white"
        >
          <div className="aspect-[4/5] animate-pulse bg-[#e9eaec] motion-reduce:animate-none" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[#e9eaec] motion-reduce:animate-none" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-[#eff0f1] motion-reduce:animate-none" />
            <div className="flex gap-2 border-t border-border pt-3">
              <div className="h-9 flex-1 animate-pulse rounded-md bg-[#e9eaec] motion-reduce:animate-none" />
              <div className="h-9 flex-1 animate-pulse rounded-md bg-[#eff0f1] motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      ))}
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

function formatPlatformList(platforms: SocialPlatform[]) {
  return platforms
    .map((platform) => {
      switch (platform) {
        case "instagram":
          return "Instagram";
        case "tiktok":
          return "TikTok";
        case "youtube":
          return "YouTube";
      }
    })
    .join(", ");
}
