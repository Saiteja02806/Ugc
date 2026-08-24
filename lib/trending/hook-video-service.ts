import "server-only";

import { loadSavedTrendingCreativeEditForDownstream } from "@/lib/trending/creative-edit-service";
import {
  getHookVideoSuggestionForUser,
  parseHookSuggestionRenderLayout,
  saveHookVideoDraft,
} from "@/lib/trending/hook-video-db";
import { buildUserInfluencerId } from "@/lib/trending/hook-video-source-logic";
import { createHookTextLayout } from "@/lib/trending/hook-text-layout";
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
  const [demo, suggestion, creativeEdit] = await Promise.all([
    getHookDemoAsset({ assetId: input.demoAssetId, userId }),
    getHookVideoSuggestionForUser({
      suggestionId: input.selectedHookId,
      userId,
    }),
    loadSavedTrendingCreativeEditForDownstream({
      creativeId: input.selectedHookId,
      format: "hook_video",
      userId,
    }),
  ]);

  if (!suggestion) {
    throw new HookVideoSelectionError(
      "This hook suggestion is no longer available.",
      404,
    );
  }

  const savedSource = creativeEdit?.source;
  const effectiveSelection = savedSource
    ? {
        influencerId: buildUserInfluencerId(savedSource.resolvedAssetId),
        sourceKind: "user" as const,
        videoId: savedSource.resolvedAssetId,
      }
    : {
        influencerId: input.influencerId,
        sourceKind: input.sourceKind,
        videoId: input.influencerVideoId,
      };
  const [influencer, source] = await Promise.all([
    getHookInfluencerForUser({
      influencerId: effectiveSelection.influencerId,
      sourceKind: effectiveSelection.sourceKind,
      userId,
    }),
    resolveHookVideoSource({
      influencerId: effectiveSelection.influencerId,
      sourceKind: effectiveSelection.sourceKind,
      userId,
      videoId: effectiveSelection.videoId,
    }),
  ]);

  if (
    (suggestion.demo_asset_id !== null &&
      suggestion.demo_asset_id !== input.demoAssetId) ||
    (!savedSource &&
      (suggestion.influencer_id !== input.influencerId ||
        suggestion.influencer_video_id !== input.influencerVideoId ||
        suggestion.influencer_source !== input.sourceKind))
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

  const editedHookContent =
    creativeEdit?.content.format === "hook_video"
      ? creativeEdit.content
      : null;
  const suggestionLayout = parseHookSuggestionRenderLayout({
    hookText: suggestion.text,
    openingLines: suggestion.opening_lines,
    visualFit: suggestion.visual_fit,
  });

  if (!editedHookContent && !suggestionLayout) {
    throw new HookVideoSelectionError(
      "The validated Hook text layout is no longer available.",
      409,
    );
  }

  const hookRenderSpec = createHookTextLayout(
    editedHookContent?.hookText ?? suggestion.text,
    editedHookContent
      ? {
          fontSize: editedHookContent.fontSize,
          layoutVersion: editedHookContent.layoutVersion,
          lines: editedHookContent.lines,
        }
      : {
          enforceMaximum: false,
          enforceMinimum: false,
          fontSize: suggestionLayout!.fontSize,
          layoutVersion: suggestionLayout!.layoutVersion,
          lines: suggestionLayout!.lines,
        },
  );

  const draft = await saveHookVideoDraft({
    demoAssetId: demo.id,
    demoTitle: demo.title,
    draftId: input.draftId,
    hookText: hookRenderSpec.hookText,
    influencerId: influencer.id,
    influencerName: influencer.name,
    influencerVideoId: source.id,
    influencerVideoTitle: source.title,
    librarySaved: params.librarySaved,
    metadata: creativeEdit
      ? {
          trendingCreativeEditId: creativeEdit.id,
          trendingCreativeEditRevision: creativeEdit.revision,
          trendingHookTextFontSize: hookRenderSpec.fontSize,
          trendingHookTextLines: hookRenderSpec.lines,
          trendingHookTextPosition:
            editedHookContent?.position ?? null,
          trendingHookTextColor: editedHookContent?.textColor ?? null,
        }
      : undefined,
    previewThumbnailUrl: source.thumbnailUrl,
    selectedHookId: suggestion.id,
    sourceKind: source.sourceKind,
    trimEnd: input.trimEnd,
    trimStart: input.trimStart,
    userId,
  });

  return {
    creativeEdit,
    demo,
    draft,
    hookRenderSpec,
    influencer,
    source,
  };
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
