# Workflow visual directions — 10 October 2026

Status: two candidate image studies. No production UI change or chosen final design.

## The job

A first-time user needs to create an opening video for Talking Head + Demo.
The screen must distinguish generating a new clip from using existing footage,
explain optional inputs, and make the next action and its cost clear.

The user rejected the prior concepts as visually poor and requested image
exploration. The user also explicitly requested optional references above the
brief. These are direct requirements; preference for either new layout is
still unknown.

## Candidate A: Unified production brief

References sit in a horizontal attachment strip above the writing field.
Source choice, references, brief, output settings and generation action share
one composed work surface.

Recommended candidate for the next interactive prototype. Its sequential
reading order makes it easier to trace the intended inputs to one generation
request. This is a design hypothesis, not measured customer performance.

Tokens: fog canvas #EDF1F5, paper #FFFFFF, inset #F5F7FA, ink #202A38,
divider #D7DEE7, brand orange #F5774E. Heading role: Sora-like grotesk;
body: Source Sans 3-like humanist; utility: monospace.
Signature: media attachments stitched into a single production brief.

Image: [Unified production brief](../../output/imagegen/workflow-unified-brief.png)

## Candidate B: Studio brief with output inspector

A compact reference strip spans the workspace ABOVE the brief. Below it,
writing takes roughly two thirds of the space; output settings occupy the
remaining third. A shared action footer makes the two zones inputs to the
same generation request.

The initial generated version placed references in a left tray. That version
was rejected during self-review because it resembled the structure the user
had already criticized and did not put every reference physically above the
brief. The final image corrects both problems.

Alternative for testing whether separating writing from output settings helps
people concentrate. Its risk is more horizontal scanning and narrower writing
space. On small screens the inspector must move below the brief.

Tokens: mist #E9EDF3, slate header #26364A, paper #FFFFFF, tray #F0F4F8,
ink #1B2B3C, divider #CFD8E3, brand orange #F5774E.
Heading role: Space Grotesk-like; body: IBM Plex Sans-like; utility: mono.
Signature: an attachment strip over a writing surface and output inspector.

Image: [Studio brief with output inspector](../../output/imagegen/workflow-output-inspector.png)

## Element decisions

| Element | Why it belongs here |
| --- | --- |
| Workflow name and Explore link | Confirm the chosen format and provide an exit. |
| Create / Edit / Schedule | Explain real artifact dependencies and support returning to prior work. |
| Generate new video / Use existing video | Choose the opening's source before exposing generation inputs. |
| AI references, Optional | Explain that attachments guide a new result and can be skipped. |
| Reference controls above the brief | Follow the user's requirement and let the person inspect their inputs before describing the desired result. |
| Image, video and voice labels | Separate appearance, scene/motion and vocal delivery; these do not create three additional assets. |
| Selected attachment and removal | Reveal which media influence the request and allow correction. |
| Required brief | Supply the actual instructions; largest writing input because the person must compose here. |
| Length, shape and quantity | Describe the paid output and expose choices that affect scope. |
| Model & quality disclosure | Preserve real capability choices without giving every technical control equal prominence. |
| Estimate beside Generate opening | Make the paid consequence visible where the decision happens. |
| Result preview after generation | Provide media for evaluation when it exists, without reserving a large empty player first. |

Putting references above the brief does not make them mandatory. The existing
video branch must hide generation references and instructions, then offer
upload or Creative Assets and proceed to editing with that exact clip.

## Visual critique

Both images preserve the requested reference placement and distinguish source
choice from guidance. The final B has unselected video/voice references shown
as add controls; its selected image has a removal action. Neither candidate
reserves a large empty video player or introduces a second navigation sidebar.

The generated headings and reference areas still need tighter sizing in an
interactive design, particularly B's oversized task heading. A's reference
controls can also be made shorter so optional inputs do not dominate the brief.
These are directions to refine, not raster specifications to copy pixel for
pixel. Existing application navigation must be retained outside the workspace;
the illustrated app chrome is not authorization to redesign global navigation.

## What the images can and cannot establish

Images can help judge hierarchy, density, attachment placement, visual tone
and perceived professionalism. They do not prove usability, accessibility,
model compatibility or production behavior.

All sample inputs, thumbnails and the 10-credit estimate are illustrative.
No new cost, model-support or generation-result claim is being made.

