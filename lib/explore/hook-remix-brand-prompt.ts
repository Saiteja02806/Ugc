import type { ReferenceText } from "./reference-text";
import { HOOK_SOURCE_RELATIVE_REMIX_INSTRUCTIONS, HOOK_SOURCE_RELATIVE_REMIX_VERSION, hookRemixBlockBudgets } from "../../worker/src/lib/hook-remix-source-relative.ts";

export const HOOK_BRAND_REMIX_PROMPT_VERSION = HOOK_SOURCE_RELATIVE_REMIX_VERSION;
export const HOOK_BRAND_REMIX_SYSTEM_PROMPT = HOOK_SOURCE_RELATIVE_REMIX_INSTRUCTIONS;

export function hookBrandRemixSystemPrompt(source: ReferenceText, businessContext?: unknown) {
  if (source.format !== "hook") throw new Error("Source-relative adaptation requires Hook text.");
  const budgets = hookRemixBlockBudgets(source, businessContext);
  const safetyLimit = Math.max(80, Math.ceil(source.blocks.reduce((sum, block) => sum + block.text.length, 0) * 1.3));
  return `${HOOK_BRAND_REMIX_SYSTEM_PROMPT}\nThis request: ${source.blocks.length} ordered nonempty block(s); at most 600 characters per block and ${Math.min(safetyLimit, budgets.reduce((sum, value) => sum + value, 0))} characters total. Per-block character budgets: ${budgets.join(", ")}. Counts include spaces, punctuation and newlines. These are ceilings, not targets. A longer exact named-brand replacement may use its explicit allowance; otherwise do not expand the source. Source word counts: ${source.blocks.map(block => block.text.trim().split(/\s+/u).length).join(", ")}. Keep useful source line breaks; rendered wrapping is checked separately.`;
}
