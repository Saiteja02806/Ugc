import { ensureCharacterCatalogCache, readCatalogImage } from "../../scripts/character-catalog-test-cache.mjs";
import { studioCatalogUrl } from "./studio-catalog.ts";
await ensureCharacterCatalogCache();
import test from "node:test";
import assert from "node:assert/strict";
import { findTraitById, getTraitsByCategory, HAIR_STYLES, OUTFITS, ACCESSORIES, DEFAULT_INFLUENCER_SELECTION } from "./influencer-registry.ts";
import { changedInfluencerPills, compileInfluencerPrompt } from "./master-prompt-compiler.ts";
import {
  orderedStudioReferences,
  resolveStudioReferenceUrls,
  studioReferenceOrderLine,
  studioReferenceSize,
} from "./studio-references.ts";

test("marked choices are retired without breaking saved selections and head references", () => {
  const characters = getTraitsByCategory("character_type");
  assert.equal(characters.some(t => t.id === "char_wide_eyed_mustache"), false);
  assert.equal(characters.some(t => t.id === "char_playful_mustache"), true);
  assert.ok(findTraitById("char_wide_eyed_mustache"));
  const retired = ["bg_car_interior", "bg_clean_studio", "bg_cozy_bedroom", "bg_cozy_living_room", "bg_modern_kitchen", "bg_office_desk"];
  const backgrounds = getTraitsByCategory("background");
  assert.equal(backgrounds.length, 7);
  for (const id of retired) {
    assert.equal(backgrounds.some(t => t.id === id), false);
    assert.equal(findTraitById(id)?.category, "background");
  }
  const head = getTraitsByCategory("head_shape").find(t => t.id === "head_wide_eyed_mustache");
  assert.equal(head?.imagePath, findTraitById("char_wide_eyed_mustache").imagePath);
  const selection = { ...DEFAULT_INFLUENCER_SELECTION, headShapeId: head.id };
  const refs = orderedStudioReferences(selection);
  assert.equal(refs[0].id, selection.characterTypeId);
  assert.ok(refs.some(ref => ref.id === head.id && ref.role === "head shape"));
  assert.ok(compileInfluencerPrompt(selection).prompt.includes(head.promptSnippet));
  assert.match(head.promptSnippet, /preserve the selected character identity/);
});

test("keep-existing defaults preserve character traits without replacement photo references", () => {
  for (const [field, id] of [
    ["headShapeId", "head_keep_existing"],
    ["hairStyleId", "hair_keep_existing"],
    ["hairColorId", "hair_color_keep_existing"],
  ]) {
    assert.equal(DEFAULT_INFLUENCER_SELECTION[field], id);
    const trait = findTraitById(id);
    assert.ok(trait?.isDefault);
    assert.equal(trait.imagePath, undefined);
    assert.equal(trait.colorHex, undefined);
    const choices = getTraitsForField(field);
    assert.equal(choices.filter(item => item.isDefault).length, 1);
  }
  const defaults = compileInfluencerPrompt(DEFAULT_INFLUENCER_SELECTION);
  assert.match(defaults.prompt, /Preserve the head shape from the selected character reference/);
  assert.match(defaults.prompt, /Preserve the hairstyle from the selected character reference/);
  assert.match(defaults.prompt, /Preserve the original hair color from the selected character reference/);
  assert.doesNotMatch(defaults.prompt, /chin-length natural bob|glossy jet-black hair|classic symmetrical oval/);
  assert.deepEqual(changedInfluencerPills(DEFAULT_INFLUENCER_SELECTION, defaults.displayPills), []);
});

function getTraitsForField(field) {
  const category = { headShapeId: "head_shape", hairStyleId: "hair_style", hairColorId: "hair_color" }[field];
  return getTraitsByCategory(category);
}

