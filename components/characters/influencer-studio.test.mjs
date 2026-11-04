import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_INFLUENCER_SELECTION,
  randomizeInfluencerSelection,
  findTraitById,
  getTraitsByCategory,
  CATEGORY_DEFINITIONS,
} from "../../lib/characters/influencer-registry.ts";
import { CHARACTER_STUDIO_IMAGE_MODEL, getCharacterPromptLimit } from "../../lib/characters/image-models.ts";
import { changedInfluencerPills, compileInfluencerPrompt } from "../../lib/characters/master-prompt-compiler.ts";

test("influencer registry has every category populated with traits", () => {
  assert.equal(CATEGORY_DEFINITIONS.length, 17);

  for (const cat of CATEGORY_DEFINITIONS) {
    const traits = getTraitsByCategory(cat.id);
    assert.ok(traits.length > 0, `Category ${cat.id} must have items`);
    for (const trait of traits) {
      assert.equal(trait.category, cat.id);
      assert.ok(trait.id.length > 0);
      assert.ok(trait.label.length > 0);
      if (!["outfit_none", "outfit_color_as_shown", "accessory_none"].includes(trait.id)) assert.ok(trait.promptSnippet.length > 0);
    }
  }
});

test("compileInfluencerPrompt compiles default selection into coherent master prompt", () => {
  const result = compileInfluencerPrompt(DEFAULT_INFLUENCER_SELECTION);

  assert.ok(result.prompt.includes("South Asian") || result.prompt.includes("Middle Eastern"));
  assert.ok(result.prompt.includes("almond"));
  assert.match(result.prompt, /Preserve the hairstyle from the selected character reference/);
  assert.doesNotMatch(result.prompt, /chin-length natural bob|glossy jet-black hair|classic symmetrical oval/);
  assert.ok(result.prompt.includes("athletic"));
  assert.ok(result.prompt.includes("headphones"));
  assert.ok(result.prompt.includes("workspace") || result.prompt.includes("Authentic UGC"));
  assert.equal(result.negativePrompt.includes("plastic skin"), true);
  assert.equal(result.referenceImagePath, "/explore/influencer-studio/characters/1.png");
  assert.ok(result.displayPills.length >= 10);
  assert.ok(result.displayPills.some((p) => p.category === "Background"));
  assert.equal(result.displayPills.at(-1)?.label, "Full");
  assert.match(result.prompt, /head to feet/);
  assert.match(result.negativePrompt, /missing feet/);
});

test("half framing asks for a waist-up portrait and keeps the vertical frame", () => {
  const result = compileInfluencerPrompt({ ...DEFAULT_INFLUENCER_SELECTION, framing: "half" });
  assert.match(result.prompt, /head through the waist/);
  assert.match(result.prompt, /9:16/);
  assert.doesNotMatch(result.prompt, /head to feet/);
  assert.doesNotMatch(result.negativePrompt, /missing legs|missing feet/);
  assert.match(result.negativePrompt, /plastic skin/);
  assert.equal(result.displayPills.at(-1)?.label, "Half");
});

test("Full avoids conflicting portrait and foreground-chair instructions while Half retains its composition", () => {
  const selection = { ...DEFAULT_INFLUENCER_SELECTION, backgroundId: "bg_cozy_floral_bedroom" };
  const full = compileInfluencerPrompt(selection).prompt;
  assert.match(full, /full-body photograph.*9:16/);
  assert.match(full, /head to feet.*floor below both feet/);
  assert.match(full, /desk chair to the side/);
  assert.doesNotMatch(full, /studio portrait|creator portrait photograph|desk chair back in foreground/);
  const half = compileInfluencerPrompt({ ...selection, framing: "half" }).prompt;
  assert.match(half, /creator portrait photograph/);
  assert.match(half, /studio portrait/);
  assert.match(half, /desk chair back in foreground/);
});

test("compileInfluencerPrompt respects tall vs petite height proportions", () => {
  const tallSelection = { ...DEFAULT_INFLUENCER_SELECTION, heightId: "height_tall" };
  const tallResult = compileInfluencerPrompt(tallSelection);
  assert.ok(tallResult.prompt.includes("1:8 head-to-body ratio"));

  const petiteSelection = { ...DEFAULT_INFLUENCER_SELECTION, heightId: "height_petite" };
  const petiteResult = compileInfluencerPrompt(petiteSelection);
  assert.ok(petiteResult.prompt.includes("1:6 head-to-body scale ratio"));
});

