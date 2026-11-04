# Two-reference character stage2: exact test inputs — 4 November 2026

Assistant-selected diagnostic choices reproduce the earlier Extreme character test. These are not a newly captured UI selection.
Plan: one controlled stage2 call with the previous failed scene, then one complete new application generation (scene + identity + existing local harmonizer). Three paid provider calls maximum, zero automatic diagnostic retries. Full application generation costs one existing image credit; the controlled direct provider call has provider usage cost only.
Production domain and hosted worker are not changed. The full application test runs current source with live admission, database, provider, storage and billing; it does not test a browser click or deployed revision.

## Every selected setting

```json
{
  "characterTypeId": "Extreme",
  "backgroundId": "Bedroom",
  "genderId": "Male",
  "ethnicityId": "Middle Eastern",
  "ageId": "Adult (25)",
  "skinToneId": "Light Olive",
  "headShapeId": "Keep head shape",
  "neckId": "Natural Athletic",
  "eyeShapeId": "Vibrant Open",
  "eyeColorId": "Ice Blue",
  "hairStyleId": "Textured Crop",
  "hairColorId": "Platinum Ash",
  "outfitId": "Leather Jacket",
  "outfitColorId": "Red",
  "heightId": "Tall / Statuesque (~5'11\")",
  "buildId": "Natural / Casual",
  "accessoryIds": "No accessories",
  "framing": "full"
}
```

## Settings

Gemini 3 Pro Image through OpenRouter; 9:16; provider image_size 2K. No explicit seed, temperature, identity strength or model edit mask. Existing harmonizer runs only in the complete application test.

## All ordered stage1 images

### 1. character face — char_extreme

Owned asset decd49aa-bb8b-5da1-a6af-54f510f780c2; SHA256 720991b8ab157033b6dc0aec6a18f6894ed5bc311cf20bece71569bccf5b4cb1.
![character face](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-1.jpg)

### 2. background — bg_cozy_floral_bedroom

Owned asset 433f68f3-39df-58a3-a0c7-d56a293b963d; SHA256 ae8e43b5143277e040c3b6d51a55a2cbe1f33b8a7cdc3c0788ac71391463cde2.
![background](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-2.jpg)

### 3. ethnicity — ethnicity_middle_eastern

Owned asset a2a9c04d-574a-5f40-a5df-71142009bde4; SHA256 f6e6d62423d7b399cc4ce801f2acdc3f2f17c0ecdef5a12b40f3f8b97299d69f.
![ethnicity](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-3.jpg)

### 4. eye shape — eye_vibrant_open

Owned asset c5e97e03-efbd-5678-a182-c94ef9ff0f27; SHA256 9f9e86eb6b54c3f5ad0f51140f426aec040714335f7f6098ee54a2c74629c47b.
![eye shape](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-4.jpg)

### 5. hairstyle — hair_textured_crop

Owned asset a935ba6d-1bb5-5681-aadc-54ad65ad9ed0; SHA256 c3e0af4d3cfe9636a567e9772350793b114851a0e5ddaec2a9adbfbd5eaf695f.
![hairstyle](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-5.jpg)

### 6. outfit — outfit_2025_leather_jacket

Owned asset 0ea8cab1-73bb-5320-a5d1-76fa6117f330; SHA256 37eb987d02cfab8a815b605890ce10936a8255b00bf25be993355a30e11618dc.
![outfit](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-6.jpg)

### 7. build — build_natural

Owned asset 7f3b2fde-5198-5624-a278-6ef53fd4b379; SHA256 818d25ca4e3ee40c17d776bca8176a9260a0e92dc994a251c5212c9657d6b792.
![build](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-7.jpg)

### 8. neck — neck_standard

Owned asset c967f06c-167a-5172-a31a-4e26732ae3ea; SHA256 c494727d0d40c02ce2d5643a4caa08bdfc98401e56f24a1f1e85ebae3b83d0ee.
![neck](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-8.jpg)

### 9. height — height_tall

Owned asset ce50dc32-422e-56cc-a3f8-e0854fa8827a; SHA256 b2261a6cb909c68bdbcda5f19343a6d76966b42f6513bfd811876806ae504ff7.
![height](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-9.jpg)