test("head shape, hairstyle and hair color override independently for catalog and uploaded characters", () => {
  const uploaded = { id: "upload_keep_test", label: "Uploaded face", category: "character_type", imagePath: "blob:owned-face", promptSnippet: "uploaded character facial identity", isCustomUpload: true };
  for (const characterTypeId of ["char_extreme", uploaded.id]) {
    for (let mask = 0; mask < 8; mask++) {
      const selection = {
        ...DEFAULT_INFLUENCER_SELECTION, characterTypeId,
        ...(mask & 1 ? { headShapeId: "head_square" } : {}),
        ...(mask & 2 ? { hairStyleId: "hair_curly_mullet" } : {}),
        ...(mask & 4 ? { hairColorId: "hair_color_blonde" } : {}),
      };
      const compiled = compileInfluencerPrompt(selection, [uploaded]);
      const refs = orderedStudioReferences(selection, [uploaded]);
      assert.equal(refs.some(ref => ref.role === "head shape"), Boolean(mask & 1));
      assert.equal(refs.some(ref => ref.role === "hairstyle"), Boolean(mask & 2));
      assert.ok(refs.every(ref => !ref.id.includes("keep_existing")));
      for (const [bit, field, category] of [[1, "headShapeId", "Head"], [2, "hairStyleId", "Hairstyle"], [4, "hairColorId", "Hair Color"]]) {
        const selectedTrait = findTraitById(selection[field]);
        assert.ok(compiled.prompt.includes(selectedTrait.promptSnippet));
        const pills = changedInfluencerPills(selection, compiled.displayPills);
        assert.equal(pills.some(pill => pill.category === category), Boolean(mask & bit));
      }
      assert.ok(refs.length <= 10);
      assert.match(compiled.prompt, /head to feet/);
    }
  }
});

test("ordered studio references start with the selected character face and stay within ten images", () => {
  const references = orderedStudioReferences(DEFAULT_INFLUENCER_SELECTION);
  assert.equal(references[0].id, "char_average");
  assert.equal(references[0].role, "character face");
  assert.equal(references[0].imagePath, "/explore/influencer-studio/characters/1.png");
  assert.equal(references[1].id, "bg_modern_workspace");
  assert.equal(references[1].role, "background");
  assert.ok(references.length > 1);
  assert.ok(references.length <= 10);
  assert.equal(new Set(references.map((reference) => reference.imagePath)).size, references.length);
  const prompt = `${compileInfluencerPrompt(DEFAULT_INFLUENCER_SELECTION).prompt}${studioReferenceOrderLine(references.map((reference) => reference.role))}`;
  assert.ok(prompt.length <= 4000);
  assert.match(prompt, /1 character face/);
  assert.match(prompt, /2 background/);
  assert.match(prompt, /one full-body person standing in the selected room/);
  assert.match(prompt, /wide shot with floor below both feet and furniture to the side/);
  assert.doesNotMatch(prompt, /creator portrait photograph|studio portrait/);
  assert.match(prompt, /Show the whole person from head to feet/);
  assert.match(prompt, /Do not copy a white backdrop/);
  const halfPrompt = `${compileInfluencerPrompt({ ...DEFAULT_INFLUENCER_SELECTION, framing: "half" }).prompt}${studioReferenceOrderLine(references.map((reference) => reference.role), "half")}`;
  assert.match(halfPrompt, /Frame the person from the head through the waist/);
  assert.match(halfPrompt, /one person framed from the head through the waist/);
  assert.doesNotMatch(halfPrompt, /full-body|head to feet|missing legs/);
  assert.doesNotMatch(halfPrompt, /wide shot|floor below|furniture to the side/);
  assert.ok(halfPrompt.length <= 4000);
  const withAccessories = orderedStudioReferences({ ...DEFAULT_INFLUENCER_SELECTION, accessoryIds: ACCESSORIES.map((trait) => trait.id) });
  const accessoryPrompt = `${compileInfluencerPrompt({ ...DEFAULT_INFLUENCER_SELECTION, accessoryIds: ACCESSORIES.map((trait) => trait.id) }).prompt}${studioReferenceOrderLine(withAccessories.map((reference) => reference.role))}`;
  assert.ok(withAccessories.length <= 10);
  assert.ok(accessoryPrompt.length <= 4000);
});

test("studio reference ids resolve to public studio image URLs and reject unknown ids", () => {
  const references = orderedStudioReferences(DEFAULT_INFLUENCER_SELECTION);
  const urls = resolveStudioReferenceUrls(references.map((reference) => reference.id));
  assert.equal(urls.length, references.length);
  assert.equal(urls[0], studioCatalogUrl(references[0].imagePath));
  assert.throws(() => resolveStudioReferenceUrls(["upload_custom_face"]), /studio/);
  assert.throws(() => resolveStudioReferenceUrls(["char_average", "char_average"]), /10 different/);
});

