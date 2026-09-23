import { getCarouselHookTemplate, isCarouselHookTemplateId, type CarouselHookTemplateId } from "./carousel-hook-templates.ts";
import { getCarouselStructure2Format, type CarouselStructure2FormatId } from "./carousel-structure-2-formats.ts";

export type CarouselHookTemplateMode = "enabled" | "shadow" | "off";
export const STRUCTURE_2_HOOK_SELECTOR_VERSION = "structure-2-hook-templates-v1";

// Story compatibility is independent of Structure 1's educational grammar.
// Avoid list/formula promises that this six-beat product story cannot deliver.
export const STRUCTURE_2_HOOK_TEMPLATE_POOLS = {
  wrong_belief: ["advice_to_ignore", "approach_isnt_working", "the_real_reason"],
  perfect_plan_breaks: ["thing_holding_you_back", "approach_isnt_working", "the_real_reason"],
  stopped_behavior: ["stop_doing_this", "doing_it_wrong", "thing_holding_you_back"],
  terrible_at: ["stuck_read_this", "thing_holding_you_back", "approach_isnt_working"],
  result_without_sacrifice: ["cracked_the_code", "simple_switch_10x", "strategy_no_one_talks_about"],
  identity_transformation: ["cracked_the_code", "stop_doing_this", "thing_holding_you_back"],
  new_rule: ["try_this_first", "strategy_no_one_talks_about", "stop_doing_this"],
  wrong_villain: ["the_real_reason", "advice_to_ignore", "approach_isnt_working"],
} as const satisfies Record<CarouselStructure2FormatId, readonly CarouselHookTemplateId[]>;

export function resolveStructure2HookTemplate(params: {
  storyFormatId: CarouselStructure2FormatId;
  hookTemplateId?: string | null;
  hookTemplateVersion?: number | null;
}) {
  getCarouselStructure2Format(params.storyFormatId); // Required identity fails closed.
  const id = params.hookTemplateId;
  if (!id && params.hookTemplateVersion == null) return { template: null, reason: "not_assigned" } as const;
  if (!id || params.hookTemplateVersion == null) return { template: null, reason: "incomplete_assignment" } as const;
  if (!isCarouselHookTemplateId(id)) return { template: null, reason: "unknown_template" } as const;
  const template = getCarouselHookTemplate(id);
  if (template.version !== params.hookTemplateVersion) return { template: null, reason: "version_mismatch" } as const;
  if (!(STRUCTURE_2_HOOK_TEMPLATE_POOLS[params.storyFormatId] as readonly string[]).includes(id)) {
    return { template: null, reason: "format_mismatch" } as const;
  }
  return { template, reason: null } as const;
}

export function selectStructure2HookTemplates(params: {
  batchId: string;
  mode: CarouselHookTemplateMode;
  assignments: readonly { slotIndex: number; storyFormatId: CarouselStructure2FormatId }[];
  recentTemplateIds?: readonly string[];
}) {
  const selected = new Set<string>(params.recentTemplateIds ?? []);
  return [...params.assignments].sort((a, b) => a.slotIndex - b.slotIndex).map((assignment) => {
    getCarouselStructure2Format(assignment.storyFormatId);
    const pool = STRUCTURE_2_HOOK_TEMPLATE_POOLS[assignment.storyFormatId];
    const unused = pool.filter((id) => !selected.has(id));
    const eligible = unused.length ? unused : pool;
    let hash = 2166136261;
    for (const char of `${params.batchId}:${assignment.slotIndex}:${assignment.storyFormatId}`) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    }
    const proposed = params.mode === "off" ? null : getCarouselHookTemplate(eligible[(hash >>> 0) % eligible.length]!);
    if (proposed) selected.add(proposed.id);
    return {
      selector_version: STRUCTURE_2_HOOK_SELECTOR_VERSION,
      slot_index: assignment.slotIndex,
      story_format_id: assignment.storyFormatId,
      hook_template_id: params.mode === "enabled" ? proposed?.id ?? null : null,
      hook_template_version: params.mode === "enabled" ? proposed?.version ?? null : null,
      proposed_template_id: proposed?.id ?? null,
      reason: params.mode === "enabled" ? "selected" : params.mode,
    };
  });
}

export function structure2HookGuidance(params: Parameters<typeof resolveStructure2HookTemplate>[0]) {
  const { template } = resolveStructure2HookTemplate(params);
  if (!template) return "No optional hook template is assigned. Use the story format's native Slide 1 guidance.";
  return `Slide 1 only: adapt the hook pattern ${JSON.stringify(template.pattern)} to the supported topic and this story's reader payoff. This is structural guidance, not literal copy. Replace placeholders; shorten naturally to one 5-11 word hook that fits the fixed three-line cover. Remove unsupported numbers, time promises, personal results and performance claims; never fabricate proof. Do not promise a list or formula the story does not deliver. Keep Slides 2-6 and the selected story sequence unchanged. Do not flatten every pattern into an 'Are you' or 'Do you' question.`;
}
