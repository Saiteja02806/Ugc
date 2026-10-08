"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalWorkflowMedia, type LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { workflowSourceVideoError, type WorkflowVideoMode } from "@/lib/explore/workflow-source-video";
import type { MediaAsset } from "@/lib/media/types";

export function useWorkflowSourceVideo({ enabled, ownerId, initialMode = "generate", minDuration = 0, onSelected }: { enabled: boolean; ownerId: string | null; initialMode?: WorkflowVideoMode; minDuration?: number; onSelected?: (asset: MediaAsset | null, preview: LocalWorkflowMedia, mode: "upload" | "assets") => void }) {
  const [mode, setMode] = useState<WorkflowVideoMode>(initialMode);
  const local = useLocalWorkflowMedia("video");
  const [uploaded, setUploaded] = useState<MediaAsset | null>(null);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [acceptedPreview, setAcceptedPreview] = useState<LocalWorkflowMedia | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const metadataRequest = useRef<AbortController | null>(null);
  const revision = useRef(0), active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; revision.current += 1; metadataRequest.current?.abort(); }; }, []);

  async function chooseUpload(file: File) {
    const request = ++revision.current;
    metadataRequest.current?.abort();
    const controller = new AbortController();
    metadataRequest.current = controller;
    setError(null);
    if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type) || file.size <= 0 || file.size > 250 * 1024 * 1024) {
      setError("Choose an MP4, MOV or WebM video up to 250 MB."); setBusy(false); return false;
    }
    if (enabled && !ownerId) { setError("Sign in to upload your video."); setBusy(false); return false; }
    setBusy(true);
    try {
      let preview: LocalWorkflowMedia | null = null;
      if (!await local.choose(file, { minDuration, maxDuration: 120, signal: controller.signal, onRead: value => { preview = value; } })) return false;
      if (!active.current || request !== revision.current) return false;
      // Layout review stays browser-only. Live uploads use the existing owned-media API.
      if (enabled && ownerId) {
        const result = await uploadAIStudioReferenceMedia(file, "video", 120, ownerId, { requireVideoReferenceRatio: false, purpose: "explore-source" });
        if (!active.current || request !== revision.current) return false;
        const problem = workflowSourceVideoError(result.asset) ?? (result.asset.durationSeconds !== null && result.asset.durationSeconds < minDuration ? `Choose a video at least ${minDuration} second long.` : null);
        if (problem) throw new Error(problem);
        setUploaded(result.asset);
        onSelected?.(result.asset, { name: result.asset.title, url: result.asset.url, duration: result.asset.durationSeconds }, "upload");
      } else if (preview) {
        setAcceptedPreview(preview);
        onSelected?.(null, preview, "upload");
      }
      return true;
    } catch (e) {
      if (active.current && request === revision.current) setError(e instanceof Error ? e.message : "Could not upload your video. Try again.");
      return false;
    } finally { if (active.current && request === revision.current) setBusy(false); }
  }
  function selectAsset(asset: MediaAsset) {
    const problem = workflowSourceVideoError(asset) ?? (asset.durationSeconds !== null && asset.durationSeconds < minDuration ? `Choose a video at least ${minDuration} second long.` : null);
    if (problem) { setAssetError(problem); return false; }
    setSelected(asset); setAssetError(null); onSelected?.(asset, { name: asset.title, url: asset.url, duration: asset.durationSeconds }, "assets"); return true;
  }
  function removeUpload() { revision.current += 1; metadataRequest.current?.abort(); local.remove(); setUploaded(null); setAcceptedPreview(null); setBusy(false); setError(null); }
  function clearSelection() { removeUpload(); setSelected(null); setAssetError(null); }
  function clearUploadError() { setError(null); local.clearError(); }
  const uploadError = error ?? local.error;
  // The last accepted clip stays visible while a replacement is validated.
  // Pending/error state blocks actions without discarding confirmed media.
  const source = mode === "upload" ? uploaded : mode === "assets" ? selected : null;
  const preview = source ? { name: source.title, url: source.url, duration: source.durationSeconds } : mode === "upload" ? acceptedPreview ?? local.asset : null;
  const ready = mode !== "generate" && !!preview && (mode !== "upload" || (!busy && !uploadError)) && (!enabled || !!source);
  return { ownerId, enabled, mode, setMode, source, preview, ready, busy: mode === "upload" && busy,
    error: mode === "upload" ? uploadError : mode === "assets" ? assetError : null, chooseUpload, selectAsset, removeUpload, clearSelection, clearUploadError,
    canKeepUpload: Boolean(uploaded || acceptedPreview),
    dirty: !!local.asset || !!uploaded || !!selected };
}

export type WorkflowVideoSelection = Omit<ReturnType<typeof useWorkflowSourceVideo>, "setMode"> & { setMode: (mode: WorkflowVideoMode) => void };