Next: select a visual direction, build one interactive prototype, then observe
a novice generating without references, generating with a reference, and
reusing an existing clip. Check whether the person predicts each action's
outcome correctly and can complete it without explanation. Also check empty,
selected, incompatible-reference, loading, failure and result states before
implementation. Appearance alone is insufficient for acceptance.

## Generation record

Tool: built-in image_gen. A is a new image generation. B began as a separate
new image and was edited after self-review. The prior rejected HTML/sidebar
layout was not used as a visual reference.

Final workspace assets:
- output/imagegen/workflow-unified-brief.png
- output/imagegen/workflow-output-inspector.png

### Prompt A

```text
Use case: ui-mockup.
Asset type: a high-fidelity desktop product-interface design image for UGCPilot, an AI UGC video creation app. This is a design study for a first-time customer making their first video, not a promotional landing page.
Render a crisp flat front-on 1600-by-1000-style desktop UI screenshot, not a photograph of a monitor, no perspective. Make the UI professionally finished, legible, practical and specific to creating a talking-head opening followed by optional demo footage. Show only one whole interface per image; no split comparison boards.
Product truths: stages are Create, Edit, Schedule. The opening can be generated by AI OR the user can reuse an existing clip. Optional image/video/voice references only guide a newly generated video. Using an existing clip bypasses AI generation. References must appear ABOVE the written generation brief in reading order. Do not create a fourth stage. The app's existing primary navigation is outside this design; focus the image on the workflow workspace, do not invent a large sidebar or nested navigation rail.
Hierarchy: quiet top app header with UGCPilot wordmark left, back link 'Explore', workflow name 'Talking Head + Demo'; compact horizontal three-stage navigation with 'Create' active and 'Edit' and 'Schedule' inactive. Current task heading 'Create your opening'. A segmented source choice 'Generate new video' (selected) and 'Use existing video'. Below this source choice show the reference group, followed by the required brief and then output settings and one dominant generation action. No large empty video player in the creation state.
Exact UI copy, sentence case, no duplicate labels: 'AI references' and secondary 'Optional'; reference controls 'Image reference' with 'Appearance', 'Video reference' with 'Scene & motion', and 'Voice reference' with 'Vocal delivery'. A subtle helper 'Guide the result. You can skip these.' Required brief label 'What should the creator say and do?' The brief contains realistic sample text: 'Introduce our project app in a relaxed home office. Say: “Keep your team aligned without another meeting.” Use a friendly, direct delivery.' Show this as typed illustrative content, not as a marketing headline. Output controls: 'Length' '5 seconds'; 'Shape' 'Portrait · 9:16'; 'Videos' '1 video'; quiet expandable 'Model & quality' with 'Kling 3.0 · 720p'. Main action 'Generate opening'. Beside it 'Example estimate' '10 credits'. Put a tiny footer 'Design study · illustrative inputs and estimate'.
No mandatory language on references. Never label any reference control 'Create image' or 'Create video'. No duplicated upload for the same purpose. No fake completion, progress percentages, testimonials, account balance, performance claims, decorative graphs, confetti, gradients, giant onboarding illustration, gratuitous empty player, or multiple primary buttons. No huge text or airy dashboard of rounded cards. No pricing or upgrade banners.
Professional qualities: disciplined alignment, a readable 14-to-16px equivalent UI text scale, one 28-to-30px task heading, high contrast, generous-but-efficient spacing, precise thin dividers, 6-to-10px radius control corners, restrained shadows, hand-designed details. Main brand accent is muted warm orange #F5774E, used sparingly on selected stage and the primary action. The signature is an elegant reference attachment treatment resembling an organized video-production brief, not a copied navigation sidebar. Any thumbnail must be obviously a small reference attachment, not a generated result.
Direction A — Unified production brief, my preferred candidate.
Layout: one broad integrated workspace centered under the stage navigation with a usable content width about 1020px. Within one carefully structured white work surface, source choice is first, then a compact horizontal strip of three reference attachment slots at the TOP, then a wide brief writing field, then a quiet output-settings bar. Do not put each section in a separate floating card; use material differences and slim rules to give hierarchy. Attachments are three compact landscape slots with small outline icons and plus controls, clear filenames if selected; image reference can show a small 48px natural creator headshot with the label 'creator.jpg', while video and voice remain empty. A selected image clearly has a remove cross. No oversized file-drop rectangles. Input is about 180px high, spacious for writing but not a huge empty canvas. The action footer is integrated into the bottom of the work surface, estimate left and orange button right.
Color tokens: fog canvas #EDF1F5, white paper #FFFFFF, pale slate inset #F5F7FA, ink #202A38, divider #D7DEE7, brand orange #F5774E. Type: a restrained modern grotesk heading resembling Sora, humanist readable body resembling Source Sans 3, quiet monospace for dimensions. The bold design choice is that the form reads as one composed production brief with a reference strip stitched to the top, not a stack of generic SaaS cards. Slight cool neutral ambience with a high-quality light professional application look. Make refs above brief absolutely unmistakable.
```