test("a custom uploaded face is not treated as a catalog studio image", () => {
  const custom = {
    id: "upload_face",
    label: "Mine",
    category: "character_type",
    imagePath: "blob:http://localhost/face",
    promptSnippet: "uploaded face",
    isCustomUpload: true,
  };
  const references = orderedStudioReferences({ ...DEFAULT_INFLUENCER_SELECTION, characterTypeId: custom.id }, [custom]);
  assert.equal(references.some((reference) => reference.id === "upload_face" || reference.id === "char_average"), false);
  assert.equal(references[0].role, "background");
});

test("an outfit photo takes a reference slot ahead of the accessories", () => {
  const references = orderedStudioReferences({ ...DEFAULT_INFLUENCER_SELECTION, headShapeId: "head_oval", hairStyleId: "hair_bob", outfitId: "outfit_1950s_grey_suit" });
  assert.equal(references.length, 10);
  assert.ok(references.some((reference) => reference.role === "outfit" && reference.id === "outfit_1950s_grey_suit"));
  assert.equal(references.some((reference) => reference.role === "accessory"), false);
  const prompt = compileInfluencerPrompt({ ...DEFAULT_INFLUENCER_SELECTION, outfitId: "outfit_1950s_grey_suit", outfitColorId: "outfit_color_navy" }).prompt;
  assert.match(prompt, /1950s tailored suit/);
  assert.match(prompt, /Do not copy its face/);
  assert.match(prompt, /Dye the main garment navy/);
});

test("background setting is included in ordered studio references and anchors room scene", () => {
  const references = orderedStudioReferences(DEFAULT_INFLUENCER_SELECTION);
  const bgRef = references.find((r) => r.role === "background");
  assert.ok(bgRef, "background must be included in studio references");
  assert.equal(bgRef.id, "bg_modern_workspace");
  assert.equal(bgRef.imagePath, "/explore/influencer-studio/backgrounds/modern-workspace.png");
});

test("studio reference photos are limited to a 1280px longest side", () => {
  assert.deepEqual(studioReferenceSize(1254, 1254), { width: 1254, height: 1254 });
  assert.deepEqual(studioReferenceSize(2000, 1000), { width: 1280, height: 640 });
  assert.throws(() => studioReferenceSize(0, 100), /no usable size/);
});


test("all 29 supplied outfit images are available and keep identity separate from clothing", () => {
  const outfits = OUTFITS.filter(outfit => outfit.imagePath);
  assert.equal(outfits.length, 29);
  assert.equal(OUTFITS.length, 30);
  assert.equal(new Set(outfits.map(outfit => outfit.id)).size, 29);
  assert.equal(new Set(outfits.map(outfit => outfit.imagePath)).size, 29);
  assert.equal(DEFAULT_INFLUENCER_SELECTION.outfitId, "outfit_none");
  for (const outfit of outfits) {
    const bytes=readCatalogImage(outfit.imagePath);
    assert.equal(bytes.subarray(0,8).toString("hex"), "89504e470d0a1a0a", outfit.imagePath);
    const selection={...DEFAULT_INFLUENCER_SELECTION,outfitId:outfit.id};
    const references=orderedStudioReferences(selection);
    assert.equal(references[0].role,"character face");
    assert.ok(references.some(reference=>reference.role==="outfit"&&reference.imagePath===outfit.imagePath),outfit.id);
    const compiled=compileInfluencerPrompt(selection);
    assert.match(compiled.prompt,/clothing cut only/);
    assert.match(compiled.prompt,/Do not copy its face, hair, pose, or white background/);
    assert.ok(compiled.displayPills.some(pill=>pill.category==="Outfit"&&pill.label===outfit.label));
  }
});


