import type { MediaRatio, MediaSourceType } from "@/lib/media/types";

export const hookVideoSourceKinds = ["catalog", "user"] as const;

export type HookVideoSourceKind = (typeof hookVideoSourceKinds)[number];

export type HookInfluencerSummary = {
  id: string;
  name: string;
  sourceKind: HookVideoSourceKind;
  thumbnailUrl: string | null;
  videoCount: number;
};

export type HookInfluencerVideoSummary = {
  durationSeconds: number | null;
  id: string;
  influencerKey: string | null;
  influencerId: string;
  ratio: MediaRatio;
  reactionType: string | null;
  sourceKind: HookVideoSourceKind;
  thumbnailUrl: string | null;
  title: string;
  trimEnd: number | null;
  trimStart: number;
  visualGroup: string | null;
};

export type HookVideoBrowseEntry = {
  influencer: HookInfluencerSummary;
  video: HookInfluencerVideoSummary;
};

export type HookDemoSummary = {
  durationSeconds: number | null;
  id: string;
  ratio: MediaRatio;
  sourceType: MediaSourceType;
  thumbnailUrl: string | null;
  title: string;
};

export type HookSuggestion = {
  id: string;
  text: string;
};

export type HookVideoDraftStatus = "draft" | "saved" | "scheduled";

export type HookVideoDraftInput = {
  demoAssetId: string;
  draftId?: string | null;
  hookText: string;
  influencerId: string;
  influencerVideoId: string;
  selectedHookId: string;
  sourceKind: HookVideoSourceKind;
  trimEnd: number | null;
  trimStart: number;
};

export function isHookVideoSourceKind(
  value: unknown,
): value is HookVideoSourceKind {
  return (
    typeof value === "string" &&
    hookVideoSourceKinds.includes(value as HookVideoSourceKind)
  );
}
