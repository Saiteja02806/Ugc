import "server-only";

import type { ExploreHookVideo } from "@/lib/explore/hook-video-types";
import { buildPublicStorageUrl } from "@/lib/storage/storage";

export type { ExploreHookVideo } from "@/lib/explore/hook-video-types";

type ExploreHookVideoAsset = {
  id: string;
  sourceFileSha256: string;
  storageKey: string;
};

type ExplorePreviewVideoAsset = {
  id: string;
  sourceFileSha256: string;
  storageKey: string;
};

// This is the dedicated autplaying landing preview for free users. It is
// intentionally separate from the Hook library and is never shown as a Pro
// library card.
const EXPLORE_PREVIEW_VIDEO_ASSET: ExplorePreviewVideoAsset = {
  id: "explore-landing-preview",
  sourceFileSha256:
    "d12f92b5a902a80f6bfbfe7565fa31254ca265a3cb48db95ab12dcfd101ca3ed",
  storageKey:
    "explore/landing-preview/2026-08-29/d12f92b5a902a80f6bfbfe7565fa31254ca265a3cb48db95ab12dcfd101ca3ed.mp4",
};

// Dedicated Explore catalog. These are short, silent reference clips uploaded
// for this library only; they do not use a Trending source or data table.
const EXPLORE_HOOK_VIDEO_ASSETS: ReadonlyArray<ExploreHookVideoAsset> = [
  {
    id: "explore-hook-01",
    sourceFileSha256: "364fde62380195dc1373414ce6934f17130410407ced6fd5c86f0fb167ad7326",
    storageKey:
      "explore/hook-videos/2026-08-29/364fde62380195dc1373414ce6934f17130410407ced6fd5c86f0fb167ad7326.mp4",
  },
  {
    id: "explore-hook-02",
    sourceFileSha256: "ad7de81331d83919f5e38df0656688a48649a5b77b3e5405cd50f0787352a954",
    storageKey:
      "explore/hook-videos/2026-08-29/ad7de81331d83919f5e38df0656688a48649a5b77b3e5405cd50f0787352a954.mp4",
  },
  {
    id: "explore-hook-03",
    sourceFileSha256: "f986f3b675af7524243b37f19bc6bc5615d1648dd5ed6ec9f4373a2033d0a0b3",
    storageKey:
      "explore/hook-videos/2026-08-29/f986f3b675af7524243b37f19bc6bc5615d1648dd5ed6ec9f4373a2033d0a0b3.mp4",
  },
  {
    id: "explore-hook-04",
    sourceFileSha256: "c26ad227deaa517481beb60f5545d68ba2a7fa33929f07067da2043a9ae6dc61",
    storageKey:
      "explore/hook-videos/2026-08-29/c26ad227deaa517481beb60f5545d68ba2a7fa33929f07067da2043a9ae6dc61.mp4",
  },
  {
    id: "explore-hook-05",
    sourceFileSha256: "fef5c58892318bbcaed596d7ec4a2a7559dff6d0ac03dabeaced3215e9cf1133",
    storageKey:
      "explore/hook-videos/2026-08-29/fef5c58892318bbcaed596d7ec4a2a7559dff6d0ac03dabeaced3215e9cf1133.mp4",
  },
  {
    id: "explore-hook-06",
    sourceFileSha256: "dabab7dbfbb7ed3533a1013919f00aaafeb5044afec2ee46b553238a95fc491f",
    storageKey:
      "explore/hook-videos/2026-08-29/dabab7dbfbb7ed3533a1013919f00aaafeb5044afec2ee46b553238a95fc491f.mp4",
  },
  {
    id: "explore-hook-07",
    sourceFileSha256: "a8bdc63746194572c57cb38c013e2ef944a2f53066b96656d4c8775565810767",
    storageKey:
      "explore/hook-videos/2026-08-29/a8bdc63746194572c57cb38c013e2ef944a2f53066b96656d4c8775565810767.mp4",
  },
  {
    id: "explore-hook-08",
    sourceFileSha256: "b6b5b34b54d19642a3ccad7b2d28548cd4e22d1f35f87f55c537836a72d00133",
    storageKey:
      "explore/hook-videos/2026-08-29/b6b5b34b54d19642a3ccad7b2d28548cd4e22d1f35f87f55c537836a72d00133.mp4",
  },
  {
    id: "explore-hook-09",
    sourceFileSha256: "eabcacd6b9306ebfa3226d78f11ca7ca47a784d358399afa802176f6413069d2",
    storageKey:
      "explore/hook-videos/2026-08-29/eabcacd6b9306ebfa3226d78f11ca7ca47a784d358399afa802176f6413069d2.mp4",
  },
  {
    id: "explore-hook-10",
    sourceFileSha256: "6865b1a00ae4b93f8754d43ac773d02bb92e056f348d3148d74b019521976f66",
    storageKey:
      "explore/hook-videos/2026-08-29/6865b1a00ae4b93f8754d43ac773d02bb92e056f348d3148d74b019521976f66.mp4",
  },
  {
    id: "explore-hook-11",
    sourceFileSha256: "e56aec7559fb0150569b54612ec835d1955ae3a980dc339961f0472290c3f56e",
    storageKey:
      "explore/hook-videos/2026-08-29/e56aec7559fb0150569b54612ec835d1955ae3a980dc339961f0472290c3f56e.mp4",
  },
  {
    id: "explore-hook-12",
    sourceFileSha256: "7aedfcabaa45e822381e72c731c7d0c6c04cfd6da2b97ca55bd0fff6ecd393c7",
    storageKey:
      "explore/hook-videos/2026-08-29/7aedfcabaa45e822381e72c731c7d0c6c04cfd6da2b97ca55bd0fff6ecd393c7.mp4",
  },
  {
    id: "explore-hook-13",
    sourceFileSha256: "b8c5073ee786be5e8c050c9e6ea0353bad8ed45464039df7e9cc724374c7d5ae",
    storageKey:
      "explore/hook-videos/2026-08-29/b8c5073ee786be5e8c050c9e6ea0353bad8ed45464039df7e9cc724374c7d5ae.mp4",
  },
  {
    id: "explore-hook-14",
    sourceFileSha256: "cca422a0a75f1563cee80ad324c05b0ceb90c42275cdde25cb6dfbc5e3b06caa",
    storageKey:
      "explore/hook-videos/2026-08-29/cca422a0a75f1563cee80ad324c05b0ceb90c42275cdde25cb6dfbc5e3b06caa.mp4",
  },
];

export function getExploreHookVideos(): Array<ExploreHookVideo> {
  return EXPLORE_HOOK_VIDEO_ASSETS.map((asset) => ({
    id: asset.id,
    videoUrl: buildPublicStorageUrl(asset.storageKey),
  }));
}

export function getExplorePreviewVideo(): ExploreHookVideo {
  return {
    id: EXPLORE_PREVIEW_VIDEO_ASSET.id,
    videoUrl: buildPublicStorageUrl(EXPLORE_PREVIEW_VIDEO_ASSET.storageKey),
  };
}

// Used by the server-side video-generation boundary to recognize an Explore
// recreation without trusting a client-provided flag.
export function isExploreHookVideoId(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return (
    value === EXPLORE_PREVIEW_VIDEO_ASSET.id ||
    EXPLORE_HOOK_VIDEO_ASSETS.some((asset) => asset.id === value)
  );
}

export function getExploreHookVideoAssetsForImport() {
  return EXPLORE_HOOK_VIDEO_ASSETS;
}
