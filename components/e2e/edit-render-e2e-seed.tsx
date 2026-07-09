"use client";

import { useEffect } from "react";

import { EDIT_RENDER_E2E_TOKEN_STORAGE_KEY } from "@/lib/firebase/auth";

const EDITABLE_VIDEO_LIBRARY_STORAGE_KEY = "ugc-studio.editable-videos.v1";

export function EditRenderE2ESeed({
  token,
  videoPayload,
}: {
  token: string;
  videoPayload: string;
}) {
  useEffect(() => {
    try {
      const video = JSON.parse(atob(videoPayload)) as { id?: unknown };

      if (typeof video.id !== "string" || !video.id.trim()) {
        throw new Error("Seed video is missing an id.");
      }

      window.localStorage.setItem(EDIT_RENDER_E2E_TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(
        EDITABLE_VIDEO_LIBRARY_STORAGE_KEY,
        JSON.stringify([video]),
      );
      window.location.replace(`/edit/${encodeURIComponent(video.id)}`);
    } catch (error) {
      console.error("Edit render E2E seed failed:", error);
    }
  }, [token, videoPayload]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <p className="rounded-2xl border border-border bg-white px-5 py-4 text-sm font-semibold shadow-sm">
        Preparing edit render test...
      </p>
    </main>
  );
}
