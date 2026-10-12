# Workflow navigation and voice reference study — 10 October 2026

Status: revised image proposal for review. No product code, generation request or deployment is part of this study.

Later placement decision: workflow-existing-header-study-2026-10-10.md
supersedes this study's separate workspace navigation row. The user selected
Create / Edit / Schedule within the existing Explore / Create a Hook header,
retaining the references and form composition below.

This revision supersedes the Create image in workflow-dark-screens-and-references-2026-10-10.md. Edit and Schedule images from that study retain their prior navigation and have not been revised in this turn.

## User requirements

The audience is first-time users making their first video. The user approved the dark Create composition and visible example gallery, then requested visible Image reference, Video reference and Voice reference controls. They also rejected the detached numbered Create / Edit / Schedule rail. Keep generation references above the brief and keep reference examples visible on the right. Do not borrow a sidebar layout for this work area.

## Selected treatment and reasons

| Element | Placement | User purpose |
| --- | --- | --- |
| Create / Edit / Schedule | Compact navigation inside the workspace header | Shows the current stage and keeps navigation attached to the work. Removes the floating numbered circles and long connector. |
| Image reference | First optional generation card, above the brief | Guides appearance. The label and Choose image action make the input type explicit. |
| Video reference | Second optional generation card, above the brief | Guides scene and motion. Keeps an uploaded generation input distinct from choosing an example to recreate. |
| Voice reference | Third optional generation card, above the brief | Offers audio guidance for vocal delivery. Choose audio communicates the input type; no fake uploaded state or waveform is shown. |
| Optional badge and short group helper | Beside the group title and under it | Makes all three inputs discoverable without implying users must supply them before writing their brief. |
| Model compatibility hint | Immediately below the reference cards | Explains the dependence between guidance inputs and the chosen model. The selected model and estimate are illustrative. |
| References / Your videos | In the right content area | Preserves visible examples and users' results without creating a second permanent output panel. |
| Play and Recreate | Per example card | Separates inspecting an example from selecting it as a starting point. Selection must not initiate paid generation. |
| Generate video | Below brief and output controls | Keeps one clear action after the inputs users need to review. |

## Interaction requirements for implementation

- Treat Create, Edit and Schedule as ordered stages. Edit becomes available after a usable video exists. Schedule becomes available after the finished video is saved. Explain unavailable stages on focus or selection; do not rely on low-contrast text alone.
- Preserve inputs and selected references when returning to a stage or browsing the example gallery.
- Show generation guidance when Generate new video is selected. Use existing video should expose its upload/select flow and preserve the generation draft without presenting irrelevant guidance as required.
- Voice reference guides the generated vocal delivery; it is a different input from optional demo audio or background music in Edit.
- After adding audio, show the actual filename, playable preview, replace and remove controls. Explain compatibility next to that input when relevant and offer an explicit compatible model choice. Do not silently switch the user's model or begin a charge.
- Retain existing filtering, paging, ownership, subscription and generation eligibility behavior.
- On narrow layouts, provide a clearly labelled References entry point and preserve the draft. The desktop image does not establish responsive or keyboard behavior.

## Product facts and proposed scope

The current Hook / Wall-of-text FormatGenerationReferences form exposes image and video inputs, not voice. The separate workflow-generation-client.ts path accepts audioReference and currently gates video/audio guidance on seedance_2_5. Therefore the visible Voice reference card is a requested product proposal, not evidence that the current Hook generation path already supports it. Wiring and validating that path remains implementation work.

The example gallery is grounded in the supplied Hook screen. Its examples and the displayed model/credits are illustrative; the screenshot is not a live account or generation test.

## Visual review

The generated 1584 × 992 desktop frame was visually inspected. All three reference cards and their actions are visible above the brief. The floating numbered rail is removed; the stage navigation is inside the workspace header. The six example cards, References / Your videos, Filter, playback and Recreate actions remain visible on the right. The output settings, estimate and Generate video button fit without clipping.

