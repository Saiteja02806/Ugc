"use client";

import {
  CalendarClock,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type SavedWallTextDraft = {
  assignmentId: string;
  previewUrl: string;
  renderError: string | null;
  renderedMediaAssetId: string | null;
  renderedVideoUrl: string | null;
  renderStatus: "not_requested" | "queued" | "rendering" | "ready" | "failed";
  text: { fullText: string };
  thumbnailUrl: string | null;
};

type DraftsResponse =
  | { drafts: SavedWallTextDraft[]; ok: true }
  | { error?: string; ok?: false };

export function WallTextLibraryTab() {
  const [drafts, setDrafts] = useState<SavedWallTextDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before viewing saved Wall-text Reels.");
      }

      const response = await fetch("/api/trending/wall-text/drafts", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | DraftsResponse
        | null;

      if (!response.ok || !data || data.ok !== true) {
        throw new Error(
          data?.ok === false && data.error
            ? data.error
            : "Could not load saved Wall-text Reels.",
        );
      }

      setDrafts(data.drafts);
    } catch (error) {
      setDrafts([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load saved Wall-text Reels.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDrafts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDrafts]);

  return (
    <section
      aria-labelledby="wall-text-library-heading"
      className="relative overflow-hidden rounded-panel border border-border bg-card"
    >
      <header className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
            <FileText className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="wall-text-library-heading"
              className="text-base font-semibold text-foreground-strong"
            >
              Wall-text Reels
            </h2>
            <p className="mt-0.5 text-sm leading-5 text-muted">
              Saved background videos with the complete text overlay.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadDrafts()}
          disabled={loading}
          aria-label="Refresh Wall-text Reels"
          title="Refresh"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-control border border-border text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
        >
          <RefreshCw
            className={`size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
            aria-hidden="true"
          />
        </button>
      </header>

      {loading ? (
        <div className="flex min-h-36 items-center justify-center border-t border-border text-sm font-semibold text-muted">
          <Loader2
            className="mr-2 size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          Loading saved Reels
        </div>
      ) : errorMessage ? (
        <div className="border-t border-border px-4 py-6 sm:px-5">
          <p role="alert" className="text-sm font-semibold text-error">
            {errorMessage}
          </p>
        </div>
      ) : drafts.length === 0 ? (
        <div className="border-t border-border px-4 py-8 text-center sm:px-5">
          <p className="text-sm font-semibold text-foreground-strong">
            No Wall-text Reels saved yet
          </p>
          <p className="mt-1 text-sm text-muted">
            Swipe right on a Wall-text idea, review it, then save it here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {drafts.map((draft) => {
            const ready =
              draft.renderStatus === "ready" &&
              Boolean(draft.renderedMediaAssetId);

            return (
              <article
                key={draft.assignmentId}
                className="grid gap-4 px-4 py-4 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center sm:px-5"
              >
                <video
                  src={draft.renderedVideoUrl ?? draft.previewUrl}
                  poster={draft.thumbnailUrl ?? undefined}
                  muted
                  playsInline
                  preload="metadata"
                  aria-label="Saved Wall-text Reel preview"
                  className="aspect-[9/16] w-[88px] rounded-control bg-surface-subtle object-cover"
                />
                <div className="min-w-0">
                  <p className="line-clamp-3 text-sm font-semibold leading-5 text-foreground-strong">
                    {draft.text.fullText}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
                    {draft.renderStatus === "failed" ? (
                      <>
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        Preparation failed
                      </>
                    ) : ready ? (
                      "Ready to schedule"
                    ) : (
                      <>
                        <Loader2
                          className="size-3.5 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        Preparing video
                      </>
                    )}
                  </p>
                  {draft.renderStatus === "failed" && draft.renderError ? (
                    <p className="mt-1 line-clamp-2 text-xs text-error">
                      {draft.renderError}
                    </p>
                  ) : null}
                </div>
                {ready ? (
                  <Link
                    href="/scheduling"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <CalendarClock className="size-4" aria-hidden="true" />
                    Schedule
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
