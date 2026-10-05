"use client";

import { useEffect, useRef, useState } from "react";

export type LocalWorkflowMedia = { name: string; url: string; duration: number | null; file?: File };
export type LocalMediaKind = "image" | "audio" | "video";

/** Browser-only attachments for layout review. No upload, account write, or provider request. */
export function useLocalWorkflowMedia(kind: LocalMediaKind) {
  const [asset, setAsset] = useState<LocalWorkflowMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  useEffect(() => () => { revision.current += 1; }, []);
  useEffect(() => () => { if (asset?.url.startsWith("blob:")) URL.revokeObjectURL(asset.url); }, [asset]);

  async function choose(file: File, options: { maxDuration?: number; signal?: AbortSignal } = {}) {
    const request = ++revision.current;
    setError(null);
    const maxMB = kind === "video" ? 250 : kind === "audio" ? 25 : 20;
    if (!file.type.startsWith(`${kind}/`) || file.size > maxMB * 1024 * 1024) {
      setError(`Choose ${kind === "image" || kind === "audio" ? "an" : "a"} ${kind} file smaller than ${maxMB} MB.`);
      setLoading(false);
      return false;
    }
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const duration = await readDuration(url, kind);
      if (request !== revision.current || options.signal?.aborted) { URL.revokeObjectURL(url); return false; }
      if (options.maxDuration && duration !== null && duration > options.maxDuration) {
        URL.revokeObjectURL(url);
        setError(`Choose audio up to ${options.maxDuration} seconds long.`);
        return false;
      }
      setAsset({ name: file.name, url, duration, file });
      return true;
    } catch {
      URL.revokeObjectURL(url);
      if (request === revision.current) setError(`This ${kind} could not be previewed. Try another file.`);
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
  function chooseLibraryImage(image: { name: string; url: string }) {
    // Only the existing static Creator library. Never upload or add prompt text.
    if (kind !== "image" || !/^\/ai-studio\/creator-references\/creator-\d{2}\.png$/.test(image.url)) return;
    revision.current += 1;
    setAsset({ ...image, duration: null });
    setLoading(false);
    setError(null);
  }
  return { asset, choose, chooseLibraryImage, error, loading, remove };
}

function readDuration(url: string, kind: LocalMediaKind): Promise<number | null> {
  return new Promise((resolve, reject) => {
    if (kind === "image") {
      const image = new Image();
      image.onload = () => resolve(null);
      image.onerror = reject;
      image.src = url;
      return;
    }
    const media = document.createElement(kind);
    let finished = false;
    const finish = (duration?: number) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      media.onloadedmetadata = null;
      media.onerror = null;
      media.removeAttribute("src");
      media.load();
      if (duration && Number.isFinite(duration)) resolve(duration);
      else reject(new Error("Invalid media duration"));
    };
    const timer = setTimeout(() => finish(), 15000);
    media.onloadedmetadata = () => finish(media.duration);
    media.onerror = () => finish();
    media.preload = "metadata";
    media.src = url;
  });
}
