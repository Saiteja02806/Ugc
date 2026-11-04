# Controlled stage2 reference isolation inputs — 4 November 2026

Eight planned direct provider diagnostic calls, two per condition, with the exact same shared v3 prompt/settings and unchanged primary reference. These are assistant-selected test inputs from earlier failed job eb15d5d4-5e0d-4548-aecc-a8b4c4b358ce. No new app jobs/credits or stage1 generation. Provider calls are billable.

## All selected traits

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

## Run order

A1, B1, C1, D1, D2, C2, B2, A2

## Exact image inputs by condition

### A: Original scene and original haircut portrait

Image 1: scene, 1536x2752, SHA256 23ee1ac7dd1989d3050ce6b9255c6ab4c28f9f07d5125ead17494d8296f05bae
![scene](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/openrouter-image-scene-v1.png)

Image 2: primary identity, 1254x1254, SHA256 720991b8ab157033b6dc0aec6a18f6894ed5bc311cf20bece71569bccf5b4cb1
![primary identity](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-1.jpg)

Image 3: hairstyle, 768x1024, SHA256 c3e0af4d3cfe9636a567e9772350793b114851a0e5ddaec2a9adbfbd5eaf695f
![hairstyle](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-5.jpg)

### B: Original scene; haircut face suppressed

Image 1: scene, 1536x2752, SHA256 23ee1ac7dd1989d3050ce6b9255c6ab4c28f9f07d5125ead17494d8296f05bae
![scene](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/openrouter-image-scene-v1.png)

Image 2: primary identity, 1254x1254, SHA256 720991b8ab157033b6dc0aec6a18f6894ed5bc311cf20bece71569bccf5b4cb1
![primary identity](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-1.jpg)

Image 3: hairstyle, 768x1024, SHA256 0e119575a8b863bff905dbc5a3738cba8a94753f626ee13808fb81ca6ed4aff5
![hairstyle](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-isolation-v3-20261104/hair-face-suppressed.png)

### C: Scene face suppressed; original haircut portrait

Image 1: scene, 1536x2752, SHA256 2e08a94945c485c423e476757ba93314bae5062864cb41fec2e2b2eb08f4ae1b
![scene](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-isolation-v3-20261104/scene-face-suppressed.png)

Image 2: primary identity, 1254x1254, SHA256 720991b8ab157033b6dc0aec6a18f6894ed5bc311cf20bece71569bccf5b4cb1
![primary identity](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-1.jpg)

Image 3: hairstyle, 768x1024, SHA256 c3e0af4d3cfe9636a567e9772350793b114851a0e5ddaec2a9adbfbd5eaf695f
![hairstyle](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-5.jpg)

### D: Scene face and haircut face both suppressed

Image 1: scene, 1536x2752, SHA256 2e08a94945c485c423e476757ba93314bae5062864cb41fec2e2b2eb08f4ae1b
![scene](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-isolation-v3-20261104/scene-face-suppressed.png)

Image 2: primary identity, 1254x1254, SHA256 720991b8ab157033b6dc0aec6a18f6894ed5bc311cf20bece71569bccf5b4cb1
![primary identity](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-1.jpg)

Image 3: hairstyle, 768x1024, SHA256 0e119575a8b863bff905dbc5a3738cba8a94753f626ee13808fb81ca6ed4aff5
![hairstyle](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-isolation-v3-20261104/hair-face-suppressed.png)

## Original background — provenance only, not a separate stage2 input
![Bedroom](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-2.jpg)

## Shared complete prompt, including unchanged negative constraints

```text
CHARACTER STAGE 2: PRIMARY FACIAL IDENTITY.

Image 1 supplies background, camera, framing, body, pose, clothing and lighting. Preserve these and both feet when visible. Correct the face, selected hairstyle and accessories as instructed below, even when Image 1 is wrong. Selected eye and hair colors override reference colors.

Image 2 is the ONLY facial identity authority. Preserve its distinctive facial geometry and facial hair, including the moustache. Do not beautify, replace or average that person. Do not copy its background, outfit or accessories.

Image 3 supplies ONLY the selected hairstyle. Match haircut length, silhouette, strand texture and fringe; apply the selected hair color. Ignore neutral isolation patches and all non-hair content. Never transfer this person's facial identity. Ignore this reference person's face, facial hair, skin, eyes, clothing and background; never blend their identity with Image 2.

Neutral patches are reference-isolation aids, never subject appearance. Reconstruct the face in Image 1 from Image 2 and do not reproduce any patch.

Preserve the primary identity photo's distinctive facial proportions, brows, nose, lips, jaw and facial hair, including its moustache when present. Do not average it with other people.
Selected overrides take priority over the identity photo: piercing sky-blue eyes with intricate iris fiber patterns and dark outer limbal ring
Preserve the primary identity photo's head shape.
Apply only the selected eyelid shape and skin tone; preserve the primary face's other proportions, eye spacing, nose, lips and facial hair: bright alert eyes, glassy reflections with natural eye catchlights, engaged creator gaze light olive skin tone with soft neutral-warm undertones, healthy matte skin finish
Correct the scene hairstyle to the selected haircut reference, including its length, texture, silhouette and fringe; do not retain an incorrect scene hairstyle. short textured crop. Use this photo for the haircut only, and apply the selected hair color modern platinum ash-blonde hair with cool silvery undertones and dark root shadow
Remove all accessories from the scene and identity photo. Both ears must remain bare with natural unpierced earlobes. No earrings, jewellery, glasses, headphones, headbands, hats or other accessories, even if present in the identity photo.

Relight the face to the scene while preserving skin detail. Return one photograph with the same composition and aspect ratio.

Negative constraints: Avoid cropped, cut off, headshot, close up, partial body, missing legs, missing feet, out of frame, floating head, plastic skin, oily face glare, synthetic shine, airbrushed porcelain smoothness, uncanny valley, CGI 3D render, cartoon, doll, distorted anatomy, warped fingers, extra limbs, bad eyes, blurry, low resolution, oversaturated lighting, visible studio softbox lights, photography umbrellas, camera tripods, glasses, sunglasses, headphones, headbands, earrings, necklaces, hats, readable text, logos, watermarks.
```

## Acceptance

Primary face resemblance excluding requested hair/eye/skin modifications and expression changes; Nose/brow/jaw and facial-hair configuration; Selected blue eyes, platinum crop and no accessories; Room, jacket, body pose and full framing preserved; No neutral-patch artifacts

Two repetitions per condition are exploratory, not statistical reliability
Scene face region manually reviewed for this one frozen scene, not automatic production face detection
Character v3 production candidate uses reviewed hairstyle isolation; scene suppression remains experimental
No new stage1 or harmonizer, all outputs saved before any visual selection