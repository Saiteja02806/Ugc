/** A layout preview is always non-spending, even when development generation is enabled. */
export function getWorkflowGenerationMode(input: {
  environment: string | undefined;
  generationEnabled: string | undefined;
  preview: unknown;
  mode: unknown;
}): "hidden" | "preview" | "generation" {
  if (input.preview === "1") return "preview";
  return input.generationEnabled === "true" ? "generation" : "preview";
}
