"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  Film,
  Folder,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getCreativeAssetDisplayState,
  hasRenderingEditProjects,
  indexLatestEditProjectsByAssetId,
} from "@/lib/edit/creative-asset-display";
import { getCreativeAssetEditorHref } from "@/lib/edit/routes";
import type { EditableVideo } from "@/lib/edit/video-library";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type {
  MediaAsset,
  MediaCollection,
  MediaRatio,
  MediaSourceType,
} from "@/lib/media/types";
import { cn } from "@/lib/utils";

type MediaListResponse =
  | { assets: MediaAsset[]; ok: true }
  | { error?: string; ok?: false };

type EditableVideosResponse =
  | { ok: true; videos: EditableVideo[] }
  | { error?: string; ok?: false };

type CreativeAssetGroup = {
  createdAt: string;
  id: string;
  mediaType: "image" | "video";
  name: string;
  updatedAt: string;
};

type GroupListResponse =
  | { groups: CreativeAssetGroup[]; ok: true }
  | { error?: string; ok?: false };

type GroupAssetsResponse =
  | {
      assets: Array<{ addedAt: string; asset: MediaAsset }>;
      group: CreativeAssetGroup;
      ok: true;
    }
  | { error?: string; ok?: false };

type GroupMutationResponse =
  | { group: CreativeAssetGroup; ok: true }
  | { error?: string; ok?: false };

export type AspectRatioMode = "9:16" | "1:1" | "16:9" | "adaptive";

export type UploadTask = {
  error?: string;
  fileName: string;
  id: string;
  progress: number;
  status: "preparing" | "uploading" | "completing" | "done" | "error";
};

