"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { VideoLibraryGrid } from "@/components/edit/video-library-grid";
import { buttonClassName } from "@/components/ui/button";
import type { EditableVideo } from "@/lib/edit/video-library";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  editableMediaSourceTypes,
  isEditableMediaAsset,
  mediaAssetToEditableVideo,
} from "@/lib/media/editable-video";
import type { MediaAsset } from "@/lib/media/types";

export function EditLibraryWorkspace() {
  const [editableVideos, setEditableVideos] = useState<EditableVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in to open your edit library.");
      }

      const params = new URLSearchParams({
        sourceTypes: editableMediaSourceTypes.join(","),
      });
      const response = await fetch(`/api/media?${params.toString()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as
        | { assets: MediaAsset[]; ok: true }
        | { error?: string; ok?: false };

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiError(data, "Could not load your edit library."));
      }

      setEditableVideos(
        data.assets
          .filter(isEditableMediaAsset)
          .map(mediaAssetToEditableVideo),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load your edit library.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadVideos(), 0);
    return () => window.clearTimeout(timer);
  }, [loadVideos]);

  return (
    <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Edit
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Trim, add text, and export videos from Creative Assets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadVideos()}
            disabled={loading}
            className={buttonClassName({
              variant: "secondary",
              className: "size-9 p-0",
            })}
            aria-label="Refresh edit library"
          >
            <RefreshCw
              className={loading ? "size-4 animate-spin" : "size-4"}
              aria-hidden="true"
            />
          </button>
          <Link
            href="/avatars?tab=videos"
            className={buttonClassName({
              variant: "secondary",
              className: "h-9 w-fit px-3 text-xs",
            })}
          >
            Add videos
          </Link>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col pt-5">
        {errorMessage ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-error/20 bg-error/5 px-3 py-2.5 text-sm font-semibold text-error"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {errorMessage}
          </div>
        ) : null}
        <VideoLibraryGrid loading={loading} videos={editableVideos} />
      </div>
    </section>
  );
}

function getApiError(value: unknown, fallback: string) {
  return value && typeof value === "object" && "error" in value && typeof value.error === "string"
    ? value.error
    : fallback;
}
