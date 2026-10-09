export const CHARACTER_IMAGE_MODELS = [
  "gpt_image", "gpt_image_2_5", "gemini_3_pro", "nano_banana_2", "seedream_5_pro",
] as const;

const labels: Record<(typeof CHARACTER_IMAGE_MODELS)[number], string> = {
  gpt_image: "ChatGPT Image",
  gpt_image_2_5: "ChatGPT Image 2.5 Sunburst",
  gemini_3_pro: "Gemini 3 Pro",
  nano_banana_2: "Nano Banana 2.1",
  seedream_5_pro: "Seedream 5.0 Pro",
};

export const CHARACTER_IMAGE_MODEL_OPTIONS = CHARACTER_IMAGE_MODELS.map(value => ({ value, label: labels[value] }));
export const MAX_CHARACTER_PROMPT_LENGTH = 32_000;

export function getCharacterPromptLimit(model: (typeof CHARACTER_IMAGE_MODELS)[number]) {
  return model === "seedream_5_pro" ? 4_000 : MAX_CHARACTER_PROMPT_LENGTH;
}