### Initial prompt B

This generated draft was discarded from the final pair.

```text
Use case: ui-mockup.
Asset type: a high-fidelity desktop product-interface design image for UGCPilot, an AI UGC video creation app. This is a design study for a first-time customer making their first video, not a promotional landing page.
Render a crisp flat front-on 1600-by-1000-style desktop UI screenshot, not a photograph of a monitor, no perspective. Make the UI professionally finished, legible, practical and specific to creating a talking-head opening followed by optional demo footage. Show only one whole interface per image; no split comparison boards.
Product truths: stages are Create, Edit, Schedule. The opening can be generated by AI OR the user can reuse an existing clip. Optional image/video/voice references only guide a newly generated video. Using an existing clip bypasses AI generation. References must appear ABOVE the written generation brief in reading order. Do not create a fourth stage. The app's existing primary navigation is outside this design; focus the image on the workflow workspace, do not invent a large sidebar or nested navigation rail.
Hierarchy: quiet top app header with UGCPilot wordmark left, back link 'Explore', workflow name 'Talking Head + Demo'; compact horizontal three-stage navigation with 'Create' active and 'Edit' and 'Schedule' inactive. Current task heading 'Create your opening'. A segmented source choice 'Generate new video' (selected) and 'Use existing video'. Below this source choice show the reference group, followed by the required brief and then output settings and one dominant generation action. No large empty video player in the creation state.
Exact UI copy, sentence case, no duplicate labels: 'AI references' and secondary 'Optional'; reference controls 'Image reference' with 'Appearance', 'Video reference' with 'Scene & motion', and 'Voice reference' with 'Vocal delivery'. A subtle helper 'Guide the result. You can skip these.' Required brief label 'What should the creator say and do?' The brief contains realistic sample text: 'Introduce our project app in a relaxed home office. Say: “Keep your team aligned without another meeting.” Use a friendly, direct delivery.' Show this as typed illustrative content, not as a marketing headline. Output controls: 'Length' '5 seconds'; 'Shape' 'Portrait · 9:16'; 'Videos' '1 video'; quiet expandable 'Model & quality' with 'Kling 3.0 · 720p'. Main action 'Generate opening'. Beside it 'Example estimate' '10 credits'. Put a tiny footer 'Design study · illustrative inputs and estimate'.
No mandatory language on references. Never label any reference control 'Create image' or 'Create video'. No duplicated upload for the same purpose. No fake completion, progress percentages, testimonials, account balance, performance claims, decorative graphs, confetti, gradients, giant onboarding illustration, gratuitous empty player, or multiple primary buttons. No huge text or airy dashboard of rounded cards. No pricing or upgrade banners.
Professional qualities: disciplined alignment, a readable 14-to-16px equivalent UI text scale, one 28-to-30px task heading, high contrast, generous-but-efficient spacing, precise thin dividers, 6-to-10px radius control corners, restrained shadows, hand-designed details. Main brand accent is muted warm orange #F5774E, used sparingly on selected stage and the primary action. The signature is an elegant reference attachment treatment resembling an organized video-production brief, not a copied navigation sidebar. Any thumbnail must be obviously a small reference attachment, not a generated result.
Direction B — Reference desk, a structurally different candidate.
Layout: below source choice, use a 34/66 two-column composition inside one coherent workspace. The left zone holds 'AI references' 'Optional' and three horizontal attachment rows arranged vertically, all beginning at the top of the page. The right wider zone starts a few pixels BELOW the reference heading and holds the large required brief. This makes references top-left in reading order before the brief; no reference controls beneath the brief. The reference zone is a quiet attachment tray, NOT a sidebar: no tabs, nav items, active states, numbered section menu or navigation semantics. Each row has a purposeful compact small icon/thumbnail, clear label/subtitle and a plus action; selected image can show a natural creator thumbnail and 'creator.jpg'. A subdued helper under the tray explains 'Guide the result. You can skip these.' The right zone has enough space for comfortable writing. Under both zones a FULL-width integrated output toolbar and action footer cross the workspace; this shared baseline reinforces that both columns are inputs to one generation, not separate sections.
Color tokens: mist canvas #E9EDF3, deep slate header #26364A, white main paper #FFFFFF, subtle blue-grey reference tray #F0F4F8, ink #1B2B3C, thin divider #CFD8E3; preserve orange #F5774E as main action only. Typography: strong compact grotesk heading resembling Space Grotesk, highly readable humanist UI body resembling IBM Plex Sans, utility mono for aspect ratio. The restrained aesthetic risk is the inky blue horizontal stage header paired with the white composed workspace and media-input tray. Avoid the generic all-dark/orange template. Distinctive studio utility, stronger visual separation for users who already have reference assets. Retain professional, dense-enough layout; no giant player, no duplicate sidebar.
```

