import type { HookVideoSourceKind } from "@/lib/trending/hook-video-types";

export type HookVideoFlowStage =
  | "browse"
  | "select_demo"
  | "select_hook"
  | "review";

export type HookVideoDraft = {
  demoAssetId: string | null;
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
  influencerId: string;
  influencerVideoId: string;
  sourceKind: HookVideoSourceKind;
  trimEnd?: number | null;
  trimStart?: number;
}): HookVideoFlowState {
  return {
    draft: {
      ...EMPTY_HOOK_VIDEO_DRAFT,
      influencerId: params.influencerId,
      influencerVideoId: params.influencerVideoId,
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
      hookText: null,
      selectedHookId: null,
    },
    stage: "select_hook",
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
  return {
    draft: {
      ...state.draft,
      demoAssetId: null,
      hookText: null,
      selectedHookId: null,
    },
    stage: "select_demo",
  };
}

export function returnToHookSuggestionSelection(
  state: HookVideoFlowState,
): HookVideoFlowState {
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
