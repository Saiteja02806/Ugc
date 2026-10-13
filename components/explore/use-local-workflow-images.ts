"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";

export type WorkflowImageAttachment = WorkflowAttachment & {
  assets: LocalWorkflowMedia[];
  maxImages: number;
  chooseFiles: (files: File[]) => Promise<boolean>;
  removeImage: (url: string) => void;
};

/** Ordered local references. Files upload only when the user generates. */
export function useLocalWorkflowImages(maxImages = 6): WorkflowImageAttachment {
  const [assets, setAssets] = useState<LocalWorkflowMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const current = useRef<LocalWorkflowMedia[]>([]);
  const ownedUrls = useRef(new Set<string>());
  const revision = useRef(0);
  const reading = useRef(false);
  useEffect(() => () => {
    revision.current += 1;
    for (const url of ownedUrls.current) URL.revokeObjectURL(url);
    ownedUrls.current.clear();
  }, []);
  useEffect(() => {
    const retained = new Set(assets.map(asset => asset.url));
    for (const url of ownedUrls.current) if (!retained.has(url)) {
      URL.revokeObjectURL(url); ownedUrls.current.delete(url);
    }
  }, [assets]);

  function update(next: LocalWorkflowMedia[]) { current.current = next; setAssets(next); }
  async function selectFiles(source: File[] | (() => Promise<File[]>), options?: Parameters<WorkflowAttachment["choose"]>[1], acceptFile?: (file: File) => Promise<boolean>) {
    if (reading.current) return false;
    const request = ++revision.current;
    reading.current = true; setLoading(true); setError(null);
    const prepared: LocalWorkflowMedia[] = [];
    let accepted = false;
    try {
      const files = typeof source === "function" ? await source() : source;
      if (request !== revision.current) return false;
      if (options?.signal?.aborted) throw new Error("This image selection was interrupted. Choose it again or remove the reference.");
      if (!files.length) return false;
      if (current.current.length + files.length > maxImages) throw new Error(`This model accepts up to ${maxImages} image references. Remove an image before adding more.`);
      for (const file of files) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || !Number.isFinite(file.size) || file.size <= 0 || file.size > 20 * 1024 ** 2) {
          throw new Error("Use a PNG, JPEG or WebP reference image up to 20 MB.");
        }
        if (acceptFile) return await acceptFile(file);
        const url = URL.createObjectURL(file);
        const asset = { name: file.name, url, file, duration: null };
        prepared.push(asset);
        await new Promise<void>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("This image could not be previewed. Try another file."));
          image.src = url;
        });
        if (request !== revision.current) return false;
        if (options?.signal?.aborted) throw new Error("This image selection was interrupted. Choose it again or remove the reference.");
      }
      for (const asset of prepared) ownedUrls.current.add(asset.url);
      update([...current.current, ...prepared]);
      for (const asset of prepared) options?.onRead?.(asset);
      accepted = true;
      return true;
    } catch (cause) {
      if (request === revision.current) setError(cause instanceof Error ? cause.message : "Could not add these images.");
      return false;
    } finally {
      if (!accepted) for (const asset of prepared) URL.revokeObjectURL(asset.url);
      if (request === revision.current) { reading.current = false; setLoading(false); }
    }
  }
  const chooseFiles = (files: File[]) => selectFiles(files);
  function removeImage(url: string) {
    revision.current += 1; reading.current = false;
    update(current.current.filter(asset => asset.url !== url)); setError(null); setLoading(false);
  }
  function remove() {
    revision.current += 1; reading.current = false;
    update([]); setError(null); setLoading(false);
  }
  function chooseLibraryImage(image: { name: string; url: string }) {
    if (!/^\/ai-studio\/creator-references\/creator-\d{2}\.png$/.test(image.url) || reading.current) return;
    if (current.current.some(asset => asset.url === image.url)) { setError(null); return; }
    if (current.current.length >= maxImages) { setError(`This model accepts up to ${maxImages} image references. Remove an image before adding more.`); return; }
    update([...current.current, { ...image, duration: null }]); setError(null);
  }
  const choose: WorkflowAttachment["choose"] = (file, options) => selectFiles([file], options);
  const chooseRemote: WorkflowAttachment["chooseRemote"] = async (loadFile, options, acceptFile) => {
    return selectFiles(async () => [await loadFile()], options, acceptFile);
  };
  return { assets, asset: assets[0] ?? null, maxImages, chooseFiles, choose, chooseRemote, chooseLibraryImage, removeImage, remove,
    error, loading, clearError: () => setError(null) };
}
