export const CREATIVE_ASSETS_VIDEOS_HREF = "/avatars?tab=videos";
export const CONTENT_REELS_HREF = "/library?tab=posts";

export function getCreativeAssetEditorHref(assetId: string) {
  return `/avatars/media/${encodeURIComponent(assetId)}/edit`;
}

export function getContentDemoEditorHref(demoId: string) {
  return `/library/demos/${encodeURIComponent(demoId)}/edit`;
}
