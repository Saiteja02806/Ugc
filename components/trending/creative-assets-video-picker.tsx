"use client";

import {
  Check,
  Film,
  Folder,
  FolderOpen,
  Layers3,
  Loader2,
  RotateCcw,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";
import type {
  TrendingVideoSourceFormat,
  TrendingVideoSourceSelection,
} from "@/lib/trending/video-source-selection";
import { cn } from "@/lib/utils";

type CreativeAssetGroup = {
  createdAt: string;
  id: string;
  mediaType: "video";
  name: string;
  updatedAt: string;
};

type GroupAsset = {
  addedAt: string;
  asset: MediaAsset;
};

type MediaResponse =
  | { assets: MediaAsset[]; ok: true }
  | { error?: string; ok?: false };

type GroupsResponse =
  | { groups: CreativeAssetGroup[]; ok: true }
  | { error?: string; ok?: false };

type GroupAssetsResponse =
  | {
      assets: GroupAsset[];
      group: CreativeAssetGroup;
      ok: true;
    }
  | { error?: string; ok?: false };

type SelectionResponse =
  | {
      ok: true;
      selection: TrendingVideoSourceSelection | null;
    }
  | { error?: string; ok?: false };

export function CreativeAssetsVideoPicker({
  format,
  open,
  onOpenChange,
  onSelectionSaved,
}: {
  format: TrendingVideoSourceFormat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectionSaved: () => void;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [groups, setGroups] = useState<CreativeAssetGroup[]>([]);
  const [selection, setSelection] =
    useState<TrendingVideoSourceSelection | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [groupAssets, setGroupAssets] = useState<
    Record<string, MediaAsset[]>
  >({});
  const [loadingGroupId, setLoadingGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"asset" | "default" | "group" | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGroup = useCallback(
    async (groupId: string, token?: string) => {
      setLoadingGroupId(groupId);
      setErrorMessage(null);

      try {
        const idToken = token ?? (await getCurrentUserIdToken());

        if (!idToken) {
          throw new Error("Sign in before choosing Creative Assets.");
        }

        const response = await fetch(
          `/api/media/groups/${encodeURIComponent(groupId)}/items`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${idToken}` },
          },
        );
        const data = (await response.json().catch(() => null)) as
          | GroupAssetsResponse
          | null;

        if (!response.ok || data?.ok !== true) {
          throw new Error(getApiError(data, "Could not load this group."));
        }

        const videos = data.assets
          .map((item) => item.asset)
          .filter(isCreativeAssetVideo);

        setGroupAssets((current) => ({ ...current, [groupId]: videos }));
        return videos;
      } finally {
        setLoadingGroupId((current) => (current === groupId ? null : current));
      }
    },
    [],
  );

  const loadPicker = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setGroupAssets({});
    setActiveGroupId(null);
    setSelectedAssetId(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before choosing Creative Assets.");
      }

      const [mediaResponse, groupsResponse, selectionResponse] =
        await Promise.all([
          fetch("/api/media", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/media/groups?mediaType=video", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(
            `/api/trending/video-source-selection?format=${encodeURIComponent(format)}`,
            {
              cache: "no-store",
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        ]);
      const [mediaData, groupsData, selectionData] = (await Promise.all([
        mediaResponse.json().catch(() => null),
        groupsResponse.json().catch(() => null),
        selectionResponse.json().catch(() => null),
      ])) as [
        MediaResponse | null,
        GroupsResponse | null,
        SelectionResponse | null,
      ];

      if (!mediaResponse.ok || mediaData?.ok !== true) {
        throw new Error(
          getApiError(mediaData, "Could not load Creative Assets."),
        );
      }

      if (!groupsResponse.ok || groupsData?.ok !== true) {
        throw new Error(getApiError(groupsData, "Could not load video groups."));
      }

      if (!selectionResponse.ok || selectionData?.ok !== true) {
        throw new Error(
          getApiError(selectionData, "Could not load the current source."),
        );
      }

      const videos = mediaData.assets.filter(isCreativeAssetVideo);
      setAssets(videos);
      setGroups(groupsData.groups);
      setSelection(selectionData.selection);

      if (
        selectionData.selection?.selectionKind === "group" &&
        selectionData.selection.groupId &&
        groupsData.groups.some(
          (group) => group.id === selectionData.selection?.groupId,
        )
      ) {
        setActiveGroupId(selectionData.selection.groupId);
        await loadGroup(selectionData.selection.groupId, token);
      } else if (selectionData.selection?.selectionKind === "asset") {
        setSelectedAssetId(selectionData.selection.mediaAssetId);
      }
    } catch (error) {
      setAssets([]);
      setGroups([]);
      setSelection(null);
      setErrorMessage(
        getErrorMessage(error, "Could not load Creative Assets."),
      );
    } finally {
      setLoading(false);
    }
  }, [format, loadGroup]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => void loadPicker(), 0);

    return () => window.clearTimeout(timer);
  }, [loadPicker, open]);

  const activeGroup =
    groups.find((group) => group.id === activeGroupId) ?? null;
  const visibleAssets = activeGroupId
    ? groupAssets[activeGroupId] ?? []
    : assets;
  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ??
    visibleAssets.find((asset) => asset.id === selectedAssetId) ??
    null;
  const currentLabel = useMemo(() => {
    if (!selection) {
      return "UGC Pilot library";
    }

    if (selection.selectionKind === "group") {
      return (
        groups.find((group) => group.id === selection.groupId)?.name ??
        "Video group"
      );
    }

    return (
      assets.find((asset) => asset.id === selection.mediaAssetId)?.title ??
      "One video"
    );
  }, [assets, groups, selection]);

  async function openGroup(groupId: string) {
    setActiveGroupId(groupId);
    setSelectedAssetId(null);

    try {
      await loadGroup(groupId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not load this group."));
    }
  }

  async function saveSource(
    kind: "asset" | "group",
    id: string,
  ) {
    setSaving(kind);
    setErrorMessage(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before choosing Creative Assets.");
      }

      const response = await fetch("/api/trending/video-source-selection", {
        body: JSON.stringify({
          format,
          groupId: kind === "group" ? id : undefined,
          mediaAssetId: kind === "asset" ? id : undefined,
          selectionKind: kind,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const data = (await response.json().catch(() => null)) as
        | SelectionResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not save this source."));
      }

      setSelection(data.selection);
      onOpenChange(false);
      onSelectionSaved();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not save this source."));
    } finally {
      setSaving(null);
    }
  }

  async function restoreDefaultSource() {
    setSaving("default");
    setErrorMessage(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before changing the video source.");
      }

      const response = await fetch(
        `/api/trending/video-source-selection?format=${encodeURIComponent(format)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          method: "DELETE",
        },
      );
      const data = (await response.json().catch(() => null)) as
        | SelectionResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not restore default videos."));
      }

      setSelection(null);
      onOpenChange(false);
      onSelectionSaved();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Could not restore default videos."),
      );
    } finally {
      setSaving(null);
    }
  }

  const formatLabel =
    format === "hook_video" ? "Hook video" : "Wall of text";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(760px,calc(100dvh-2rem))] min-h-[560px] grid-rows-[auto_minmax(0,1fr)_auto] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b bg-card px-5 py-5 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{formatLabel}</Badge>
            <span className="text-xs font-medium text-muted-foreground">
              Current: {currentLabel}
            </span>
          </div>
          <DialogTitle className="text-lg">
            Choose videos from Creative Assets
          </DialogTitle>
          <DialogDescription>
            Use every video in a group, or choose one specific video.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {loading ? (
            <PickerLoading />
          ) : errorMessage && assets.length === 0 ? (
            <PickerLoadError message={errorMessage} onRetry={loadPicker} />
          ) : assets.length === 0 ? (
            <Empty className="min-h-[390px] rounded-none border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Film />
                </EmptyMedia>
                <EmptyTitle>
                  There is no content in Creative Assets
                </EmptyTitle>
                <EmptyDescription>
                  Upload or generate a video in Creative Assets, then return
                  here to choose it.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link
                  href="/avatars?tab=videos"
                  className={buttonVariants({ variant: "default" })}
                >
                  Open Creative Assets
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <div className="border-b bg-muted/35 px-5 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Video shelves
                </p>
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    <Button
                      type="button"
                      variant={activeGroupId ? "outline" : "secondary"}
                      onClick={() => {
                        setActiveGroupId(null);
                        setSelectedAssetId(null);
                      }}
                    >
                      <Layers3 data-icon="inline-start" />
                      All assets
                      <Badge variant="outline">{assets.length}</Badge>
                    </Button>
                    {groups.map((group) => {
                      const selected = group.id === activeGroupId;

                      return (
                        <Button
                          key={group.id}
                          type="button"
                          variant={selected ? "secondary" : "outline"}
                          aria-pressed={selected}
                          onClick={() => void openGroup(group.id)}
                        >
                          {selected ? (
                            <FolderOpen data-icon="inline-start" />
                          ) : (
                            <Folder data-icon="inline-start" />
                          )}
                          {group.name}
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
                <div className="flex min-h-8 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">
                      {activeGroup?.name ?? "All assets"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {activeGroup
                        ? "Use the group as a rotating pool, or pick one video."
                        : "Choose one video, or open a group above."}
                    </p>
                  </div>
                  {loadingGroupId === activeGroupId ? (
                    <Loader2
                      className="animate-spin motion-reduce:animate-none"
                      aria-label="Loading group videos"
                    />
                  ) : null}
                </div>

                {activeGroupId &&
                loadingGroupId !== activeGroupId &&
                visibleAssets.length === 0 ? (
                  <Empty className="min-h-[310px] rounded-lg border">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Folder />
                      </EmptyMedia>
                      <EmptyTitle>This group has no videos</EmptyTitle>
                      <EmptyDescription>
                        Add videos to this group in Creative Assets, or choose
                        from All assets.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveGroupId(null)}
                      >
                        View All assets
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <ScrollArea className="mt-4 min-h-0 flex-1">
                    <div className="grid grid-cols-2 gap-3 pb-3 sm:grid-cols-3 md:grid-cols-4">
                      {visibleAssets.map((asset) => (
                        <VideoChoice
                          key={asset.id}
                          asset={asset}
                          selected={asset.id === selectedAssetId}
                          onSelect={() => setSelectedAssetId(asset.id)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="m-0 shrink-0 rounded-none px-5 py-4">
          {errorMessage && assets.length > 0 ? (
            <p
              role="alert"
              className="mr-auto self-center text-xs font-medium text-destructive"
            >
              {errorMessage}
            </p>
          ) : null}
          {selection ? (
            <Button
              type="button"
              variant="ghost"
              disabled={saving !== null}
              onClick={() => void restoreDefaultSource()}
            >
              {saving === "default" ? (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <RotateCcw data-icon="inline-start" />
              )}
              Use default videos
            </Button>
          ) : null}
          {activeGroup && visibleAssets.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving !== null}
              onClick={() => void saveSource("group", activeGroup.id)}
            >
              {saving === "group" ? (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Layers3 data-icon="inline-start" />
              )}
              Use entire group
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={!selectedAsset || saving !== null}
            onClick={() =>
              selectedAsset
                ? void saveSource("asset", selectedAsset.id)
                : undefined
            }
          >
            {saving === "asset" ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Video data-icon="inline-start" />
            )}
            Use selected video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VideoChoice({
  asset,
  selected,
  onSelect,
}: {
  asset: MediaAsset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Choose ${asset.title}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group relative aspect-[9/13] min-w-0 overflow-hidden rounded-lg border bg-muted text-left outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hover:translate-y-0",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-foreground/30",
      )}
    >
      {asset.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.thumbnailUrl}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <Film aria-hidden="true" />
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-foreground/80 px-2.5 py-2 text-background">
        <span className="block truncate text-xs font-semibold">
          {asset.title}
        </span>
        <span className="mt-0.5 block text-[10px] opacity-75">
          {formatDuration(asset.durationSeconds)}
        </span>
      </span>
      {selected ? (
        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check aria-hidden="true" />
        </span>
      ) : null}
    </button>
  );
}

function PickerLoading() {
  return (
    <div className="flex min-h-[430px] flex-col gap-4 px-5 py-5">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="aspect-[9/13] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function PickerLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Empty className="min-h-[390px] rounded-none border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Film />
        </EmptyMedia>
        <EmptyTitle>Could not load Creative Assets</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function isCreativeAssetVideo(asset: MediaAsset) {
  return (
    asset.status === "ready" &&
    (asset.collection === "video" || asset.collection === "influencer") &&
    asset.mimeType.startsWith("video/")
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "Video";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
