"use client";

import { Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { requestImageDownload, startMediaDownload } from "@/lib/media/video-download-client";

export function ImageDownloadButton({ assetId, userId, name, className, label }: {
  assetId: string; userId: string | null; name: string; className?: string; label?: string;
}) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { pending.current?.abort(); }, [assetId, userId]);
  async function download() {
    if (pending.current || !userId) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError(null);
    try {
      const token = await getCurrentUserIdToken(userId);
      if (!token) throw new Error("Sign in to download your image.");
      if (controller.signal.aborted) return;
      const result = await requestImageDownload(assetId, token, controller.signal);
      const currentToken = await getCurrentUserIdToken(userId);
      if (!controller.signal.aborted && currentToken) startMediaDownload(result);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not download your image. Try again.");
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setBusy(false); }
    }
  }
  return <div className="min-w-0">
    <button type="button" className={className} disabled={busy || !userId} aria-label={`Download ${name}`} title="Download image" aria-busy={busy} onClick={() => void download()}>
      {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
      {label ? <span>{busy ? "Downloading…" : label}</span> : null}
    </button>
    {error ? <p role="alert" className="p-2 text-xs text-destructive">{error}</p> : null}
  </div>;
}
