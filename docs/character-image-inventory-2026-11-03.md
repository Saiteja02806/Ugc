# Character image inventory audit — 3 November 2026

Read-only application audit. Compared D:/AI_influncers image files with imagePath entries in lib/characters/influencer-registry.ts and assets under public/explore/influencer-studio. Used byte SHA256 and decoded RGB pixel comparisons; inspected candidate images in a labelled contact sheet. No source code, registry or media changed.

## Results
-121source images total;8under hair style/old treated as archives.113outside archive.
-105/113active-source files have exact byte matches registered in the picker.
-8active-source files unregistered, representing7unique images because the square-jaw caricature is duplicated in root and head_shape.
-All currently registered image paths exist.

## Missing accessory variants
- addons/glasses/ChatGPT Image Oct31,2026,09_50_13PM-2.png: amber aviator sunglasses; no registered entry.
- addons/glasses/ChatGPT Image Oct31,2026,09_50_14PM-3.png: black sunglasses; no registered entry.
- addons/daily patch/04_Pink_Star_Pattern.png: pink star-pattern under-eye patches; distinct from existing Rose Pink Patches, no registered entry.

## Other unregistered source images requiring category decisions
- Root a_crisp_hyper_realistic_high_detail_studio_portr.png and head_shape copy: same exaggerated square-jaw character. Not a distinct missing hairstyle; could be Head Shape/Character Type after review.
- Root a_crisp_hyper_realistic_studio_headshot_portrait.png: older dark blunt-bob portrait. Public hair-style/sleek-pixie.png is an exact file match but is NOT registered. Existing Blunt Bob/Natural Bob are separate images, so no byte/pixel match claimed.
- Root a_hyper_realistic_studio_lit_ultra_detailed_clos.png: exaggerated glasses/moustache closeup, no registered entry.
- hair style/08_glasses_mustache.png: related glasses/moustache character with bowl cut, no registered entry; avoid importing the face/accessory traits as a haircut without role separation.

## Public assets with no picker entry
-6older background JPGs: car-interior, clean-studio, cozy-bedroom, cozy-living-room, modern-kitchen, office-desk.
-4older hairstyle PNGs: curls-afro, rugged-crop, sleek-pixie, wavy-textured. Names do not reliably describe their actual hairstyles; visual review showed tall flat top, rugged short crop, blunt bob and braided updo respectively. These are absent, but some overlap existing hairstyle concepts; do not count as4new unique designs automatically.
-ai_influencer_fullbody_portrait.jpg is also not a trait entry; likely sample/reference material, purpose not verified.
-7long-filename background PNGs and3named character PNGs are decoded-pixel duplicates of registered assets; not missing options.

All seven supplied background images,29outfits,6builds,3characters,6country references,11eye shapes,3heights and4neck references are registered. Head_shape9/10files registered; addons8/11; active hair-style19/20. Root3files unregistered; duplicate source count explained above.

Evidence `.tmp/character-inventory/exact.json`, enriched.json, visual-paths.json and missing-contact.jpg. No browser/paid generation needed or performed for this source inventory; production deployment state not audited. Report identifies gaps, not authorization to import every old/sample asset.

## Exact unmatched active-source paths
- D:\AI_influncers\a_crisp_hyper_realistic_high_detail_studio_portr.png
- D:\AI_influncers\a_crisp_hyper_realistic_studio_headshot_portrait.png
- D:\AI_influncers\a_hyper_realistic_studio_lit_ultra_detailed_clos.png
- D:\AI_influncers\hair style\08_glasses_mustache.png
- D:\AI_influncers\head_shape\a_crisp_hyper_realistic_high_detail_studio_portr.png
- D:\AI_influncers\addons\daily patch\04_Pink_Star_Pattern.png
- D:\AI_influncers\addons\glasses\ChatGPT Image Oct 31, 2026, 09_50_13 PM-2.png
- D:\AI_influncers\addons\glasses\ChatGPT Image Oct 31, 2026, 09_50_14 PM-3.png
