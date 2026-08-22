"use client";

import {
  ArrowRight,
  CalendarCheck,
  Eye,
  FileVideo,
  Images,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { UploadedPostsTab } from "@/components/demos/demos-workspace";
import { PlatformSelectionModalLoading } from "@/components/social/platform-selection-modal-loading";
import type { SchedulePlatformContext } from "@/components/social/platform-selection-modal";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  createAndPublishCarouselSchedule,
  createCarouselScheduleIdempotencyKey,
  type CarouselScheduleSubmission,
} from "@/lib/scheduling/carousel-scheduling-client";
import { cn } from "@/lib/utils";

const PlatformSelectionModal = dynamic(
  () =>
    import("@/components/social/platform-selection-modal").then(
      (module) => module.PlatformSelectionModal,
    ),
  { loading: PlatformSelectionModalLoading },
);

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
  title: string;
  updatedAt: string;
};

type LibraryContentResponse =
  | {
      items: LibraryCarouselItem[];
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

const primaryActionClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";
const secondaryActionClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";
const compactSecondaryActionClassName =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-control border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";
const iconActionClassName =
  "inline-flex size-11 items-center justify-center rounded-control border border-border bg-card text-muted transition-colors hover:border-border-strong hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 sm:size-10";
const metricChipClassName =
  "inline-flex min-h-10 items-center rounded-control bg-surface-subtle px-3 text-xs font-semibold text-muted ring-1 ring-inset ring-border";

export function LibraryWorkspace() {
  return (
    <section className="min-h-screen flex-1 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-4">
        <header>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground-strong sm:text-[28px]">
              Content Library
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Keep reusable demo footage in one place, ready for your next
              post.
            </p>
          </div>
        </header>

        <div className="min-w-0 pt-1">
          <UploadedPostsTab embeddedInLibrary />
        </div>
      </div>
    </section>
  );
}

export function CarouselLibraryTab({
  embedded = false,
  onShowPosts,
}: {
  embedded?: boolean;
  onShowPosts?: () => void;
} = {}) {
  const [serverItems, setServerItems] = useState<LibraryCarouselItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<LibraryCarouselItem | null>(
    null,
  );
  const [pendingRemoveItem, setPendingRemoveItem] =
    useState<LibraryCarouselItem | null>(null);
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

      setServerItems(data.items);
    } catch {
      setServerItems([]);
      setErrorMessage(
        "Could not load your saved carousels. Check your connection and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadItems]);

  const items = serverItems;

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
      setPendingRemoveItem(null);
      setNotice("Removed from Library.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not remove this carousel."));
    } finally {
      setRemovingItemId(null);
    }
  }

  function scheduleItem(item: LibraryCarouselItem) {
    setErrorMessage(null);
    setNotice(null);
    setScheduleContext({
      carouselId: item.sourceId,
      coverUrl: item.coverUrl ?? item.slides[0]?.renderedUrl ?? null,
      idempotencyKey: createCarouselScheduleIdempotencyKey("library", item.id),
      libraryItemId: item.id,
      returnTo: "library",
      title: item.title,
    });
  }

  async function confirmPlatforms(submission: CarouselScheduleSubmission) {
    if (!scheduleContext) {
      throw new Error("Choose a saved Library carousel first.");
    }

    await scheduleLibraryCarousel({
      context: scheduleContext,
      submission,
    });

    setScheduleContext(null);
    setNotice("Carousel scheduled. View it on the Scheduled page.");
  }

  return (
    <section
      className={cn(
        !embedded && "overflow-hidden rounded-panel border border-border bg-card",
      )}
      aria-labelledby="library-content-heading"
    >
      <header
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
          embedded ? "pb-3" : "px-4 py-4 sm:px-5",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {!embedded ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
              <Images className="size-[18px]" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2
              id="library-content-heading"
              className="text-base font-semibold text-foreground-strong"
            >
              Saved carousels
            </h2>
            {!embedded ? (
              <p className="mt-0.5 max-w-xl text-sm leading-5 text-muted">
                Complete carousel sets saved from Trending and ready to
                schedule as Instagram posts.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!showSkeleton && items.length > 0 ? (
            <Link
              href="/dashboard"
              className={compactSecondaryActionClassName}
            >
              Find carousel ideas
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
          <span className={metricChipClassName}>
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
            className={iconActionClassName}
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

      <div
        className={cn(
          "flex flex-col gap-4",
          !embedded && "border-t border-border bg-surface-subtle/55 p-4 sm:p-5",
        )}
      >
        {errorMessage ? (
          <div
            role="status"
            className="rounded-control border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-semibold text-warning"
          >
            {errorMessage}
          </div>
        ) : null}

        {notice ? (
          <div
            role="status"
            className="rounded-control border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-success"
          >
            {notice}
          </div>
        ) : null}

        {showSkeleton ? (
          <LibraryContentSkeleton />
        ) : items.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {items.map((item) => (
              <LibraryCarouselCard
                key={item.id}
                item={item}
                removing={removingItemId === item.id}
                onRemove={() => setPendingRemoveItem(item)}
                onSchedule={() => scheduleItem(item)}
                onView={() => setSelectedItem(item)}
              />
            ))}
          </div>
        ) : (
          <LibraryContentEmptyState embedded={embedded} onShowPosts={onShowPosts} />
        )}
      </div>

      {selectedItem ? (
        <LibraryCarouselViewer
          item={selectedItem}
          open={Boolean(selectedItem)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedItem(null);
            }
          }}
        />
      ) : null}
      <RemoveCarouselDialog
        item={pendingRemoveItem}
        removing={Boolean(
          pendingRemoveItem && removingItemId === pendingRemoveItem.id,
        )}
        onOpenChange={(open) => {
          if (!open && !removingItemId) {
            setPendingRemoveItem(null);
          }
        }}
        onConfirm={() => {
          if (pendingRemoveItem) {
            void removeItem(pendingRemoveItem);
          }
        }}
      />
      {scheduleContext ? (
        <PlatformSelectionModal
          context={scheduleContext}
          open
          onConfirmed={confirmPlatforms}
          onOpenChange={(open) => {
            if (!open) {
              setScheduleContext(null);
            }
          }}
        />
      ) : null}
    </section>
  );
}

