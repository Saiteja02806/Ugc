import type { HookKeyframePreviewRuntime } from "@/components/explore/hook-starting-frame-workspace";
import { readVerifiedHookStartingFrame } from "./hook-starting-frame-client";

/** Separate from authenticated drafts; this identity can never submit work. */
export const LOCAL_HOOK_PREVIEW_OWNER_ID = "local-hook-source-preview-v2";

/** Real frame extraction only. Anonymous preview cannot simulate a paid result. */
export function createLocalHookStartingFramePreviewRuntime(): HookKeyframePreviewRuntime {
  const signIn = "Sign in to use your saved influencer photos and generate starting images.";
  return {
    generationDisabledReason: "Local preview shows the actual first frame. Sign in to generate starting images; no generation has been submitted.",
    loadSource: async ({ scope, signal }) => {
      const response = await fetch(`/e2e/hook-keyframe-preview/source?referenceId=${encodeURIComponent(scope.referenceId)}`, { cache: "no-store", signal });
      return readVerifiedHookStartingFrame(response, scope);
    },
    loadInfluencers: async () => { throw new Error(signIn); },
    resolvePhoto: async () => { throw new Error("Local photos are temporary. Choose them again, or sign in to restore saved photos."); },
    read: async () => { throw new Error(signIn); },
    submit: async () => { throw new Error(signIn); },
  };
}