## Stage1 complete prompt

```text
Authentic UGC full-body photograph in vertical 9:16 frame, natural candid posture, in an authentic relatable creator bedroom setting, desk chair to the side, cozy floral duvet bed with soft lavender accent pillow in background, gentle diffused daylight, candid everyday creator space, authentic UGC content creator aesthetic, natural ambient room lighting, realistic optical background blur, zero commercial studio equipment. Show the whole person from head to feet in a wide shot with floor below both feet and furniture to the side..
photorealistic full-length photograph of a young male influencer, masculine jawline, strong brow ridge, fit male structure, contemporary 25-year-old influencer, polished creator look, refined self-assured presence, authentic Middle Eastern heritage, warm olive skin undertones, expressive gaze, prominent refined facial contour, natural dense eyebrows, light olive skin tone with soft neutral-warm undertones, healthy matte skin finish, facial identity anchored by reference image with extreme expressive viral creator face, distinctive exaggerated masculine features, neatly groomed mustache, high-energy creator presence.
Preserve the head shape from the selected character reference., well-proportioned natural athletic neck, balanced trapezius line, relaxed confident posture, bright alert eyes, glassy reflections with natural eye catchlights, engaged creator gaze, piercing sky-blue eyes with intricate iris fiber patterns and dark outer limbal ring.
short textured crop. Use this photo for the haircut only, and apply the selected hair color, modern platinum ash-blonde hair with cool silvery undertones and dark root shadow.
2025 leather jacket with denim. Use this photo for the clothing cut only. Do not copy its face, hair, pose, or white background..
Dye the main garment red. Keep the garment cut, small patterns, belt, and shoes from the outfit photo..
natural everyday healthy body build, realistic relatable creator frame, statuesque tall frame, 5'11" height, elongated leg-to-torso proportions, 1:8 head-to-body ratio, commanding vertical presence.
No accessories required; both ears must have bare, natural unpierced earlobes. No earrings, jewelry, headphones, glasses, headbands or skincare patches, even when visible in reference photos..
Authentic unretouched human skin texture, natural dermal micro-pores, balanced matte skin finish, completely eliminate artificial plastic shine, fine facial peach fuzz, hyper-realistic 8k raw photo, authentic optical depth of field from a 35mm f/2.0 camera lens..
Eye color priority: both irises must be Ice Blue. This selected color overrides every reference photo. Eye-shape references supply eyelid shape only, never iris color.
Combine these reference images into one new vertical 9:16 photograph of one full-body person standing in the selected room. Each image supplies only its named trait. Do not copy a white backdrop, a cropped head, or a floating-head composition. Reference image order: 1 character face; 2 background; 3 ethnicity; 4 eye shape; 5 hairstyle; 6 outfit; 7 build; 8 neck; 9 height. Only selected accessories may appear; ignore jewelry in all other references. The selected eye color overrides every photo's iris color.
Negative constraints: Avoid cropped, cut off, headshot, close up, partial body, missing legs, missing feet, out of frame, floating head, plastic skin, oily face glare, synthetic shine, airbrushed porcelain smoothness, uncanny valley, CGI 3D render, cartoon, doll, distorted anatomy, warped fingers, extra limbs, bad eyes, blurry, low resolution, oversaturated lighting, visible studio softbox lights, photography umbrellas, camera tripods, glasses, sunglasses, headphones, headbands, earrings, necklaces, hats, readable text, logos, watermarks.
```

## Stage2 complete prompt

