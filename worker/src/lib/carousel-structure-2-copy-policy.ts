/** Opt-in copy policy. Existing callers keep the legacy story contract. */
export const CAROUSEL_STRUCTURE_2_READER_SCENARIO_VERSION = "structure-2-reader-scenario-v1";
export type CarouselStructure2CopyPolicy = {
  version: typeof CAROUSEL_STRUCTURE_2_READER_SCENARIO_VERSION;
};

export function isStructure2ReaderScenario(policy?: CarouselStructure2CopyPolicy) {
  if (policy === undefined) return false;
  if (!policy || policy.version !== CAROUSEL_STRUCTURE_2_READER_SCENARIO_VERSION) {
    throw new Error("Unsupported Structure 2 copy policy version.");
  }
  return true;
}

const READER_SCENARIO_GUIDANCE =
  "Copy policy: structure-2-reader-scenario-v1. No verified personal experience or customer story is supplied for this policy. All six visible slides, including the cover and headings, use direct reader scenarios or impersonal observations. Do not use I, me, my, mine, we, us, our or ours in storyText or headline. Do not invent a narrator, completed customer experience, observed result or testimonial. Slide 4 introduces one supported product interaction. Slide 5 explains a conditional example or a limitation of that interaction; it does not assert proof or a personal result. Slide 6 delivers a useful practical takeaway with an optional separate CTA. Keep the assigned six roles, word counts, layout limits and product timing. A source feature does not establish improved engagement, sales, health, accuracy or any other outcome. visualContext describes a plausible scenario, not evidence that it happened. These voice rules also apply to optional hook examples and every repair.";

function readerScenarioText(value: string) {
  return value
    .replace(/First-person hooks are welcome,[^.]*only when the deck actually delivers five ways\./g,
      "Reader-scenario hooks describe the audience's situation without inventing a personal experience. A list hook is appropriate only when the deck delivers the promised list.")
    .replaceAll('"i kept making content without a clear plan"', '"your content needs a clear idea before writing"')
    .replaceAll("A short first-person open loop such as 'I thought...' or 'I used to...' is welcome.", "Use a direct reader situation or impersonal statement without inventing a personal experience.")
    .replaceAll("only Slide 1 may lead with direct reader wording", "all six slides may use direct reader wording")
    .replaceAll("Only Slide 1 may lead with direct reader wording", "All six slides may use direct reader wording")
    .replaceAll("Slide 1 may use first-person or direct reader wording", "Slide 1 uses direct reader wording or impersonal observations")
    .replaceAll("I/me/my", "you/your or impersonal observations")
    .replaceAll("(I, me, or my)", "(you, your, or impersonal observations)")
    .replaceAll("first-person", "reader-scenario")
    .replaceAll("modest proof or result", "conditional demonstration or limitation")
    .replaceAll("Give a modest, supportable proof or result that follows from the mechanism.", "Give a conditional example or limitation of the supported mechanism.")
    .replaceAll("Give modest proof", "Give a conditional example");
}

export function applyStructure2CopyPolicyMessages<T extends { content: string }>(
  messages: T[], policy?: CarouselStructure2CopyPolicy,
): T[] {
  if (!isStructure2ReaderScenario(policy)) return messages;
  return messages.map((message) => ({
    ...message,
    // Business context, original plans and history are JSON data lines. Never
    // rewrite them while adapting generated instructions to the new voice.
    content: `${message.content.split("\n").map((line) =>
      /^[\s]*[\[{]/.test(line) ? line : readerScenarioText(line),
    ).join("\n")}\n${READER_SCENARIO_GUIDANCE}`,
  }));
}

export function getStructure2CopyInstruction(value: string, policy?: CarouselStructure2CopyPolicy) {
  return isStructure2ReaderScenario(policy) ? readerScenarioText(value).replaceAll("narrator", "reader") : value;
}

/** Change descriptive guidance only, preserving the existing JSON interface. */
export function applyStructure2CopyPolicySchema<T>(schema: T, policy?: CarouselStructure2CopyPolicy): T {
  if (!isStructure2ReaderScenario(policy)) return schema;
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key, key === "description" && typeof child === "string"
        ? `${readerScenarioText(child)} Use reader scenarios or impersonal observations; no invented personal experience.`
        : visit(child),
    ]));
  }
  return visit(schema) as T;
}

export function hasStructure2PersonalStoryVoice(value: string) {
  return /\b(?:i|me|my|mine|we|us|our|ours)\b/i.test(value);
}
