import { assertProviderOperationCanContinue, ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { DEFAULT_HOOK_VIDEO_PROVIDER, type HookVideoProvider } from "./ugc-video-prompt.js";

export function resolveHookVideoProvider(input: {
  model?: "seedance_2_5" | "google_omni" | "kling_3_0" | "wan_3_0";
  provider?: HookVideoProvider;
}, legacyOperation: { provider_operation_id: string | null; status: string } | null) {
  if (input.model === "kling_3_0") return "runway" as const;
  if (input.model === "wan_3_0") {
    if (input.provider && input.provider !== "openrouter") {
      throw new ProviderRequestNotSubmittedError("WAN 3.0 requires OpenRouter.");
    }
    return "openrouter" as const;
  }
  if (legacyOperation) {
    // A paid or uncertain legacy operation cannot become a fresh Runway task.
    assertProviderOperationCanContinue({ operation: legacyOperation, shouldSubmit: false });
    return "higgsfield" as const;
  }
  if (input.provider === "openrouter") {
    if (input.model !== "seedance_2_5") {
      throw new ProviderRequestNotSubmittedError("OpenRouter video generation requires Seedance 2.5.");
    }
    return "openrouter" as const;
  }
  if (input.model === "seedance_2_5") return "runway" as const;
  if (input.model === "google_omni") return "gemini" as const;
  if (input.provider === "higgsfield") {
    throw new ProviderRequestNotSubmittedError("Higgsfield no longer accepts new generations. Select Runway Seedance 2.5.");
  }
  return input.provider ?? DEFAULT_HOOK_VIDEO_PROVIDER;
}
