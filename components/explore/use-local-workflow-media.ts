"use client";

import { useEffect, useRef, useState } from "react";

export type LocalWorkflowMedia = { name: string; url: string; duration: number | null; width?: number | null; height?: number | null; file?: File };
export type LocalMediaKind = "image" | "audio" | "video";
type FileSelectionOptions = { minDuration?: number; maxDuration?: number; maxBytes?: number; signal?: AbortSignal; onRead?: (asset: LocalWorkflowMedia) => void };

/** Browser-only attachments for layout review. No upload, account write, or provider request. */
export function useLocalWorkflowMedia(kind: LocalMediaKind) {
  const [asset, setAsset] = useState<LocalWorkflowMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  useEffect(() => () => { revision.current += 1; }, []);
  useEffect(() => () => { if (asset?.url.startsWith("blob:")) URL.revokeObjectURL(asset.url); }, [asset]);

  async function select(source: File | (() => Promise<File>), options: FileSelectionOptions = {}, acceptFile?: (file: File) => Promise<boolean>) {
    const request = ++revision.current;
    setError(null);
    setLoading(true);
    let url: string | null = null;
    let accepted = false;
    let downloading = typeof source === "function";
    try {
      // Saved choices are pending generation inputs from the initial click,
      // including the download before browser metadata validation begins.
      const file = typeof source === "function" ? await source() : source;
      if (request !== revision.current) return false;
      if (options.signal?.aborted) throw new Error(`This ${kind} selection was interrupted. Choose it again or remove the reference.`);
      downloading = false;
      const defaultMaxBytes = (kind === "video" ? 250 : kind === "audio" ? 25 : 20) * 1024 ** 2;
      const maxBytes = Math.min(defaultMaxBytes, options.maxBytes ?? defaultMaxBytes);
      const maxMB = maxBytes / 1024 ** 2;
      if (!file.type.startsWith(`${kind}/`) || !Number.isFinite(file.size) || file.size <= 0 || file.size > maxBytes) {
        setError(`Choose ${kind === "image" || kind === "audio" ? "an" : "a"} ${kind} file smaller than ${maxMB} MB.`);
        return false;
      }
      if (acceptFile) {
        // Editor callers upload and persist in their own choose callback.
        // Hand off without replacing that callback or the previous source.
        setLoading(false);
        return await acceptFile(file);
      }
      url = URL.createObjectURL(file);
      const duration = await readDuration(url, kind);
      if (request !== revision.current) return false;
      if (options.signal?.aborted) throw new Error(`This ${kind} selection was interrupted. Choose it again or remove the reference.`);
      if (options.minDuration && duration !== null && duration < options.minDuration) {
        setError(`Choose ${kind} at least ${options.minDuration} second long.`);
        return false;
      }
      if (options.maxDuration && duration !== null && duration > options.maxDuration) {
        setError(`Choose ${kind} up to ${options.maxDuration} seconds long.`);
        return false;
      }
      const next = { name: file.name, url, duration, file };
      setAsset(next);
      options.onRead?.(next);
      accepted = true;
      return true;
    } catch (cause) {
      if (request === revision.current) setError(options.signal?.aborted
        ? `This ${kind} selection was interrupted. Choose it again or remove the reference.`
        : downloading && cause instanceof Error ? cause.message : `This ${kind} could not be previewed. Try another file.`);
      return false;
    } finally {
      if (url && !accepted) URL.revokeObjectURL(url);
      if (request === revision.current) setLoading(false);
    }
  }

  const choose = (file: File, options: FileSelectionOptions = {}) => select(file, options);
  const chooseRemote = (loadFile: () => Promise<File>, options: FileSelectionOptions = {}, acceptFile?: (file: File) => Promise<boolean>) => select(loadFile, options, acceptFile);

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
  return { asset, choose, chooseRemote, chooseLibraryImage, error, loading, remove, clearError: () => setError(null) };
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
