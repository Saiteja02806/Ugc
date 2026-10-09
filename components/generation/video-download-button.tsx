"use client";

import { Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { fetchAIStudioMediaAssets } from "@/lib/ai-studio/media-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { requestVideoDownload, startVideoDownload } from "@/lib/media/video-download-client";

type VideoDownloadButtonProps = {
  assetId?: string | null;
  className: string;
  title: string;
  url: string;
};

export function VideoDownloadButton(props: VideoDownloadButtonProps) {
  const { user } = useAuth();
  return <OwnedVideoDownloadButton key={`${user?.uid ?? "signed-out"}:${props.assetId ?? props.url}`}
    {...props} userId={user?.uid} />;
}

function OwnedVideoDownloadButton({ assetId, className, title, url, userId }: VideoDownloadButtonProps & { userId?: string }) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function download() {
    if (pending.current || !userId) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    try {
      const token = await getCurrentUserIdToken(userId);
      if (!token) throw new Error("Sign in to download your video.");
      let savedAssetId = assetId;
      // Older completed jobs may lack an asset ID; resolve through the owned list.
      if (!savedAssetId) {
        const assets = await fetchAIStudioMediaAssets({ collection: "video", sourceType: "generated_video", token });
        savedAssetId = assets.find(asset => asset.status === "ready" && asset.url === url)?.id;
      }
      if (controller.signal.aborted) return;
      if (!savedAssetId) throw new Error("Your video is still being saved. Please try again shortly.");
      const result = await requestVideoDownload(savedAssetId, token, controller.signal);
      // Auth or the selected result can change while the request is pending.
      await getCurrentUserIdToken(userId);
      if (!controller.signal.aborted) startVideoDownload(result);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Could not start your download. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  return <span className="flex flex-col items-start gap-1">
    <button type="button" onClick={() => void download()} disabled={busy || !userId}
      aria-label={`Download ${title}`} aria-busy={busy}
      title={busy ? "Preparing download…" : userId ? "Download video" : "Sign in to download your video"}
      className={`${className} disabled:cursor-wait disabled:opacity-50`}>
      {busy ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        : <Download className="size-3.5" aria-hidden="true" />}
    </button>
    {error ? <span role="alert" className="max-w-64 text-xs text-destructive">{error}</span> : null}
  </span>;
}
