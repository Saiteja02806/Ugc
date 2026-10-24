# Starting-frame prompt validation

User prefers Gemini 3 Pro over Seedream 5.0 Pro and requests prompt validation before the GPT 2.5 Sunburst comparison. Revised candidate means opt-in starting-frame prompt v5, not another model or a production replacement. V4 remains the selected baseline; this version numbering is separate from Hook text Remix prompt versions.

## Mechanical audit completed

Ran outputs/recreate-ui-preview/audit-sent-prompts.mjs against all twelve completed Gemini/Seedream request artifacts. For each of three scenes and both prompt versions, verified the current compiler reproduces the frozen base prompt exactly; prompt SHA-256, actual input byte hashes, four-image order, identical labels, model and version binding, receipt request IDs and saved output hashes all match. Seedream received the entire same base prompt plus IMAGE INPUT ORDER and the four labels. No truncation, missing reference, local version mismatch or later-motion prompt was found. All six full Seedream prompts fit the 4,000-character contract: v4 2,717–2,770; v5 3,509–3,562. Twelve unique completed request IDs were checked.

Image 1 is source scene; Image 2 main person; Images 3/4 supporting photos. Runner code constructs provider arrays in this order. Gemini interleaves a label before each image, whereas Seedream appends the labels to its text prompt. Both use inline image bytes, via different API structures. Gemini outputs were requested at 2K, Seedream at 1K. These differences prevent calling the exercise perfectly controlled across models. Evidence validates local prepared/submitted construction and saved receipts, not independently retained provider request bodies or internal model conditioning. No new inference calls were made in this audit.

## Wording review

The shared task matches the user's chosen direction: generate a new photograph of the selected person in the source situation. It explicitly assigns scene and facial roles, asks for source pose/expression and creator-caption removal, and preserves physical object labels. It does not instruct retaining the source person's identity. Correctly supplied instructions do not guarantee compliance.

V4 permits composition interpretation through “as a guide” and “Compose the scene naturally.” V5 strengthens preservation, but the generated samples show that this can coincide with retaining source-performer appearance. That observation does not isolate a causal mechanism.

The source-matched glasses opening description says “held forward just above the face.” This can be read as forehead placement; the actual source shows the glasses angled in front of/across the face with their lenses on screen-right. A proposed clearer description is: “The screen-right hand holds the clear eyeglasses in front of the face, with the lenses on screen-right and the temples extending diagonally across the forehead; eyes are mostly closed and the mouth is open. Follow the visible image for their position and angle.” This is a proposed targeted wording correction, not a changed production prompt or a proven improvement. Do not modify historical prompts/receipts.

Keyboard and can opening descriptions agree broadly with the visible frames. No long manually focused scene descriptions from earlier experiments were substituted into these v4/v5 batches. All twelve images omit creator captions on prior visual inspection; exact physical label transcription was not validated.

## Next comparison

Use the user's preferred Gemini 3 Pro and the current v4 baseline as the comparison starting point. For a model-only Sunburst comparison, freeze identical prompt text, main/supporting photos and source images; disclose native output settings and differing API role representations. If the glasses description is changed, generate a fresh Gemini baseline with that same change rather than comparing against the previous unchanged Gemini sample. No paid Sunburst request, production prompt change or deployment was made during this validation.