```text
CHARACTER STAGE 2: PRIMARY FACIAL IDENTITY.

Exactly two images are supplied. Image 1 is the stage 1 scene. Preserve its background, camera, framing, body, pose, hands, clothing, hairstyle, hair color, selected accessories and lighting. Keep both feet when visible. Do not copy Image 2's hair, outfit, accessories or background.

Image 2 is the ONLY facial identity authority. Correct the visible face in Image 1 to this person, preserving their distinctive facial geometry, brows, nose, lips, jaw and facial hair. Do not average the two faces or beautify the primary person. Adapt the primary face to Image 1's head pose, expression, light and existing occlusions.

Preserve the primary identity photo's distinctive facial proportions, brows, nose, lips, jaw and facial hair, including its moustache when present. Do not average it with other people.
Selected facial overrides take priority over the identity photo: piercing sky-blue eyes with intricate iris fiber patterns and dark outer limbal ring
Preserve the primary identity photo's head shape.
Apply only the selected eyelid shape and skin tone; preserve the primary face's other proportions, eye spacing, nose, lips and facial hair: bright alert eyes, glassy reflections with natural eye catchlights, engaged creator gaze light olive skin tone with soft neutral-warm undertones, healthy matte skin finish
Preserve the appearance established in Image 1. Selected scene settings: backgroundId: Bedroom; genderId: Male; ethnicityId: Middle Eastern; ageId: Adult (25); neckId: Natural Athletic; hairStyleId: Textured Crop; hairColorId: Platinum Ash; outfitId: Leather Jacket; outfitColorId: Red; heightId: Tall / Statuesque (~5'11"); buildId: Natural / Casual; framing: full. These scene settings do not supply another person's facial identity.
Keep Image 1's hairstyle and hair color; the primary image supplies facial identity, not a replacement haircut.
Keep the scene free of accessories. Both ears must remain bare with natural unpierced earlobes. No earrings, jewellery, glasses, headphones, headbands, hats or other accessories, even if present in the primary identity photo.

Change only the visible facial region and explicitly selected facial overrides. Keep scene hairstyle and selected objects intact, including any hand or accessory overlapping the face. Return one photograph with the same composition and aspect ratio.

Negative constraints: Avoid cropped, cut off, headshot, close up, partial body, missing legs, missing feet, out of frame, floating head, plastic skin, oily face glare, synthetic shine, airbrushed porcelain smoothness, uncanny valley, CGI 3D render, cartoon, doll, distorted anatomy, warped fingers, extra limbs, bad eyes, blurry, low resolution, oversaturated lighting, visible studio softbox lights, photography umbrellas, camera tripods, glasses, sunglasses, headphones, headbands, earrings, necklaces, hats, readable text, logos, watermarks.
```

## Negative prompts

Additional user-test negatives: glasses, sunglasses, headphones, headbands, earrings, necklaces, hats, readable text, logos, watermarks

Effective complete negatives:

cropped, cut off, headshot, close up, partial body, missing legs, missing feet, out of frame, floating head, plastic skin, oily face glare, synthetic shine, airbrushed porcelain smoothness, uncanny valley, CGI 3D render, cartoon, doll, distorted anatomy, warped fingers, extra limbs, bad eyes, blurry, low resolution, oversaturated lighting, visible studio softbox lights, photography umbrellas, camera tripods, glasses, sunglasses, headphones, headbands, earrings, necklaces, hats, readable text, logos, watermarks

## Controlled stage2 exact visual inputs

Image1: saved stage1 output of previous job; no face suppression or crop.

![Controlled scene](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/controlled-scene.png)

Image2: unchanged primary Extreme character; same bytes as stage1 image1.

![Primary](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-1.jpg)

No haircut, outfit, accessory, body, ethnicity or background portrait is separately supplied to stage2. Selected settings remain textual constraints.
## Fresh complete generation: stage2 inputs

Image1 will be the newly generated stage1 PNG. The worker pauses before stage2 submission so this exact image can be displayed. Image2 is the same unchanged primary shown above. Their hashes and the complete actual payload are checked before each paid request.

## Acceptance

Review facial geometry and facial-hair pattern against the primary, separately from selected blue eyes/platinum hair, hairstyle fidelity, no accessories, full framing, room and outfit. Provider completion is not identity approval. All outputs retained, including failures; no calibrated similarity percentage.
## Fresh stage2 visual inputs disclosed before submission

Image1: [new stage1 scene](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/scene.png).

Image2: [unchanged primary](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/ref-1.jpg).

Exact stage2 payload SHA256: 81e2cb1b28c71c3f024cbce974ca786202216294cea13c3ea1cdc6cf687c9bf4. Full image hashes and prompt: .tmp/character-two-reference-20261104/stage2-ready.json.

Stage1 inspection: feet already cropped despite full-body instructions; short platinum hair and primary-like expressive face present. This is a stage1 output failure to assess independently from identity preservation.

