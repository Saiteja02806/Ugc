import {
  findTraitById,
  type InfluencerSelectionState,
  type InfluencerTrait,
  DEFAULT_INFLUENCER_SELECTION,
} from "./influencer-registry.ts";

export interface CompiledInfluencerPayload {
  prompt: string;
  negativePrompt: string;
  referenceImagePath?: string;
  displayPills: { category: string; label: string }[];
}

const REALISM_ENGINE_TOKENS =
  "Authentic unretouched human skin texture, natural dermal micro-pores, balanced matte skin finish, completely eliminate artificial plastic shine, fine facial peach fuzz, hyper-realistic 8k raw photo, authentic optical depth of field from a 35mm f/2.0 camera lens.";

const SHARED_NEGATIVE_PROMPT =
  "floating head, plastic skin, oily face glare, synthetic shine, airbrushed porcelain smoothness, uncanny valley, CGI 3D render, cartoon, doll, distorted anatomy, warped fingers, extra limbs, bad eyes, blurry, low resolution, oversaturated lighting, visible studio softbox lights, photography umbrellas, camera tripods";
const FULL_NEGATIVE_PROMPT =
  `cropped, cut off, headshot, close up, partial body, missing legs, missing feet, out of frame, ${SHARED_NEGATIVE_PROMPT}`;
const HALF_NEGATIVE_PROMPT =
  `face-only close-up, missing head, cut off at the neck, ${SHARED_NEGATIVE_PROMPT}`;

export function compileInfluencerPrompt(
  selection: InfluencerSelectionState = DEFAULT_INFLUENCER_SELECTION,
  customTraits: readonly InfluencerTrait[] = []
): CompiledInfluencerPayload {
  const charType = findTraitById(selection.characterTypeId, customTraits);
  const background = selection.backgroundId ? findTraitById(selection.backgroundId, customTraits) : undefined;
  const gender = findTraitById(selection.genderId, customTraits);
  const ethnicity = findTraitById(selection.ethnicityId, customTraits);
  const age = findTraitById(selection.ageId, customTraits);
  const skinTone = findTraitById(selection.skinToneId, customTraits);
  const headShape = findTraitById(selection.headShapeId, customTraits);
  const neck = findTraitById(selection.neckId, customTraits);
  const eyeShape = findTraitById(selection.eyeShapeId, customTraits);
  const eyeColor = findTraitById(selection.eyeColorId, customTraits);
  const hairStyle = findTraitById(selection.hairStyleId, customTraits);
  const hairColor = findTraitById(selection.hairColorId, customTraits);
  const outfit = findTraitById(selection.outfitId, customTraits);
  const outfitColor = findTraitById(selection.outfitColorId, customTraits);
  const height = findTraitById(selection.heightId, customTraits);
  const build = findTraitById(selection.buildId, customTraits);
  const accessories = selection.accessoryIds
    .map((id) => findTraitById(id, customTraits))
    .filter((trait): trait is NonNullable<typeof trait> => Boolean(trait));

  const displayPills: { category: string; label: string }[] = [];

  if (charType) displayPills.push({ category: "Character", label: charType.label.split("(")[0].trim() });
  if (background) displayPills.push({ category: "Background", label: background.label });
  if (gender) displayPills.push({ category: "Gender", label: gender.label });
  if (ethnicity) displayPills.push({ category: "Ethnicity", label: ethnicity.label });
  if (age) displayPills.push({ category: "Age", label: age.label });
  if (skinTone) displayPills.push({ category: "Skin", label: skinTone.label });
  if (headShape) displayPills.push({ category: "Head", label: headShape.label });
  if (neck) displayPills.push({ category: "Neck", label: neck.label });
  if (eyeShape) displayPills.push({ category: "Eyes", label: eyeShape.label });
  if (eyeColor) displayPills.push({ category: "Eye Color", label: eyeColor.label });
  if (hairStyle) displayPills.push({ category: "Hairstyle", label: hairStyle.label });
  if (hairColor) displayPills.push({ category: "Hair Color", label: hairColor.label });
  if (outfit?.imagePath) displayPills.push({ category: "Outfit", label: outfit.label });
  if (outfitColor && outfitColor.id !== "outfit_color_as_shown") displayPills.push({ category: "Outfit Color", label: outfitColor.label });
  if (height) displayPills.push({ category: "Height", label: height.label });
  if (build) displayPills.push({ category: "Build", label: build.label });
  accessories.forEach((acc) => displayPills.push({ category: "Accessory", label: acc.label }));
  const framing = selection.framing === "half" ? "half" : "full";
  displayPills.push({ category: "Framing", label: framing === "half" ? "Half" : "Full" });

  const promptSections: string[] = [];

  // 0. UGC framing and the selected room. Full shows the whole person. Half stops at the waist.
  const backgroundSnippet = background?.promptSnippet
    ? background.promptSnippet
    : "authentic home office workspace environment with laptop and desk";
  const bgSnippet = framing === "full"
    ? backgroundSnippet.replace("ergonomic desk chair back in foreground", "desk chair to the side")
    : backgroundSnippet;
  const framingLine = framing === "half"
    ? "Frame the person from the head through the waist, with the legs and feet outside the photograph and the room still visible around them."
    : "Show the whole person from head to feet in a wide shot with floor below both feet and furniture to the side.";
  const photograph = framing === "full" ? "full-body photograph" : "creator portrait photograph";

  promptSections.push(
    `Authentic UGC ${photograph} in vertical 9:16 frame, natural candid posture, in an ${bgSnippet}, authentic UGC content creator aesthetic, natural ambient room lighting, realistic optical background blur, zero commercial studio equipment. ${framingLine}`
  );

  // 1. Identity & Demographic Core
  const identityTokens: string[] = [];
  if (gender) identityTokens.push(framing === "full" ? gender.promptSnippet.replace("studio portrait", "full-length photograph") : gender.promptSnippet);
  if (age) identityTokens.push(age.promptSnippet);
  if (ethnicity) identityTokens.push(ethnicity.promptSnippet);
  if (skinTone) identityTokens.push(skinTone.promptSnippet);
  if (charType) {
    if (charType.id !== "char_scratch") {
      identityTokens.push(`facial identity anchored by reference image with ${charType.promptSnippet}`);
    } else {
      identityTokens.push(charType.promptSnippet);
    }
  }
  if (identityTokens.length > 0) {
    promptSections.push(identityTokens.join(", "));
  }

  // 2. Facial Architecture & Eyes
  const faceTokens: string[] = [];
  if (headShape) faceTokens.push(headShape.promptSnippet);
  if (neck) faceTokens.push(neck.promptSnippet);
  if (eyeShape) faceTokens.push(eyeShape.promptSnippet);
  if (eyeColor) faceTokens.push(eyeColor.promptSnippet);
  if (faceTokens.length > 0) {
    promptSections.push(faceTokens.join(", "));
  }

  // 3. Hair & Grooming
  const hairTokens: string[] = [];
  if (hairStyle) hairTokens.push(hairStyle.promptSnippet);
  if (hairColor) hairTokens.push(hairColor.promptSnippet);
  if (hairTokens.length > 0) {
    promptSections.push(hairTokens.join(", "));
  }

  if (outfit?.imagePath) promptSections.push(outfit.promptSnippet);
  if (outfit?.imagePath && outfitColor?.promptSnippet) promptSections.push(outfitColor.promptSnippet);

  // 4. Physique & Proportions
  const bodyTokens: string[] = [];
  if (build) bodyTokens.push(build.promptSnippet);
  if (height) bodyTokens.push(height.promptSnippet);
  if (bodyTokens.length > 0) {
    promptSections.push(bodyTokens.join(", "));
  }

  // 5. Accessories & Styling
  if (accessories.length > 0) {
    promptSections.push(accessories.map((acc) => acc.promptSnippet).join(", "));
  }

  // 6. Realism & Photography Standards
  promptSections.push(REALISM_ENGINE_TOKENS);

  const fullPrompt = promptSections.filter(Boolean).join(".\n");

  const referenceImagePath =
    charType && charType.id !== "char_scratch" ? charType.imagePath : undefined;

  return {
    prompt: fullPrompt,
    negativePrompt: framing === "half" ? HALF_NEGATIVE_PROMPT : FULL_NEGATIVE_PROMPT,
    referenceImagePath,
    displayPills,
  };
}

