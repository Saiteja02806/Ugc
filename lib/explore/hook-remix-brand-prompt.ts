import type { ReferenceText } from "./reference-text";
import { HOOK_ROLE_REMIX_SYSTEM_PROMPT } from "./hook-remix-role-prompt";

/** V8 clarifies named-tool replacement; approved v7 stays reproducible. */
export const HOOK_BRAND_REMIX_PROMPT_VERSION = 8;
export const HOOK_BRAND_REMIX_SYSTEM_PROMPT = `${HOOK_ROLE_REMIX_SYSTEM_PROMPT}

Named tools: when the source explicitly names a product, app, AI tool, website or company as the thing being used, replace that name with businessContext.businessName, using its exact spelling, if the supplied product truthfully fits the task. Replacing an existing product name is a necessary source edit, not an extra promotional brand insertion. Do not replace a specific named tool with a vague category such as "a marketing app", "an app" or "a tool" when the business name is supplied and appropriate. Preserve the surrounding sentence and its use case; do not repeat the category as a substitute for the name. If the original task does not fit the supplied business facts, adapt that task minimally without inventing capabilities. Honor an explicit user request to omit brand names. This rule does not add branding to otherwise suitable generic hooks or change a human character into a product.`;

export function hookBrandRemixSystemPrompt(source: ReferenceText) {
  if (source.format !== "hook") throw new Error("Named-tool Hook adaptation requires Hook text.");
  const maxCharacters = Math.max(80, Math.ceil(source.blocks.reduce((sum, block) => sum + block.text.length, 0) * 1.3));
  return `${HOOK_BRAND_REMIX_SYSTEM_PROMPT}\n\nReturn exactly ${source.blocks.length} nonempty block(s), at most 600 characters each and ${maxCharacters} characters total across all block text, including spaces, newlines and emojis.`;
}
