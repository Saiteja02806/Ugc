"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Folder,
  FolderOpen,
  ImagePlus,
  Loader2,
  Move,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";
import {
  clampNormalizedTextPosition,
  createHookEditContent,
  createWallTextEditContent,
  type NormalizedTextPosition,
  type TrendingCarouselEditContent,
  type TrendingCarouselEditSlide,
  type TrendingCreativeEditContent,
  type TrendingCreativeEditRecord,
  type TrendingHookEditContent,
  type TrendingWallTextEditContent,
} from "@/lib/trending/creative-edit-contract";
import {
  selectEntireLibrary,
  selectExactVideo,
  updateSourceChoiceForPreview,
  type CreativeEditSourceChoice,
} from "@/lib/trending/creative-edit-source-selection";
import type { TrendingFeedItem } from "@/lib/trending/feed-items";
import {
  createHookTextLayout,
  HOOK_TEXT_BROWSER_FONT_FAMILY,
  HOOK_TEXT_FONT_WEIGHT,
  HOOK_TEXT_MAXIMUM_CHARACTERS,
  HOOK_TEXT_MAXIMUM_LINES,
  HOOK_TEXT_MAXIMUM_WORDS,
  HOOK_TEXT_MINIMUM_CHARACTERS,
  HOOK_TEXT_MINIMUM_WORDS,
  HOOK_TEXT_OUTLINE_COLOR,
  HOOK_TEXT_OUTLINE_WIDTH,
  type HookTextLayout,
} from "@/lib/trending/hook-text-layout";
import {
  TRENDING_TEXT_COLOR_OPTIONS,
  type TrendingTextColor,
} from "@/lib/trending/text-color";
import {
  getWallTextFontSize,
  WALL_TEXT_FONT_WEIGHT,
  WALL_TEXT_INLINE_SAFE_PADDING,
  WALL_TEXT_LINE_HEIGHT_FACTOR,
  WALL_TEXT_OUTLINE_WIDTH,
} from "@/lib/trending/wall-text-visual-style";
import { MIN_SHORT_WALL_TEXT_WORDS } from "@/lib/trending/wall-text-text-logic";
import { getWallTextRenderBlocks } from "@/lib/trending/wall-text-types";
import { cn } from "@/lib/utils";

type CreativeAssetGroup = {
  createdAt: string;
  id: string;
  mediaType: "video";
  name: string;
  updatedAt: string;
};

type MediaResponse =
  | { assets: MediaAsset[]; ok: true }
  | { error?: string; ok?: false };
type GroupsResponse =
  | { groups: CreativeAssetGroup[]; ok: true }
  | { error?: string; ok?: false };
type GroupAssetsResponse =
  | {
      assets: Array<{ addedAt: string; asset: MediaAsset }>;
      group: CreativeAssetGroup;
      ok: true;
    }
  | { error?: string; ok?: false };
type EditResponse =
  | { edit: TrendingCreativeEditRecord; ok: true }
  | { error?: string; ok?: false };

