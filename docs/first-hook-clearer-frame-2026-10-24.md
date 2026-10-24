# Clearer frame for the first Hook reference

The first displayed reference in the user's screenshot is Hook 100: `explore-paired-hook-fc44f6214b6e17413600ec13`, [original source](https://www.instagram.com/reel/DeacvdqpkvR/). Its source caption is “POV: you finally understand how to use Claude for marketing.”

## Selection and evidence

Reviewed all **112 decoded frames** of the 3.733333-second source across two contact sheets, then inspected full-resolution frames 61, 70 and 80. The opening shows an angled face, reflective glasses and a hand touching the glasses. Selected **frame 70 at elapsed 2.333333 seconds**, absolute presentation timestamp 2.399349 seconds: both eyes and the complete face are visible toward the camera, the glasses are off and no hand overlaps the face. Source resolution is 720×1280.

- Source SHA-256: `405670a27856c31e698a0ef13b178ece82c18cc379c0cec7489b0c1c1414fa1e`.
- Selected PNG SHA-256: `df452e82eadb2e7ed8338f34e2424e623b59ef4015d646a2a3c89d63a34d5a9c`.
- Packaged asset: `public/explore/curated-hook-frames/v1/df452e82eadb2e7ed8338f34e2424e623b59ef4015d646a2a3c89d63a34d5a9c.png`.
- Full-image comparison: `outputs/first-hook-clearer-frame-2026-10-24/comparison.png`.
- Probe, two contact sheets, five detail candidates and exact selection metadata: `outputs/first-hook-clearer-frame-2026-10-24/`.

This is an additional user-requested replacement after the original twenty approvals; those twenty catalog bindings and their frozen approval record remain unchanged. The current runtime catalog contains **21** selections. Hook 88 remains unapproved and keeps its opening. Discovery visibility and the 104-reference count are unchanged.

## Runtime behavior and tradeoff

Recreate now resolves this exact selected PNG using the same source hash, dimensions, frame index, timestamp and asset hash verification as the prior replacements. Both source-preview and image-admission route tracing already include all assets in the curated-frame directory. The source video and gallery playback remain intact.

The selected image begins **after glasses removal**. Adapted motion starts from the bare-eyed questioning expression, with a small side glance, subtle brow/mouth movement and blink. It expressly keeps the glasses off and hands below the face. It does not direct another glasses-removal gesture or promise the original opening chronology. The raw source still contains captions; caption omission belongs to the existing image-generation prompt, not destructive editing of the reference video.

New preparations use the exact version-3 selected-frame binding. Existing version-2 frame-zero drafts/receipts remain readable. Updating a restored preparation to the new selected source upgrades only the current preparation and clears its stale current approval; existing frozen accepted-request inputs and saved output receipts remain unchanged. Starting-frame history can still derive motion for the old frame-zero receipt.

## Local validation

Twenty-three tests pass across curated assets, drafts and prompt previews. They verify all 21 packaged PNG hashes and exact frame metadata, matching browser/worker receipt input keys, frame-bound motion, unknown/corrupt selection rejection and hidden-reference behavior. New regression checks compare every original approval against the unchanged frozen twenty-item manifest, and exercise Hook 100's old approved frame-zero receipt alongside the new preparation.

No AI regeneration, video generation, push or deployment was performed for this selection. This is source-frame and transport validation, not a claim of generated-image likeness or animation quality. Production acceptance follows a later deployment.
