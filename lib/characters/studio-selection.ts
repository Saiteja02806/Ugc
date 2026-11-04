import { z } from "zod";
import { findTraitById, getTraitsByCategory, SCRATCH_CHARACTER_FALLBACK, type TraitCategory, type InfluencerTrait } from "./influencer-registry.ts";
import { compileInfluencerPrompt } from "./master-prompt-compiler.ts";
import { validateStudioReferenceCapacity, studioReferenceOrderLine } from "./studio-references.ts";

const traitId = (category: TraitCategory) => z.string().trim().min(1).max(96).refine(
  id => getTraitsByCategory(category).some(trait => trait.id === id),
  `Choose an available ${category.replaceAll("_", " ")} option.`,
);
export const isUploadedStudioFace = (id: string) => /^upload_\d{1,20}$/.test(id);

export const InfluencerSelectionSchema = z.strictObject({
  characterTypeId: z.string().trim().min(1).max(96).refine(id =>
    isUploadedStudioFace(id) || id === SCRATCH_CHARACTER_FALLBACK.id ||
    getTraitsByCategory("character_type").some(trait => trait.id === id), "Choose an available character or upload a face photo."),
  backgroundId: traitId("background"),
  genderId: traitId("gender"),
  ethnicityId: traitId("ethnicity"),
  ageId: traitId("age"),
  skinToneId: traitId("skin_tone"),
  headShapeId: traitId("head_shape"),
  neckId: traitId("neck"),
  eyeShapeId: traitId("eyes"),
  eyeColorId: traitId("eye_color"),
  hairStyleId: traitId("hair_style"),
  hairColorId: traitId("hair_color"),
  outfitId: traitId("outfit"),
  outfitColorId: traitId("outfit_color"),
  heightId: traitId("height"),
  buildId: traitId("build"),
  accessoryIds: z.array(traitId("accessories")).max(10)
    .refine(ids => new Set(ids).size === ids.length, "Choose each accessory only once.")
    .refine(ids => !ids.includes("accessory_none"), "Use an empty accessory list for No accessories."),
  framing: z.enum(["full", "half"]),
});
export type InfluencerSelection = z.infer<typeof InfluencerSelectionSchema>;

export function characterIdentityInstructions(selection: InfluencerSelection) {
  const snippet = (id: string) => findTraitById(id)?.promptSnippet ?? "";
  return [
    "Preserve the primary identity photo's distinctive facial proportions, brows, nose, lips, jaw and facial hair, including its moustache when present. Do not average it with other people.",
    `Selected overrides take priority over the identity photo: ${snippet(selection.eyeColorId)}`,
    selection.headShapeId === "head_keep_existing" ? "Preserve the primary identity photo's head shape." : snippet(selection.headShapeId),
    `Apply only the selected eyelid shape and skin tone; preserve the primary face's other proportions, eye spacing, nose, lips and facial hair: ${snippet(selection.eyeShapeId)} ${snippet(selection.skinToneId)}`,
    selection.hairStyleId === "hair_keep_existing"
      ? `Preserve the primary identity photo's hairstyle. ${snippet(selection.hairColorId)}`
      : `Correct the scene hairstyle to the selected haircut reference, including its length, texture, silhouette and fringe; do not retain an incorrect scene hairstyle. ${snippet(selection.hairStyleId)} ${snippet(selection.hairColorId)}`,
    selection.accessoryIds.length
      ? `Apply and retain every selected accessory: ${selection.accessoryIds.map(snippet).join("; ")}. Use accessory references only for the selected objects, never their wearer's identity or hair. Remove every unselected accessory from the scene and identity photo.`
      : "Remove all accessories from the scene and identity photo. Both ears must remain bare with natural unpierced earlobes. No earrings, jewellery, glasses, headphones, headbands, hats or other accessories, even if present in the identity photo.",
  ].filter(Boolean).join("\n");
}

/** New face-only stage: all appearance choices remain frozen, without additional portrait references. */
export function characterFaceOnlyInstructions(selection: InfluencerSelection) {
  const snippet = (id: string) => findTraitById(id)?.promptSnippet ?? "";
  const label = (id: string) => findTraitById(id)?.label ?? id;
  const sceneFields = ["backgroundId", "genderId", "ethnicityId", "ageId", "neckId", "hairStyleId", "hairColorId", "outfitId", "outfitColorId", "heightId", "buildId"] as const;
  return [
    "Preserve the primary identity photo's distinctive facial proportions, brows, nose, lips, jaw and facial hair, including its moustache when present. Do not average it with other people.",
    `Selected facial overrides take priority over the identity photo: ${snippet(selection.eyeColorId)}`,
    selection.headShapeId === "head_keep_existing" ? "Preserve the primary identity photo's head shape." : snippet(selection.headShapeId),
    `Apply only the selected eyelid shape and skin tone; preserve the primary face's other proportions, eye spacing, nose, lips and facial hair: ${snippet(selection.eyeShapeId)} ${snippet(selection.skinToneId)}`,
    `Preserve the appearance established in Image 1. Selected scene settings: ${sceneFields.map(field => `${field}: ${label(selection[field])}`).join("; ")}; framing: ${selection.framing}. These scene settings do not supply another person's facial identity.`,
    "Keep Image 1's hairstyle and hair color; the primary image supplies facial identity, not a replacement haircut.",
    selection.accessoryIds.length
      ? `Preserve the selected accessories in Image 1: ${selection.accessoryIds.map(snippet).join("; ")}. Do not introduce accessories from the primary identity photo or remove selected objects while correcting the face.`
      : "Keep the scene free of accessories. Both ears must remain bare with natural unpierced earlobes. No earrings, jewellery, glasses, headphones, headbands, hats or other accessories, even if present in the primary identity photo.",
  ].filter(Boolean).join("\n");
}

/** Merge into the actual model prompt; providers need no unsupported negative_prompt field. */
export function appendCharacterNegativePrompt(prompt: string, negativePrompt?: string) {
  const negative = negativePrompt?.trim();
  if (!negative) return prompt;
  const line = `Negative constraints: Avoid ${negative}.`;
  return prompt.split("\n").includes(line) ? prompt : `${prompt}\n${line}`;
}

/** The validated selections, rather than client-authored prose, control studio generation. */
export function compileStudioSelection(selection: InfluencerSelection, extraNegativePrompt?: string) {
  const uploaded = isUploadedStudioFace(selection.characterTypeId);
  const customTraits: InfluencerTrait[] = uploaded ? [{
    id: selection.characterTypeId, category: "character_type", label: "Uploaded face", isCustomUpload: true,
    promptSnippet: "custom uploaded face likeness with the facial bone structure, facial identity, and authentic skin texture of the uploaded face photo",
  }] : [];
  const compiled = compileInfluencerPrompt(selection, customTraits);
  const capacity = validateStudioReferenceCapacity(selection, customTraits, uploaded);
  const labels = [...(uploaded ? ["uploaded face"] : []), ...capacity.references.map(reference => reference.role)];
  const extra = extraNegativePrompt?.trim();
  const negativePrompt = extra && extra !== compiled.negativePrompt
    ? `${compiled.negativePrompt}, ${extra}` : compiled.negativePrompt;
  const positivePrompt = `${compiled.prompt}${studioReferenceOrderLine(labels, selection.framing)}`;
  return { ...capacity, uploaded, positivePrompt, negativePrompt,
    prompt: appendCharacterNegativePrompt(positivePrompt, negativePrompt) };
}
