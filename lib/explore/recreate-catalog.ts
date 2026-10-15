import "server-only";

import importedCatalog from "./imported-catalog.json" with { type: "json" };
import {
  getExploreHookVideos,
} from "./hook-video-library";
import {
  getExploreWallTextVideos,
} from "./wall-text-video-library";
import type { RecreateReference, ReferenceSlide } from "./recreate-types";
import { buildPublicStorageUrl } from "@/lib/storage/storage";
import { getHookReferenceReleaseItems, isHookReferenceReleaseActive } from "@/worker/src/lib/explore-hook-reference-release";

const IMPORTED_CATALOG_STORAGE_PREFIX = "explore/recreate/v1";

type ImportedCatalogItem = {
  id: string;
  format: "slideshow" | "wall_text" | "hook";
  title: string;
  category: string | null;
  categoryLabel: string | null;
  posterFile: string;
  videoFile?: string;
  durationSeconds?: number;
  slides: Array<{
    id: string;
    file: string;
    height: number;
    width: number;
  }>;
};

const importedItems = importedCatalog.mediaStatus === "published"
  ? importedCatalog.items as ImportedCatalogItem[]
  : [];

export function getRecreateReferences(includeArchivedHooks = false): RecreateReference[] {
  const hooks = getExploreHookVideos(includeArchivedHooks).map((item, index): RecreateReference => ({
    category: null,
    categoryLabel: null,
    format: "hook",
    id: item.id,
    posterUrl: item.posterUrl,
    slides: [],
    title: `Hook ${String(index + 1).padStart(2, "0")}`,
    videoUrl: item.videoUrl,
    ...(item.instagramUrl ? { instagramUrl: item.instagramUrl } : {}),
    ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
    ...(item.sourcePlatform ? { sourcePlatform: item.sourcePlatform } : {}),
    ...(item.previewVideoUrl ? { previewVideoUrl: item.previewVideoUrl } : {}),
    ...(item.durationSeconds === undefined ? {} : { durationSeconds: item.durationSeconds }),
    ...(item.pairedAudio ? { pairedAudio: item.pairedAudio } : {}),
  }));
  const existingWallText = getExploreWallTextVideos().map((item, index): RecreateReference => ({
    category: item.pairedAudio ? null : "productivity",
    categoryLabel: item.pairedAudio ? null : "Productivity",
    format: "wall_text",
    id: item.id,
    posterUrl: item.posterUrl,
    slides: [],
    title: `${item.pairedAudio ? "Wall of text" : "Productivity"} ${String(index + 1).padStart(2, "0")}`,
    videoUrl: item.videoUrl,
    ...(item.durationSeconds === undefined ? {} : { durationSeconds: item.durationSeconds }),
    ...(item.pairedAudio ? { pairedAudio: item.pairedAudio } : {}),
  }));

  // Published imported Hooks already enter through the dedicated Hook library.
  return [...hooks, ...existingWallText, ...importedItems.filter((item) => item.format !== "hook").map((item) => toImportedReference(item))];
}

export function isKnownRecreateReferenceId(value: unknown) {
  return typeof value === "string" && Boolean(getRecreateReference(value));
}

/** Retired gallery cards remain addressable by saved jobs, text and edit drafts. */
export function getRecreateReference(id: unknown) {
  if (typeof id !== "string") return undefined;
  return getRecreateReferences().find(item => item.id === id) ?? getArchivedHookReferences().find(item => item.id === id);
}

export function getArchivedHookReferences(): RecreateReference[] {
  // A gallery rollback must retain references used by already-saved creations.
  if (!getHookReferenceReleaseItems().length) return [];
  const active = new Set(getRecreateReferences().map(item => item.id));
  return getRecreateReferences(true).filter(item => item.format === "hook" && !active.has(item.id)).map(item => ({ ...item, archived: true }));
}

/** Real source media for local visual review; never used by the authenticated API. */
export function getLocalRecreateReferences(): RecreateReference[] {
  if (process.env.NODE_ENV !== "development") return [];
  const existing = getRecreateReferences();
  const existingIds = new Set(existing.map((item) => item.id));
  let hookNumber = existing.filter((item) => item.format === "hook").length;
  const staged = (importedCatalog.items as ImportedCatalogItem[])
    .filter((item) => !existingIds.has(item.id) && !(item.format === "hook" && isHookReferenceReleaseActive()))
    .map((item) => {
      const reference = toImportedReference(item, (file) => `/api/explore/local-media/${file}`);
      // Keep accessible Hook labels unique and consistent with later publication.
      return item.format === "hook" ? { ...reference, title: `Hook ${String(++hookNumber).padStart(2, "0")}` } : reference;
    });
  return [...existing, ...staged];
}

function toImportedReference(item: ImportedCatalogItem, assetUrl = getImportedAssetUrl): RecreateReference {
  const slides: ReferenceSlide[] = item.slides.map((slide) => ({
    height: slide.height,
    id: slide.id,
    url: assetUrl(slide.file),
    width: slide.width,
  }));

  return {
    category: item.category,
    categoryLabel: item.categoryLabel,
    durationSeconds: item.durationSeconds,
    format: item.format,
    id: item.id,
    posterUrl: assetUrl(item.posterFile),
    slides,
    title: item.title,
    videoUrl: item.videoFile ? assetUrl(item.videoFile) : undefined,
  };
}

function getImportedAssetUrl(fileName: string) {
  return buildPublicStorageUrl(`${IMPORTED_CATALOG_STORAGE_PREFIX}/${fileName}`);
}
