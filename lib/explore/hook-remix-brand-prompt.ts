import type { ReferenceText } from "./reference-text";
import { HOOK_SOURCE_RELATIVE_REMIX_INSTRUCTIONS, HOOK_SOURCE_RELATIVE_REMIX_VERSION, hookRemixBlockBudgets } from "../../worker/src/lib/hook-remix-source-relative.ts";
import { explicitNamedToolSlots } from "./hook-remix-quality.ts";

export const HOOK_BRAND_REMIX_PROMPT_VERSION = HOOK_SOURCE_RELATIVE_REMIX_VERSION;
export const HOOK_BRAND_REMIX_SYSTEM_PROMPT = HOOK_SOURCE_RELATIVE_REMIX_INSTRUCTIONS;

export function hookBrandRemixSystemPrompt(source: ReferenceText, businessContext?: unknown) {
  if (source.format !== "hook") throw new Error("Source-relative adaptation requires Hook text.");
  const budgets = hookRemixBlockBudgets(source, businessContext);
  const draftingTargets = budgets.map(budget => Math.max(1, Math.floor(budget * 0.9)));
  const context = businessContext && typeof businessContext === "object" ? businessContext as Record<string, unknown> : {};
  const name = typeof context.businessName === "string" ? context.businessName.trim() : "";
  const tools = explicitNamedToolSlots(source);
  const candidates = name && tools.length ? source.blocks.map(block => {
    let text = block.text;
    for (const tool of tools) text = text.replaceAll(tool, () => name);
    return text;
  }) : null;
  const replacementGuide = candidates
    ? `\nLiteral named-tool substitution candidate: ${JSON.stringify(candidates)}. This candidate preserves source wording and line breaks. When the task fits the supplied product and the rest is truthful, use these exact blocks, subject to the user's explicit preferences. Do not paraphrase a truthful candidate into understanding formats, discovering content, or a product category. A POV about understanding how to use software is a fictional user situation, not a claim that the product provides lessons. If the candidate transfers any unsupported usage history or result, reject the candidate and ADAPT that claim instead. An explicit no-brand or other user instruction takes priority.`
    : "";
  const safetyLimit = Math.max(80, Math.ceil(source.blocks.reduce((sum, block) => sum + block.text.length, 0) * 1.3));
  return `${HOOK_BRAND_REMIX_SYSTEM_PROMPT}\nThis request: ${source.blocks.length} ordered nonempty block(s); at most 600 characters per block and ${Math.min(safetyLimit, budgets.reduce((sum, value) => sum + value, 0))} characters total. Per-block character budgets: ${budgets.join(", ")}. For ADAPT only, shorter drafting targets: ${draftingTargets.join(", ")} characters. Counts include spaces, punctuation and newlines. These are ceilings, not targets. A longer exact named-brand replacement may use its explicit allowance; otherwise do not expand the source. Source word counts: ${source.blocks.map(block => block.text.trim().split(/\s+/u).length).join(", ")}. Keep useful source line breaks; rendered wrapping is checked separately.${replacementGuide}`;
}
