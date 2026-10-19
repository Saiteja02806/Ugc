"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { workflowSessionAssetError } from "@/lib/explore/workflow-session";
import type { MediaAsset } from "@/lib/media/types";
import type { FinishingOptions } from "./use-workflow-finishing";
import { useLocalWorkflowMedia } from "./use-local-workflow-media";
import type { WorkflowAttachment } from "./hook-workflow-media-controls";
import { isLibraryMusic } from "@/lib/media/music-library";

export type WorkflowBackgroundMusic = {
  attachment: WorkflowAttachment; source: MediaAsset | null; playback: "once" | "repeat";
  choose: (file: File, playback?: "once" | "repeat") => Promise<boolean>;
  setPlayback: (value: "once" | "repeat") => void; selectionError: string | null;
};

/** Only a confirmed owned track replaces the accepted selection. No generation. */
export function useWorkflowBackgroundMusic({ ownerId, enabled, options, setOptions }: {
  ownerId: string | null; enabled: boolean; options: FinishingOptions;
  setOptions: Dispatch<SetStateAction<FinishingOptions>>;
}): WorkflowBackgroundMusic {
  const libraryDownload = useLocalWorkflowMedia("audio");
  const cache = useQueryClient();
  const [upload, setUpload] = useState({ busy: false, error: null as string | null });
  const active = useRef(true), revision = useRef(0);
  useEffect(() => { active.current = true; const requests = revision; return () => { active.current = false; requests.current++; }; }, []);
  const id = options.backgroundAssetId ?? null;
  const key = ["workflow-background-music", ownerId, id];
  const query = useQuery({ queryKey: key, enabled: enabled && !!ownerId && !!id, retry: false,
    queryFn: ({ signal }) => withReadDeadline(async bounded => {
      const token = await getCurrentUserIdToken(ownerId ?? undefined);
      if (!token || !id) throw new Error("Sign in to restore background music.");
      const asset = await fetchAIStudioMediaAsset(id, token, { signal: bounded });
      const problem = workflowSessionAssetError(asset, id, "demoAudio");
      if (problem) throw new Error("Choose ready background music up to 10 minutes long.");
      return asset;
    }, signal),
  });
  const source = id && query.data?.id === id ? query.data : null;
  async function choose(file: File, playback: "once" | "repeat" = "repeat") {
    if (!enabled || !ownerId) return false;
    const request = ++revision.current;
    setUpload({ busy: true, error: null });
    try {
      const result = await uploadAIStudioReferenceMedia(file, "audio", 120, ownerId, { maxAudioDurationSeconds: 600, purpose: "explore-demo" });
      if (!active.current || request !== revision.current) return false;
      if (workflowSessionAssetError(result.asset, result.asset.id, "demoAudio")) throw new Error("Choose ready background music up to 10 minutes long.");
      cache.setQueryData(["workflow-background-music", ownerId, result.asset.id], result.asset);
      setOptions(previous => ({ ...previous, backgroundAssetId: result.asset.id, backgroundPlayback: playback, corrections: [] }));
      return true;
    } catch (cause) {
      if (active.current && request === revision.current) setUpload({ busy: false, error: cause instanceof Error ? cause.message : "Could not select music. Your previous track is kept." });
      return false;
    } finally { if (active.current && request === revision.current) setUpload(previous => ({ ...previous, busy: false })); }
  }
  function remove() {
    revision.current++; libraryDownload.cancelPending(); setUpload({ busy: false, error: null });
    setOptions(previous => ({ ...previous, backgroundMusic: false, backgroundAssetId: null, backgroundPlayback: "repeat", corrections: [] }));
  }
  async function chooseOwnedAudio(assetId: string) {
    if (!enabled || !ownerId) return false;
    const request = ++revision.current;
    setUpload({ busy: true, error: null });
    try {
      const token = await getCurrentUserIdToken(ownerId);
      if (!token) throw new Error("Sign in to select library music.");
      const asset = await withReadDeadline(signal => fetchAIStudioMediaAsset(assetId, token, { signal }));
      if (!isLibraryMusic(asset) || asset.id !== assetId) throw new Error("This music is unavailable. Refresh the library and try again.");
      if (!active.current || request !== revision.current) return false;
      cache.setQueryData(["workflow-background-music", ownerId, asset.id], asset);
      setOptions(previous => ({ ...previous, backgroundAssetId: asset.id, backgroundPlayback: "repeat", corrections: [] }));
      return true;
    } catch (cause) {
      if (active.current && request === revision.current) setUpload({ busy: false, error: cause instanceof Error ? cause.message : "Could not choose this music. Your previous track is kept." });
      return false;
    } finally { if (active.current && request === revision.current) setUpload(previous => ({ ...previous, busy: false })); }
  }
  const loading = upload.busy || libraryDownload.loading || !!id && query.isPending && enabled;
  const restoreError = query.isError ? "Could not restore background music. Choose a replacement or remove it." : null;
  return { source, playback: options.backgroundPlayback ?? "repeat", choose,
    setPlayback: value => setOptions(previous => ({ ...previous, backgroundPlayback: value, corrections: [] })),
    attachment: { asset: source ? { name: source.title, url: source.url, duration: source.durationSeconds } : null,
      loading, error: upload.error ?? libraryDownload.error ?? restoreError,
      choose: file => choose(file), chooseRemote: (load, config, accept) => libraryDownload.chooseRemote(load, config, accept ?? choose), remove,
      chooseOwnedAudio,
      chooseLibraryImage: libraryDownload.chooseLibraryImage,
      clearError: () => { libraryDownload.clearError(); setUpload(previous => ({ ...previous, error: null })); if (query.isError) void query.refetch(); } },
    selectionError: options.backgroundMusic && loading ? "Wait for background music to finish loading." : options.backgroundMusic && id && !source ? restoreError ?? "Loading your background music…" : null };
}
