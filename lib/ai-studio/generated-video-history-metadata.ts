export type GeneratedVideoHistoryMetadata = {
  model?: "google_omni" | "seedance_2_5" | "wan_3_0";
  prompt?: string;
  resolution?: "480p" | "720p" | "1080p";
  workflow?: "talking_head" | "hook" | "wall_text" | "phone";
};

export function getGeneratedVideoHistoryMetadata(
  value: unknown,
): GeneratedVideoHistoryMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const model = input.model;
  const prompt = input.hookIdea;
  const resolution = input.resolution;

  let workflow: GeneratedVideoHistoryMetadata["workflow"];
  if (input.workflow === "talking_head" || input.workflow === "hook" || input.workflow === "wall_text" || input.workflow === "phone") {
    workflow = input.workflow;
  } else if ((input.startingFrameReceipt as Record<string, unknown> | undefined)?.workflow === "talking_head") {
    workflow = "talking_head";
  } else if (typeof input.referenceId === "string" && (input.referenceId.startsWith("talking-") || input.referenceId.includes("talking"))) {
    workflow = "talking_head";
  } else if (input.workflowKind === "phone") {
    workflow = "phone";
  } else if (input.exploreFormat === "wall_text" || (input.startingFrameReceipt as Record<string, unknown> | undefined)?.workflow === "wall_text") {
    workflow = "wall_text";
  } else if (input.exploreFormat === "hook" || (input.startingFrameReceipt as Record<string, unknown> | undefined)?.workflow === "hook" || (typeof input.referenceId === "string" && (input.referenceId.startsWith("HV_") || input.referenceId.startsWith("hook-")))) {
    workflow = "hook";
  }

  return {
    ...(model === "google_omni" || model === "seedance_2_5" || model === "wan_3_0" ? { model } : {}),
    ...(typeof prompt === "string" && prompt.trim()
      ? { prompt: prompt.trim() }
      : {}),
    ...(resolution === "480p" || resolution === "720p" || resolution === "1080p"
      ? { resolution }
      : {}),
    ...(workflow ? { workflow } : {}),
  };
}
