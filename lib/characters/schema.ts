import { z } from "zod";

export const CHARACTER_SOURCE = "ugc-pilot-characters";
export const CHARACTER_VERSION = 2;
export const MAX_CHARACTER_PROMPT_LENGTH = 32_000;
export const CHARACTER_CANDIDATE_COUNT = 3;
export const CharacterImageCountSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const CharacterGenderSchema = z.enum(["male", "female"]);
export const CharacterImageModelSchema = z.enum(["gpt_image", "gemini_3_pro", "nano_banana_2"]);

export const CharacterGenerateRequestSchema = z.strictObject({
  mode: z.literal("custom"),
  model: CharacterImageModelSchema,
  imageCount: CharacterImageCountSchema.optional(),
  prompt: z.string().trim().min(1, "Describe your influencer before generating.").max(MAX_CHARACTER_PROMPT_LENGTH, "Your description is too long to send. Please shorten it."),
  referenceCharacterId: z.uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
});

const visualDetail = z.string().trim().min(1).max(120);

/** Historical v1 identity metadata only; never used to rewrite new prompts. */
export const CharacterSpecSchema = z.strictObject({
  creatorType: visualDetail,
  gender: CharacterGenderSchema,
  age: z.number().int().min(21).max(80),
  appearance: visualDetail,
  wardrobe: visualDetail,
  environment: visualDetail,
  expression: visualDetail,
  framing: visualDetail,
  lighting: visualDetail,
});

export type CharacterSpec = z.infer<typeof CharacterSpecSchema>;
export type CharacterGenerateRequest = z.infer<typeof CharacterGenerateRequestSchema>;
