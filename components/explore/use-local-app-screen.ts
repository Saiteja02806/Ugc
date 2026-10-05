"use client";

import { useEffect, useRef, useState } from "react";
import { validateAppScreenFile } from "@/lib/explore/phone-workflow";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";

export type LocalAppScreen = LocalWorkflowMedia & { kind: "image" | "video" };

/** One app-screen slot, independent of Creator, video reference and appended demo. */
export function useLocalAppScreen() {
  const [asset, setAsset] = useState<LocalAppScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  useEffect(() => () => { revision.current += 1; }, []);
  useEffect(() => () => { if (asset) URL.revokeObjectURL(asset.url); }, [asset]);

  async function choose(file: File) {
    const request = ++revision.current;
    setError(null);
    const validation = validateAppScreenFile(file);
    if (validation.error !== null) {
      setError(validation.error);
      setLoading(false);
      return false;
    }
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const duration = await readAppScreen(url, validation.kind);
      if (request !== revision.current) { URL.revokeObjectURL(url); return false; }
      setAsset({ name: file.name, url, duration, kind: validation.kind, file });
      return true;
    } catch {
      URL.revokeObjectURL(url);
      if (request === revision.current) setError("This app screen could not be previewed. Choose another screenshot or recording.");
      return false;
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }

  function remove() {
    revision.current += 1;
    setAsset(null);
    setLoading(false);
    setError(null);
  }
  return { asset, choose, remove, loading, error };
}

function readAppScreen(url: string, kind: "image" | "video"): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const preview = kind === "image" ? new Image() : document.createElement("video");
    let finished = false;
    const finish = (valid: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      preview.onload = null;
      preview.onerror = null;
      const duration = preview instanceof HTMLVideoElement ? preview.duration : null;
      if (preview instanceof HTMLVideoElement) {
        preview.onloadedmetadata = null;
        preview.removeAttribute("src");
        preview.load();
      } else preview.removeAttribute("src");
      if (valid) resolve(duration);
      else reject(new Error("Invalid app-screen media"));
    };
    const timer = setTimeout(() => finish(false), 15000);
    preview.onerror = () => finish(false);
    if (preview instanceof HTMLVideoElement) {
      preview.preload = "metadata";
      preview.onloadedmetadata = () => finish(Number.isFinite(preview.duration) && preview.duration > 0);
    } else preview.onload = () => finish(preview.naturalWidth > 0 && preview.naturalHeight > 0);
    preview.src = url;
  });
}