function LibraryContentEmptyState({
  embedded,
  onShowPosts,
}: {
  embedded: boolean;
  onShowPosts?: () => void;
}) {
  if (embedded) {
    return (
      <div className="flex min-h-44 items-center justify-center px-5 py-8 text-center">
        <div className="max-w-md">
          <h3 className="text-lg font-semibold text-foreground-strong">
            No saved carousels yet
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Save a carousel from Trending and it will appear here.
          </p>
          <Link href="/dashboard" className={`${primaryActionClassName} mt-5`}>
            Explore carousel ideas
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[330px] items-center gap-8 rounded-panel border border-dashed border-border-strong bg-card px-5 py-8 sm:grid-cols-[minmax(0,1fr)_280px] sm:px-8">
      <div className="max-w-xl text-left">
        <div className="flex size-12 items-center justify-center rounded-control bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
          <Images className="size-5" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-xl font-semibold text-foreground-strong">
          Build your carousel library
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          Save carousel ideas from Trending. Each complete slide set
          stays here for review and scheduling.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className={primaryActionClassName}
          >
            Explore carousel ideas
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          {onShowPosts ? (
            <button
              type="button"
              onClick={onShowPosts}
              className={secondaryActionClassName}
            >
              <FileVideo className="size-4" aria-hidden="true" />
              View demo footage
            </button>
          ) : null}
        </div>
      </div>
      <div className="rounded-panel border border-border bg-surface-subtle p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-subtle">
          How it works
        </p>
        <ol className="mt-3 space-y-3 text-sm text-muted">
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary ring-1 ring-inset ring-border">
              1
            </span>
            Find a complete carousel in Trending.
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary ring-1 ring-inset ring-border">
              2
            </span>
            Save the full slide set to Creative Assets.
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary ring-1 ring-inset ring-border">
              3
            </span>
            Preview it here, then schedule it.
          </li>
        </ol>
      </div>
    </div>
  );
}

async function scheduleLibraryCarousel(params: {
  context: SchedulePlatformContext;
  submission: CarouselScheduleSubmission;
}) {
  return createAndPublishCarouselSchedule({
    carouselId: params.context.carouselId,
    idempotencyKey: params.context.idempotencyKey,
    libraryItemId: params.context.libraryItemId,
    sourceSurface: "library",
    submission: params.submission,
    title: params.context.title,
  });
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
    <article className="group min-w-0 overflow-hidden rounded-panel border border-border bg-card transition-colors hover:border-border-strong">
      <button
        type="button"
        aria-label={`Preview ${item.title}`}
        onClick={onView}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-foreground-strong text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        {coverUrl ? (
          // Saved carousel slides are already rendered media assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.015] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-white/70">
            <Images className="size-8" aria-hidden="true" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-primary ring-1 ring-inset ring-primary/20">
            Carousel
          </span>
          <span className="rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white">
            {item.slideCount} slides
          </span>
        </div>
      </button>

      <div className="flex flex-col gap-2.5 p-3">
        <div>
          <h3 className="line-clamp-2 min-h-9 text-[13px] font-semibold leading-[18px] text-foreground-strong">
            {item.title}
          </h3>
          <p className="mt-0.5 text-[11px] font-semibold text-muted">
            Saved {formatDate(item.savedAt)}
          </p>
        </div>

        <div className="flex items-center gap-1.5 border-t border-border pt-2.5">
          <button
            type="button"
            onClick={onView}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-control bg-primary px-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-9"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            Preview
          </button>
          <button
            type="button"
            onClick={onSchedule}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-border bg-card px-2 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:min-h-9"
          >
            <CalendarCheck className="size-3.5" aria-hidden="true" />
            Schedule
          </button>
        </div>

        <details className="group/actions">
          <summary className="flex min-h-9 list-none items-center justify-center gap-1.5 rounded-control text-xs font-semibold text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
            <MoreHorizontal className="size-3.5" aria-hidden="true" />
            More actions
          </summary>
          <div className="mt-2 rounded-control border border-border bg-surface-subtle p-2">
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-control px-2 text-xs font-semibold text-muted transition-colors hover:bg-error/5 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              {removing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-3.5" aria-hidden="true" />
              )}
              Remove from library
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}

function LibraryCarouselViewer({
  item,
  onOpenChange,
  open,
}: {
  item: LibraryCarouselItem;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[1120px] flex-col overflow-hidden p-0 sm:max-w-[calc(100%-2rem)]">
        <DialogHeader className="border-b border-border px-5 py-4 pr-14">
          <DialogTitle className="truncate text-lg font-semibold text-foreground-strong">
            {item.title}
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-muted">
            {item.slideCount} ordered slides - saved {formatDate(item.savedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {item.slides.map((slide) => (
              <figure
                key={slide.id}
                className="overflow-hidden rounded-card border border-border bg-surface-subtle"
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
                <figcaption className="border-t border-border bg-card-muted px-3 py-2 text-xs font-semibold text-muted">
                  Slide {slide.slideNumber}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RemoveCarouselDialog({
  item,
  onConfirm,
  onOpenChange,
  removing,
}: {
  item: LibraryCarouselItem | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  removing: boolean;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove carousel?</DialogTitle>
          <DialogDescription>
            {item
              ? `This removes "${item.title}" from your online Library.`
              : "This carousel will be removed."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-between">
          <DialogClose
            disabled={removing}
            className="inline-flex h-10 items-center justify-center rounded-control border border-border bg-card-muted px-4 text-sm font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            Keep it
          </DialogClose>
          <button
            type="button"
            onClick={onConfirm}
            disabled={removing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-error px-4 text-sm font-semibold text-error-foreground transition-colors hover:bg-error/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            {removing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
            Remove
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LibraryContentSkeleton() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
      aria-label="Loading Library content"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-card border border-border bg-card"
        >
          <div className="aspect-[4/5] animate-pulse bg-card-muted motion-reduce:animate-none" />
          <div className="flex flex-col gap-2.5 p-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-card-muted motion-reduce:animate-none" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-subtle motion-reduce:animate-none" />
            <div className="flex gap-2 border-t border-border pt-3">
              <div className="h-9 flex-1 animate-pulse rounded-control bg-card-muted motion-reduce:animate-none" />
              <div className="h-9 flex-1 animate-pulse rounded-control bg-surface-subtle motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      ))}
    </div>
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