type CarouselProductAsset = {
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

type CarouselProductAssetsResponse =
  | { assets: CarouselProductAsset[]; ok: true }
  | { error?: string; ok?: false };

type CarouselProductAssetUploadResponse =
  | {
      assetId: string;
      ok: true;
      requiredHeaders: Record<string, string>;
      storageKey: string;
      uploadUrl: string;
    }
  | { error?: string; ok?: false };

type CarouselProductAssetCompleteResponse =
  | { asset: CarouselProductAsset; deduplicated: boolean; ok: true }
  | { error?: string; ok?: false };

type CarouselHyperHookAsset = {
  height: number;
  id: string;
  name: string;
  url: string;
  width: number;
};

type CarouselHyperHooksResponse =
  | {
      assets: CarouselHyperHookAsset[];
      folder: {
        assetCount: number;
        description: string;
        id: "hyper-hooks";
        name: string;
      };
      ok: true;
    }
  | { error?: string; ok?: false };

export function TrendingCreativeEditor({
  item,
  onClose,
  onSaved,
}: {
  item: TrendingFeedItem | null;
  onClose: () => void;
  onSaved: (edit: TrendingCreativeEditRecord) => void;
}) {
  const [edit, setEdit] = useState<TrendingCreativeEditRecord | null>(null);
  const [content, setContent] = useState<TrendingCreativeEditContent | null>(
    null,
  );
  const [initialContent, setInitialContent] =
    useState<TrendingCreativeEditContent | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [groups, setGroups] = useState<CreativeAssetGroup[]>([]);
  const [groupAssets, setGroupAssets] = useState<Record<string, MediaAsset[]>>(
    {},
  );
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [productAssets, setProductAssets] = useState<CarouselProductAsset[]>([]);
  const [productAssetsLoading, setProductAssetsLoading] = useState(false);
  const [productAssetsUploading, setProductAssetsUploading] = useState(false);
  const [productAssetsError, setProductAssetsError] = useState<string | null>(
    null,
  );
  const [hyperHookAssets, setHyperHookAssets] = useState<
    CarouselHyperHookAsset[]
  >([]);
  const [hyperHookAssetsLoading, setHyperHookAssetsLoading] = useState(false);
  const [hyperHookAssetsError, setHyperHookAssetsError] = useState<
    string | null
  >(null);
  const [hyperHookFolderOpen, setHyperHookFolderOpen] = useState(false);
  const [folderView, setFolderView] = useState<
    "folders" | "creative-assets" | "group"
  >("folders");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [loadingGroupId, setLoadingGroupId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [sourceChoice, setSourceChoice] = useState<
    CreativeEditSourceChoice | null | undefined
  >(undefined);
  const [protectedHookPreviewUrl, setProtectedHookPreviewUrl] = useState<
    string | null
  >(null);
  const groupRequestRef = useRef(0);
  const productAssetInputRef = useRef<HTMLInputElement>(null);

  const loadEditor = useCallback(async () => {
    if (!item) {
      return;
    }

    setLoading(true);
    setError(null);
    groupRequestRef.current += 1;
    setActiveSlideIndex(0);
    setProtectedHookPreviewUrl(null);
    setProductAssets([]);
    setProductAssetsError(null);
    setHyperHookAssets([]);
    setHyperHookAssetsError(null);
    setHyperHookFolderOpen(false);

    try {
      const token = await requireToken();
      const response = await fetch(getEditorEndpoint(item, true), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | EditResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not open this editor."));
      }

      setEdit(data.edit);
      setContent(data.edit.content);
      setInitialContent(data.edit.content);
      setFolderView("folders");
      setActiveGroupId(null);
      setSourceChoice(toSourceChoice(data.edit));
      setSelectedAsset(null);
    } catch (loadError) {
      setEdit(null);
      setContent(null);
      setInitialContent(null);
      setError(getErrorMessage(loadError, "Could not open this editor."));
    } finally {
      setLoading(false);
    }
  }, [item]);

  const loadGroup = useCallback(async (groupId: string, token?: string) => {
    setLoadingGroupId(groupId);
    setAssetsError(null);

    try {
      const idToken = token ?? (await requireToken());
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
        .map((entry) => entry.asset)
        .filter(isReadyVideoAsset);
      setGroupAssets((current) => ({ ...current, [groupId]: videos }));
      return videos;
    } finally {
      setLoadingGroupId((current) => (current === groupId ? null : current));
    }
  }, []);

  const loadCreativeAssets = useCallback(async () => {
    if (!item || item.format === "carousel") {
      return;
    }

    setAssetsLoading(true);
    setAssetsError(null);

    try {
      const token = await requireToken();
      const [mediaResponse, groupsResponse] = await Promise.all([
        fetch("/api/media", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/media/groups?mediaType=video", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const [mediaData, groupsData] = (await Promise.all([
        mediaResponse.json().catch(() => null),
        groupsResponse.json().catch(() => null),
      ])) as [MediaResponse | null, GroupsResponse | null];

      if (!mediaResponse.ok || mediaData?.ok !== true) {
        throw new Error(
          getApiError(mediaData, "Could not load Creative Assets."),
        );
      }

      if (!groupsResponse.ok || groupsData?.ok !== true) {
        throw new Error(getApiError(groupsData, "Could not load video groups."));
      }

      const videos = mediaData.assets.filter(isReadyVideoAsset);
      setAssets(videos);
      setGroups(groupsData.groups);

      const savedAssetId = edit?.source?.resolvedAssetId;
      const savedAsset = videos.find((asset) => asset.id === savedAssetId);
      if (savedAsset) {
        setSelectedAsset(savedAsset);
      }

      const savedGroupId = edit?.source?.groupId;
      if (savedGroupId) {
        const loaded = await loadGroup(savedGroupId, token);
        const groupedSavedAsset = loaded.find(
          (asset) => asset.id === savedAssetId,
        );
        if (groupedSavedAsset) {
          setSelectedAsset(groupedSavedAsset);
        }
      }
    } catch (assetsLoadError) {
      setAssetsError(
        getErrorMessage(assetsLoadError, "Could not load Creative Assets."),
      );
    } finally {
      setAssetsLoading(false);
    }
  }, [edit, item, loadGroup]);

  const loadCarouselProductAssets = useCallback(async () => {
    if (!item || item.format !== "carousel") {
      return;
    }

    setProductAssetsLoading(true);
    setProductAssetsError(null);

    try {
      const token = await requireToken();
      const response = await fetch(
        `/api/trending/carousel-product-assets?carouselId=${encodeURIComponent(item.creativeId)}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json().catch(() => null)) as
        | CarouselProductAssetsResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not load app screenshots."));
      }

      setProductAssets(data.assets);
    } catch (loadError) {
      setProductAssetsError(
        getErrorMessage(loadError, "Could not load app screenshots."),
      );
    } finally {
      setProductAssetsLoading(false);
    }
  }, [item]);

  const loadCarouselHyperHooks = useCallback(async () => {
    if (!item || item.format !== "carousel") {
      return;
    }

    setHyperHookAssetsLoading(true);
    setHyperHookAssetsError(null);

    try {
      const token = await requireToken();
      const response = await fetch("/api/trending/carousel-hyper-hooks", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | CarouselHyperHooksResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not load the Hook library."));
      }

      setHyperHookAssets(data.assets);
    } catch (loadError) {
      setHyperHookAssetsError(
        getErrorMessage(loadError, "Could not load the Hook library."),
      );
    } finally {
      setHyperHookAssetsLoading(false);
    }
  }, [item]);

  useEffect(() => {
    if (!item) {
      return;
    }

    const timer = window.setTimeout(() => void loadEditor(), 0);
    return () => window.clearTimeout(timer);
  }, [item, loadEditor]);

  useEffect(() => {
    if (!edit || edit.format === "carousel") {
      return;
    }

    const timer = window.setTimeout(() => void loadCreativeAssets(), 0);
    return () => window.clearTimeout(timer);
  }, [edit, loadCreativeAssets]);

  useEffect(() => {
    if (!edit || edit.format !== "carousel") {
      return;
    }

    const timer = window.setTimeout(
      () => void loadCarouselProductAssets(),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [edit, loadCarouselProductAssets]);

  useEffect(() => {
    if (!edit || edit.format !== "carousel") {
      return;
    }

    const timer = window.setTimeout(() => void loadCarouselHyperHooks(), 0);
    return () => window.clearTimeout(timer);
  }, [edit, loadCarouselHyperHooks]);

  useEffect(() => {
    if (!item || item.format !== "hook_video" || edit?.source) {
      return;
    }

    const controller = new AbortController();
    const hookItem = item;

    async function loadProtectedPreview() {
      try {
        const token = await requireToken();
        const response = await fetch(hookItem.creative.previewSessionEndpoint, {
          body: JSON.stringify({
            influencerId: hookItem.creative.influencerId,
            sourceKind: hookItem.creative.sourceKind,
          }),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | { ok: true; previewUrl: string }
          | { ok?: false }
          | null;

        if (response.ok && data?.ok === true && !controller.signal.aborted) {
          setProtectedHookPreviewUrl(
            `${data.previewUrl}?session=${Date.now()}`,
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setProtectedHookPreviewUrl(null);
        }
      }
    }

    void loadProtectedPreview();
    return () => controller.abort();
  }, [edit?.source, item]);

  const sourcePreview = selectedAsset
    ? {
        thumbnailUrl: selectedAsset.thumbnailUrl,
        title: selectedAsset.title,
        url: selectedAsset.url,
      }
    : edit?.source
      ? {
          thumbnailUrl: edit.source.resolvedThumbnailUrl,
          title: edit.source.resolvedAssetTitle,
          url: edit.source.resolvedAssetUrl,
        }
      : null;
  const visibleAssets = activeGroupId
    ? groupAssets[activeGroupId] ?? []
    : assets;
  const activeGroup =
    groups.find((group) => group.id === activeGroupId) ?? null;

  async function openGroup(groupId: string) {
    const requestId = groupRequestRef.current + 1;
    groupRequestRef.current = requestId;
    setFolderView("group");
    setActiveGroupId(groupId);

    try {
      const loaded = await loadGroup(groupId);
      if (groupRequestRef.current !== requestId) {
        return;
      }
      const currentGroupAssetId =
        sourceChoice?.selectionKind === "group" &&
        sourceChoice.groupId === groupId
          ? sourceChoice.resolvedAssetId
          : null;
      const nextAsset =
        loaded.find((asset) => asset.id === currentGroupAssetId) ??
        loaded[0] ??
        null;

      setSelectedAsset(nextAsset);
    } catch (groupError) {
      if (groupRequestRef.current === requestId) {
        setAssetsError(
          getErrorMessage(groupError, "Could not load this group."),
        );
      }
    }
  }

  function openCreativeAssets() {
    groupRequestRef.current += 1;
    setFolderView("creative-assets");
    setActiveGroupId(null);
    setSelectedAsset((current) => {
      if (!current) return assets[0] ?? null;
      return assets.find((asset) => asset.id === current.id) ?? assets[0] ?? null;
    });
  }

  function showFolders() {
    groupRequestRef.current += 1;
    setFolderView("folders");
  }

  function chooseAsset(asset: MediaAsset) {
    setSelectedAsset(asset);
    setSourceChoice(selectExactVideo(asset.id));
  }

  function previewAsset(asset: MediaAsset) {
    setSelectedAsset(asset);
    setSourceChoice((current) => {
      if (
        !activeGroupId ||
        current?.selectionKind !== "group" ||
        current.groupId !== activeGroupId
      ) {
        return current;
      }

      return updateSourceChoiceForPreview(current, activeGroupId, asset.id);
    });
  }

  function chooseLibrary() {
    if (!activeGroupId || !selectedAsset) {
      return;
    }

    setSourceChoice(selectEntireLibrary(activeGroupId, selectedAsset.id));
  }

  function assignHyperHookAsset(asset: CarouselHyperHookAsset) {
    if (!content || content.format !== "carousel" || !content.slides[0]) {
      return;
    }

    setHyperHookAssetsError(null);
    setActiveSlideIndex(0);
    setContent({
      ...content,
      slides: content.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              backgroundAssetId: asset.id,
              backgroundUrl: asset.url,
              visualRole: "hook",
            }
          : slide,
      ),
    });
  }

  function restoreCarouselHookBackground() {
    if (!content || content.format !== "carousel" || !content.slides[0]) {
      return;
    }

    setActiveSlideIndex(0);
    setContent({
      ...content,
      slides: content.slides.map((slide, index) =>
        index === 0 ? restoreOriginalCarouselBackground(slide) : slide,
      ),
    });
  }

  async function uploadProductAsset(file: File) {
    if (!item || item.format !== "carousel" || productAssetsUploading) {
      return;
    }

    setProductAssetsUploading(true);
    setProductAssetsError(null);
    let pendingAssetId: string | null = null;
    let uploadCompleted = false;

    try {
      const token = await requireToken();
      const endpoint = "/api/trending/carousel-product-assets";
      const prepareResponse = await fetch(endpoint, {
        body: JSON.stringify({
          carouselId: item.creativeId,
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
        | CarouselProductAssetUploadResponse
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

      uploadCompleted = true;
      const completeResponse = await fetch(endpoint, {
        body: JSON.stringify({
          assetId: prepared.assetId,
          carouselId: item.creativeId,
          storageKey: prepared.storageKey,
        }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const completed = (await completeResponse.json().catch(() => null)) as
        | CarouselProductAssetCompleteResponse
        | null;

      if (!completeResponse.ok || completed?.ok !== true) {
        throw new Error(
          getApiError(completed, "Could not verify this app screenshot."),
        );
      }

      setProductAssets((current) => [
        completed.asset,
        ...current.filter((asset) => asset.id !== completed.asset.id),
      ]);
    } catch (uploadError) {
      if (pendingAssetId && !uploadCompleted) {
        const token = await getCurrentUserIdToken().catch(() => null);
        if (token) {
          await fetch("/api/trending/carousel-product-assets", {
            body: JSON.stringify({
              assetId: pendingAssetId,
              carouselId: item.creativeId,
            }),
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            method: "DELETE",
          }).catch(() => undefined);
        }
      }
      setProductAssetsError(
        getErrorMessage(uploadError, "Could not upload this app screenshot."),
      );
    } finally {
      setProductAssetsUploading(false);
      if (productAssetInputRef.current) {
        productAssetInputRef.current.value = "";
      }
    }
  }

  function assignProductAsset(asset: CarouselProductAsset) {
    if (!content || content.format !== "carousel") {
      return;
    }

    const activeSlide = content.slides[activeSlideIndex];
    if (
      !activeSlide ||
      !getProductAssetEligibleSlideIndexes(content).includes(activeSlideIndex)
    ) {
      setProductAssetsError(
        "Choose an eligible Structure 2 product slide before using a screenshot.",
      );
      return;
    }

    setProductAssetsError(null);
    setContent({
      ...content,
      slides: content.slides.map((slide, index) => {
        if (index === activeSlideIndex) {
          return {
            ...slide,
            backgroundAssetId: asset.id,
            backgroundUrl: asset.url,
            visualRole: "product_asset",
          };
        }

        return slide.visualRole === "product_asset" &&
          slide.backgroundAssetId !== slide.originalBackgroundAssetId
          ? restoreOriginalCarouselBackground(slide)
          : slide;
      }),
    });
  }

  function restoreActiveCarouselBackground() {
    if (!content || content.format !== "carousel") {
      return;
    }

    setContent({
      ...content,
      slides: content.slides.map((slide, index) =>
        index === activeSlideIndex
          ? restoreOriginalCarouselBackground(slide)
          : slide,
      ),
    });
  }

  async function removeProductAsset(assetId: string) {
    if (!item || item.format !== "carousel") return;

    setProductAssetsError(null);
    try {
      const token = await requireToken();
      const response = await fetch("/api/trending/carousel-product-assets", {
        body: JSON.stringify({ assetId, carouselId: item.creativeId }),
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
        throw new Error(getApiError(data, "Could not remove app screenshot."));
      }

      setProductAssets((current) =>
        current.filter((asset) => asset.id !== assetId),
      );
      setContent((current) =>
        current?.format === "carousel"
          ? {
              ...current,
              slides: current.slides.map((slide) =>
                slide.backgroundAssetId === assetId
                  ? restoreOriginalCarouselBackground(slide)
                  : slide,
              ),
            }
          : current,
      );
    } catch (removeError) {
      setProductAssetsError(
        getErrorMessage(removeError, "Could not remove app screenshot."),
      );
    }
  }

  async function saveEdit() {
    if (!item || !content || !edit || saving) {
      return;
    }

    if (
      activeGroupId &&
      sourceChoice?.selectionKind === "group" &&
      sourceChoice.groupId === activeGroupId &&
      loadingGroupId !== activeGroupId &&
      visibleAssets.length === 0
    ) {
      setError("Choose a library that contains at least one ready video.");
      return;
    }

    const validationMessage = validateContent(content);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = await requireToken();
      const response = await fetch(getEditorEndpoint(item, false), {
        body: JSON.stringify(toPatchPayload(edit, content, sourceChoice)),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const data = (await response.json().catch(() => null)) as
        | EditResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not save this edit."));
      }

      setEdit(data.edit);
      setContent(data.edit.content);
      onSaved(data.edit);
      onClose();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not save this edit."));
    } finally {
      setSaving(false);
    }
  }

  const formatLabel = item
    ? item.format === "carousel"
      ? "Carousel"
      : item.format === "hook_video"
        ? "Hook video"
        : "Wall of text"
    : "Creative";

  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open && !saving) {
          onClose();
        }
      }}
    >
      <DialogContent
        showCloseButton={!saving}
        className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="border-b border-border bg-card px-5 py-4 pr-14 sm:px-6">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{formatLabel}</Badge>
            <span className="text-xs font-medium text-muted-foreground">
              Edit text and drag it directly on the preview
            </span>
          </div>
          <DialogTitle>Edit creative</DialogTitle>
          <DialogDescription>
            Your current design and media stay unchanged unless you choose a
            Hook library image, app screenshot, or Creative Assets video.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0">
          {loading ? (
            <EditorLoading />
          ) : error && !content ? (
            <EditorLoadError message={error} onRetry={loadEditor} />
          ) : content && item ? (
            <div className="grid min-h-[590px] gap-0 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]">
              <div className="border-b border-border bg-muted/25 p-5 lg:border-b-0 lg:border-r sm:p-6">
                <EditorPreview
                  content={content}
                  edit={edit}
                  fallbackHookPreviewUrl={protectedHookPreviewUrl}
                  initialContent={initialContent}
                  item={item}
                  sourcePreview={sourcePreview}
                  activeSlideIndex={activeSlideIndex}
                  onContentChange={setContent}
                />
                <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
                  <Move className="size-3.5" aria-hidden="true" />
                  {content.format === "carousel" &&
                  content.slides[activeSlideIndex]?.structureId ===
                    "structure_2"
                    ? "Press the text and drag it vertically in the frame."
                    : "Press the text and drag it anywhere in the frame."}
                </div>
              </div>

              <div className="min-w-0 p-5 sm:p-6">
                <EditorFields
                  activeSlideIndex={activeSlideIndex}
                  content={content}
                  onActiveSlideIndexChange={setActiveSlideIndex}
                  onContentChange={setContent}
                />

                {content.format === "carousel" ? (
                  <>
                    <HyperHookLibrarySection
                      assets={hyperHookAssets}
                      content={content}
                      error={hyperHookAssetsError}
                      folderOpen={hyperHookFolderOpen}
                      loading={hyperHookAssetsLoading}
                      onAssign={assignHyperHookAsset}
                      onBack={() => setHyperHookFolderOpen(false)}
                      onOpen={() => setHyperHookFolderOpen(true)}
                      onRestore={restoreCarouselHookBackground}
                      onRetry={() => void loadCarouselHyperHooks()}
                    />
                    <AppScreenshotsSection
                      activeSlideIndex={activeSlideIndex}
                      assets={productAssets}
                      content={content}
                      error={productAssetsError}
                      loading={productAssetsLoading}
                      uploading={productAssetsUploading}
                      onActiveSlideIndexChange={setActiveSlideIndex}
                      onAssign={assignProductAsset}
                      onRemove={(assetId) => void removeProductAsset(assetId)}
                      onRestore={restoreActiveCarouselBackground}
                      onRetry={() => void loadCarouselProductAssets()}
                      onUpload={() => productAssetInputRef.current?.click()}
                    />
                    <input
                      ref={productAssetInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      aria-label="Upload app screenshot"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadProductAsset(file);
                      }}
                    />
                  </>
                ) : (
                  <CreativeAssetsSection
                    activeGroup={activeGroup}
                    activeGroupId={activeGroupId}
                    assets={assets}
                    error={assetsError}
                    groups={groups}
                    folderView={folderView}
                    content={content}
                    loading={assetsLoading}
                    loadingGroupId={loadingGroupId}
                    sourceChoice={sourceChoice}
                    selectedAssetId={
                      selectedAsset?.id ?? edit?.source?.resolvedAssetId ?? null
                    }
                    visibleAssets={visibleAssets}
                    onAssetPreview={previewAsset}
                    onBackToFolders={showFolders}
                    onCreativeAssetsOpen={openCreativeAssets}
                    onGroupOpen={(groupId) => void openGroup(groupId)}
                    onRetry={() => void loadCreativeAssets()}
                    onUseAsset={chooseAsset}
                    onUseLibrary={chooseLibrary}
                  />
                )}

                {error ? (
                  <FieldError className="mt-5">{error}</FieldError>
                ) : null}
              </div>
            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter className="m-0 shrink-0 rounded-none bg-card px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            aria-label="Confirm and save creative edit"
            disabled={
              !content ||
              loading ||
              saving ||
              productAssetsUploading ||
              Boolean(loadingGroupId)
            }
            onClick={() => void saveEdit()}
          >
            {saving ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Check data-icon="inline-start" />
            )}
            {saving ? "Saving…" : "Save edit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditorPreview({
  activeSlideIndex,
  content,
  edit,
  fallbackHookPreviewUrl,
  initialContent,
  item,
  onContentChange,
  sourcePreview,
}: {
  activeSlideIndex: number;
  content: TrendingCreativeEditContent;
  edit: TrendingCreativeEditRecord | null;
  fallbackHookPreviewUrl: string | null;
  initialContent: TrendingCreativeEditContent | null;
  item: TrendingFeedItem;
  onContentChange: (content: TrendingCreativeEditContent) => void;
  sourcePreview: {
    thumbnailUrl: string | null;
    title: string;
    url: string;
  } | null;
}) {
  if (content.format === "carousel" && item.format === "carousel") {
    const slide =
      content.slides[
        Math.min(activeSlideIndex, Math.max(content.slides.length - 1, 0))
      ];

    if (!slide) {
      return null;
    }

    const initialSlide =
      initialContent?.format === "carousel"
        ? initialContent.slides.find((entry) => entry.slideId === slide.slideId) ??
          null
        : null;
    const exactRenderedUrl = getExactCarouselPreviewUrl({
      edit,
      initialSlide,
      slideNumber: slide.slideNumber,
    });
    const showExactRender = Boolean(
      exactRenderedUrl &&
        initialSlide &&
        !hasCarouselSlidePreviewChanged(initialSlide, slide),
    );
    const isStructure2 = slide.structureId === "structure_2";
    const structure2Layout = isStructure2
      ? createStructure2EditorLayout(slide)
      : null;
    const previewPosition =
      structure2Layout?.storyPosition ?? slide.textPosition;
    const supportingText = slide.subtext || slide.ctaText;

    return (
      <div
        data-carousel-editor-preview={
          showExactRender ? "exact-render" : "live-render"
        }
        className={cn(
          "relative mx-auto w-full max-w-[340px] overflow-hidden rounded-xl border border-border bg-foreground-strong [container-type:inline-size]",
          slide.renderFormat === "1:1" ? "aspect-square" : "aspect-[4/5]",
        )}
      >
        {showExactRender ? (
          // The immutable rendered asset is the source of truth until a field changes.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exactRenderedUrl!}
            alt={`Slide ${slide.slideNumber} rendered preview`}
            draggable={false}
            className="absolute inset-0 size-full object-contain"
          />
        ) : (
          <CarouselEditorBackground slide={slide} />
        )}
        <DraggableOverlay
          ariaLabel={`Move text for slide ${slide.slideNumber}`}
          bounds={
            isStructure2
              ? { maxX: 0.5, maxY: 0.88, minX: 0.5, minY: 0.12 }
              : undefined
          }
          position={previewPosition}
          onPositionChange={(textPosition) =>
            onContentChange({
              ...content,
              slides: content.slides.map((entry) =>
                entry.slideId === slide.slideId
                  ? {
                      ...entry,
                      textPosition: isStructure2
                        ? { x: 0.5, y: textPosition.y }
                        : textPosition,
                    }
                  : entry,
              ),
            })
          }
        >
          {showExactRender ? (
            <span
              aria-hidden="true"
              className="block h-[28cqw] w-[82cqw] opacity-0"
            >
              {slide.headline}
            </span>
          ) : structure2Layout ? (
            <Structure2StoryText layout={structure2Layout} />
          ) : (
            <div className="w-[82cqw] text-center">
              <CarouselBubbleText
                kind="headline"
                text={slide.headline || "Add a headline"}
              />
              {supportingText ? (
                <CarouselBubbleText kind="body" text={supportingText} />
              ) : null}
            </div>
          )}
        </DraggableOverlay>
        {!showExactRender && structure2Layout?.cta ? (
          <Structure2CtaText
            layout={{
              ...structure2Layout.cta,
              renderHeight: structure2Layout.renderHeight,
            }}
          />
        ) : null}
      </div>
    );
  }

  if (content.format === "hook_video" && item.format === "hook_video") {
    const previewUrl = sourcePreview?.url ?? fallbackHookPreviewUrl;
    const hookLayout = getHookEditorLayout(content);

    return (
      <VerticalVideoPreview
        posterUrl={sourcePreview?.thumbnailUrl ?? item.creative.thumbnailUrl}
        title={sourcePreview?.title ?? item.creative.title}
        url={previewUrl}
      >
        <DraggableOverlay
          ariaLabel="Move Hook video text"
          bounds={hookLayout?.positionBounds}
          position={content.position}
          onPositionChange={(position) =>
            onContentChange({ ...content, position })
          }
        >
          <HookOverlayText content={content} layout={hookLayout} />
        </DraggableOverlay>
      </VerticalVideoPreview>
    );
  }

  if (content.format === "wall_text" && item.format === "wall_text") {
    const box = content.layout.textBox;
    const center = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };

    return (
      <VerticalVideoPreview
        posterUrl={sourcePreview?.thumbnailUrl ?? item.creative.thumbnailUrl}
        title={sourcePreview?.title ?? item.creative.title}
        url={sourcePreview?.url ?? item.creative.previewUrl}
      >
        <DraggableOverlay
          ariaLabel="Move Wall-of-text copy"
          bounds={{
            maxX: 1 - content.layout.safeArea.right - box.width / 2,
            maxY: 1 - content.layout.safeArea.bottom - box.height / 2,
            minX: content.layout.safeArea.left + box.width / 2,
            minY: content.layout.safeArea.top + box.height / 2,
          }}
          position={center}
          onPositionChange={(position) =>
            onContentChange({
              ...content,
              layout: {
                ...content.layout,
                textBox: {
                  ...box,
                  x: position.x - box.width / 2,
                  y: position.y - box.height / 2,
                },
              },
            })
          }
        >
          <WallTextOverlayText content={content} />
        </DraggableOverlay>
      </VerticalVideoPreview>
    );
  }

  return null;
}

const STRUCTURE_2_RENDER_WIDTH = 1080;
const STRUCTURE_2_SAFE_X = 72;
const STRUCTURE_2_SAFE_TOP = 84;
const STRUCTURE_2_SAFE_BOTTOM = 92;
const STRUCTURE_2_STORY_HORIZONTAL_PADDING = 34;
const STRUCTURE_2_STORY_VERTICAL_PADDING = 10;
const CAROUSEL_FIXED_EDITOR_FONT_SIZE = 44;

type Structure2EditorTextLayout = {
  blockHeight: number;
  fontSize: number;
  lineHeight: number;
  lines: string[];
  maximumLineWidth: number;
};

type Structure2EditorBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type Structure2EditorLayout = {
  cta: {
    bounds: Structure2EditorBounds;
    text: Structure2EditorTextLayout;
  } | null;
  renderHeight: number;
  story: Structure2EditorTextLayout;
  storyBounds: Structure2EditorBounds;
  storyPosition: NormalizedTextPosition;
  treatment: "outlined_overlay" | "overlay" | "pill";
};

function getExactCarouselPreviewUrl({
  edit,
  initialSlide,
  slideNumber,
}: {
  edit: TrendingCreativeEditRecord | null;
  initialSlide: TrendingCarouselEditSlide | null;
  slideNumber: number;
}) {
  if (!initialSlide) return null;

  if ((edit?.revision ?? 0) === 0) {
    return initialSlide.renderedUrl || null;
  }

  return (
    edit?.renderOutput?.slides.find(
      (slide) => slide.slideNumber === slideNumber,
    )?.renderedUrl ?? null
  );
}

function hasCarouselSlidePreviewChanged(
  initial: TrendingCarouselEditSlide,
  current: TrendingCarouselEditSlide,
) {
  return (
    initial.backgroundAssetId !== current.backgroundAssetId ||
    initial.backgroundUrl !== current.backgroundUrl ||
    initial.ctaText !== current.ctaText ||
    initial.headline !== current.headline ||
    initial.subtext !== current.subtext ||
    initial.textPosition.x !== current.textPosition.x ||
    initial.textPosition.y !== current.textPosition.y ||
    initial.visualRole !== current.visualRole
  );
}

function CarouselEditorBackground({
  slide,
}: {
  slide: TrendingCarouselEditSlide;
}) {
  if (slide.structureId === "structure_1") {
    return (
      // Structure 1 composes its connected text bubbles over the normalized image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={slide.backgroundUrl || slide.renderedUrl}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-cover"
      />
    );
  }

  const isProduct = slide.visualRole === "product_asset";
  const layoutVariant = isProduct
    ? "story_product_reveal"
    : slide.storyLayoutVariant ?? "story_overlay_only";
  const position = getStructure2TextPosition(slide.textPosition.y);

  return (
    <>
      {isProduct ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.backgroundUrl || slide.renderedUrl}
            alt=""
            draggable={false}
            className="absolute -inset-5 size-[calc(100%+2.5rem)] scale-110 object-cover blur-xl brightness-[.54] saturate-[.82]"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.backgroundUrl || slide.renderedUrl}
            alt=""
            draggable={false}
            className="absolute inset-[4.5%] size-[91%] object-contain"
          />
        </>
      ) : (
        // Carousel library backgrounds are normalized to the render aspect ratio.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.backgroundUrl || slide.renderedUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: getStructure2ReadabilityBackground({
            layoutVariant,
            position,
          }),
        }}
      />
      {layoutVariant === "story_product_reveal" ? (
        <div className="pointer-events-none absolute inset-[4%] rounded-[3cqw] border border-white/20" />
      ) : null}
    </>
  );
}

function Structure2StoryText({ layout }: { layout: Structure2EditorLayout }) {
  return (
    <div
      className="text-center"
      style={{
        color: "#141518",
        fontFamily: 'var(--font-geist-sans), Geist, Arial, Helvetica, sans-serif',
        fontSize: `${layout.story.fontSize / 10.8}cqw`,
        fontWeight: 600,
        letterSpacing: 0,
        lineHeight: layout.story.lineHeight / layout.story.fontSize,
        paddingBlock: `${STRUCTURE_2_STORY_VERTICAL_PADDING / 2 / 10.8}cqw`,
        width: `${layout.storyBounds.width / 10.8}cqw`,
      }}
    >
      {layout.story.lines.map((line, index) => (
        <span
          key={`${index}:${line}`}
          className={cn(
            "mx-auto block w-fit whitespace-nowrap rounded-[1.7cqw] bg-white",
          )}
          style={{
            marginTop:
              index > 0
                ? `${-STRUCTURE_2_STORY_VERTICAL_PADDING / 10.8}cqw`
                : undefined,
            paddingBlock: `${STRUCTURE_2_STORY_VERTICAL_PADDING / 2 / 10.8}cqw`,
            width: `${Math.min(
              layout.storyBounds.width,
              Math.ceil(
                estimateStructure2EditorTextWidth(
                  line,
                  layout.story.fontSize,
                ) + STRUCTURE_2_STORY_HORIZONTAL_PADDING * 2,
              ),
            ) / 10.8}cqw`,
          }}
        >
          {line}
        </span>
      ))}
    </div>
  );
}

function Structure2CtaText({
  layout,
}: {
  layout: NonNullable<Structure2EditorLayout["cta"]> & {
    renderHeight: number;
  };
}) {
  return (
    <div
      className="pointer-events-none absolute flex flex-col items-center justify-center text-center text-[#141518]"
      style={{
        fontFamily: 'var(--font-geist-sans), Geist, Arial, Helvetica, sans-serif',
        fontSize: `${layout.text.fontSize / 10.8}cqw`,
        fontWeight: 600,
        height: `${(layout.bounds.height / layout.renderHeight) * 100}%`,
        left: `${(layout.bounds.x / STRUCTURE_2_RENDER_WIDTH) * 100}%`,
        letterSpacing: 0,
        lineHeight: layout.text.lineHeight / layout.text.fontSize,
        top: `${(layout.bounds.y / layout.renderHeight) * 100}%`,
        width: `${(layout.bounds.width / STRUCTURE_2_RENDER_WIDTH) * 100}%`,
      }}
    >
      {layout.text.lines.map((line, index) => (
        <span
          key={`${index}:${line}`}
          className="mx-auto block whitespace-nowrap rounded-[1.7cqw] bg-white"
          style={{
            marginTop:
              index > 0
                ? `${-STRUCTURE_2_STORY_VERTICAL_PADDING / 10.8}cqw`
                : undefined,
            paddingBlock: `${STRUCTURE_2_STORY_VERTICAL_PADDING / 2 / 10.8}cqw`,
            width: `${Math.ceil(
              estimateStructure2EditorTextWidth(line, layout.text.fontSize) +
                STRUCTURE_2_STORY_HORIZONTAL_PADDING * 2,
            ) / 10.8}cqw`,
          }}
        >
          {line}
        </span>
      ))}
    </div>
  );
}

function createStructure2EditorLayout(
  slide: TrendingCarouselEditSlide,
): Structure2EditorLayout {
  const height = getStructure2RenderHeight(slide.renderFormat);
  const maximumTextWidth = STRUCTURE_2_RENDER_WIDTH - STRUCTURE_2_SAFE_X * 2;
  const treatment = "pill" as const;
  const story = fitStructure2EditorText({
    maximumLines: 6,
    maximumWidth:
      maximumTextWidth - STRUCTURE_2_STORY_HORIZONTAL_PADDING * 2,
    value:
      (slide.subtext
        ? `${slide.headline} ${slide.subtext}`
        : slide.headline) || "Add a headline",
  });
  const cta = slide.ctaText
    ? fitStructure2EditorText({
        maximumLines: 3,
        maximumWidth:
          maximumTextWidth - STRUCTURE_2_STORY_HORIZONTAL_PADDING * 2,
        value: slide.ctaText,
      })
    : null;
  const storyWidth = Math.min(
    maximumTextWidth,
    story.maximumLineWidth +
      STRUCTURE_2_STORY_HORIZONTAL_PADDING * 2,
  );
  const storyHeight =
    story.blockHeight + STRUCTURE_2_STORY_VERTICAL_PADDING * 2;
  const ctaHeight = cta
    ? cta.blockHeight + STRUCTURE_2_STORY_VERTICAL_PADDING * 2
    : 0;
  const ctaWidth = cta
    ? Math.min(
        maximumTextWidth,
        cta.maximumLineWidth + STRUCTURE_2_STORY_HORIZONTAL_PADDING * 2,
      )
    : 0;
  const ctaBottom = height - STRUCTURE_2_SAFE_BOTTOM;
  const ctaTop = cta ? ctaBottom - ctaHeight : null;
  const maximumStoryBottom = ctaTop
    ? ctaTop - 46
    : height - STRUCTURE_2_SAFE_BOTTOM;
  const storyTop = resolveStructure2StoryTop({
    blockHeight: storyHeight,
    height,
    maximumBottom: maximumStoryBottom,
    position: getStructure2TextPosition(slide.textPosition.y),
  });
  const storyBounds = {
    height: storyHeight,
    width: storyWidth,
    x: Math.round((STRUCTURE_2_RENDER_WIDTH - storyWidth) / 2),
    y: storyTop,
  };

  return {
    cta:
      cta && ctaTop !== null
        ? {
            bounds: {
              height: ctaHeight,
              width: ctaWidth,
              x: Math.round((STRUCTURE_2_RENDER_WIDTH - ctaWidth) / 2),
              y: ctaTop,
            },
            text: cta,
          }
        : null,
    renderHeight: height,
    story,
    storyBounds,
    storyPosition: {
      x: 0.5,
      y: (storyTop + storyHeight / 2) / height,
    },
    treatment,
  };
}

function fitStructure2EditorText(params: {
  maximumLines: number;
  maximumWidth: number;
  value: string;
}): Structure2EditorTextLayout {
  const value = params.value.trim().replace(/\s+/gu, " ");
  const fontSize = CAROUSEL_FIXED_EDITOR_FONT_SIZE;
  const lines = wrapStructure2EditorWords(
    value || "Add a headline",
    params.maximumWidth,
    fontSize,
  );
  const lineHeight = Math.round(fontSize * 1.16);
  return {
    blockHeight: lineHeight * lines.length,
    fontSize,
    lineHeight,
    lines,
    maximumLineWidth: Math.ceil(
      Math.max(
        ...lines.map((line) =>
          estimateStructure2EditorTextWidth(line, fontSize),
        ),
      ),
    ),
  };
}

function wrapStructure2EditorWords(
  value: string,
  maximumWidth: number,
  fontSize: number,
) {
  const words = value.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (
      current &&
      estimateStructure2EditorTextWidth(candidate, fontSize) > maximumWidth
    ) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function estimateStructure2EditorTextWidth(value: string, fontSize: number) {
  return Array.from(value).reduce((width, character) => {
    if (character === " ") return width + fontSize * 0.29;
    if (/[A-Z0-9]/u.test(character)) return width + fontSize * 0.61;
    if (/[il.,'|:;]/u.test(character)) return width + fontSize * 0.27;
    if (/[mwMW@%]/u.test(character)) return width + fontSize * 0.8;
    return width + fontSize * 0.52;
  }, 0);
}

function getStructure2TextPosition(y: number) {
  return y < 0.42 ? "upper" : y > 0.58 ? "lower" : "center";
}

function getStructure2RenderHeight(format: TrendingCarouselEditSlide["renderFormat"]) {
  return format === "1:1" ? 1080 : 1350;
}

function resolveStructure2StoryTop(params: {
  blockHeight: number;
  height: number;
  maximumBottom: number;
  position: ReturnType<typeof getStructure2TextPosition>;
}) {
  const availableBottom = Math.max(
    STRUCTURE_2_SAFE_TOP + params.blockHeight,
    params.maximumBottom,
  );
  const preferred =
    params.position === "upper"
      ? STRUCTURE_2_SAFE_TOP + 40
      : params.position === "center"
        ? Math.round((params.height - params.blockHeight) / 2)
        : availableBottom - params.blockHeight;

  return Math.max(
    STRUCTURE_2_SAFE_TOP,
    Math.min(preferred, availableBottom - params.blockHeight),
  );
}

function getStructure2ReadabilityBackground({
  layoutVariant,
  position,
}: {
  layoutVariant: NonNullable<TrendingCarouselEditSlide["storyLayoutVariant"]>;
  position: ReturnType<typeof getStructure2TextPosition>;
}) {
  if (layoutVariant === "story_pill_overlay") {
    return "rgba(0,0,0,.10)";
  }

  if (layoutVariant === "story_product_reveal") {
    return "linear-gradient(to bottom,rgba(0,0,0,.68),rgba(0,0,0,.04) 34%,rgba(0,0,0,.06) 70%,rgba(0,0,0,.70))";
  }

  const topOpacity = position === "upper" ? 0.66 : 0.2;
  const bottomOpacity = position === "lower" ? 0.72 : 0.42;
  return `linear-gradient(to bottom,rgba(0,0,0,${topOpacity}),rgba(0,0,0,.04) 48%,rgba(0,0,0,${bottomOpacity}))`;
}

type CarouselBubbleGeometry = {
  height: number;
  rects: Array<{
    height: number;
    radius: number;
    width: number;
    x: number;
    y: number;
  }>;
  width: number;
};

function CarouselBubbleText({
  kind,
  text,
}: {
  kind: "body" | "headline";
  text: string;
}) {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [geometry, setGeometry] = useState<CarouselBubbleGeometry>({
    height: 0,
    rects: [],
    width: 0,
  });

  const measureBubble = useCallback(() => {
    const container = containerRef.current;
    const textElement = textRef.current;

    if (!container || !textElement) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    if (containerRect.width <= 0 || containerRect.height <= 0) {
      return;
    }

    const paddingX = containerRect.width * (18 / 842.4);
    const paddingY =
      containerRect.width * (kind === "headline" ? 7 / 842.4 : 6 / 842.4);
    const radius = containerRect.width * (20 / 842.4);
    const nextGeometry: CarouselBubbleGeometry = {
      height: roundBubbleCoordinate(containerRect.height),
      rects: Array.from(textElement.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          height: roundBubbleCoordinate(rect.height + paddingY * 2),
          radius: roundBubbleCoordinate(radius),
          width: roundBubbleCoordinate(rect.width + paddingX * 2),
          x: roundBubbleCoordinate(rect.left - containerRect.left - paddingX),
          y: roundBubbleCoordinate(rect.top - containerRect.top - paddingY),
        })),
      width: roundBubbleCoordinate(containerRect.width),
    };

    setGeometry((current) =>
      hasMatchingBubbleGeometry(current, nextGeometry) ? current : nextGeometry,
    );
  }, [kind]);

  useLayoutEffect(() => {
    measureBubble();

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measureBubble);
    observer.observe(container);

    void document.fonts?.ready.then(measureBubble);

    return () => observer.disconnect();
  }, [measureBubble, text]);

  return (
    <p
      ref={containerRef}
      className={cn(
        "relative isolate mx-auto max-w-[78cqw] text-center text-[#111316]",
        kind === "headline"
          ? "text-[4.074cqw] font-bold leading-[1.04]"
          : "mt-[2.2cqw] text-[4.074cqw] font-semibold leading-[1.05]",
      )}
    >
      {geometry.width > 0 && geometry.height > 0 ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          preserveAspectRatio="none"
        >
          {geometry.rects.map((rect, index) => (
            <rect
              key={index}
              fill="#ffffff"
              height={rect.height}
              rx={rect.radius}
              width={rect.width}
              x={rect.x}
              y={rect.y}
            />
          ))}
        </svg>
      ) : null}
      <span ref={textRef}>{text}</span>
    </p>
  );
}

function roundBubbleCoordinate(value: number) {
  return Math.round(value * 10) / 10;
}

function hasMatchingBubbleGeometry(
  current: CarouselBubbleGeometry,
  next: CarouselBubbleGeometry,
) {
  return (
    current.height === next.height &&
    current.width === next.width &&
    current.rects.length === next.rects.length &&
    current.rects.every((rect, index) => {
      const nextRect = next.rects[index];
      return (
        nextRect !== undefined &&
        rect.height === nextRect.height &&
        rect.radius === nextRect.radius &&
        rect.width === nextRect.width &&
        rect.x === nextRect.x &&
        rect.y === nextRect.y
      );
    })
  );
}

function getHookEditorLayout(
  content: TrendingHookEditContent,
): HookTextLayout | null {
  try {
    return createHookTextLayout(content.hookText, {
      enforceMaximum: false,
      enforceMinimum: false,
      fontSize: content.fontSize,
      layoutVersion: content.layoutVersion,
      lines: content.lines,
    });
  } catch {
    return null;
  }
}

function HookOverlayText({
  content,
  layout,
}: {
  content: TrendingHookEditContent;
  layout: HookTextLayout | null;
}) {
  if (!layout) {
    return null;
  }

  return (
    <p
      className="text-center tracking-normal"
      style={{
        color: content.textColor,
        fontFamily: HOOK_TEXT_BROWSER_FONT_FAMILY,
        fontSize: `${layout.fontSize / 10.8}cqw`,
        fontWeight: HOOK_TEXT_FONT_WEIGHT,
        lineHeight: 1,
        paintOrder: "stroke fill",
        WebkitTextStroke: `${HOOK_TEXT_OUTLINE_WIDTH / 10.8}cqw ${HOOK_TEXT_OUTLINE_COLOR}`,
        width: `${layout.containerWidth / 10.8}cqw`,
      }}
    >
      {layout.lines.map((line, index) => (
        <span
          key={`${index}:${line}`}
          className="block whitespace-nowrap"
          style={
            index > 0
              ? {
                  marginTop: `${layout.lineSpacing / 10.8}cqw`,
                }
              : undefined
          }
        >
          {line}
        </span>
      ))}
    </p>
  );
}

function WallTextOverlayText({
  content,
}: {
  content: TrendingWallTextEditContent;
}) {
  const isPendingAuthoritativeLayout = !content.content.finalLayout;

  return (
    <div
      className="flex flex-col justify-center text-center [paint-order:stroke_fill]"
      style={{
        boxSizing: "border-box",
        WebkitTextStroke: `${WALL_TEXT_OUTLINE_WIDTH / 10.8}cqw #000`,
        color: content.textColor,
        fontFamily:
          'var(--font-wall-text), Inter, Arial, "Helvetica Neue", sans-serif',
        fontSize: `${getWallTextFontSize(content.content) / 10.8}cqw`,
        fontWeight: WALL_TEXT_FONT_WEIGHT,
        letterSpacing: `${-0.2 / 10.8}cqw`,
        paddingInline: `${WALL_TEXT_INLINE_SAFE_PADDING / 10.8}cqw`,
        textShadow: "0 0.111111cqw 0.185185cqw rgba(0, 0, 0, 0.45)",
        width: `${content.layout.textBox.width * 100}cqw`,
      }}
    >
      {isPendingAuthoritativeLayout ? (
        <p className="m-0 whitespace-normal" style={{ lineHeight: WALL_TEXT_LINE_HEIGHT_FACTOR }}>
          {content.content.fullText}
        </p>
      ) : getWallTextRenderBlocks(content.content).map((segment, segmentIndex) => (
        <p
          key={`${segment.role}-${segmentIndex}`}
          className="m-0"
          style={{
            lineHeight: WALL_TEXT_LINE_HEIGHT_FACTOR,
            whiteSpace: "nowrap",
          }}
        >
          {segment.lines.map((line, lineIndex) => (
            <span
              key={`${lineIndex}:${line}`}
              className="block whitespace-nowrap"
              style={{ whiteSpace: "nowrap" }}
            >
              {line}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

function StaticCreativeTextOverlay({
  content,
}: {
  content: TrendingHookEditContent | TrendingWallTextEditContent;
}) {
  if (content.format === "hook_video") {
    return (
      <div
        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${content.position.x * 100}%`,
          top: `${content.position.y * 100}%`,
        }}
      >
        <HookOverlayText
          content={content}
          layout={getHookEditorLayout(content)}
        />
      </div>
    );
  }

  const box = content.layout.textBox;
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${(box.x + box.width / 2) * 100}%`,
        top: `${(box.y + box.height / 2) * 100}%`,
      }}
    >
      <WallTextOverlayText content={content} />
    </div>
  );
}

function VerticalVideoPreview({
  children,
  posterUrl,
  title,
  url,
}: {
  children: ReactNode;
  posterUrl: string | null;
  title: string;
  url: string | null;
}) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[315px] overflow-hidden rounded-xl border border-border bg-[#171717] shadow-floating [container-type:inline-size]">
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      {url ? (
        <video
          key={url}
          src={url}
          poster={posterUrl ?? undefined}
          aria-label={`${title} editor preview`}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/55">
          <Film className="size-7" aria-hidden="true" />
        </div>
      )}
      {children}
    </div>
  );
}

function DraggableOverlay({
  ariaLabel,
  bounds = { maxX: 0.9, maxY: 0.9, minX: 0.1, minY: 0.1 },
  children,
  onPositionChange,
  position,
}: {
  ariaLabel: string;
  bounds?: { maxX: number; maxY: number; minX: number; minY: number };
  children: ReactNode;
  onPositionChange: (position: NormalizedTextPosition) => void;
  position: NormalizedTextPosition;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const frame = layerRef.current?.parentElement;
    const rect = frame?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOffsetRef.current = {
      x: (event.clientX - rect.left) / rect.width - position.x,
      y: (event.clientY - rect.top) / rect.height - position.y,
    };
    setDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const frame = layerRef.current?.parentElement;
    const rect = frame?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onPositionChange(
      clampNormalizedTextPosition(
        {
          x:
            (event.clientX - rect.left) / rect.width -
            dragOffsetRef.current.x,
          y:
            (event.clientY - rect.top) / rect.height -
            dragOffsetRef.current.y,
        },
        bounds,
      ),
    );
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const delta = event.shiftKey ? 0.05 : 0.01;
    const offset =
      event.key === "ArrowLeft"
        ? { x: -delta, y: 0 }
        : event.key === "ArrowRight"
          ? { x: delta, y: 0 }
          : event.key === "ArrowUp"
            ? { x: 0, y: -delta }
            : event.key === "ArrowDown"
              ? { x: 0, y: delta }
              : null;

    if (!offset) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onPositionChange(
      clampNormalizedTextPosition(
        { x: position.x + offset.x, y: position.y + offset.y },
        bounds,
      ),
    );
  }

  return (
    <div
      ref={layerRef}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={cn(
        "absolute z-20 -translate-x-1/2 -translate-y-1/2 select-none outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        touchAction: "none",
      }}
      onPointerCancel={finishPointer}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

function EditorFields({
  activeSlideIndex,
  content,
  onActiveSlideIndexChange,
  onContentChange,
}: {
  activeSlideIndex: number;
  content: TrendingCreativeEditContent;
  onActiveSlideIndexChange: (index: number) => void;
  onContentChange: (content: TrendingCreativeEditContent) => void;
}) {
  if (content.format === "carousel") {
    const slide = content.slides[activeSlideIndex];
    if (!slide) return null;

    const updateSlide = (
      field: "ctaText" | "headline" | "subtext",
      value: string,
    ) =>
      onContentChange({
        ...content,
        slides: content.slides.map((entry, index) =>
          index === activeSlideIndex ? { ...entry, [field]: value } : entry,
        ),
      });

    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Slide {activeSlideIndex + 1} of {content.slides.length}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Edit this slide’s existing copy.
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Previous slide"
              disabled={activeSlideIndex === 0}
              onClick={() => onActiveSlideIndexChange(activeSlideIndex - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Next slide"
              disabled={activeSlideIndex >= content.slides.length - 1}
              onClick={() => onActiveSlideIndexChange(activeSlideIndex + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <FieldGroup className="mt-5">
          <Field>
            <FieldLabel htmlFor="trending-carousel-headline">
              Headline
            </FieldLabel>
            <Input
              id="trending-carousel-headline"
              value={slide.headline}
              maxLength={180}
              onChange={(event) => updateSlide("headline", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="trending-carousel-subtext">
              Supporting text
            </FieldLabel>
            <Input
              id="trending-carousel-subtext"
              value={slide.subtext}
              maxLength={360}
              onChange={(event) => updateSlide("subtext", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="trending-carousel-cta">
              Call to action
            </FieldLabel>
            <Input
              id="trending-carousel-cta"
              value={slide.ctaText}
              maxLength={120}
              onChange={(event) => updateSlide("ctaText", event.target.value)}
            />
            <FieldDescription>
              {slide.structureId === "structure_2"
                ? "Rendered as the bottom action label."
                : "Rendered when Supporting text is empty."}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </div>
    );
  }

  if (content.format === "hook_video") {
    return (
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="trending-hook-text">Hook text</FieldLabel>
          <textarea
            id="trending-hook-text"
            value={content.hookText}
            maxLength={HOOK_TEXT_MAXIMUM_CHARACTERS}
            rows={HOOK_TEXT_MAXIMUM_LINES}
            wrap="off"
            onChange={(event) => {
              const hookText = event.target.value;
              onContentChange(createHookEditContent(hookText, content));
            }}
            className="min-h-24 w-full resize-y overflow-x-auto whitespace-pre rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium leading-6 text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
          <FieldDescription>
            Use {HOOK_TEXT_MINIMUM_WORDS}–{HOOK_TEXT_MAXIMUM_WORDS} words and no
            more than {HOOK_TEXT_MAXIMUM_CHARACTERS} characters, with up to{" "}
            {HOOK_TEXT_MAXIMUM_LINES} lines. Press Enter where you want a line
            to end; the preview keeps those breaks.
          </FieldDescription>
        </Field>
        <TextColorPicker
          value={content.textColor}
          onChange={(textColor) => onContentChange({ ...content, textColor })}
        />
      </FieldGroup>
    );
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="trending-wall-text">Overlay copy</FieldLabel>
        <textarea
          id="trending-wall-text"
          value={content.content.fullText}
          maxLength={600}
          rows={7}
          onChange={(event) =>
            onContentChange({
              ...content,
              content: {
                ...createWallTextEditContent(
                  event.target.value,
                  content.content,
                ),
                // Keep the user's in-progress whitespace while deriving the
                // normalized preview segments. The API normalizes on save.
                fullText: event.target.value,
              },
            })
          }
          className="min-h-32 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <FieldDescription>
          Use {MIN_SHORT_WALL_TEXT_WORDS}–50 words. Saving measures Inter Regular and creates the final
          5–8 lines inside the export-safe area; clip duration does not change
          the copy limit.
        </FieldDescription>
      </Field>
      <TextColorPicker
        value={content.textColor}
        onChange={(textColor) => onContentChange({ ...content, textColor })}
      />
    </FieldGroup>
  );
}

function TextColorPicker({
  onChange,
  value,
}: {
  onChange: (value: TrendingTextColor) => void;
  value: TrendingTextColor;
}) {
  return (
    <Field>
      <FieldLabel>Text color</FieldLabel>
      <div
        aria-label="Text color"
        className="flex flex-wrap gap-2"
        role="group"
      >
        {TRENDING_TEXT_COLOR_OPTIONS.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              aria-pressed={selected}
              title={option.label}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative flex size-10 items-center justify-center rounded-full border-2 bg-card shadow-xs transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                selected ? "border-foreground" : "border-border",
              )}
            >
              <span
                aria-hidden="true"
                className="size-7 rounded-full border border-black/15"
                style={{ backgroundColor: option.value }}
              />
              {selected ? (
                <Check
                  aria-hidden="true"
                  className="absolute size-4 text-black drop-shadow-[0_1px_1px_rgb(255_255_255_/_0.8)]"
                  strokeWidth={3}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <FieldDescription>
        The selected color is saved with the edit and used for export.
      </FieldDescription>
    </Field>
  );
}

function HyperHookLibrarySection({
  assets,
  content,
  error,
  folderOpen,
  loading,
  onAssign,
  onBack,
  onOpen,
  onRestore,
  onRetry,
}: {
  assets: CarouselHyperHookAsset[];
  content: TrendingCarouselEditContent;
  error: string | null;
  folderOpen: boolean;
  loading: boolean;
  onAssign: (asset: CarouselHyperHookAsset) => void;
  onBack: () => void;
  onOpen: () => void;
  onRestore: () => void;
  onRetry: () => void;
}) {
  const hookSlide = content.slides[0] ?? null;
  const selectedAssetId = hookSlide?.backgroundAssetId ?? null;
  const selectedHookImage = assets.some(
    (asset) => asset.id === selectedAssetId,
  );
  const hasCustomHook = Boolean(
    hookSlide &&
      hookSlide.backgroundAssetId !== hookSlide.originalBackgroundAssetId,
  );
  return (
    <section
      aria-labelledby="carousel-hook-library-heading"
      className="mt-7 border-t pt-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id="carousel-hook-library-heading"
              className="text-sm font-semibold text-foreground"
            >
              Hook library
            </h3>
            <Badge variant="secondary">Slide 1 only</Badge>
          </div>
          <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            Choose an image for the first slide. Other slides stay unchanged.
          </p>
        </div>
        {loading ? (
          <Loader2
            className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
            aria-label="Loading Hook library"
          />
        ) : null}
      </div>

      {error && assets.length === 0 ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={onRetry}
          >
            <RefreshCw />
            Retry
          </Button>
        </div>
      ) : !folderOpen ? (
        loading && assets.length === 0 ? (
          <Skeleton className="mt-4 h-16 rounded-xl" />
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="group mt-4 flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-foreground/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
              <Folder className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold">
                Hook library
                {selectedHookImage ? (
                  <Check className="size-4 text-primary" aria-label="Selected" />
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {assets.length} {assets.length === 1 ? "image" : "images"}
              </span>
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </button>
        )
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onBack}>
              <ChevronLeft />
              Back
            </Button>
            {hasCustomHook ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRestore}
              >
                Restore original image
              </Button>
            ) : null}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FolderOpen className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Hook library</p>
              <p className="text-xs text-muted-foreground">
                Choosing an image applies it directly to Slide 1.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {assets.map((asset) => {
              const selected = asset.id === selectedAssetId;

              return (
                <button
                  key={asset.id}
                  type="button"
                  aria-label={`Use ${asset.name} on Slide 1`}
                  aria-pressed={selected}
                  onClick={() => onAssign(asset)}
                  className={cn(
                    "group relative aspect-[4/5] overflow-hidden rounded-lg border bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-foreground ring-2 ring-foreground/15"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt=""
                    className="size-full object-cover transition-transform group-hover:scale-[1.02] motion-reduce:transition-none"
                    loading="lazy"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-left text-[10px] font-medium text-white">
                    {asset.name}
                  </span>
                  {selected ? (
                    <span className="absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function AppScreenshotsSection({
  activeSlideIndex,
  assets,
  content,
  error,
  loading,
  onActiveSlideIndexChange,
  onAssign,
  onRemove,
  onRestore,
  onRetry,
  onUpload,
  uploading,
}: {
  activeSlideIndex: number;
  assets: CarouselProductAsset[];
  content: TrendingCarouselEditContent;
  error: string | null;
  loading: boolean;
  onActiveSlideIndexChange: (index: number) => void;
  onAssign: (asset: CarouselProductAsset) => void;
  onRemove: (assetId: string) => void;
  onRestore: () => void;
  onRetry: () => void;
  onUpload: () => void;
  uploading: boolean;
}) {
  const activeSlide = content.slides[activeSlideIndex] ?? null;
  const eligibleSlideIndexes = getProductAssetEligibleSlideIndexes(content);
  const eligibleSlides = eligibleSlideIndexes.map((index) => ({
    index,
    slide: content.slides[index]!,
  }));
  const activeEligible = eligibleSlideIndexes.includes(activeSlideIndex);
  const hasCustomBackground = Boolean(
    activeSlide &&
      activeSlide.backgroundAssetId !== activeSlide.originalBackgroundAssetId,
  );

  return (
    <section
      aria-labelledby="carousel-app-screenshots-heading"
      className="mt-7 border-t pt-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            id="carousel-app-screenshots-heading"
            className="text-sm font-semibold text-foreground"
          >
            App Screenshots
          </h3>
          <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            Save product screens once, then reuse one in an eligible Structure 2
            product slot. Your 1:2:2 image balance stays unchanged.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={onUpload}
        >
          {uploading ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Upload />
          )}
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {eligibleSlides.length > 0 ? (
        <div className="mt-4 rounded-xl border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-muted-foreground">
              Product reveal lane
            </span>
            {eligibleSlides.map(({ index, slide }) => (
              <Button
                key={slide.slideId}
                type="button"
                size="sm"
                variant={index === activeSlideIndex ? "default" : "outline"}
                onClick={() => onActiveSlideIndexChange(index)}
              >
                Slide {slide.slideNumber}
                {slide.productVisualEligibility === "preferred" ? (
                  <span className="opacity-70">Preferred</span>
                ) : null}
              </Button>
            ))}
            {hasCustomBackground ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onRestore}
              >
                Use original image
              </Button>
            ) : null}
          </div>
          {!activeEligible ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Choose one of these slides before assigning a screenshot.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed p-3 text-xs leading-5 text-muted-foreground">
          This Structure 1 carousel keeps its original visuals. Screenshots saved
          here remain available for future Structure 2 carousels.
        </div>
      )}

      {error ? (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p role="alert" className="text-xs leading-5 text-destructive">
            {error}
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading && assets.length === 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="aspect-[4/5] rounded-lg" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ImagePlus className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium">No app screenshots saved yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              JPG, PNG, or WebP up to 25 MB.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {assets.map((asset) => {
            const selected = activeSlide?.backgroundAssetId === asset.id;

            return (
              <div
                key={asset.id}
                className={cn(
                  "group relative overflow-hidden rounded-lg border bg-card shadow-xs",
                  selected ? "border-foreground ring-2 ring-foreground/15" : "border-border",
                )}
              >
                <button
                  type="button"
                  disabled={!activeEligible}
                  aria-label={`Use ${asset.fileName} on the selected slide`}
                  aria-pressed={selected}
                  onClick={() => onAssign(asset)}
                  className="relative block aspect-[4/5] w-full overflow-hidden bg-muted text-left disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt=""
                    className="size-full object-cover transition-transform group-hover:scale-[1.02] motion-reduce:transition-none"
                  />
                  {selected ? (
                    <span className="absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
                <div className="flex items-center gap-1 border-t px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                    {asset.fileName}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${asset.fileName} from App Screenshots`}
                    title="Remove from App Screenshots"
                    onClick={() => onRemove(asset.id)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CreativeAssetsSection({
  activeGroup,
  activeGroupId,
  assets,
  content,
  error,
  folderView,
  groups,
  loading,
  loadingGroupId,
  onAssetPreview,
  onBackToFolders,
  onCreativeAssetsOpen,
  onGroupOpen,
  onRetry,
  onUseAsset,
  onUseLibrary,
  selectedAssetId,
  sourceChoice,
  visibleAssets,
}: {
  activeGroup: CreativeAssetGroup | null;
  activeGroupId: string | null;
  assets: MediaAsset[];
  content: TrendingHookEditContent | TrendingWallTextEditContent;
  error: string | null;
  folderView: "folders" | "creative-assets" | "group";
  groups: CreativeAssetGroup[];
  loading: boolean;
  loadingGroupId: string | null;
  onAssetPreview: (asset: MediaAsset) => void;
  onBackToFolders: () => void;
  onCreativeAssetsOpen: () => void;
  onGroupOpen: (groupId: string) => void;
  onRetry: () => void;
  onUseAsset: (asset: MediaAsset) => void;
  onUseLibrary: () => void;
  selectedAssetId: string | null;
  sourceChoice: CreativeEditSourceChoice | null | undefined;
  visibleAssets: MediaAsset[];
}) {
  const activeAsset =
    visibleAssets.find((asset) => asset.id === selectedAssetId) ??
    visibleAssets[0] ??
    null;
  const librarySelected = Boolean(
    activeGroupId &&
      sourceChoice?.selectionKind === "group" &&
      sourceChoice.groupId === activeGroupId,
  );
  const activeVideoSelected = Boolean(
    activeAsset &&
      sourceChoice?.selectionKind === "asset" &&
      sourceChoice.mediaAssetId === activeAsset.id,
  );

  return (
    <section
      aria-labelledby="editor-assets-heading"
      className="mt-7 border-t pt-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="editor-assets-heading" className="text-sm font-semibold">
            Choose a video folder
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Open Creative Assets or one of your groups, then choose the video
            you want to use.
          </p>
        </div>
        {loading ? (
          <Loader2
            className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
            aria-label="Loading Creative Assets"
          />
        ) : null}
      </div>

      {loading && assets.length === 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="aspect-[9/12] rounded-lg" />
          ))}
        </div>
      ) : error && assets.length === 0 && groups.length === 0 ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={onRetry}
          >
            <RefreshCw data-icon="inline-start" />
            Try again
          </Button>
        </div>
      ) : assets.length === 0 && groups.length === 0 ? (
        <Empty className="mt-4 min-h-48">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Film />
            </EmptyMedia>
            <EmptyTitle>No ready videos yet</EmptyTitle>
            <EmptyDescription>
              Upload or generate a video in Creative Assets first.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent />
        </Empty>
      ) : (
        <>
          {error ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetry}
              >
                <RefreshCw data-icon="inline-start" />
                Retry
              </Button>
            </div>
          ) : null}

          {folderView === "folders" ? (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Video folders
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <VideoFolderCard
                  description={`${assets.length} ready ${assets.length === 1 ? "video" : "videos"}`}
                  icon={<Film aria-hidden="true" />}
                  name="Creative Assets"
                  onOpen={onCreativeAssetsOpen}
                />
                {groups.map((group) => (
                  <VideoFolderCard
                    key={group.id}
                    description="Your video group"
                    icon={<Folder aria-hidden="true" />}
                    name={group.name}
                    onOpen={() => onGroupOpen(group.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-muted/25 px-3 py-2.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onBackToFolders}
                >
                  <ChevronLeft data-icon="inline-start" />
                  Back to folders
                </Button>
                <div className="min-w-0 text-right">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {activeGroup?.name ?? "Creative Assets"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {librarySelected
                      ? "Entire group selected"
                      : activeVideoSelected
                        ? "This video is selected"
                        : "Browse, then choose how to use it"}
                  </p>
                </div>
                {loadingGroupId === activeGroupId && activeGroupId ? (
                  <Loader2
                    className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none"
                    aria-label="Loading group videos"
                  />
                ) : null}
              </div>

              {loadingGroupId === activeGroupId && activeGroupId ? (
                <Skeleton className="mx-auto mt-4 aspect-[9/16] w-full max-w-[218px] rounded-2xl" />
              ) : activeGroupId && visibleAssets.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  This group has no ready videos.
                </p>
              ) : activeAsset ? (
                <>
                  <CreativeAssetDeck
                    activeAssetId={activeAsset.id}
                    assets={visibleAssets}
                    content={content}
                    onActiveAssetChange={onAssetPreview}
                  />

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {activeGroup ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={librarySelected ? "default" : "outline"}
                        aria-pressed={librarySelected}
                        onClick={onUseLibrary}
                      >
                        {librarySelected ? (
                          <Check data-icon="inline-start" />
                        ) : (
                          <FolderOpen data-icon="inline-start" />
                        )}
                        Use entire group
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={activeVideoSelected ? "default" : "outline"}
                      aria-pressed={activeVideoSelected}
                      className={activeGroup ? undefined : "sm:col-span-2"}
                      onClick={() => onUseAsset(activeAsset)}
                    >
                      {activeVideoSelected ? (
                        <Check data-icon="inline-start" />
                      ) : (
                        <Film data-icon="inline-start" />
                      )}
                      Use this video
                    </Button>
                  </div>

                  <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
                    {librarySelected
                      ? "The group stays linked. This visible video is the stable export choice."
                      : "A single-video choice stays fixed even if the folder changes."}
                  </p>
                </>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No ready videos are available in this folder.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function VideoFolderCard({
  description,
  icon,
  name,
  onOpen,
}: {
  description: string;
  icon: ReactNode;
  name: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="group flex min-h-24 items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/45 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 motion-reduce:transform-none"
      onClick={onOpen}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary [&_svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {name}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transform-none"
      />
    </button>
  );
}

function CreativeAssetDeck({
  activeAssetId,
  assets,
  content,
  onActiveAssetChange,
}: {
  activeAssetId: string;
  assets: MediaAsset[];
  content: TrendingHookEditContent | TrendingWallTextEditContent;
  onActiveAssetChange: (asset: MediaAsset) => void;
}) {
  const dragStartRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const activeIndex = Math.max(
    0,
    assets.findIndex((asset) => asset.id === activeAssetId),
  );
  const activeAsset = assets[activeIndex] ?? assets[0];

  if (!activeAsset) {
    return null;
  }

  function showAsset(index: number) {
    const asset = assets[index];
    if (asset) {
      onActiveAssetChange(asset);
    }
  }

  function finishGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    dragStartRef.current = null;

    if (start !== null) {
      const distance = event.clientX - start;
      if (distance <= -44 && activeIndex < assets.length - 1) {
        showAsset(activeIndex + 1);
      } else if (distance >= 44 && activeIndex > 0) {
        showAsset(activeIndex - 1);
      }
    }

    setDragOffset(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label="Previous library video"
          disabled={activeIndex === 0}
          onClick={() => showAsset(activeIndex - 1)}
        >
          <ChevronLeft />
        </Button>

        <div
          role="group"
          tabIndex={0}
          aria-label={`${activeAsset.title}. Video ${activeIndex + 1} of ${assets.length}. Swipe or use arrow keys to browse.`}
          className="relative aspect-[9/16] w-full max-w-[218px] cursor-grab touch-pan-y overflow-hidden rounded-2xl border border-white/15 bg-[#171717] shadow-floating outline-none transition-[transform,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing motion-reduce:transition-none [container-type:inline-size]"
          style={{
            transform: `translateX(${dragOffset}px) rotate(${dragOffset / 22}deg)`,
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" && activeIndex > 0) {
              event.preventDefault();
              showAsset(activeIndex - 1);
            } else if (
              event.key === "ArrowRight" &&
              activeIndex < assets.length - 1
            ) {
              event.preventDefault();
              showAsset(activeIndex + 1);
            }
          }}
          onPointerCancel={(event) => {
            dragStartRef.current = null;
            setDragOffset(0);
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) {
              return;
            }
            dragStartRef.current = event.clientX;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStartRef.current === null) {
              return;
            }
            setDragOffset(
              Math.max(-70, Math.min(70, event.clientX - dragStartRef.current)),
            );
          }}
          onPointerUp={finishGesture}
        >
          {activeAsset.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeAsset.thumbnailUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 size-full object-cover"
            />
          ) : null}
          <video
            key={activeAsset.url}
            src={activeAsset.url}
            poster={activeAsset.thumbnailUrl ?? undefined}
            aria-label={`${activeAsset.title} library preview`}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
          <StaticCreativeTextOverlay content={content} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-10 text-white">
            <p className="truncate text-xs font-semibold">{activeAsset.title}</p>
            <p className="mt-0.5 text-[10px] text-white/70">
              {activeIndex + 1} of {assets.length}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label="Next library video"
          disabled={activeIndex >= assets.length - 1}
          onClick={() => showAsset(activeIndex + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Swipe to audition
      </p>
    </div>
  );
}

function EditorLoading() {
  return (
    <div className="grid min-h-[590px] gap-6 p-6 lg:grid-cols-2">
      <Skeleton className="mx-auto aspect-[9/16] w-full max-w-[315px] rounded-xl" />
      <div className="space-y-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

function EditorLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Empty className="min-h-[520px] rounded-none border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Film />
        </EmptyMedia>
        <EmptyTitle>Could not open this edit</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" />
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function getEditorEndpoint(item: TrendingFeedItem, includeAssignment: boolean) {
  const base = `/api/trending/creatives/${encodeURIComponent(item.format)}/${encodeURIComponent(item.creativeId)}/edit`;
  return includeAssignment
    ? `${base}?assignmentId=${encodeURIComponent(item.assignmentId)}`
    : base;
}

function toSourceChoice(
  edit: TrendingCreativeEditRecord,
): CreativeEditSourceChoice | undefined {
  const source = edit.source;
  if (!source) return undefined;

  return source.selectionKind === "group" && source.groupId
    ? {
        groupId: source.groupId,
        resolvedAssetId: source.resolvedAssetId,
        selectionKind: "group",
      }
    : {
        mediaAssetId: source.mediaAssetId ?? source.resolvedAssetId,
        selectionKind: "asset",
      };
}

function toPatchPayload(
  edit: TrendingCreativeEditRecord,
  content: TrendingCreativeEditContent,
  source: CreativeEditSourceChoice | null | undefined,
) {
  if (content.format === "carousel") {
    return {
      assignmentId: edit.assignmentId,
      expectedRevision: edit.revision,
      slides: content.slides.map((slide) => ({
        backgroundAssetId: slide.backgroundAssetId,
        ctaText: slide.ctaText,
        headline: slide.headline,
        slideId: slide.slideId,
        slideNumber: slide.slideNumber,
        subtext: slide.subtext,
        textPosition: slide.textPosition,
      })),
    };
  }

  if (content.format === "hook_video") {
    return {
      assignmentId: edit.assignmentId,
      expectedRevision: edit.revision,
      hookText: content.hookText,
      position: content.position,
      textColor: content.textColor,
      ...(source !== undefined ? { source } : {}),
    };
  }

  return {
    assignmentId: edit.assignmentId,
    expectedRevision: edit.revision,
    fullText: content.content.fullText,
    ...(source !== undefined ? { source } : {}),
    textColor: content.textColor,
    textBox: content.layout.textBox,
  };
}

function validateContent(content: TrendingCreativeEditContent) {
  if (
    content.format === "carousel" &&
    content.slides.some((slide) => !slide.headline.trim())
  ) {
    return "Every Carousel slide needs a headline.";
  }

  if (content.format === "hook_video") {
    try {
      createHookTextLayout(content.hookText, {
        fontSize: content.fontSize,
        layoutVersion: content.layoutVersion,
        lines: content.lines,
      });
    } catch (error) {
      return error instanceof Error
        ? error.message
        : `Hook text must contain at least ${HOOK_TEXT_MINIMUM_CHARACTERS} characters.`;
    }
  }

  if (content.format === "wall_text") {
    const normalized = content.content.fullText.replace(/\s+/gu, " ").trim();
    const wordCount = normalized.split(/\s+/u).filter(Boolean).length;
    if (
      !normalized ||
      wordCount < MIN_SHORT_WALL_TEXT_WORDS ||
      wordCount > 50
    ) {
      return `Wall-of-text copy must contain ${MIN_SHORT_WALL_TEXT_WORDS}–50 words and fit the measured 5–8-line layout.`;
    }
  }

  return null;
}

function isProductAssetEligibleSlide(
  slide: TrendingCarouselEditContent["slides"][number],
) {
  return (
    slide.structureId === "structure_2" &&
    (slide.productVisualEligibility === "allowed" ||
      slide.productVisualEligibility === "preferred")
  );
}

function getProductAssetEligibleSlideIndexes(
  content: TrendingCarouselEditContent,
) {
  const originallyAssignedProductIndex = content.slides.findIndex(
    (slide) => slide.originalVisualRole === "product_asset",
  );

  if (
    originallyAssignedProductIndex >= 0 &&
    isProductAssetEligibleSlide(content.slides[originallyAssignedProductIndex]!)
  ) {
    return [originallyAssignedProductIndex];
  }

  return content.slides.flatMap((slide, index) =>
    isProductAssetEligibleSlide(slide) ? [index] : [],
  );
}

function restoreOriginalCarouselBackground(
  slide: TrendingCarouselEditContent["slides"][number],
) {
  return {
    ...slide,
    backgroundAssetId: slide.originalBackgroundAssetId,
    backgroundUrl: slide.originalBackgroundUrl,
    visualRole: slide.originalVisualRole,
  };
}

function isReadyVideoAsset(asset: MediaAsset) {
  return (
    asset.status === "ready" &&
    (asset.collection === "video" || asset.collection === "influencer") &&
    asset.mimeType.startsWith("video/")
  );
}

async function requireToken() {
  const token = await getCurrentUserIdToken();
  if (!token) throw new Error("Sign in before editing this creative.");
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

function getErrorMessage(value: unknown, fallback: string) {
  return value instanceof Error && value.message ? value.message : fallback;
}

export type {
  TrendingCarouselEditContent,
  TrendingHookEditContent,
  TrendingWallTextEditContent,
};
