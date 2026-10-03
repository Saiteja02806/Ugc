import { z } from "zod";

export const CHARACTER_SOURCE = "ugc-pilot-characters";
export const CHARACTER_VERSION = 1;
export const CHARACTER_CANDIDATE_COUNT = 3;

export const CharacterGenderSchema = z.enum(["male", "female"]);
export const CharacterImageModelSchema = z.enum(["gpt_image", "nano_banana_2"]);

export const CharacterGenerateRequestSchema = z.strictObject({
  mode: z.enum(["assisted", "custom"]),
  gender: CharacterGenderSchema.optional(),
  model: CharacterImageModelSchema,
  prompt: z.string().trim().min(1).optional(),
  referenceCharacterId: z.uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
}).superRefine((request, context) => {
  if (request.mode === "assisted" && !request.gender) {
    context.addIssue({ code: "custom", path: ["gender"], message: "Choose male or female before generating." });
  }
  if (request.mode === "assisted" && request.prompt) {
    context.addIssue({ code: "custom", path: ["prompt"], message: "Use custom mode to describe your own influencer." });
  }
  if (request.mode === "custom" && !request.prompt) {
    context.addIssue({ code: "custom", path: ["prompt"], message: "Describe your influencer before generating." });
  }
  if (request.mode === "assisted" && request.referenceCharacterId) {
    context.addIssue({ code: "custom", path: ["referenceCharacterId"], message: "Use the prompt to refine a saved influencer." });
  }
});

const visualDetail = z.string().trim().min(1).max(120);

/** Only the planner supplies this schema. It never comes from the browser. */
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

export const CharacterPlanSchema = z.strictObject({
  schemaVersion: z.literal(CHARACTER_VERSION),
  creativeBrief: z.string().trim().min(1).max(400),
  candidates: z.array(CharacterSpecSchema).length(CHARACTER_CANDIDATE_COUNT),
});

export type CharacterSpec = z.infer<typeof CharacterSpecSchema>;
export type CharacterPlan = z.infer<typeof CharacterPlanSchema>;
export type CharacterGenerateRequest = z.infer<typeof CharacterGenerateRequestSchema>;
