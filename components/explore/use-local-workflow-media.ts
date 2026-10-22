"use client";

import { useEffect, useRef, useState } from "react";

export type LocalWorkflowMedia = { name: string; url: string; duration: number | null; width?: number | null; height?: number | null; file?: File; assetId?: string };
export type LocalMediaKind = "image" | "audio" | "video";
type FileSelectionOptions = { minDuration?: number; maxDuration?: number; maxBytes?: number; signal?: AbortSignal; onRead?: (asset: LocalWorkflowMedia) => void };

/** Browser-only attachments for layout review. No upload, account write, or provider request. */
export function useLocalWorkflowMedia(kind: LocalMediaKind) {
  const [asset, setAsset] = useState<LocalWorkflowMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  const metadataRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { revision.current += 1; metadataRequest.current?.abort(); }, []);
  useEffect(() => () => { if (asset?.url.startsWith("blob:")) URL.revokeObjectURL(asset.url); }, [asset]);

  async function select(source: File | (() => Promise<File>), options: FileSelectionOptions = {}, acceptFile?: (file: File) => Promise<boolean>) {
    const request = ++revision.current;
    metadataRequest.current?.abort();
    const controller = new AbortController();
    metadataRequest.current = controller;
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
      const duration = await readDuration(url, kind, options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal);
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

  function cancelPending() {
    revision.current += 1;
    metadataRequest.current?.abort();
    setLoading(false);
    setError(null);
  }

  function remove() {
    revision.current += 1;
    metadataRequest.current?.abort();
    setAsset(null);
    setLoading(false);
    setError(null);
  }
  function chooseLibraryImage(image: { name: string; url: string }) {
    // Only the existing static Creator library. Never upload or add prompt text.
    if (kind !== "image" || !/^\/ai-studio\/creator-references\/creator-\d{2}\.png$/.test(image.url)) return;
    revision.current += 1;
    metadataRequest.current?.abort();
    setAsset({ ...image, duration: null });
    setLoading(false);
    setError(null);
  }
  return { asset, choose, chooseRemote, chooseLibraryImage, error, loading, remove, cancelPending, clearError: () => setError(null) };
}

export function readDuration(url: string, kind: LocalMediaKind, signal?: AbortSignal): Promise<number | null> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    if (kind === "image") {
      const image = new Image();
      let finished = false;
      const finish = (error?: unknown) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        image.onload = null; image.onerror = null;
        image.removeAttribute("src");
        if (error) reject(error); else resolve(null);
      };
      const onAbort = () => finish(signal?.reason ?? new Error("Image selection cancelled"));
      const timer = setTimeout(() => finish(new Error("Reading this image took too long")), 15000);
      signal?.addEventListener("abort", onAbort, { once: true });
      image.onload = () => finish();
      image.onerror = () => finish(new Error("Invalid image"));
      image.src = url;
      return;
    }
    const media = document.createElement(kind);
    let finished = false;
    const finish = (duration?: number) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      media.onloadedmetadata = null;
      media.onerror = null;
      media.removeAttribute("src");
      media.load();
      if (duration && Number.isFinite(duration)) resolve(duration);
      else reject(new Error("Invalid media duration"));
    };
    const onAbort = () => finish();
    const timer = setTimeout(() => finish(), 15000);
    signal?.addEventListener("abort", onAbort, { once: true });
    media.onloadedmetadata = () => finish(media.duration);
    media.onerror = () => finish();
    media.preload = "metadata";
    media.src = url;
  });
}
