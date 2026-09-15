import "server-only";

export const DEFAULT_BUSINESS_CONTEXT_MODEL = "gpt-5.6-luna";
export const DEFAULT_BUSINESS_CONTEXT_REASONING_EFFORT = "medium" as const;

type BusinessContextReasoningEffort = "low" | "medium" | "high";

/**
 * Business-context analysis is deliberately configured separately from any
 * creative writer. That prevents a performance-copy model override from
 * silently changing the facts used by every future format.
 */
export function getBusinessContextModelRequest() {
  const model = process.env.OPENAI_BUSINESS_CONTEXT_MODEL?.trim() ||
    DEFAULT_BUSINESS_CONTEXT_MODEL;
  const configuredEffort = process.env.OPENAI_BUSINESS_CONTEXT_REASONING_EFFORT
    ?.trim()
    .toLowerCase();
  const reasoningEffort: BusinessContextReasoningEffort =
    configuredEffort === "low" || configuredEffort === "medium" || configuredEffort === "high"
      ? configuredEffort
      : DEFAULT_BUSINESS_CONTEXT_REASONING_EFFORT;

  // GPT-5.6 Luna is a reasoning model. Older explicit model overrides retain
  // the legacy temperature setting rather than receiving an unsupported field.
  if (/^gpt-5(?:\.6)?(?:-|$)/iu.test(model)) {
    return { model, reasoning_effort: reasoningEffort } as const;
  }

  return { model, temperature: 0.2 } as const;
}
