import { notFound } from "next/navigation";

import { CreateContentWorkspace } from "@/components/create-content/create-content-workspace";
import {
  CREATE_CONTENT_CARD_VERSION,
  type CreateContentCard,
} from "@/lib/create-content/card-contract";
import type { MediaAsset } from "@/lib/media/types";

const PREVIEW_ASSETS: MediaAsset[] = [
  createPreviewAsset({
    durationSeconds: 14,
    id: "create-content-preview-wall",
    thumbnailUrl: "/marketing/showcase/wot-preview-poster-v2.webp",
    title: "Morning routine",
    url: "/marketing/showcase/wot-preview-v2.mp4",
  }),
  createPreviewAsset({
    durationSeconds: 9,
    id: "create-content-preview-hook",
    thumbnailUrl: "/marketing/showcase/hook-preview-poster-v3.webp",
    title: "Product close-up",
    url: "/marketing/showcase/hook-preview-v3.mp4",
  }),
  createPreviewAsset({
    durationSeconds: 11,
    id: "create-content-preview-demo",
    thumbnailUrl: "/marketing/showcase/hook-preview-poster-v2.webp",
    title: "In the studio",
    url: "/marketing/showcase-part2/demo-preview.mp4",
  }),
];

const PREVIEW_CARDS: CreateContentCard[] = [
  {
    overlay: {
      format: "wall_text",
      position: { x: 0.5, y: 0.58 },
      text:
        "Not every good idea\nneeds to be loud.\nIt needs to feel true\nto the people\nwho need it.",
    },
    revision: 1,
    sourceMediaAssetId: "create-content-preview-wall",
    updatedAt: "2026-09-07T00:00:00.000Z",
    version: CREATE_CONTENT_CARD_VERSION,
  },
  {
    overlay: {
      format: "hook_text",
      position: { x: 0.5, y: 0.3 },
      text: "THE SMALL CHANGE\nI WISH I MADE EARLIER",
    },
    revision: 1,
    sourceMediaAssetId: "create-content-preview-hook",
    updatedAt: "2026-09-07T00:00:00.000Z",
    version: CREATE_CONTENT_CARD_VERSION,
  },
];

export default function CreateContentPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <CreateContentWorkspace
      previewAssets={PREVIEW_ASSETS}
      previewCards={PREVIEW_CARDS}
    />
  );
}

function createPreviewAsset(
  overrides: Pick<
    MediaAsset,
    "durationSeconds" | "id" | "thumbnailUrl" | "title" | "url"
  >,
): MediaAsset {
  return {
    collection: "video",
    createdAt: "2026-09-07T00:00:00.000Z",
    durationSeconds: overrides.durationSeconds,
    fileName: null,
    fileSizeBytes: null,
    height: 1920,
    id: overrides.id,
    metadata: {},
    mimeType: "video/mp4",
    parentAssetId: null,
    projectId: null,
    ratio: "9:16",
    sourceRecordId: null,
    sourceType: "upload",
    status: "ready",
    thumbnailUrl: overrides.thumbnailUrl,
    title: overrides.title,
    updatedAt: "2026-09-07T00:00:00.000Z",
    url: overrides.url,
    width: 1080,
  };
}