No interactive acceptance or production claim is made. Focus states, unavailable-stage explanations, audio preview, model compatibility and draft preservation require implementation verification.

## Artifacts and generation

Revised image: output/imagegen/workflow-create-with-references-dark-v2.png

Source image: output/imagegen/workflow-create-with-references-dark.png

Tool: built-in image_gen, one image edit with the actual local source image attached. Original image preserved.

### Full edit prompt

```text
Edit the supplied UGC Pilot desktop workflow screenshot into ONE polished, professional revised Create screen. Preserve the supplied screen's 1584 × 992 landscape aspect ratio, black/charcoal theme, exact brand treatment and restrained orange accent. This is a focused revision of a selected direction, not a fresh redesign.

PRESERVE: the top global header (UGCPilot, Explore, Hook video, help, account); the large rounded workspace; the comfortable wide creation form on the LEFT and visible reference-video gallery on the RIGHT; the existing reference gallery's six portrait examples, References / Your videos tabs, Filter, playback and explicit Recreate actions. Use the actual supplied gallery imagery, preserving the people and thumbnails. The gallery must remain plainly visible without scrolling on this desktop screen. Preserve the form hierarchy, Generate new video / Use existing video selector, instruction textarea and sample content, Length / Shape / Videos / Model & quality row, estimated credits and orange Generate video action. Keep all text sharp and readable. No annotations or red circles.

MAKE ONLY THESE TWO TARGETED CHANGES:
1. Replace the detached, floating numbered Create / Edit / Schedule stepper ABOVE the workspace. Remove that entire floating rail, the numbered circles and its long connector line. Integrate a compact refined three-segment navigation control INSIDE a slim workspace header at the very top of the large panel. Center the control within that panel header. Labels: Create, Edit, Schedule. Create is active with a subtle charcoal selected surface, bright white text and a restrained orange active indicator; Edit and Schedule are secondary muted text. Use moderately sized segments with tight spacing, no numbers, no extra arrows, no timeline connector, no repeated step text. Keep this top row about 52 pixels tall. Move the main panel slightly upward so the new header consumes the space recovered from the old rail. Position the main creation form and gallery below this header, retaining their existing balance. The gallery tabs belong in the gallery area, visually secondary to workflow navigation. This must feel like navigation integrated with the workspace, not a separate onboarding progress decoration.
2. Above the instructions, replace the current two large attachment boxes with THREE equal, COMPACT generation-reference cards in one row within the LEFT form. Group heading: Generation references with a discreet Optional badge. Helper sentence: Guide appearance, motion or delivery. Each card is about one third of the available left-column width and about 125 pixels tall, with a thin muted border and subtle charcoal background, not a giant empty dashed drop zone. Provide a small outline icon, a clear type label and a secondary descriptive line, then a compact outlined add button. Card 1: image icon, Image reference, Appearance, + Choose image. Card 2: video icon, Video reference, Scene & motion, + Choose video. Card 3: microphone icon, Voice reference, Vocal delivery, + Choose audio. All three types MUST be visible and aligned, with Voice reference fully readable. Use a quiet small helper beneath this three-card row: Reference support depends on the model. Do not invent a waveform or pretend an audio file has been uploaded. Do not describe this as background music, narration or voice cloning. Keep this references group ABOVE the brief, as requested.

Continue the selected visual system: near-black canvas #090c0e, charcoal panel #12171b, restrained blue-gray borders, white headings, muted secondary text, vivid orange only for the active stage, generation mode and main action. Use crisp modern sans-serif typography, consistent 8-pixel spacing, modest radii and clear alignment. Preserve title Create your hook; preserve the populated prompt; output controls and CTA must fit entirely without clipping. Do not add unrelated controls or decorative elements. Tiny bottom caption: Design study · illustrative media and data. Output only the revised desktop UI image.
```
