import { z } from "zod";
import { InfluencerSelectionSchema, compileStudioSelection, appendCharacterNegativePrompt } from "./studio-selection.ts";
export { InfluencerSelectionSchema, type InfluencerSelection } from "./studio-selection.ts";
import { CHARACTER_IMAGE_MODELS, getCharacterPromptLimit, MAX_CHARACTER_PROMPT_LENGTH, MAX_CHARACTER_REFERENCES } from "./image-models.ts";
import { CHARACTER_PROMPT_SKILLS, composeCharacterPrompt, resolveCharacterPromptSkills } from "./prompt-skills.ts";

export { MAX_CHARACTER_PROMPT_LENGTH } from "./image-models.ts";

export const CHARACTER_SOURCE = "ugc-pilot-characters";
export const CHARACTER_VERSION = 2;
export const CHARACTER_CANDIDATE_COUNT = 3;
export const CharacterImageCountSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const CharacterGenderSchema = z.enum(["male", "female"]);
export const CharacterImageModelSchema = z.enum(CHARACTER_IMAGE_MODELS);
export const PortraitFramingSchema = z.enum(["full", "half"]);

export const CharacterGenerateRequestSchema = z.strictObject({
  mode: z.literal("custom"),
  model: CharacterImageModelSchema,
  imageCount: CharacterImageCountSchema.optional(),
  skillIds: z.array(z.string().min(1).max(80)).max(20).refine(ids => new Set(ids).size === ids.length, "Choose each skill only once.").optional(),
  prompt: z.string().trim().min(1, "Describe your influencer before generating.").max(MAX_CHARACTER_PROMPT_LENGTH, "Your description is too long to send. Please shorten it."),
  negativePrompt: z.string().trim().max(4_000).optional(),
  selection: InfluencerSelectionSchema.optional(),
  referenceCharacterId: z.uuid().optional(),
  referenceCharacterIds: z.array(z.uuid()).min(1).max(MAX_CHARACTER_REFERENCES).refine((ids) => new Set(ids).size === ids.length, "Choose each reference image only once.").optional(),
  referenceImageAssetId: z.uuid().optional(),
  referenceImageAssetIds: z.array(z.uuid()).min(1).max(MAX_CHARACTER_REFERENCES).refine((ids) => new Set(ids).size === ids.length, "Choose each reference image only once.").optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
}).superRefine((request, context) => {
  if (request.skillIds?.some(id => !CHARACTER_PROMPT_SKILLS.some(skill => skill.id === id))) {
    context.addIssue({ code: "custom", path: ["skillIds"], message: "Choose an available skill before generating." });
    return;
  }
  const studio = request.selection ? compileStudioSelection(request.selection, request.negativePrompt) : null;
  if (studio && !studio.valid) {
    context.addIssue({ code: "custom", path: ["selection"], message: `Choose up to ${studio.limit} reference looks; remove ${studio.excess} accessory or trait selections.` });
  }
  const fullPrompt = composeCharacterPrompt(studio?.prompt ?? appendCharacterNegativePrompt(request.prompt, request.negativePrompt), resolveCharacterPromptSkills(request.skillIds));
  if (fullPrompt.length > getCharacterPromptLimit(request.model)) {
    context.addIssue({ code: "custom", path: ["prompt"], message: `Your description, restrictions and selected skills exceed this model's ${getCharacterPromptLimit(request.model).toLocaleString("en-US")} characters. Shorten the description or remove a skill.` });
  }
  if (request.referenceCharacterId && request.referenceCharacterIds || request.referenceImageAssetId && request.referenceImageAssetIds) {
    context.addIssue({ code: "custom", path: ["referenceImageAssetIds"], message: "Use one image list for each reference source." });
  }
  const savedIds = request.referenceCharacterIds ?? (request.referenceCharacterId ? [request.referenceCharacterId] : []);
  const uploadedIds = request.referenceImageAssetIds ?? (request.referenceImageAssetId ? [request.referenceImageAssetId] : []);
  const ids = [...savedIds, ...uploadedIds];
  if (ids.length > MAX_CHARACTER_REFERENCES || new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["referenceImageAssetIds"], message: `Choose up to ${MAX_CHARACTER_REFERENCES} different reference images in total.` });
  }
  if (request.model === "seedream_5_pro" && request.prompt.length > getCharacterPromptLimit(request.model)) {
    context.addIssue({ code: "custom", path: ["prompt"], message: "Seedream 5.0 Pro supports descriptions up to 4,000 characters. Shorten your description before generating." });
  }
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
