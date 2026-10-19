import { assertProviderOperationCanContinue, ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { DEFAULT_HOOK_VIDEO_PROVIDER, type HookVideoProvider } from "./ugc-video-prompt.js";

export function resolveHookVideoProvider(input: {
  model?: "seedance_2_5" | "google_omni" | "kling_3_0" | "wan_3_0";
  provider?: HookVideoProvider;
}, legacyOperation: { provider_operation_id: string | null; status: string } | null) {
  if (input.provider === "reapi") {
    if (input.model !== "seedance_2_5" && input.model !== "wan_3_0") {
      throw new ProviderRequestNotSubmittedError("ReAPI video generation requires Seedance 2.5 or WAN 3.0.");
    }
    // Newly admitted ReAPI jobs must never migrate an existing paid operation.
    if (legacyOperation) {
      assertProviderOperationCanContinue({ operation: legacyOperation, shouldSubmit: false });
      return "higgsfield" as const;
    }
    return "reapi" as const;
  }
  if (input.model === "kling_3_0") return "runway" as const;
  if (input.model === "wan_3_0") {
    if (input.provider && input.provider !== "openrouter" && input.provider !== "runway") {
      throw new ProviderRequestNotSubmittedError("The selected WAN 3.0 generation route is unavailable.");
    }
    // New requests are explicitly frozen to ReAPI at admission. Older jobs
    // retain their recorded route so recovery cannot create a second job.
    return input.provider ?? "openrouter" as const;
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
