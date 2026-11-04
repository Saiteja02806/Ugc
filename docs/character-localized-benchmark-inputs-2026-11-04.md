# Localized character identity benchmark inputs — 4 November 2026

{
  "createdAt": "2026-11-04T06:59:52.963Z",
  "sourceJob": "eb15d5d4-5e0d-4548-aecc-a8b4c4b358ce",
  "method": "localized generative face replacement with deterministic masked compositing; not biometric swap",
  "maxProviderCalls": 2,
  "runOrder": [
    "L1",
    "L2"
  ],
  "crop": {
    "left": 576,
    "top": 256,
    "width": 512,
    "height": 512
  },
  "blendEllipse": [
    0.5,
    0.57421875,
    0.302734375,
    0.3515625,
    0.271484375
  ],
  "blendFeatherSigma": 3,
  "refs": [
    {
      "file": ".tmp/character-localized-benchmark-20261104/context-face-suppressed.png",
      "role": "target face context with wrong face suppressed",
      "mimeType": "image/png",
      "sha256": "5bf551e668bf53ca0b5466553e4a99c44cd3a0c25060a781f7466e7216935957"
    },
    {
      "file": ".tmp/character-stage2-traits-20261104/ref-1.jpg",
      "role": "sole primary identity",
      "mimeType": "image/jpeg",
      "sha256": "720991b8ab157033b6dc0aec6a18f6894ed5bc311cf20bece71569bccf5b4cb1"
    }
  ],
  "promptSha256": "3812c85cc22e2537fa926547ff2c3c6ea1e46e0dc97d96456109a57a8c4ee69c",
  "payloadSha256": "79d9601d623384bd96fc3154664bef0f134f89f1af13599ad0ccdd9acff74508",
  "selection": {
    "characterTypeId": "char_extreme",
    "backgroundId": "bg_cozy_floral_bedroom",
    "genderId": "gender_male",
    "ethnicityId": "ethnicity_middle_eastern",
    "ageId": "age_young_adult",
    "skinToneId": "skin_light_olive",
    "headShapeId": "head_keep_existing",
    "neckId": "neck_standard",
    "eyeShapeId": "eye_vibrant_open",
    "eyeColorId": "eye_color_blue",
    "hairStyleId": "hair_textured_crop",
    "hairColorId": "hair_color_platinum",
    "outfitId": "outfit_2025_leather_jacket",
    "outfitColorId": "outfit_color_red",
    "heightId": "height_tall",
    "buildId": "build_natural",
    "accessoryIds": [],
    "framing": "full"
  },
  "labels": {
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
  },
  "settings": {
    "model": "google/gemini-3-pro-image",
    "modalities": [
      "image"
    ],
    "image_config": {
      "aspect_ratio": "1:1",
      "image_size": "2K"
    },
    "seed": "not supplied",
    "temperature": "not supplied",
    "timeoutMs": 120000
  },
  "limits": [
    "Different localized approach benchmark, not a single-factor extension of full-frame matrix",
    "No new hair reference is sent; existing scene hair is retained",
    "Full-body framing negatives omitted from patch request because final framing is preserved by compositing",
    "Final pixels outside the finite crop remain original; identity and seam quality still require visual review"
  ]
}

## Exact model inputs

target face context with wrong face suppressed
![target face context with wrong face suppressed](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-localized-benchmark-20261104/context-face-suppressed.png)

sole primary identity
![sole primary identity](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-1.jpg)

## Hairstyle/background provenance, not extra inputs
![Hairstyle](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-5.jpg)
![Background](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-traits-20261104/ref-2.jpg)

## Full prompt including effective negative constraints

```text
LOCALIZED CHARACTER FACE REPLACEMENT — return this cropped image, not a full-body composition.

Image 1 is a 512x512 context crop from the fixed scene. Its neutral gray patch hides the wrong face. Reconstruct a natural face in that region using Image 2. Preserve Image 1 head position, scale, surrounding platinum short haircut, background, clothing edges and lighting. Do not copy or regenerate the gray patch.

Image 2 is the sole facial identity authority. Reproduce its distinctive face shape, cheek and chin proportions, nose bridge/length/tip, eyebrow arches, eye spacing, lips, sparse moustache and small chin patch. Do not average this person with a generic attractive face. Do not add a beard or change their distinctive proportions. The expression can adapt naturally; likeness matters more than making the mouth identical.

Explicit selected modifications: Ice Blue irises in both eyes; bright alert eyelids without changing eye spacing; light olive skin tone. Keep the selected platinum short hairstyle from Image 1, not Image 2 hair. Keep ears bare; no earrings, glasses, jewelry, headphones or other accessories.

Return one square photograph of the same cropped context. Only the face will be blended back into the original full-body scene. Do not introduce a new crop, head position, scene or outfit.

Negative constraints: Avoid plastic skin, oily face glare, synthetic shine, airbrushed porcelain smoothness, uncanny valley, CGI 3D render, cartoon, doll, distorted anatomy, warped fingers, extra limbs, bad eyes, blurry, low resolution, oversaturated lighting, visible studio softbox lights, photography umbrellas, camera tripods, glasses, sunglasses, headphones, headbands, earrings, necklaces, hats, readable text, logos, watermarks.
```