export function UserMediaCollection({
  collection,
  description,
  displayCollections,
  emptyDescription,
  emptyTitle,
  variant = "default",
  sourceTypes,
  title,
}: {
  collection: MediaCollection;
  description: string;
  displayCollections?: MediaCollection[];
  emptyDescription: string;
  emptyTitle: string;
  sourceTypes?: MediaSourceType[];
  title: string;
  variant?: "default" | "dark";
}) {
  const { loading: authLoading, user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const lastLoadedGroupIdRef = useRef<string | null>(null);
  const [allAssets, setAllAssets] = useState<MediaAsset[]>([]);
  const [groupAssets, setGroupAssets] = useState<MediaAsset[]>([]);
  const [editProjects, setEditProjects] = useState<EditableVideo[]>([]);
  const [groups, setGroups] = useState<CreativeAssetGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [aspectRatioMode, setAspectRatioMode] = useState<AspectRatioMode>(
    collection === "video" ? "9:16" : "adaptive",
  );
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingGroupAssets, setIsLoadingGroupAssets] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<MediaAsset | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editProjectErrorMessage, setEditProjectErrorMessage] = useState<
    string | null
  >(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [groupDialogMode, setGroupDialogMode] = useState<
    "create" | "rename" | null
  >(null);
  const [groupName, setGroupName] = useState("");
  const [groupFormError, setGroupFormError] = useState<string | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [pendingDeleteGroup, setPendingDeleteGroup] =
    useState<CreativeAssetGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isAddAssetsOpen, setIsAddAssetsOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set(),
  );
  const [isAddingAssets, setIsAddingAssets] = useState(false);
  const isDarkVariant = variant === "dark";
  const groupMediaType = collection === "image" ? "image" : "video";
  const collectionsToLoad = useMemo(
    () =>
      displayCollections?.length
        ? Array.from(new Set(displayCollections))
        : [collection],
    [collection, displayCollections],
  );
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );
  const assets = selectedGroup ? groupAssets : allAssets;
  const isLoading = selectedGroup
    ? isLoadingGroupAssets
    : isLoadingLibrary;
  const groupAssetIds = useMemo(
    () => new Set(groupAssets.map((asset) => asset.id)),
    [groupAssets],
  );
  const assetsAvailableToAdd = useMemo(
    () => allAssets.filter((asset) => !groupAssetIds.has(asset.id)),
    [allAssets, groupAssetIds],
  );
  const editProjectsByAssetId = useMemo(
    () => indexLatestEditProjectsByAssetId(editProjects),
    [editProjects],
  );
  const renderingEditProjectIds = useMemo(
    () =>
      editProjects
        .filter((project) => project.status === "rendering")
        .map((project) => project.id)
        .sort()
        .join(","),
    [editProjects],
  );
  const hasRenderingEditProject = useMemo(
    () => hasRenderingEditProjects(editProjects),
    [editProjects],
  );
  const visibleErrorMessage = errorMessage ?? editProjectErrorMessage;

  const loadAllAssets = useCallback(async () => {
    if (authLoading) {
      return;
    }

    setIsLoadingLibrary(true);
    setErrorMessage(null);

    try {
      if (!user) {
        throw new Error("Sign in to open your media library.");
      }

      const token = await requireToken();
      const results = await Promise.all(
        collectionsToLoad.map(async (displayCollection) => {
          const params = new URLSearchParams({
            collection: displayCollection,
          });

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

          return data.assets;
        }),
      );
      const uniqueAssets = Array.from(
        new Map(results.flat().map((asset) => [asset.id, asset])).values(),
      ).sort(
        (first, second) =>
          Date.parse(second.updatedAt) - Date.parse(first.updatedAt),
      );

      setAllAssets(uniqueAssets);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not load your media."));
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [authLoading, collectionsToLoad, sourceTypes, user]);

  const loadGroups = useCallback(async () => {
    if (authLoading) {
      return;
    }

    setIsLoadingGroups(true);

    try {
      if (!user) {
        throw new Error("Sign in to open your media library.");
      }

      const token = await requireToken();
      const params = new URLSearchParams({ mediaType: groupMediaType });
      const response = await fetch(
        `/api/media/groups?${params.toString()}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as GroupListResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiError(data, "Could not load your groups."));
      }

      setGroups(data.groups);
      setSelectedGroupId((current) =>
        current && data.groups.some((group) => group.id === current)
          ? current
          : null,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not load your groups."));
    } finally {
      setIsLoadingGroups(false);
    }
  }, [authLoading, groupMediaType, user]);

  const loadEditProjects = useCallback(
    async (options?: { silent?: boolean }) => {
      if (authLoading || groupMediaType !== "video") {
        return;
      }

      if (!options?.silent) {
        setEditProjectErrorMessage(null);
      }

      try {
        if (!user) {
          throw new Error("Sign in to load saved video edits.");
        }

        const token = await requireToken();
        const response = await fetch("/api/edit/videos", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as EditableVideosResponse;

        if (!response.ok || data.ok !== true) {
          throw new Error(
            getApiError(data, "Could not load saved video edit status."),
          );
        }

        setEditProjects(data.videos);
        setEditProjectErrorMessage(null);
      } catch (error) {
        setEditProjectErrorMessage(
          getErrorMessage(error, "Could not load saved video edit status."),
        );
      }
    },
    [authLoading, groupMediaType, user],
  );

  const loadGroupAssets = useCallback(
    async (groupId: string) => {
      if (authLoading) {
        return;
      }

      setIsLoadingGroupAssets(true);
      setErrorMessage(null);

      try {
        if (!user) {
          throw new Error("Sign in to open your media library.");
        }

        const token = await requireToken();
        const response = await fetch(
          `/api/media/groups/${encodeURIComponent(groupId)}/items`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = (await response.json()) as GroupAssetsResponse;

        if (!response.ok || data.ok !== true) {
          throw new Error(getApiError(data, "Could not load this group."));
        }

        setGroupAssets(data.assets.map((item) => item.asset));
        lastLoadedGroupIdRef.current = groupId;
      } catch (error) {
        if (lastLoadedGroupIdRef.current !== groupId) {
          setGroupAssets([]);
        }
        setErrorMessage(getErrorMessage(error, "Could not load this group."));
      } finally {
        setIsLoadingGroupAssets(false);
      }
    },
    [authLoading, user],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        void Promise.all([loadAllAssets(), loadGroups(), loadEditProjects()]),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [loadAllAssets, loadEditProjects, loadGroups]);

  useEffect(() => {
    if (!selectedGroupId) {
      return;
    }

    const timer = window.setTimeout(
      () => void loadGroupAssets(selectedGroupId),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [loadGroupAssets, selectedGroupId]);

  useEffect(() => {
    if (
      groupMediaType !== "video" ||
      !renderingEditProjectIds ||
      !hasRenderingEditProject
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadEditProjects({ silent: true });
    }, 4_000);

    return () => window.clearInterval(timer);
  }, [
    groupMediaType,
    hasRenderingEditProject,
    loadEditProjects,
    renderingEditProjectIds,
  ]);

  useEffect(() => {
    if (groupMediaType !== "video") {
      return;
    }

    function refreshEditProjectsWhenVisible() {
      if (document.visibilityState === "visible") {
        void loadEditProjects({ silent: true });
      }
    }

    window.addEventListener("focus", refreshEditProjectsWhenVisible);
    document.addEventListener(
      "visibilitychange",
      refreshEditProjectsWhenVisible,
    );

    return () => {
      window.removeEventListener("focus", refreshEditProjectsWhenVisible);
      document.removeEventListener(
        "visibilitychange",
        refreshEditProjectsWhenVisible,
      );
    };
  }, [groupMediaType, loadEditProjects]);

  const overallUploadProgress = useMemo(() => {
    if (uploadTasks.length === 0) return 0;
    const sum = uploadTasks.reduce((acc, task) => acc + task.progress, 0);
    return Math.round(sum / uploadTasks.length);
  }, [uploadTasks]);

  function handleDragEnter(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (event.dataTransfer?.items && event.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      void handleFiles(event.dataTransfer.files);
    }
  }

  async function handleFiles(files: FileList | File[] | undefined | null) {
    if (!files || files.length === 0 || isUploading) {
      return;
    }

    const fileList = Array.from(files);
    if (fileList.length === 0) {
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const initialTasks: UploadTask[] = fileList.map((file) => ({
      fileName: file.name,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      progress: 0,
      status: "preparing",
    }));

    setUploadTasks(initialTasks);

    function updateTask(id: string, updates: Partial<UploadTask>) {
      setUploadTasks((current) =>
        current.map((task) =>
          task.id === id ? { ...task, ...updates } : task,
        ),
      );
    }

    const successfulAssets: MediaAsset[] = [];
    const errors: string[] = [];

    try {
      const token = await requireToken();

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const task = initialTasks[i];

        let incompleteUpload: { assetId: string; token: string } | null = null;

        try {
          updateTask(task.id, { progress: 5, status: "preparing" });
          const metadata = await readMediaMetadata(file, collection);

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

          if (
            !preparedResponse.ok ||
            !prepared.ok ||
            !prepared.assetId ||
            !prepared.key ||
            !prepared.uploadUrl
          ) {
            throw new Error(prepared.error || "Could not prepare this upload.");
          }

          incompleteUpload = { assetId: prepared.assetId, token };
          updateTask(task.id, { progress: 10, status: "uploading" });

          await uploadSingleFileWithXhr({
            file,
            headers: prepared.requiredHeaders,
            onProgress: (percent) => {
              const mapped = 10 + Math.round(percent * 0.8);
              updateTask(task.id, { progress: mapped });
            },
            url: prepared.uploadUrl,
          });

          updateTask(task.id, { progress: 92, status: "completing" });

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

          const uploadedAsset = completed.asset;
          incompleteUpload = null;
          successfulAssets.push(uploadedAsset);

          setAllAssets((current) => [
            uploadedAsset,
            ...current.filter((asset) => asset.id !== uploadedAsset.id),
          ]);

          if (selectedGroupId) {
            const grouped = await addAssetsToGroup({
              groupId: selectedGroupId,
              mediaAssetIds: [uploadedAsset.id],
              token,
            }).catch(() => false);

            if (grouped) {
              setGroupAssets((current) => [
                uploadedAsset,
                ...current.filter((asset) => asset.id !== uploadedAsset.id),
              ]);
            }
          }

          updateTask(task.id, { progress: 100, status: "done" });
        } catch (itemError) {
          const message = getErrorMessage(
            itemError,
            `Failed to upload ${file.name}`,
          );
          errors.push(message);
          updateTask(task.id, { error: message, progress: 0, status: "error" });

          if (incompleteUpload) {
            await fetch(
              `/api/media/${encodeURIComponent(incompleteUpload.assetId)}`,
              {
                headers: { Authorization: `Bearer ${incompleteUpload.token}` },
                method: "DELETE",
              },
            ).catch(() => undefined);
          }
        }
      }

      if (successfulAssets.length > 0) {
        if (selectedGroupId) {
          setSuccessMessage(
            `${successfulAssets.length} ${successfulAssets.length === 1 ? "asset" : "assets"} uploaded and added to ${selectedGroup?.name ?? "the group"}.`,
          );
        } else {
          setSuccessMessage(
            `${successfulAssets.length} ${successfulAssets.length === 1 ? "asset" : "assets"} uploaded to All assets.`,
          );
        }
      }

      if (errors.length > 0) {
        setErrorMessage(
          errors.length === 1
            ? errors[0]
            : `${errors.length} uploads could not be completed.`,
        );
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not upload media."));
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
      const response = selectedGroupId
        ? await fetch(
            `/api/media/groups/${encodeURIComponent(selectedGroupId)}/items`,
            {
              body: JSON.stringify({ mediaAssetId: asset.id }),
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              method: "DELETE",
            },
          )
        : await fetch(`/api/media/${encodeURIComponent(asset.id)}`, {
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

      if (selectedGroupId) {
        setGroupAssets((current) =>
          current.filter((item) => item.id !== asset.id),
        );
      } else {
        setAllAssets((current) =>
          current.filter((item) => item.id !== asset.id),
        );
        setGroupAssets((current) =>
          current.filter((item) => item.id !== asset.id),
        );
      }
      setPendingDeleteAsset(null);
      setSuccessMessage(
        selectedGroupId
          ? `${asset.title} was removed from ${selectedGroup?.name ?? "the group"}. It is still in All assets.`
          : getRemovalSuccessMessage(asset),
      );
    } catch (error) {
      setDeleteErrorMessage(getErrorMessage(error, "Could not remove this asset."));
    } finally {
      setDeletingAssetId(null);
    }
  }

  function openCreateGroupDialog() {
    setGroupDialogMode("create");
    setGroupName("");
    setGroupFormError(null);
  }

  function openRenameGroupDialog() {
    if (!selectedGroup) {
      return;
    }

    setGroupDialogMode("rename");
    setGroupName(selectedGroup.name);
    setGroupFormError(null);
  }

  async function saveGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSavingGroup) {
      return;
    }

    const name = groupName.trim();

    if (!name || name.length > 80) {
      setGroupFormError("Use a group name with 80 characters or fewer.");
      return;
    }

    setIsSavingGroup(true);
    setGroupFormError(null);

    try {
      const token = await requireToken();
      const isRenaming = groupDialogMode === "rename" && selectedGroup;
      const response = await fetch(
        isRenaming
          ? `/api/media/groups/${encodeURIComponent(selectedGroup.id)}`
          : "/api/media/groups",
        {
          body: JSON.stringify(
            isRenaming ? { name } : { mediaType: groupMediaType, name },
          ),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: isRenaming ? "PATCH" : "POST",
        },
      );
      const data = (await response.json()) as GroupMutationResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(getApiError(data, "Could not save this group."));
      }

      setGroups((current) =>
        isRenaming
          ? current.map((group) =>
              group.id === data.group.id ? data.group : group,
            )
          : [data.group, ...current],
      );
      setSelectedGroupId(data.group.id);
      setGroupDialogMode(null);
      setSuccessMessage(
        isRenaming
          ? `Group renamed to ${data.group.name}.`
          : `${data.group.name} created. Add any assets you want.`,
      );
    } catch (error) {
      setGroupFormError(getErrorMessage(error, "Could not save this group."));
    } finally {
      setIsSavingGroup(false);
    }
  }

  async function deleteGroup() {
    if (!pendingDeleteGroup || isDeletingGroup) {
      return;
    }

    setIsDeletingGroup(true);

    try {
      const token = await requireToken();
      const response = await fetch(
        `/api/media/groups/${encodeURIComponent(pendingDeleteGroup.id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          method: "DELETE",
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(getApiError(data, "Could not delete this group."));
      }

      const deletedName = pendingDeleteGroup.name;
      setGroups((current) =>
        current.filter((group) => group.id !== pendingDeleteGroup.id),
      );
      setSelectedGroupId(null);
      setPendingDeleteGroup(null);
      setSuccessMessage(
        `${deletedName} was deleted. Its assets are still in All assets.`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not delete this group."));
    } finally {
      setIsDeletingGroup(false);
    }
  }

  function openAddAssetsDialog() {
    setSelectedAssetIds(new Set());
    setIsAddAssetsOpen(true);
  }

  function toggleAssetSelection(assetId: string, checked: boolean) {
    setSelectedAssetIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(assetId);
      } else {
        next.delete(assetId);
      }

      return next;
    });
  }

  async function addSelectedAssets() {
    if (!selectedGroup || selectedAssetIds.size === 0 || isAddingAssets) {
      return;
    }

    setIsAddingAssets(true);
    setErrorMessage(null);

    try {
      const token = await requireToken();
      const mediaAssetIds = Array.from(selectedAssetIds);
      const added = await addAssetsToGroup({
        groupId: selectedGroup.id,
        mediaAssetIds,
        token,
      });

      if (!added) {
        throw new Error("Could not add the selected assets.");
      }

      await loadGroupAssets(selectedGroup.id);
      setIsAddAssetsOpen(false);
      setSelectedAssetIds(new Set());
      setSuccessMessage(
        `${mediaAssetIds.length} ${mediaAssetIds.length === 1 ? "asset" : "assets"} added to ${selectedGroup.name}.`,
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Could not add the selected assets."),
      );
    } finally {
      setIsAddingAssets(false);
    }
  }

  async function refreshLibrary() {
    setSuccessMessage(null);
    await Promise.all([
      loadAllAssets(),
      loadEditProjects(),
      loadGroups(),
      selectedGroupId
        ? loadGroupAssets(selectedGroupId)
        : Promise.resolve(),
    ]);
  }

  const gridColsClass = useMemo(() => {
    if (
      aspectRatioMode === "9:16" ||
      (aspectRatioMode === "adaptive" && collection === "video")
    ) {
      return "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5";
    }
    if (aspectRatioMode === "1:1") {
      return "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3.5";
    }
    return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5";
  }, [aspectRatioMode, collection]);

  return (
    <section
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative"
    >
      {isDraggingOver ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center rounded-[var(--radius-card)] border-2 border-dashed border-primary bg-background/95 p-6 text-center backdrop-blur-xs">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-primary/20">
            <UploadCloud className="size-7 animate-bounce" aria-hidden="true" />
          </div>
          <p className="mt-3 text-base font-bold text-foreground">
            Drop files to upload to {selectedGroup ? selectedGroup.name : "Creative Assets"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Supports multiple MP4, MOV, WEBM videos & JPG, PNG, WEBP images
          </p>
        </div>
      ) : null}

      <div className="mb-3 flex min-w-0 items-center gap-2">
        <nav
          aria-label={`${title} groups`}
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1"
        >
          <Button
            type="button"
            variant={selectedGroupId === null ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setSelectedGroupId(null);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            aria-current={selectedGroupId === null ? "page" : undefined}
          >
            All assets
          </Button>
          {groups.map((group) => (
            <Button
              key={group.id}
              type="button"
              variant={selectedGroupId === group.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setSelectedGroupId(group.id);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              aria-current={selectedGroupId === group.id ? "page" : undefined}
              className="max-w-52 shrink-0"
            >
              <Folder data-icon="inline-start" aria-hidden="true" />
              <span className="truncate">{group.name}</span>
            </Button>
          ))}
          {isLoadingGroups ? (
            <span className="inline-flex items-center gap-2 px-2 text-xs text-muted">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Loading groups…
            </span>
          ) : null}
        </nav>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={openCreateGroupDialog}
        >
          <FolderPlus data-icon="inline-start" aria-hidden="true" />
          Create group
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card px-3.5 py-3.5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-primary",
              isDarkVariant
                ? "border border-primary/20 bg-brand-soft shadow-sm"
                : "bg-primary/10",
            )}
          >
            <CollectionIcon collection={collection} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                {selectedGroup?.name ?? title}
              </h2>
              <span className="text-xs text-muted">
                {isLoading ? "Loading…" : `${assets.length} ${assets.length === 1 ? "asset" : "assets"}`}
              </span>
            </div>
            <p className="mt-0.5 max-w-2xl text-sm leading-5 text-muted">
              {selectedGroup
                ? `Only assets added to ${selectedGroup.name} are shown here.`
                : description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {/* Aspect ratio view toggle */}
          <div className="flex items-center gap-0.5 rounded-[var(--radius-control)] border border-border bg-card-muted/80 p-0.5">
            <button
              type="button"
              onClick={() => setAspectRatioMode("9:16")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-xs font-semibold transition-colors",
                aspectRatioMode === "9:16"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted hover:text-foreground",
              )}
              title="Reel format (9:16)"
              aria-label="Reel format 9:16"
            >
              <RatioReelIcon className="size-3.5" />
              <span className="hidden sm:inline">9:16</span>
            </button>
            <button
              type="button"
              onClick={() => setAspectRatioMode("1:1")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-xs font-semibold transition-colors",
                aspectRatioMode === "1:1"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted hover:text-foreground",
              )}
              title="Square format (1:1)"
              aria-label="Square format 1:1"
            >
              <RatioSquareIcon className="size-3.5" />
              <span className="hidden sm:inline">1:1</span>
            </button>
            <button
              type="button"
              onClick={() => setAspectRatioMode("16:9")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-xs font-semibold transition-colors",
                aspectRatioMode === "16:9"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted hover:text-foreground",
              )}
              title="Landscape format (16:9)"
              aria-label="Landscape format 16:9"
            >
              <RatioLandscapeIcon className="size-3.5" />
              <span className="hidden sm:inline">16:9</span>
            </button>
            <button
              type="button"
              onClick={() => setAspectRatioMode("adaptive")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-xs font-semibold transition-colors",
                aspectRatioMode === "adaptive"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted hover:text-foreground",
              )}
              title="Adaptive format (match original clip)"
              aria-label="Adaptive format"
            >
              <RatioAutoIcon className="size-3.5" />
              <span className="hidden sm:inline">Auto</span>
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => void refreshLibrary()}
            disabled={isLoading || isUploading || isLoadingGroups}
            aria-label={`Refresh ${title}`}
            title={`Refresh ${title}`}
          >
            <RefreshCw className={isLoading ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} aria-hidden="true" />
          </Button>
          {selectedGroup ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openAddAssetsDialog}
              >
                <Plus data-icon="inline-start" aria-hidden="true" />
                Add assets
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={openRenameGroupDialog}
                aria-label={`Rename ${selectedGroup.name}`}
                title={`Rename ${selectedGroup.name}`}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPendingDeleteGroup(selectedGroup)}
                aria-label={`Delete ${selectedGroup.name}`}
                title={`Delete ${selectedGroup.name}`}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={collection === "image" ? ".jpg,.jpeg,.png,.webp" : ".mp4,.mov,.webm"}
            aria-label={getUploadLabel(collection)}
            onChange={(event) => void handleFiles(event.target.files)}
            className="sr-only"
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            size="sm"
          >
            {isUploading ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Plus data-icon="inline-start" aria-hidden="true" />
            )}
            {isUploading ? "Uploading…" : getUploadLabel(collection)}
          </Button>
        </div>
      </div>

      {/* Upload Progress Banner */}
      {uploadTasks.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-primary/30 bg-card p-3.5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {isUploading ? (
                <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              )}
              <p className="text-xs font-semibold text-foreground">
                {isUploading
                  ? `Uploading ${uploadTasks.filter((t) => t.status !== "done" && t.status !== "error").length} of ${uploadTasks.length} ${uploadTasks.length === 1 ? "file" : "files"}… (${overallUploadProgress}%)`
                  : `Completed upload of ${uploadTasks.filter((t) => t.status === "done").length} ${uploadTasks.length === 1 ? "file" : "files"}`}
              </p>
            </div>
            {!isUploading ? (
              <button
                type="button"
                onClick={() => setUploadTasks([])}
                className="inline-flex size-6 items-center justify-center rounded text-muted hover:text-foreground"
                aria-label="Dismiss upload progress"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-card-muted">
            <div
              className={cn(
                "h-full transition-all duration-200",
                isUploading ? "bg-primary" : "bg-success",
              )}
              style={{ width: `${overallUploadProgress}%` }}
            />
          </div>
          {uploadTasks.length > 1 ? (
            <div className="mt-2.5 flex max-h-32 flex-col gap-1.5 overflow-y-auto pr-1">
              {uploadTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between text-[11px] text-muted">
                  <span className="max-w-[200px] truncate sm:max-w-[320px] font-medium text-foreground-strong">
                    {task.fileName}
                  </span>
                  <span>
                    {task.status === "done"
                      ? "Done"
                      : task.status === "error"
                        ? "Failed"
                        : `${task.progress}%`}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {visibleErrorMessage ? (
        <div
          role="alert"
          className={cn(
            "mt-3 flex items-start gap-2 rounded-[var(--radius-control)] border px-3 py-2.5 text-sm font-medium text-error",
            isDarkVariant ? "border-error/35 bg-error/10" : "border-error/20 bg-error/5",
          )}
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {visibleErrorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-[var(--radius-control)] border border-success/30 bg-success/10 px-3 py-2.5 text-sm font-medium text-success"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {successMessage}
        </div>
      ) : null}

      <div className="mt-4">
        {isLoading ? (
          <div className={gridColsClass}>
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border/60 bg-card shadow-xs"
              >
                <div
                  className={cn(
                    "w-full animate-pulse bg-card-muted/70",
                    aspectRatioMode === "9:16"
                      ? "aspect-[9/16]"
                      : aspectRatioMode === "1:1"
                        ? "aspect-square"
                        : aspectRatioMode === "16:9"
                          ? "aspect-video"
                          : "aspect-[9/16]",
                  )}
                />
                <div className="flex flex-col gap-2 p-3">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-card-muted/80" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-card-muted/60" />
                  <div className="mt-2 h-7 w-full animate-pulse rounded bg-card-muted/70" />
                </div>
              </div>
            ))}
          </div>
        ) : assets.length > 0 ? (
          <div className={gridColsClass}>
            {assets.map((asset) => (
              <MediaAssetCard
                key={asset.id}
                aspectRatioMode={aspectRatioMode}
                asset={asset}
                deleting={deletingAssetId === asset.id}
                editProject={editProjectsByAssetId.get(asset.id) ?? null}
                grouped={Boolean(selectedGroup)}
                variant={variant}
                onRemove={() => {
                  setDeleteErrorMessage(null);
                  setPendingDeleteAsset(asset);
                }}
              />
            ))}
          </div>
        ) : (
          <div
            onClick={() => !selectedGroup && inputRef.current?.click()}
            className={cn(
              "group relative flex min-h-[260px] flex-col items-center justify-center rounded-[var(--radius-card)] border-2 border-dashed border-border/80 bg-card-muted/30 px-6 py-10 text-center transition-all duration-200",
              !selectedGroup && "cursor-pointer hover:border-primary/50 hover:bg-card-muted/50",
            )}
          >
            <span
              className={cn(
                "inline-flex size-12 items-center justify-center rounded-2xl border transition-transform duration-200 group-hover:scale-105",
                isDarkVariant
                  ? "border-border-strong bg-card text-primary shadow-xs"
                  : "border-border bg-card text-primary shadow-xs",
              )}
            >
              {selectedGroup ? (
                <FolderOpen className="size-5.5" aria-hidden="true" />
              ) : (
                <UploadCloud className="size-5.5" aria-hidden="true" />
              )}
            </span>
            <h3 className="mt-3.5 text-sm font-semibold text-foreground">
              {selectedGroup ? "No assets in this group" : emptyTitle}
            </h3>
            <p className="mt-1 max-w-md text-xs leading-5 text-muted">
              {selectedGroup
                ? "Add existing assets, or upload a new one while this group is open."
                : emptyDescription}
            </p>
            {selectedGroup && allAssets.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={(e) => {
                  e.stopPropagation();
                  openAddAssetsDialog();
                }}
              >
                <Plus data-icon="inline-start" aria-hidden="true" />
                Add existing assets
              </Button>
            ) : !selectedGroup ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted shadow-xs transition-colors group-hover:border-primary/40 group-hover:text-foreground">
                <UploadCloud className="size-3.5 text-primary" aria-hidden="true" />
                <span>Drag & drop files here, or click to browse</span>
              </div>
            ) : null}
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
            <DialogTitle className="text-lg font-semibold">
              {selectedGroup ? "Remove from this group?" : "Remove this asset?"}
            </DialogTitle>
            <DialogDescription>
              {pendingDeleteAsset
                ? selectedGroup
                  ? `This removes ${pendingDeleteAsset.title} from ${selectedGroup.name}. The asset stays in All assets and any other groups.`
                  : getRemovalDescription(pendingDeleteAsset)
                : ""}
            </DialogDescription>
          </DialogHeader>

          {pendingDeleteAsset ? (
            <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border bg-card-muted p-3">
              <span
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] ring-1 ring-border",
                  isDarkVariant ? "bg-card text-primary" : "bg-card text-muted",
                )}
              >
                <CollectionIcon collection={pendingDeleteAsset.collection} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{pendingDeleteAsset.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {getSourceLabel(pendingDeleteAsset)} · {formatAssetDate(pendingDeleteAsset.createdAt)}
                </p>
              </div>
            </div>
          ) : null}

          {deleteErrorMessage ? (
            <div
              role="alert"
              className={cn(
                "flex items-start gap-2 rounded-[var(--radius-control)] border px-3 py-2.5 text-sm font-medium text-error",
                isDarkVariant ? "border-error/35 bg-error/10" : "border-error/20 bg-error/5",
              )}
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {deleteErrorMessage}
            </div>
          ) : null}

          <DialogFooter className="border-border bg-popover">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteErrorMessage(null);
                setPendingDeleteAsset(null);
              }}
              disabled={Boolean(deletingAssetId)}
            >
              {selectedGroup ? "Keep in group" : "Keep asset"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-error text-error-foreground shadow-sm hover:bg-error/90"
              onClick={() => void removeAsset()}
              disabled={Boolean(deletingAssetId)}
            >
              {deletingAssetId ? (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : selectedGroup ? (
                <FolderMinus data-icon="inline-start" aria-hidden="true" />
              ) : (
                <Trash2 data-icon="inline-start" aria-hidden="true" />
              )}
              {deletingAssetId
                ? "Removing…"
                : selectedGroup
                  ? "Remove from group"
                  : "Remove asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={groupDialogMode !== null}
        onOpenChange={(open) => {
          if (!open && !isSavingGroup) {
            setGroupDialogMode(null);
            setGroupFormError(null);
          }
        }}
      >
        <DialogContent showCloseButton={!isSavingGroup}>
          <DialogHeader>
            <DialogTitle>
              {groupDialogMode === "rename" ? "Rename group" : "Create group"}
            </DialogTitle>
            <DialogDescription>
              Groups are optional. They help you organize related assets without
              changing All assets.
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-5" onSubmit={saveGroup}>
            <FieldGroup>
              <Field data-invalid={Boolean(groupFormError)}>
                <FieldLabel htmlFor={`${collection}-group-name`}>
                  Group name
                </FieldLabel>
                <Input
                  id={`${collection}-group-name`}
                  value={groupName}
                  onChange={(event) => {
                    setGroupName(event.target.value);
                    setGroupFormError(null);
                  }}
                  placeholder={
                    collection === "image"
                      ? "Product photos"
                      : "Fitness influencers"
                  }
                  maxLength={80}
                  autoComplete="off"
                  autoFocus
                  aria-invalid={Boolean(groupFormError)}
                />
                <FieldDescription>
                  You can add the same asset to more than one group.
                </FieldDescription>
                <FieldError>{groupFormError}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGroupDialogMode(null)}
                disabled={isSavingGroup}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingGroup}>
                {isSavingGroup ? (
                  <Loader2
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : null}
                {isSavingGroup
                  ? "Saving…"
                  : groupDialogMode === "rename"
                    ? "Save name"
                    : "Create group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddAssetsOpen}
        onOpenChange={(open) => {
          if (!isAddingAssets) {
            setIsAddAssetsOpen(open);

            if (!open) {
              setSelectedAssetIds(new Set());
            }
          }
        }}
      >
        <DialogContent showCloseButton={!isAddingAssets}>
          <DialogHeader>
            <DialogTitle>Add assets to {selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              Choose any assets from All assets. They remain available everywhere
              else.
            </DialogDescription>
          </DialogHeader>

          {assetsAvailableToAdd.length > 0 ? (
            <FieldGroup className="max-h-[52vh] overflow-y-auto pr-1">
              {assetsAvailableToAdd.map((asset) => {
                const checkboxId = `${collection}-group-asset-${asset.id}`;
                const checked = selectedAssetIds.has(asset.id);

                return (
                  <Field
                    key={asset.id}
                    orientation="horizontal"
                    className="rounded-[var(--radius-control)] border border-border bg-card-muted p-3"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleAssetSelection(asset.id, value === true)
                      }
                    />
                    <FieldLabel
                      htmlFor={checkboxId}
                      className="min-w-0 cursor-pointer"
                    >
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-card">
                        {asset.collection === "image" ? (
                          <Image
                            src={asset.thumbnailUrl || asset.url}
                            alt=""
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <video
                            src={asset.url}
                            poster={asset.thumbnailUrl || undefined}
                            preload="metadata"
                            muted
                            className="size-full object-cover"
                          />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {asset.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-normal text-muted">
                          {getSourceLabel(asset)} · {formatAssetDate(asset.createdAt)}
                        </span>
                      </span>
                    </FieldLabel>
                  </Field>
                );
              })}
            </FieldGroup>
          ) : (
            <div className="rounded-[var(--radius-control)] border border-dashed border-border bg-card-muted p-6 text-center">
              <p className="text-sm font-medium text-foreground">
                Every available asset is already in this group.
              </p>
              <p className="mt-1 text-sm text-muted">
                Upload another asset or return to All assets.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddAssetsOpen(false)}
              disabled={isAddingAssets}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void addSelectedAssets()}
              disabled={selectedAssetIds.size === 0 || isAddingAssets}
            >
              {isAddingAssets ? (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Plus data-icon="inline-start" aria-hidden="true" />
              )}
              {isAddingAssets
                ? "Adding…"
                : `Add ${selectedAssetIds.size || ""} ${
                    selectedAssetIds.size === 1 ? "asset" : "assets"
                  }`.trim()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDeleteGroup !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingGroup) {
            setPendingDeleteGroup(null);
          }
        }}
      >
        <DialogContent showCloseButton={!isDeletingGroup}>
          <DialogHeader>
            <DialogTitle>Delete this group?</DialogTitle>
            <DialogDescription>
              {pendingDeleteGroup
                ? `${pendingDeleteGroup.name} will be removed. Its assets stay safe in All assets and any other groups.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDeleteGroup(null)}
              disabled={isDeletingGroup}
            >
              Keep group
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-error text-error-foreground shadow-sm hover:bg-error/90"
              onClick={() => void deleteGroup()}
              disabled={isDeletingGroup}
            >
              {isDeletingGroup ? (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Trash2 data-icon="inline-start" aria-hidden="true" />
              )}
              {isDeletingGroup ? "Deleting…" : "Delete group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MediaAssetCard({
  aspectRatioMode = "9:16",
  asset,
  deleting,
  editProject,
  grouped,
  onRemove,
  variant = "default",
}: {
  aspectRatioMode?: AspectRatioMode;
  asset: MediaAsset;
  deleting: boolean;
  editProject: EditableVideo | null;
  grouped: boolean;
  onRemove: () => void;
  variant?: "default" | "dark";
}) {
  const isImage = asset.collection === "image";
  const isDarkVariant = variant === "dark";
  const displayState = getCreativeAssetDisplayState(asset.url, editProject);
  const statusLabel = getCreativeAssetCardStatusLabel(editProject);
  const statusVariant = getCreativeAssetCardStatusVariant(editProject);

  const cardAspectClass = useMemo(() => {
    if (aspectRatioMode === "9:16") return "aspect-[9/16]";
    if (aspectRatioMode === "1:1") return "aspect-square";
    if (aspectRatioMode === "16:9") return "aspect-video";
    // adaptive mode
    if (asset.ratio === "9:16") return "aspect-[9/16]";
    if (asset.ratio === "4:5") return "aspect-[4/5]";
    if (asset.ratio === "1:1") return "aspect-square";
    if (asset.ratio === "16:9") return "aspect-video";
    return isImage ? "aspect-square" : "aspect-[9/16]";
  }, [aspectRatioMode, asset.ratio, isImage]);

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div
        className={cn(
          "relative w-full overflow-hidden border-b border-border/80 transition-all",
          isDarkVariant ? "bg-[#090b10]" : "bg-[#090b10]",
          cardAspectClass,
        )}
      >
        {isImage ? (
          <Image
            src={asset.thumbnailUrl || asset.url}
            alt={asset.title}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 100vw, 25vw"
          />
        ) : (
          <video
            key={displayState.playbackUrl}
            src={displayState.playbackUrl}
            poster={asset.thumbnailUrl || undefined}
            preload="metadata"
            muted
            controls
            playsInline
            className="size-full object-cover"
          />
        )}

        {/* Ratio & Duration Badges Overlay */}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white/95 shadow-sm backdrop-blur-md">
            {asset.ratio === "other" ? "Custom" : asset.ratio}
          </span>
          {!isImage && asset.durationSeconds !== null ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white/95 shadow-sm backdrop-blur-md">
              {formatDuration(asset.durationSeconds)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between p-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-foreground" title={asset.title}>
                {asset.title}
              </h3>
              <p className="mt-0.5 truncate text-xs text-muted">
                {getSourceLabel(asset)} · {formatAssetDate(asset.createdAt)}
              </p>
            </div>
            <Badge
              aria-label={`${asset.title} status: ${statusLabel}`}
              aria-live="polite"
              role="status"
              variant={statusVariant}
              className="shrink-0"
            >
              {displayState.isRendering ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              )}
              {statusLabel}
            </Badge>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {!isImage ? (
            <Link
              href={getCreativeAssetEditorHref(asset.id)}
              className="inline-flex h-8 min-w-0 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-border-strong bg-card-muted px-3 text-xs font-semibold text-foreground-strong shadow-xs transition-colors hover:border-primary/50 hover:bg-selected hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Edit video
            </Link>
          ) : (
            <span className="min-w-0 flex-1 text-xs text-muted">
              Ready for post / carousel
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={deleting}
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border text-muted transition-colors hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
              "bg-card hover:border-error/40 hover:bg-error/10",
            )}
            aria-label={
              grouped
                ? `Remove ${asset.title} from group`
                : `Remove ${asset.title}`
            }
          >
            {deleting ? (
              <Loader2
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : grouped ? (
              <FolderMinus className="size-3.5" aria-hidden="true" />
            ) : (
              <Trash2 className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

function RatioReelIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} stroke="currentColor">
      <rect x="4.25" y="1.25" width="7.5" height="13.5" rx="1.75" strokeWidth="1.4" />
      <line x1="6.5" y1="12.25" x2="9.5" y2="12.25" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function RatioSquareIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} stroke="currentColor">
      <rect x="2" y="2" width="12" height="12" rx="2" strokeWidth="1.4" />
    </svg>
  );
}

function RatioLandscapeIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} stroke="currentColor">
      <rect x="1.25" y="3.5" width="13.5" height="9" rx="1.75" strokeWidth="1.4" />
    </svg>
  );
}

function RatioAutoIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} stroke="currentColor">
      <path d="M8 1.5L9.5 5.5L13.5 7L9.5 8.5L8 12.5L6.5 8.5L2.5 7L6.5 5.5L8 1.5Z" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M12.5 11.5L13.25 13.25L15 14L13.25 14.75L12.5 16.5L11.75 14.75L10 14L11.75 13.25L12.5 11.5Z" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function uploadSingleFileWithXhr({
  file,
  headers,
  onProgress,
  url,
}: {
  file: File;
  headers?: Record<string, string>;
  onProgress: (percent: number) => void;
  url: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const percent = Math.min(
          100,
          Math.max(0, Math.round((event.loaded / event.total) * 100)),
        );
        onProgress(percent);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => {
      reject(new Error("Network error during file upload."));
    };
    xhr.ontimeout = () => {
      reject(new Error("File upload timed out."));
    };
    xhr.send(file);
  });
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "0:00";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getCreativeAssetCardStatusLabel(editProject: EditableVideo | null) {
  if (!editProject || editProject.status === "ready") {
    return "Ready";
  }

  const labels: Record<Exclude<EditableVideo["status"], "ready">, string> = {
    draft: "Draft",
    failed: "Save failed",
    rendered: "Saved",
    rendering: "Saving",
  };

  return labels[editProject.status];
}

function getCreativeAssetCardStatusVariant(editProject: EditableVideo | null) {
  if (editProject?.status === "failed") {
    return "failed" as const;
  }

  if (editProject?.status === "rendering") {
    return "rendering" as const;
  }

  if (editProject?.status === "draft") {
    return "draft" as const;
  }

  return "ready" as const;
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
  return "Upload video";
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
    wall_text_render: "Wall-text Reel",
  };
  return labels[asset.sourceType];
}

function getRemovalDescription(asset: MediaAsset) {
  if (asset.sourceType === "catalog_influencer") {
    return "This removes the influencer from your Creative Assets only. The shared UGC Pilot influencer stays protected and remains available in the catalog.";
  }

  return "This hides the asset from Creative Assets and its editor. The stored file is retained for recovery, so it is not permanently erased.";
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

async function addAssetsToGroup({
  groupId,
  mediaAssetIds,
  token,
}: {
  groupId: string;
  mediaAssetIds: string[];
  token: string;
}) {
  const response = await fetch(
    `/api/media/groups/${encodeURIComponent(groupId)}/items`,
    {
      body: JSON.stringify({ mediaAssetIds }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const data = (await response.json().catch(() => null)) as {
    error?: string;
    ok?: boolean;
  } | null;

  if (!response.ok || data?.ok !== true) {
    throw new Error(getApiError(data, "Could not add assets to this group."));
  }

  return true;
}

function getApiError(value: unknown, fallback: string) {
  return value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