test("compileInfluencerPrompt handles new persona from scratch without reference image", () => {
  const scratchSelection = { ...DEFAULT_INFLUENCER_SELECTION, characterTypeId: "char_scratch" };
  const result = compileInfluencerPrompt(scratchSelection);
  assert.equal(result.referenceImagePath, undefined);
  assert.ok(result.prompt.includes("anatomical parameters"));
});

test("compileInfluencerPrompt handles custom uploaded character face reference", () => {
  const customTrait = {
    id: "upload_custom_face_123",
    label: "My Model Face",
    category: "character_type",
    imagePath: "blob:http://localhost:3000/123-abc",
    promptSnippet: "photorealistic facial likeness of My Model Face",
    isCustomUpload: true,
  };
  const selectionWithUpload = {
    ...DEFAULT_INFLUENCER_SELECTION,
    characterTypeId: "upload_custom_face_123",
  };
  const result = compileInfluencerPrompt(selectionWithUpload, [customTrait]);
  assert.equal(result.referenceImagePath, "blob:http://localhost:3000/123-abc");
  assert.ok(result.prompt.includes("My Model Face"));
  assert.ok(result.displayPills.some((pill) => pill.label === "My Model Face"));
});

test("randomizeInfluencerSelection returns a valid populated selection state", () => {
  const randomized = randomizeInfluencerSelection();
  assert.ok(findTraitById(randomized.characterTypeId));
  assert.ok(findTraitById(randomized.backgroundId));
  assert.ok(findTraitById(randomized.genderId));
  assert.ok(findTraitById(randomized.ethnicityId));
  assert.ok(findTraitById(randomized.ageId));
  assert.ok(findTraitById(randomized.skinToneId));
  assert.ok(findTraitById(randomized.headShapeId));
  assert.ok(findTraitById(randomized.neckId));
  assert.ok(findTraitById(randomized.eyeShapeId));
  assert.ok(findTraitById(randomized.eyeColorId));
  assert.ok(findTraitById(randomized.hairStyleId));
  assert.ok(findTraitById(randomized.hairColorId));
  assert.ok(findTraitById(randomized.heightId));
  assert.ok(findTraitById(randomized.buildId));
  assert.ok(randomized.accessoryIds.every(id => id !== "accessory_none" && findTraitById(id)?.category === "accessories"));
  assert.equal(randomized.framing, "full");
  assert.equal(randomizeInfluencerSelection("half").framing, "half");

  const compiled = compileInfluencerPrompt(randomized);
  assert.ok(compiled.prompt.length > 100);
});

test("picked settings stay hidden until a choice differs from the default", () => {
  const compiled = compileInfluencerPrompt(DEFAULT_INFLUENCER_SELECTION);
  assert.equal(changedInfluencerPills(DEFAULT_INFLUENCER_SELECTION, compiled.displayPills).length, 0);
  const changed = changedInfluencerPills(
    { ...DEFAULT_INFLUENCER_SELECTION, ethnicityId: "eth_latina", framing: "half" },
    compiled.displayPills,
  );
  assert.deepEqual(changed.map((pill) => pill.category), ["Ethnicity", "Framing"]);
});

test("the character studio header, selection color, and color tiles stay compact", () => {
  const workspace = readFileSync(new URL("./character-workspace.tsx", import.meta.url), "utf8");
  const dock = readFileSync(new URL("./influencer-customizer-dock.tsx", import.meta.url), "utf8");
  const canvas = readFileSync(new URL("./influencer-canvas.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("./influencer-studio.module.css", import.meta.url), "utf8");
  assert.match(workspace, /AI character influencer/);
  assert.match(workspace, /studioBack/);
  assert.doesNotMatch(canvas, /Studio Canvas/);
  assert.match(dock, /changedInfluencerPills/);
  assert.match(dock, /colorTile/);
  assert.match(dock, /generationOptions/);
  assert.match(css, /\.traitCardSelected[\s\S]*var\(--app-primary\)/);
  assert.match(css, /\.colorTile \{/);
});

test("the visual influencer studio generates with Gemini 3 Pro", () => {
  assert.equal(CHARACTER_STUDIO_IMAGE_MODEL, "gemini_3_pro");
  assert.equal(getCharacterPromptLimit(CHARACTER_STUDIO_IMAGE_MODEL), 32_000);
  const source = readFileSync(new URL("./character-workspace.tsx", import.meta.url), "utf8");
  assert.match(source, /model: CHARACTER_STUDIO_IMAGE_MODEL/);
  assert.match(source, /studioReferenceFile/);
  assert.match(source, /mutateAsync/);
  assert.doesNotMatch(source, /model:\s*"seedream_5_pro"/);
});
