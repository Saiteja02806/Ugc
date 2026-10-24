import type { ReferenceText } from "./reference-text";
import { HOOK_MINIMAL_REMIX_SYSTEM_PROMPT } from "./hook-remix-minimal-prompt";

/** User-approved Hook v7; non-Hook formats retain their existing prompt. */
export const HOOK_ROLE_REMIX_PROMPT_VERSION = 7;

// V6 explicitly allowed the product to replace a person. Replace that permission,
// keeping the rest of the minimal-edit brief intact.
export const HOOK_ROLE_REMIX_SYSTEM_PROMPT = HOOK_MINIMAL_REMIX_SYSTEM_PROMPT.replace(
  "In an obviously playful setup, the product can take a person's place.",
  "Keep the noun's role sensible: a person stays a person, and an app stays an app. When a dating or marriage joke names a person, change only their profession or human descriptor to fit the product's field. For a marketing product, IT guy can become marketing guy. Do not put a SaaS, app, tool, product or company into that person's place. Keep the original relationship, viewpoint and tone.",
);

export function hookRoleRemixSystemPrompt(source: ReferenceText) {
  if (source.format !== "hook") throw new Error("The role-preserving candidate is only for Hook text.");
  const maxCharacters = Math.max(80, Math.ceil(source.blocks.reduce((sum, block) => sum + block.text.length, 0) * 1.3));
  return `${HOOK_ROLE_REMIX_SYSTEM_PROMPT}\n\nReturn exactly ${source.blocks.length} nonempty block(s), at most 600 characters each and ${maxCharacters} characters total across all block text, including spaces, newlines and emojis.`;
}
