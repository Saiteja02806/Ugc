# Stage 2 controlled prompt test inputs — 4 November 2026

Four direct provider diagnostic calls using the existing stage2 provider implementation. These are assistant-selected test inputs, unchanged from the previous real application job. No new application jobs or credit deductions are created. Provider usage is billable.

## Frozen input images

Image 1: scene; 1536x2752; SHA256 23ee1ac7dd1989d3050ce6b9255c6ab4c28f9f07d5125ead17494d8296f05bae
![scene](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/openrouter-image-scene-v1.png)

Image 2: primary identity; 1254x1254; SHA256 720991b8ab157033b6dc0aec6a18f6894ed5bc311cf20bece71569bccf5b4cb1
![primary identity](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-1.jpg)

Image 3: haircut only; 768x1024; SHA256 c3e0af4d3cfe9636a567e9772350793b114851a0e5ddaec2a9adbfbd5eaf695f
![haircut only](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-5.jpg)

## All selections

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

## Settings

{
  "model": "google/gemini-3-pro-image",
  "modalities": [
    "image"
  ],
  "image_config": {
    "aspect_ratio": "9:16",
    "image_size": "2K"
  },
  "seed": "not supplied",
  "temperature": "not supplied",
  "timeoutMs": 120000
}

## Provenance

Background is the Bedroom reference below, embedded in the frozen scene; it is not a separate stage2 image. Original nine stage1 references/selections and prompt remain in docs/character-test-inputs-2026-11-04.md.
![Original background](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-2.jpg)

## Prompt A: unchanged control

```text
CHARACTER STAGE 2: PRIMARY FACIAL IDENTITY.

Image 1 supplies background, camera, framing, body, pose, clothing and lighting. Preserve these and both feet when visible. Correct the face, selected hairstyle and accessories as instructed below, even when Image 1 is wrong. Selected eye and hair colors override reference colors.

Image 2 is the ONLY facial identity authority. Preserve its distinctive facial geometry and facial hair, including the moustache. Do not beautify, replace or average that person. Do not copy its background, outfit or accessories.

Image 3 supplies ONLY the selected hairstyle. Match haircut length, silhouette, strand texture and fringe; apply the selected hair color. Ignore this reference person's face, facial hair, skin, eyes, clothing and background; never blend their identity with Image 2.

Preserve the primary identity photo's distinctive facial proportions, brows, nose, lips, jaw and facial hair, including its moustache when present. Do not average it with other people.
Selected overrides take priority over the identity photo: piercing sky-blue eyes with intricate iris fiber patterns and dark outer limbal ring
Preserve the primary identity photo's head shape.
bright alert eyes, glassy reflections with natural eye catchlights, engaged creator gaze
light olive skin tone with soft neutral-warm undertones, healthy matte skin finish
Correct the scene hairstyle to the selected haircut reference, including its length, texture, silhouette and fringe; do not retain an incorrect scene hairstyle. short textured crop. Use this photo for the haircut only, and apply the selected hair color modern platinum ash-blonde hair with cool silvery undertones and dark root shadow
Remove all accessories from the scene and identity photo. Both ears must remain bare with natural unpierced earlobes. No earrings, jewellery, glasses, headphones, headbands, hats or other accessories, even if present in the identity photo.

Relight the face to the scene while preserving skin detail. Return one photograph with the same composition and aspect ratio.

Negative constraints: Avoid cropped, cut off, headshot, close up, partial body, missing legs, missing feet, out of frame, floating head, plastic skin, oily face glare, synthetic shine, airbrushed porcelain smoothness, uncanny valley, CGI 3D render, cartoon, doll, distorted anatomy, warped fingers, extra limbs, bad eyes, blurry, low resolution, oversaturated lighting, visible studio softbox lights, photography umbrellas, camera tripods, glasses, sunglasses, headphones, headbands, earrings, necklaces, hats, readable text, logos, watermarks.
```

## Prompt B: only four negative terms removed

```text
CHARACTER STAGE 2: PRIMARY FACIAL IDENTITY.

Image 1 supplies background, camera, framing, body, pose, clothing and lighting. Preserve these and both feet when visible. Correct the face, selected hairstyle and accessories as instructed below, even when Image 1 is wrong. Selected eye and hair colors override reference colors.

Image 2 is the ONLY facial identity authority. Preserve its distinctive facial geometry and facial hair, including the moustache. Do not beautify, replace or average that person. Do not copy its background, outfit or accessories.

Image 3 supplies ONLY the selected hairstyle. Match haircut length, silhouette, strand texture and fringe; apply the selected hair color. Ignore this reference person's face, facial hair, skin, eyes, clothing and background; never blend their identity with Image 2.

Preserve the primary identity photo's distinctive facial proportions, brows, nose, lips, jaw and facial hair, including its moustache when present. Do not average it with other people.
Selected overrides take priority over the identity photo: piercing sky-blue eyes with intricate iris fiber patterns and dark outer limbal ring
Preserve the primary identity photo's head shape.
bright alert eyes, glassy reflections with natural eye catchlights, engaged creator gaze
light olive skin tone with soft neutral-warm undertones, healthy matte skin finish
Correct the scene hairstyle to the selected haircut reference, including its length, texture, silhouette and fringe; do not retain an incorrect scene hairstyle. short textured crop. Use this photo for the haircut only, and apply the selected hair color modern platinum ash-blonde hair with cool silvery undertones and dark root shadow
Remove all accessories from the scene and identity photo. Both ears must remain bare with natural unpierced earlobes. No earrings, jewellery, glasses, headphones, headbands, hats or other accessories, even if present in the identity photo.

Relight the face to the scene while preserving skin detail. Return one photograph with the same composition and aspect ratio.

Negative constraints: Avoid cropped, cut off, headshot, close up, partial body, missing legs, missing feet, out of frame, floating head, plastic skin, oily face glare, synthetic shine, airbrushed porcelain smoothness, CGI 3D render, cartoon, warped fingers, extra limbs, blurry, low resolution, oversaturated lighting, visible studio softbox lights, photography umbrellas, camera tripods, glasses, sunglasses, headphones, headbands, earrings, necklaces, hats, readable text, logos, watermarks.
```

## Comparison plan

Order A1, B1, B2, A2; same three input images byte for byte; same model/settings; no automatic retries. Compare all outputs, including failures. Rubric: overall face/head outline excluding selected hair; nose proportions; brow structure and spacing accounting for expression; mouth/moustache/goatee configuration accounting for expression; blue eyes/no accessories/hair/scene retained.

two repetitions per arm are exploratory, not statistical proof
no fixed seed; provider randomness remains
negative terms tested together, no individual-term attribution
no harmonizer or new stage1 generation