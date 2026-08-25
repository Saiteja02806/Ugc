"use client";

import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

const ENDPOINT = "/api/settings/app-screenshots";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type AppScreenshot = {
  businessProfileId: string;
  categorySlug: string;
  createdAt: string;
  fileName: string;
  height: number;
  id: string;
  libraryAssetId: string;
  storageKey: string;
  url: string;
  width: number;
};

type AssetsResponse =
  | { assets: AppScreenshot[]; ok: true }
  | { error?: string; ok?: false };

type PrepareResponse =
  | {
      assetId: string;
      ok: true;
      requiredHeaders: Record<string, string>;
      storageKey: string;
      uploadUrl: string;
    }
  | { error?: string; ok?: false };

type CompleteResponse =
  | {
      asset: AppScreenshot;
      deduplicated: boolean;
      ok: true;
    }
  | { error?: string; ok?: false };

export function AppScreenshotsSettings() {
  const { loading: authLoading, user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<AppScreenshot[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingRemoval, setPendingRemoval] =
    useState<AppScreenshot | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    if (authLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!user) {
        throw new Error("Sign in before managing app screenshots.");
      }

      const token = await requireToken();
      const response = await fetch(ENDPOINT, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | AssetsResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not load app screenshots."));
      }

      setAssets(data.assets);
    } catch (error) {
      setErrorMessage(getAppScreenshotsLoadError(error));
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAssets(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAssets]);

  async function uploadScreenshot(file: File) {
    if (isUploading) return;

    if (!SUPPORTED_TYPES.has(file.type)) {
      setErrorMessage("Upload a JPG, PNG, or WebP app screenshot.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      setErrorMessage("Choose an app screenshot up to 25 MB.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setNoticeMessage(null);
    let pendingAssetId: string | null = null;
    let token: string | null = null;
    let completed = false;

    try {
      token = await requireToken();
      const prepareResponse = await fetch(ENDPOINT, {
        body: JSON.stringify({
          contentType: file.type,
          fileName: file.name,
          fileSize: file.size,
        }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const prepared = (await prepareResponse.json().catch(() => null)) as
        | PrepareResponse
        | null;

      if (!prepareResponse.ok || prepared?.ok !== true) {
        throw new Error(
          getApiError(prepared, "Could not prepare this app screenshot."),
        );
      }

      pendingAssetId = prepared.assetId;
      const uploadResponse = await fetch(prepared.uploadUrl, {
        body: file,
        headers: prepared.requiredHeaders,
        method: "PUT",
      });

      if (!uploadResponse.ok) {
        throw new Error("The app screenshot could not be uploaded.");
      }

      const completeResponse = await fetch(ENDPOINT, {
        body: JSON.stringify({
          assetId: prepared.assetId,
          storageKey: prepared.storageKey,
        }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const result = (await completeResponse.json().catch(() => null)) as
        | CompleteResponse
        | null;

      if (!completeResponse.ok || result?.ok !== true) {
        throw new Error(
          getApiError(result, "Could not verify this app screenshot."),
        );
      }

      completed = true;
      setAssets((current) => [
        result.asset,
        ...current.filter((asset) => asset.id !== result.asset.id),
      ]);
      setNoticeMessage(
        result.deduplicated
          ? "That screenshot was already saved."
          : "App screenshot uploaded and ready for Structure 2.",
      );
    } catch (error) {
      if (pendingAssetId && token && !completed) {
        await fetch(ENDPOINT, {
          body: JSON.stringify({ assetId: pendingAssetId }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "DELETE",
        }).catch(() => undefined);
      }
      setErrorMessage(
        getErrorMessage(error, "Could not upload this app screenshot."),
      );
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeScreenshot() {
    if (!pendingRemoval || removingAssetId) return;

    setRemovingAssetId(pendingRemoval.id);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const token = await requireToken();
      const response = await fetch(ENDPOINT, {
        body: JSON.stringify({ assetId: pendingRemoval.id }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; ok?: boolean }
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not remove this screenshot."));
      }

      const removedId = pendingRemoval.id;
      setAssets((current) =>
        current.filter((asset) => asset.id !== removedId),
      );
      setPendingRemoval(null);
      setNoticeMessage("App screenshot removed from future carousels.");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Could not remove this screenshot."),
      );
    } finally {
      setRemovingAssetId(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-foreground-strong">
                Product screen library
              </p>
              <Badge variant="secondary">
                {assets.length} {assets.length === 1 ? "screenshot" : "screenshots"}
              </Badge>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Upload once and reuse these screens in eligible Structure 2
              product-reveal slides. Structure 1 keeps its original visuals.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={isUploading || isLoading}
            onClick={() => inputRef.current?.click()}
            className="w-full sm:w-auto"
          >
            {isUploading ? (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Upload data-icon="inline-start" aria-hidden="true" />
            )}
            {isUploading ? "Uploading…" : "Upload screenshot"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Upload app screenshot"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadScreenshot(file);
            }}
          />
        </div>

        {noticeMessage ? (
          <Alert aria-live="polite">
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Screenshot library updated</AlertTitle>
            <AlertDescription>{noticeMessage}</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>App screenshots unavailable</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
            <AlertAction>
              <Button type="button" size="sm" variant="ghost" onClick={() => void loadAssets()}>
                Retry
              </Button>
            </AlertAction>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="aspect-[4/5] rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <Empty className="border bg-card-muted/35">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImagePlus aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No app screenshots yet</EmptyTitle>
              <EmptyDescription>
                Add a real product screen before the next Structure 2 carousel
                is generated. JPG, PNG, or WebP up to 25 MB.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={() => inputRef.current?.click()}
              >
                <Upload data-icon="inline-start" aria-hidden="true" />
                Upload first screenshot
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <article
                key={asset.id}
                className="group overflow-hidden rounded-[var(--radius-card)] border border-border bg-card-muted/60 shadow-card transition-shadow hover:shadow-floating"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-card-muted/80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.fileName}
                    className="size-full object-contain transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
                  />
                  <Badge className="absolute left-2 top-2" variant="secondary">
                    Structure 2 ready
                  </Badge>
                </div>
                <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground-strong">
                      {asset.fileName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {asset.width} × {asset.height}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${asset.fileName}`}
                    title="Remove screenshot"
                    className="text-muted hover:bg-error/10 hover:text-error"
                    onClick={() => setPendingRemoval(asset)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !removingAssetId) setPendingRemoval(null);
        }}
      >
        <DialogContent showCloseButton={!removingAssetId}>
          <DialogHeader>
            <DialogTitle>Remove this app screenshot?</DialogTitle>
            <DialogDescription>
              It will no longer be available for future carousels. Existing
              rendered slides remain unchanged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(removingAssetId)}
              onClick={() => setPendingRemoval(null)}
            >
              Keep screenshot
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(removingAssetId)}
              onClick={() => void removeScreenshot()}
            >
              {removingAssetId ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Trash2 data-icon="inline-start" aria-hidden="true" />
              )}
              {removingAssetId ? "Removing…" : "Remove screenshot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function requireToken() {
  const token = await getCurrentUserIdToken();
  if (!token) throw new Error("Sign in before managing app screenshots.");
  return token;
}

function getApiError(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getAppScreenshotsLoadError(error: unknown) {
  if (
    error instanceof TypeError &&
    /(?:failed to fetch|load failed|networkerror)/i.test(error.message)
  ) {
    return "We couldn't reach App Screenshots. Check your connection or disable any request-blocking browser extension for this site, then try again.";
  }

  return getErrorMessage(error, "Could not load app screenshots.");
}