### Final correction prompt B

Edit target: the initial generated B image, preserving its visual style while
correcting reference placement and the workspace structure.

```text
Use case: ui-mockup. Edit target: the attached UGCPilot design image, a first-time-user workflow screen. Preserve its professional light palette, dark slate app header, UGCPilot logo, workflow title, stage navigation, typography quality, Create heading and two source options. Change the workspace structure as follows, do not preserve the left reference column.

Main correction: ALL THREE OPTIONAL REFERENCES MUST BE IN A COMPACT FULL-WIDTH HORIZONTAL STRIP ABOVE THE BRIEF, never beside it or underneath it. A first-time user reads source choice, references, brief, output settings, generation action in that order. No left panel, no reference sidebar, no navigation rail. The current target incorrectly puts references left of the brief; replace that.

This revised direction should differ from a simple stacked form: build a composed studio brief with a slim top attachment strip and a large comfortable writing surface below on the LEFT about 70% width, plus a narrow output-settings inspector on the RIGHT about 30% width. Only output choices live in that right zone, not references or navigation. It is part of the same white work surface with a quiet vertical divider, not a floating card or reused sidebar menu. The shared action footer spans both zones. Keep everything inside the viewport with adequate margins and a balanced, compact high-fidelity application layout. Flat front-on screenshot, no device frame.

Top attachment strip has 'AI references' and a small 'Optional' label with 'Guide the result. You can skip these.' Three elegant inline attachment controls, one compact thumbnail/filename 'creator.jpg' with a REMOVE CROSS for 'Image reference' 'Appearance'; two outline-icon plus controls 'Video reference' 'Scene & motion', 'Voice reference' 'Vocal delivery'. The unselected video/voice controls have NO thumbnail, waveform or selected filename. All reference controls are ABOVE both the writing surface and output settings. Avoid large dashed upload rectangles and card-within-card piles. The reference strip should use less than one fifth of the content height.

Below the strip, large left brief has exact label 'What should the creator say and do?' and sample content 'Introduce our project app in a relaxed home office. Say: “Keep your team aligned without another meeting.” Use a friendly, direct delivery.' Remove the invented 131/2000 character counter completely. Below the brief field a quiet helper 'Describe the words, delivery and setting.' On the right, inspector heading 'Output' and four neatly aligned stacked controls 'Length' '5 seconds'; 'Shape' 'Portrait · 9:16'; 'Videos' '1 video'; 'Model & quality' 'Kling 3.0 · 720p'. Compact enough to fit beside brief, not a towering options menu. Main action lower-right 'Generate opening', lower-left 'Example estimate' '10 credits'. Exactly one orange primary action. 'Generate new video' remains selected; 'Use existing video' remains the alternative. Footer 'Design study · illustrative inputs and estimate'.

Typography is restrained; make the task heading about 28–30px equivalent rather than oversized. Use cool blue-grey canvas, white paper, ink #1B2B3C, subtle divider #CFD8E3, deep slate #26364A and sparse warm orange #F5774E. No gradients, neon, glowing borders, promotional copy, progress percentages, fake result preview, fourth stage, extra CTA, duplicated references, or nested sidebars. All text must be crisply readable and correctly spelled. This is a visual candidate, no production pricing claim.
```

