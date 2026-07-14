"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  Film,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type {
  MediaAsset,
  MediaCollection,
  MediaRatio,
  MediaSourceType,
} from "@/lib/media/types";

type MediaListResponse =
  | { assets: MediaAsset[]; ok: true }
  | { error?: string; ok?: false };

export function UserMediaCollection({
  collection,
  description,
  emptyDescription,
  emptyTitle,
  sourceTypes,
  title,
}: {
  collection: MediaCollection;
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  sourceTypes?: MediaSourceType[];
  title: string;
}) {
  const { loading: authLoading, user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<MediaAsset | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    if (authLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (!user) {
        throw new Error("Sign in to open your media library.");
      }

      const token = await requireToken();
      const params = new URLSearchParams({ collection });

      if (sourceTypes?.length) {
        params.set("sourceTypes", sourceTypes.join(","));
      }

      const response = await fetch(`/api/media?${params.toString()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as MediaListResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiError(data, "Could not load your media."));
      }

      setAssets(data.assets);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not load your media."));
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, collection, sourceTypes, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAssets(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAssets]);

  async function handleFile(file: File | undefined) {
    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    let incompleteUpload: { assetId: string; token: string } | null = null;

    try {
      const metadata = await readMediaMetadata(file, collection);
      const token = await requireToken();
      const preparedResponse = await fetch("/api/media/create-upload-url", {
        body: JSON.stringify({
          collection,
          contentType: file.type,
          fileName: file.name,
          fileSize: file.size,
          title: getFileTitle(file.name),
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const prepared = (await preparedResponse.json()) as {
        assetId?: string;
        error?: string;
        key?: string;
        ok?: boolean;
        requiredHeaders?: Record<string, string>;
        uploadUrl?: string;
      };

      if (!preparedResponse.ok || !prepared.ok || !prepared.assetId || !prepared.key || !prepared.uploadUrl) {
        throw new Error(prepared.error || "Could not prepare this upload.");
      }

      incompleteUpload = { assetId: prepared.assetId, token };

      const uploadResponse = await fetch(prepared.uploadUrl, {
        body: file,
        headers: prepared.requiredHeaders,
        method: "PUT",
      });

      if (!uploadResponse.ok) {
        throw new Error("The file could not be uploaded. Please try again.");
      }

      const completedResponse = await fetch("/api/media/complete-upload", {
        body: JSON.stringify({
          assetId: prepared.assetId,
          durationSeconds: metadata.durationSeconds,
          height: metadata.height,
          key: prepared.key,
          ratio: metadata.ratio,
          width: metadata.width,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const completed = (await completedResponse.json()) as {
        asset?: MediaAsset;
        error?: string;
        ok?: boolean;
      };

      if (!completedResponse.ok || !completed.ok || !completed.asset) {
        throw new Error(completed.error || "Could not finish this upload.");
      }

      setAssets((current) => [
        completed.asset as MediaAsset,
        ...current.filter((asset) => asset.id !== completed.asset?.id),
      ]);
      incompleteUpload = null;
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not upload this media."));

      if (incompleteUpload) {
        await fetch(`/api/media/${encodeURIComponent(incompleteUpload.assetId)}`, {
          headers: { Authorization: `Bearer ${incompleteUpload.token}` },
          method: "DELETE",
        }).catch(() => undefined);
      }
    } finally {
      setIsUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function removeAsset() {
    if (!pendingDeleteAsset || deletingAssetId) {
      return;
    }

    const asset = pendingDeleteAsset;
    setDeletingAssetId(asset.id);
    setDeleteErrorMessage(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const token = await requireToken();
      const response = await fetch(`/api/media/${encodeURIComponent(asset.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not remove this asset."));
      }

      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setPendingDeleteAsset(null);
      setSuccessMessage(getRemovalSuccessMessage(asset));
    } catch (error) {
      setDeleteErrorMessage(getErrorMessage(error, "Could not remove this asset."));
    } finally {
      setDeletingAssetId(null);
    }
  }

  return (
    <section className="rounded-[var(--radius-panel)] border border-border bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CollectionIcon collection={collection} />
          </span>
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <p className="mt-0.5 max-w-2xl text-sm font-medium leading-5 text-muted">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-md border border-border bg-card-muted px-2.5 py-1.5 text-xs font-bold text-muted">
            {isLoading ? "Loading" : `${assets.length} ${assets.length === 1 ? "asset" : "assets"}`}
          </span>
          <button
            type="button"
            onClick={() => void loadAssets()}
            disabled={isLoading || isUploading}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-white text-muted transition hover:bg-card-muted hover:text-foreground disabled:opacity-50"
            aria-label={`Refresh ${title}`}
          >
            <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={collection === "image" ? ".jpg,.jpeg,.png,.webp" : ".mp4,.mov,.webm"}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3.5 text-sm font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {isUploading ? "Uploading" : getUploadLabel(collection)}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-error/20 bg-error/5 px-3 py-2.5 text-sm font-semibold text-error">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm font-semibold text-[#087443]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {successMessage}
        </div>
      ) : null}

      <div className="mt-5">
        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border bg-card-muted text-sm font-semibold text-muted">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            Loading real media…
          </div>
        ) : assets.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {assets.map((asset) => (
              <MediaAssetCard
                key={asset.id}
                asset={asset}
                deleting={deletingAssetId === asset.id}
                onRemove={() => {
                  setDeleteErrorMessage(null);
                  setPendingDeleteAsset(asset);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card-muted px-5 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-white text-muted">
              <Upload className="size-4.5" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-sm font-bold text-foreground">{emptyTitle}</h3>
            <p className="mt-1 max-w-md text-sm font-medium leading-5 text-muted">{emptyDescription}</p>
          </div>
        )}
      </div>

      <Dialog
        open={pendingDeleteAsset !== null}
        onOpenChange={(open) => {
          if (!open && !deletingAssetId) {
            setDeleteErrorMessage(null);
            setPendingDeleteAsset(null);
          }
        }}
      >
        <DialogContent showCloseButton={!deletingAssetId}>
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg font-semibold">Remove this asset?</DialogTitle>
            <DialogDescription>
              {pendingDeleteAsset ? getRemovalDescription(pendingDeleteAsset) : ""}
            </DialogDescription>
          </DialogHeader>

          {pendingDeleteAsset ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card-muted p-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-muted ring-1 ring-border">
                <CollectionIcon collection={pendingDeleteAsset.collection} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{pendingDeleteAsset.title}</p>
                <p className="mt-0.5 text-xs font-semibold text-muted">
                  {getSourceLabel(pendingDeleteAsset)} · {formatAssetDate(pendingDeleteAsset.createdAt)}
                </p>
              </div>
            </div>
          ) : null}

          {deleteErrorMessage ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/5 px-3 py-2.5 text-sm font-semibold text-error">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {deleteErrorMessage}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteErrorMessage(null);
                setPendingDeleteAsset(null);
              }}
              disabled={Boolean(deletingAssetId)}
            >
              Keep asset
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void removeAsset()}
              disabled={Boolean(deletingAssetId)}
            >
              {deletingAssetId ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              {deletingAssetId ? "Removing" : "Remove asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MediaAssetCard({
  asset,
  deleting,
  onRemove,
}: {
  asset: MediaAsset;
  deleting: boolean;
  onRemove: () => void;
}) {
  const isImage = asset.collection === "image";

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="relative aspect-video overflow-hidden bg-[#111827]">
        {isImage ? (
          <Image src={asset.thumbnailUrl || asset.url} alt={asset.title} fill unoptimized className="object-cover" sizes="(max-width: 640px) 100vw, 25vw" />
        ) : (
          <video src={asset.url} poster={asset.thumbnailUrl || undefined} preload="metadata" muted controls className="size-full object-cover" />
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-foreground">{asset.title}</h3>
            <p className="mt-1 text-xs font-semibold text-muted">{getSourceLabel(asset)}</p>
            <p className="mt-0.5 text-[11px] font-medium text-muted">{formatAssetDate(asset.createdAt)}</p>
          </div>
          <span className="rounded-md bg-success/10 px-2 py-1 text-[11px] font-bold text-[#087443]">Ready</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {!isImage ? (
            <Link href={`/edit/${encodeURIComponent(asset.id)}`} className="inline-flex h-8 min-w-0 flex-1 items-center justify-center rounded-md border border-border bg-card-muted px-3 text-xs font-bold text-foreground transition hover:bg-[#e9edf1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              Open in Edit
            </Link>
          ) : (
            <span className="min-w-0 flex-1 text-xs font-semibold text-muted">Available in your image library</span>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={deleting}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-white text-muted transition hover:border-error/30 hover:bg-error/5 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Remove ${asset.title}`}
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </article>
  );
}

async function readMediaMetadata(file: File, collection: MediaCollection) {
  const objectUrl = URL.createObjectURL(file);

  try {
    if (collection === "image") {
      const image = new window.Image();
      image.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not read this image."));
      });

      return { durationSeconds: null, height: image.naturalHeight, ratio: getRatio(image.naturalWidth, image.naturalHeight), width: image.naturalWidth };
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read this video."));
    });

    return { durationSeconds: video.duration, height: video.videoHeight, ratio: getRatio(video.videoWidth, video.videoHeight), width: video.videoWidth };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getRatio(width: number, height: number): MediaRatio {
  const value = width / height;
  const options: [MediaRatio, number][] = [["9:16", 9 / 16], ["1:1", 1], ["4:5", 4 / 5], ["16:9", 16 / 9]];
  return options.find(([, expected]) => Math.abs(value - expected) <= 0.03)?.[0] ?? "other";
}

function CollectionIcon({ collection }: { collection: MediaCollection }) {
  if (collection === "influencer") return <UserRound className="size-4.5" aria-hidden="true" />;
  if (collection === "image") return <FileImage className="size-4.5" aria-hidden="true" />;
  return <Film className="size-4.5" aria-hidden="true" />;
}

function getUploadLabel(collection: MediaCollection) {
  if (collection === "influencer") return "Upload influencer";
  if (collection === "image") return "Upload image";
  return "Upload hook";
}

function getSourceLabel(asset: MediaAsset) {
  const labels: Record<MediaAsset["sourceType"], string> = {
    demo_upload: "Uploaded demo",
    catalog_influencer: "UGC Pilot influencer",
    combined_render: "Combined render",
    edit_export: "Edit export",
    generated_image: "Generated image",
    generated_video: "Generated video",
    influencer_upload: "Your influencer",
    upload: "Your upload",
  };
  return labels[asset.sourceType];
}

function getRemovalDescription(asset: MediaAsset) {
  if (asset.sourceType === "catalog_influencer") {
    return "This removes the influencer from your personal Edit library only. The shared UGC Pilot influencer stays protected and remains available in the catalog.";
  }

  return "This hides the asset from your collection and Edit. The stored file is retained for recovery, so it is not permanently erased.";
}

function getRemovalSuccessMessage(asset: MediaAsset) {
  return asset.sourceType === "catalog_influencer"
    ? `${asset.title} was removed from your personal library. The UGC Pilot catalog was not changed.`
    : `${asset.title} was removed from your library. Its stored file remains recoverable.`;
}

function formatAssetDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Saved to your library";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getFileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 140) || "Untitled media";
}

async function requireToken() {
  const token = await getCurrentUserIdToken();
  if (!token) throw new Error("Sign in to manage your media.");
  return token;
}

function getApiError(value: unknown, fallback: string) {
  return value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
