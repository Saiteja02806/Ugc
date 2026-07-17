import "server-only";

import {
  getHookVideoSuggestionForUser,
  saveHookVideoDraft,
} from "@/lib/trending/hook-video-db";
import {
  getHookDemoAsset,
  getHookInfluencerForUser,
  resolveHookVideoSource,
} from "@/lib/trending/hook-video-sources";
import type { HookVideoDraftRequest } from "@/lib/trending/hook-video-validation";
import { validateHookTrimBounds } from "@/lib/trending/hook-video-validation";

export async function persistHookVideoSelection(params: {
  input: HookVideoDraftRequest;
  librarySaved: boolean;
  userId: string;
}) {
  const { input, userId } = params;
  const [influencer, source, demo, suggestion] = await Promise.all([
    getHookInfluencerForUser({
      influencerId: input.influencerId,
      sourceKind: input.sourceKind,
      userId,
    }),
    resolveHookVideoSource({
      influencerId: input.influencerId,
      sourceKind: input.sourceKind,
      userId,
      videoId: input.influencerVideoId,
    }),
    getHookDemoAsset({ assetId: input.demoAssetId, userId }),
    getHookVideoSuggestionForUser({
      suggestionId: input.selectedHookId,
      userId,
    }),
  ]);

  if (!suggestion) {
    throw new HookVideoSelectionError(
      "This hook suggestion is no longer available.",
      404,
    );
  }

  if (
    suggestion.demo_asset_id !== input.demoAssetId ||
    suggestion.influencer_id !== input.influencerId ||
    suggestion.influencer_video_id !== input.influencerVideoId ||
    suggestion.influencer_source !== input.sourceKind
  ) {
    throw new HookVideoSelectionError(
      "This hook was generated for a different video selection.",
      409,
    );
  }

  if (
    !validateHookTrimBounds({
      durationSeconds: source.durationSeconds,
      trimEnd: input.trimEnd,
      trimStart: input.trimStart,
    })
  ) {
    throw new HookVideoSelectionError(
      "Choose a valid trim range for the opening clip.",
    );
  }

  const draft = await saveHookVideoDraft({
    demoAssetId: demo.id,
    demoTitle: demo.title,
    draftId: input.draftId,
    hookText: suggestion.text,
    influencerId: influencer.id,
    influencerName: influencer.name,
    influencerVideoId: source.id,
    influencerVideoTitle: source.title,
    librarySaved: params.librarySaved,
    previewThumbnailUrl: source.thumbnailUrl,
    selectedHookId: suggestion.id,
    sourceKind: source.sourceKind,
    trimEnd: input.trimEnd,
    trimStart: input.trimStart,
    userId,
  });

  return { demo, draft, influencer, source };
}

export class HookVideoSelectionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "HookVideoSelectionError";
  }
}
