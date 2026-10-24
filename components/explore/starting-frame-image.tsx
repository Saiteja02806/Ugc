"use client";

/* eslint-disable @next/next/no-img-element -- Owned, verified result URL; do not send signed URLs through image optimization. */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import styles from "./hook-starting-frame-workspace.module.css";

export type StartingFramePreviewState = "loading" | "ready" | "error";

/** Job completion is separate from successfully displaying its image. */
export function StartingFrameImage({ assetId, url, alt, width, height, onStateChange }: {
  assetId: string; url: string; alt: string; width: number; height: number;
  onStateChange: (assetId: string, url: string, state: StartingFramePreviewState) => void;
}) {
  const img = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<StartingFramePreviewState>("loading");
  useEffect(() => {
    onStateChange(assetId, url, state);
  }, [assetId, url, state, onStateChange]);
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth > 0) {
      setState("ready");
      return;
    }
    const timeout = setTimeout(() => setState(current => current === "ready" ? current : "error"), 15000);
    return () => clearTimeout(timeout);
  }, []);
  return <span className={styles.previewImage} data-preview-state={state}>
    <img ref={img} src={url} alt={alt} width={width} height={height}
      onLoad={event => setState(event.currentTarget.naturalWidth > 0 ? "ready" : "error")}
      onError={() => setState("error")} />
    {state !== "ready" ? <span className={styles.previewFeedback} role={state === "error" ? "alert" : "status"}>
      {state === "loading" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
      {state === "loading" ? "Loading preview…" : "Preview could not load. Retry below; your image request is saved."}
    </span> : null}
  </span>;
}
