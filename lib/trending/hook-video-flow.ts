import type { HookVideoSourceKind } from "@/lib/trending/hook-video-types";

export type HookVideoFlowStage =
  | "browse"
  | "select_demo"
  | "select_hook"
  | "review";

export type HookVideoDraft = {
  demoAssetId: string | null;
  hookSource: "composition" | "trending" | null;
  hookText: string | null;
  id: string | null;
  influencerId: string | null;
  influencerVideoId: string | null;
  selectedHookId: string | null;
  sourceKind: HookVideoSourceKind | null;
  trimEnd: number | null;
  trimStart: number;
};

export type HookVideoFlowState = {
  draft: HookVideoDraft;
  stage: HookVideoFlowStage;
};

export const EMPTY_HOOK_VIDEO_DRAFT: HookVideoDraft = {
  demoAssetId: null,
  hookSource: null,
  hookText: null,
  id: null,
  influencerId: null,
  influencerVideoId: null,
  selectedHookId: null,
  sourceKind: null,
  trimEnd: null,
  trimStart: 0,
};

export const INITIAL_HOOK_VIDEO_FLOW_STATE: HookVideoFlowState = {
  draft: EMPTY_HOOK_VIDEO_DRAFT,
  stage: "browse",
};

export function beginHookVideoComposition(params: {
  hookText?: string;
  influencerId: string;
  influencerVideoId: string;
  selectedHookId?: string;
  sourceKind: HookVideoSourceKind;
  trimEnd?: number | null;
  trimStart?: number;
}): HookVideoFlowState {
  const hasTrendingHook = Boolean(
    params.hookText?.trim() && params.selectedHookId?.trim(),
  );

  return {
    draft: {
      ...EMPTY_HOOK_VIDEO_DRAFT,
      hookSource: hasTrendingHook ? "trending" : null,
      hookText: hasTrendingHook ? params.hookText!.trim() : null,
      influencerId: params.influencerId,
      influencerVideoId: params.influencerVideoId,
      selectedHookId: hasTrendingHook ? params.selectedHookId! : null,
      sourceKind: params.sourceKind,
      trimEnd: params.trimEnd ?? null,
      trimStart: params.trimStart ?? 0,
    },
    stage: "select_demo",
  };
}

export function selectHookVideoDemo(
  state: HookVideoFlowState,
  demoAssetId: string,
): HookVideoFlowState {
  if (!state.draft.influencerVideoId || !state.draft.influencerId) {
    return state;
  }

  return {
    draft: {
      ...state.draft,
      demoAssetId,
      ...(state.draft.hookSource === "trending"
        ? {}
        : {
            hookSource: null,
            hookText: null,
            selectedHookId: null,
          }),
    },
    stage:
      state.draft.hookSource === "trending" &&
      state.draft.hookText &&
      state.draft.selectedHookId
        ? "review"
        : "select_hook",
  };
}

export function selectHookVideoSuggestion(
  state: HookVideoFlowState,
  suggestion: { id: string; text: string },
): HookVideoFlowState {
  if (!state.draft.demoAssetId) {
    return state;
  }

  return {
    draft: {
      ...state.draft,
      hookSource: "composition",
      hookText: suggestion.text,
      selectedHookId: suggestion.id,
    },
    stage: "review",
  };
}

export function updateHookVideoTrim(
  state: HookVideoFlowState,
  trim: { trimEnd: number | null; trimStart: number },
): HookVideoFlowState {
  return {
    ...state,
    draft: {
      ...state.draft,
      trimEnd: trim.trimEnd,
      trimStart: trim.trimStart,
    },
  };
}

export function returnToHookVideoDemoSelection(
  state: HookVideoFlowState,
): HookVideoFlowState {
  const keepTrendingHook = state.draft.hookSource === "trending";

  return {
    draft: {
      ...state.draft,
      demoAssetId: null,
      ...(keepTrendingHook
        ? {}
        : {
            hookSource: null,
            hookText: null,
            selectedHookId: null,
          }),
    },
    stage: "select_demo",
  };
}

export function returnToHookSuggestionSelection(
  state: HookVideoFlowState,
): HookVideoFlowState {
  if (state.draft.hookSource === "trending") {
    return returnToHookVideoDemoSelection(state);
  }

  if (!state.draft.demoAssetId) {
    return returnToHookVideoDemoSelection(state);
  }

  return {
    draft: {
      ...state.draft,
      hookText: null,
      selectedHookId: null,
    },
    stage: "select_hook",
  };
}