/** Pills for choices the user changed. Defaults stay off the strip so it does not fill the dock. */
export function changedInfluencerPills(
  selection: InfluencerSelectionState,
  pills: CompiledInfluencerPayload["displayPills"],
) {
  const defaults = DEFAULT_INFLUENCER_SELECTION;
  const categories = new Set<string>();
  if (selection.characterTypeId !== defaults.characterTypeId) categories.add("Character");
  if (selection.backgroundId !== defaults.backgroundId) categories.add("Background");
  if (selection.genderId !== defaults.genderId) categories.add("Gender");
  if (selection.ethnicityId !== defaults.ethnicityId) categories.add("Ethnicity");
  if (selection.ageId !== defaults.ageId) categories.add("Age");
  if (selection.skinToneId !== defaults.skinToneId) categories.add("Skin");
  if (selection.headShapeId !== defaults.headShapeId) categories.add("Head");
  if (selection.neckId !== defaults.neckId) categories.add("Neck");
  if (selection.eyeShapeId !== defaults.eyeShapeId) categories.add("Eyes");
  if (selection.eyeColorId !== defaults.eyeColorId) categories.add("Eye Color");
  if (selection.hairStyleId !== defaults.hairStyleId) categories.add("Hairstyle");
  if (selection.hairColorId !== defaults.hairColorId) categories.add("Hair Color");
  if (selection.outfitId !== defaults.outfitId) categories.add("Outfit");
  if (selection.outfitColorId !== defaults.outfitColorId) categories.add("Outfit Color");
  if (selection.heightId !== defaults.heightId) categories.add("Height");
  if (selection.buildId !== defaults.buildId) categories.add("Build");
  if (selection.framing !== defaults.framing) categories.add("Framing");
  const sameAccessories = selection.accessoryIds.length === defaults.accessoryIds.length
    && selection.accessoryIds.every((id, index) => id === defaults.accessoryIds[index]);
  if (!sameAccessories) categories.add("Accessory");
  return pills.filter((pill) => categories.has(pill.category));
}