test("new hairstyle photos retain selected identity and independent hair color", () => {
  assert.equal(HAIR_STYLES.filter(style => style.imagePath).length, 23);
  assert.equal(DEFAULT_INFLUENCER_SELECTION.hairStyleId, "hair_keep_existing");
  assert.equal(new Set(HAIR_STYLES.map(style=>style.id)).size, HAIR_STYLES.length);
  for (const id of ["hair_tousled_shag","hair_spiky_high_top","hair_tall_flat_top","hair_curly_mullet","hair_wavy_bowl_cut"]) {
    const style=HAIR_STYLES.find(style=>style.id===id);assert.ok(style);
    const bytes=readCatalogImage(style.imagePath);
    assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    const selection={...DEFAULT_INFLUENCER_SELECTION,hairStyleId:id,hairColorId:"hair_color_black"};
    const references=orderedStudioReferences(selection);
    assert.equal(references[0].role,"character face");
    assert.ok(references.some(reference=>reference.role==="hairstyle"&&reference.id===id&&reference.imagePath===style.imagePath));
    assert.ok(references.length<=10);
    const compiled=compileInfluencerPrompt(selection);
    assert.ok(compiled.prompt.includes(style.promptSnippet));
    assert.match(compiled.prompt,/glossy jet-black hair/);
    assert.match(style.promptSnippet,/haircut only, and apply the selected hair color/);
    assert.ok(compiled.displayPills.some(pill=>pill.label===style.label));
  }
});


test("reviewed missing options compile and use the correct reference roles", () => {
 const added=[{"id": "accessory_amber_aviators", "category": "accessories", "path": "/explore/influencer-studio/accessories/amber-aviators.png"}, {"id": "accessory_black_sunglasses", "category": "accessories", "path": "/explore/influencer-studio/accessories/black-sunglasses.png"}, {"id": "accessory_pink_star_patches", "category": "accessories", "path": "/explore/influencer-studio/accessories/pink-star-patches.png"}, {"id": "head_exaggerated_square", "category": "head_shape", "path": "/explore/influencer-studio/head-shape/broad-square-jaw.png"}, {"id": "char_wide_eyed_mustache", "category": "character_type", "path": "/explore/influencer-studio/characters/wide-eyed-mustache.png"}, {"id": "char_playful_mustache", "category": "character_type", "path": "/explore/influencer-studio/characters/playful-mustache.png"}, {"id": "bg_car_interior", "category": "background", "path": "/explore/influencer-studio/backgrounds/car-interior.jpg"}, {"id": "bg_clean_studio", "category": "background", "path": "/explore/influencer-studio/backgrounds/clean-studio.jpg"}, {"id": "bg_cozy_bedroom", "category": "background", "path": "/explore/influencer-studio/backgrounds/cozy-bedroom.jpg"}, {"id": "bg_cozy_living_room", "category": "background", "path": "/explore/influencer-studio/backgrounds/cozy-living-room.jpg"}, {"id": "bg_modern_kitchen", "category": "background", "path": "/explore/influencer-studio/backgrounds/modern-kitchen.jpg"}, {"id": "bg_office_desk", "category": "background", "path": "/explore/influencer-studio/backgrounds/office-desk.jpg"}, {"id": "hair_classic_flat_top", "category": "hair_style", "path": "/explore/influencer-studio/hair-style/curls-afro.png"}, {"id": "hair_rugged_crop", "category": "hair_style", "path": "/explore/influencer-studio/hair-style/rugged-crop.png"}, {"id": "hair_short_fringe_bob", "category": "hair_style", "path": "/explore/influencer-studio/hair-style/sleek-pixie.png"}, {"id": "hair_braided_updo", "category": "hair_style", "path": "/explore/influencer-studio/hair-style/wavy-textured.png"}];
 const fields={background:"backgroundId",hair_style:"hairStyleId",character_type:"characterTypeId",head_shape:"headShapeId"};
 const roles={background:"background",hair_style:"hairstyle",character_type:"character face",head_shape:"head shape",accessories:"accessory"};
 for(const item of added){
  const trait=findTraitById(item.id);assert.ok(trait);assert.equal(trait.category,item.category);assert.equal(trait.imagePath,item.path);
  assert.ok(readCatalogImage(item.path).length>1000);
  const selection={...DEFAULT_INFLUENCER_SELECTION,...(item.category==="accessories"?{accessoryIds:[item.id]}:{[fields[item.category]]:item.id})};
  const compiled=compileInfluencerPrompt(selection);assert.ok(compiled.prompt.includes(trait.promptSnippet),item.id);
  assert.ok(compiled.displayPills.some(pill=>pill.label===trait.label),item.id);
  const refs=orderedStudioReferences(selection);assert.ok(refs.length<=10);
  assert.ok(refs.some(ref=>ref.id===item.id&&ref.role===roles[item.category]),item.id);
  assert.equal(refs[0].id,selection.characterTypeId);
 }
});
