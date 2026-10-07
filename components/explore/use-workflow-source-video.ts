"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { workflowSourceVideoError, type WorkflowVideoMode } from "@/lib/explore/workflow-source-video";
import type { MediaAsset } from "@/lib/media/types";

export function useWorkflowSourceVideo({ enabled, ownerId }: { enabled: boolean; ownerId: string | null }) {
  const [mode, setMode] = useState<WorkflowVideoMode>("generate");
  const local = useLocalWorkflowMedia("video");
  const [uploaded, setUploaded] = useState<MediaAsset | null>(null);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
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
      if (!await local.choose(file, { maxDuration: 120, signal: controller.signal })) return false;
      if (!active.current || request !== revision.current) return false;
      // Layout review stays browser-only. Live uploads use the existing owned-media API.
      if (enabled && ownerId) {
        setUploaded(null);
        const result = await uploadAIStudioReferenceMedia(file, "video", 120, ownerId, { requireVideoReferenceRatio: false, purpose: "explore-source" });
        if (!active.current || request !== revision.current) return false;
        const problem = workflowSourceVideoError(result.asset);
        if (problem) throw new Error(problem);
        setUploaded(result.asset);
      }
      return true;
    } catch (e) {
      if (active.current && request === revision.current) setError(e instanceof Error ? e.message : "Could not upload your video. Try again.");
      return false;
    } finally { if (active.current && request === revision.current) setBusy(false); }
  }
  function selectAsset(asset: MediaAsset) {
    const problem = workflowSourceVideoError(asset);
    if (problem) { setAssetError(problem); return false; }
    setSelected(asset); setAssetError(null); return true;
  }
  function removeUpload() { revision.current += 1; metadataRequest.current?.abort(); local.remove(); setUploaded(null); setBusy(false); setError(null); }
  const uploadError = error ?? local.error;
  const source = mode === "upload" ? !busy && !uploadError ? uploaded : null : mode === "assets" ? selected : null;
  const preview = source ? { name: source.title, url: source.url, duration: source.durationSeconds } : mode === "upload" ? local.asset : null;
  const ready = mode !== "generate" && !!preview && (mode !== "upload" || (!busy && !uploadError)) && (!enabled || !!source);
  return { ownerId, enabled, mode, setMode, source, preview, ready, busy: mode === "upload" && busy,
    error: mode === "upload" ? uploadError : mode === "assets" ? assetError : null, chooseUpload, selectAsset, removeUpload,
    dirty: !!local.asset || !!uploaded || !!selected };
}

export type WorkflowVideoSelection = ReturnType<typeof useWorkflowSourceVideo>;
