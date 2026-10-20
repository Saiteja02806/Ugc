# Dark workflow screens and reference gallery — 10 October 2026

Status: image studies for review, not a production implementation.

The later workflow-navigation-and-voice-study-2026-10-10.md supersedes this
study's Create navigation and attachment treatment. At the user's request it
adds visible voice guidance as a proposed capability and integrates the stages
into the workspace header. Edit and Schedule below remain earlier studies.
## Generated-image review

All three requested stage images were visually inspected after generation.
Create shows References / Your videos and six preview cards on the right,
with visible Play and Recreate actions. The form has substantially more width
than the supplied existing screenshot, and optional attachments remain above
the brief. The reference media are derived from the supplied gallery screenshot;
their presence in a study does not claim live catalog access or a changed gate.

Edit shows an opening/demo sequence, selected demo, conditional demo audio,
subtitle settings, background-music switch and a single Save video action.
Schedule shows a saved-video state, platform/account fields, a separate post
caption, and matching date/time/time-zone values in the form and review summary.

Controls and text fit the generated desktop frames without visibly cropped
main actions. These images are visual studies; native focus behavior, responsive
layout, playback, draft preservation, model eligibility and actual saved output
still require an interactive prototype and production verification as relevant.


## Corrected understanding

The user liked the dark unified Create direction and requested Edit and
Schedule images. They then identified a missing core capability: the visible
reference-video gallery in Hook and Wall-of-text, shown alongside Your videos.

That gallery is not the optional image/video/voice generation attachments.
The earlier mockups omitted it. The empty inspiration Library in the separate
Talking Head + Demo implementation is also not the gallery the user meant.

The supplied screenshot and components/explore/format-workspace.tsx show the
actual References / Your videos views, Filter, preview cards and Recreate
actions. components/explore/recreate-workspace.tsx defines video previews and
separate Recreate controls. FormatGenerationReferences distinguishes a selected
gallery style example from a directly uploaded generation input.

## Proposed Create behavior

References remain visible on the right when entering Create. A comfortable
creation form occupies roughly 55% of the workspace; examples use the remaining
space. This corrects the former narrow editor / oversized gallery balance.

- Click a thumbnail to watch the example.
- Choose Recreate to select an example as the starting point; selection does
  not start paid generation.
- Show the selected example name near the instructions with preview, change
  and clear actions. Make its status as an example explicit rather than
  pretending it is an uploaded model input.
- Preserve typed instructions and attachment drafts when browsing examples
  or switching References / Your videos.
- Your videos presents generated or chosen output in the same right content
  area. It does not consume a second permanent preview panel.
- Preserve filtering, paging/loading, errors, access restrictions and the
  existing ownership/model-compatibility contracts during implementation.
- Keep optional generation attachments above the brief. This earlier image
  used the image/video controls exposed by the current Hook format. The later
  revision adds Voice reference at the user's request; support in the Hook
  generation path and model compatibility must be implemented and verified.
- On narrow screens, offer clearly labelled Create / References content views
  with persistent drafts and a visible reference entry point. Do not compress
  the desktop form into a thin sidebar or hide examples behind an unlabelled
  icon.

This is a proposal. The preservation and selected-example behaviors require
interactive verification before implementation acceptance.

## Edit and Schedule

Edit places the chosen video and opening-to-demo sequence beside optional
finishing controls. Demo audio belongs to the demo; subtitle options appear
when captions are enabled. Saving produces the finished artifact.

Schedule reviews that saved artifact beside platform, account, post caption,
date, time and visible time zone. Scheduling is optional and follows saving.
The reference-example gallery serves choosing the starting point in Create;
returning to Create must preserve the person's draft.

The current Hook/Wall-of-text middle-stage label Demo also covers clip editing.
The proposed Edit label is a design change to review against real usage, not
a claim that the production navigation has already changed.

## Visual scope

The approved dark Create image is attached as the visual-system reference.
The user's existing Hook screenshot is attached as gallery/feature grounding.
These are three stages of one visual study, not three alternative concepts.

Near-black canvas #08090B, header #0E1013, workspace #15171B, controls #1B1E23
and #101216, outlines #303640/#3A414D, text #F0F2F6/#AAB3C1, orange #F5774E.

Images, handles, selected states, model settings and credit estimates are
illustrative. Schedule's 11 October 2026 date is future relative to the
10 October 2026 design session. No video generation, rendering or publishing
request is made by creating these mockups.

Final artifacts:
- output/imagegen/workflow-create-with-references-dark.png
- output/imagegen/workflow-edit-dark.png
- output/imagegen/workflow-schedule-dark.png

## Generation prompts

Tool: built-in image_gen. Each screen is generated independently with the same
two actual local image references attached.

### Create with References

```text
Use case: ui-mockup.
Create one high-fidelity professional desktop product-interface screenshot for UGCPilot. Design images only, not working software. Dimensions 1584 x 992, front-on flat UI, no device or browser frame, no perspective or clipped controls. Match the supplied approved black/dark Create screen's exact visual language: neutral near-black canvas #08090B, header #0E1013, charcoal workspace #15171B, control surfaces #1B1E23 and #101216, thin quiet outlines #303640/#3A414D, main text #F0F2F6, secondary text #AAB3C1, sparse orange #F5774E on active stage and single primary action. Keep realistic 14–16px equivalent body labels, restrained bold task heading, original grotesk font family, clean 8–10px corners, disciplined spacing and alignment. No neon, glow, marketing hero, decorative charts, fake stats, competing colorful features, side navigation rail or cards-within-cards. Use surfaces, grouping and fine dividers before extra borders.
This belongs to the Hook video flow. Audience: first-time user making a video. Preserve the approved header: UGCPilot wordmark, Explore back link, workflow name 'Hook video', help icon and account icon. A compact horizontal three-stage progression 'Create', 'Edit', 'Schedule' stays above the workspace. Do not turn workflow stages into a sidebar. The user has explicitly approved this dark aesthetic.
Input image roles: approved dark Create image is the DESIGN SYSTEM and header/stage/style reference. Existing Hook video screenshot is PRODUCT/FEATURE grounding, specifically its visible reference-example gallery and separate 'References / Your videos' content views; do not copy its narrow editor sidebar or oversized five-column gallery.
Product distinctions: the Reference examples gallery lets people watch example clips and select an example using Recreate. Selecting an example is NOT paid generation and does NOT replace the user's typed instructions. Optional image/video attachments are a separate group used to guide new generation. The existing-clip source branch reuses footage as the opening and bypasses AI generation. Voiceover, captions and optional demo belong in Edit for this Hook format. A saved finished video is required before scheduling. Do not add a voice-reference generation tile from a different workflow.
Dates are anchored to today 10 October 2026. Any scheduling date must be future relative to that anchor. Media, account, estimate and selected-state data in these mockups are illustrative, not product claims. Tiny footer 'Design study · illustrative media and data'. One complete interface per generated image, not a collage.
Screen: corrected Create WITH THE MISSING REFERENCE-EXAMPLE GALLERY RESTORED. This is a continuation of the approved design, adjusting space to accommodate its essential gallery. Active orange step is Create, remaining stages inactive. Workspace heading 'Create your hook'.

Use a balanced wide two-column composition inside ONE composed charcoal workspace: about 55% for comfortable-width creation form on the LEFT and 45% for media gallery on the RIGHT. Form must be substantially wider than the old screenshot's narrow sidebar. Main workspace can expand to use the available desktop width with sensible 64–80px outer margins. Do not hide examples in a drawer, modal, collapsed section or tiny Browse link. The reference cards must be visibly on-screen when users enter Create.

LEFT:
Source segmented choice 'Generate new video' selected, 'Use existing video' inactive.
Below it, a compact group 'Generation attachments' with 'Optional' and only TWO compact horizontal attachment controls 'Image reference' / 'Add image', 'Video reference' / 'Add video'. These are ABOVE the brief, as explicitly requested. Do not add voice guidance here. Keep attachment wells short so they do not dominate the brief.
Below, a spacious required brief 'What should the creator say and do?' with illustrative typed text: 'A creator speaks directly to camera in a relaxed home office. Say: “Keep your team aligned without another meeting.” Use a friendly, direct delivery.'
A short helper 'Describe the words, delivery and setting.'
A tidy output settings row or 2-by-2 grid: 'Length' / '5 seconds'; 'Shape' / 'Portrait · 9:16'; 'Videos' / '1 video'; 'Model & quality' / 'Omni Flash 1.1 · 720p'. These values are illustrative. Put cost and primary 'Generate video' together at the left form's bottom: 'Example estimate' '20 credits'. Only one orange primary generation action.
Do not show an example as already selected and do not claim generation has happened. No result player on the left.

RIGHT:
A clearly visible horizontal 'References' (active orange underline) and 'Your videos' (inactive) tab row. Fine vertical divider separates gallery from form; not a second sidebar and not a giant nested card.
Below tabs a helper 'Watch an example, then choose Recreate.' and a compact 'Filter' outline action.
A compact 3-column grid of SIX portrait 9:16 video examples, drawn visually from the reference-gallery screenshot. Use actual natural human creator imagery from that supplied gallery as inspiration; realistic selfie-video thumbnails, not generated icons or placeholder boxes. Each card has a small Play affordance, a clear separate 'Recreate' action with circular-arrow icon, and short name 'Hook 01' through 'Hook 06'. Recreate actions are quiet secondary controls, not six orange primary buttons. Keep thumbnails smaller than the source's oversized gallery so form has usable room. Fit the first six examples cleanly or show a natural second-row continuation with clear scroll affordance, without clipping any important form controls. No unrelated promotional claims, copied gambling claims or big text slogans. Reference thumbnails can carry small neutral hook text, while all surrounding UI text is legible.
The signature is a comfortable creation brief beside a discoverable real-media example gallery. Preserve the approved dark studio appearance.
```

### Edit

```text
Use case: ui-mockup.
Create one high-fidelity professional desktop product-interface screenshot for UGCPilot. Design images only, not working software. Dimensions 1584 x 992, front-on flat UI, no device or browser frame, no perspective or clipped controls. Match the supplied approved black/dark Create screen's exact visual language: neutral near-black canvas #08090B, header #0E1013, charcoal workspace #15171B, control surfaces #1B1E23 and #101216, thin quiet outlines #303640/#3A414D, main text #F0F2F6, secondary text #AAB3C1, sparse orange #F5774E on active stage and single primary action. Keep realistic 14–16px equivalent body labels, restrained bold task heading, original grotesk font family, clean 8–10px corners, disciplined spacing and alignment. No neon, glow, marketing hero, decorative charts, fake stats, competing colorful features, side navigation rail or cards-within-cards. Use surfaces, grouping and fine dividers before extra borders.
This belongs to the Hook video flow. Audience: first-time user making a video. Preserve the approved header: UGCPilot wordmark, Explore back link, workflow name 'Hook video', help icon and account icon. A compact horizontal three-stage progression 'Create', 'Edit', 'Schedule' stays above the workspace. Do not turn workflow stages into a sidebar. The user has explicitly approved this dark aesthetic.
Input image roles: approved dark Create image is the DESIGN SYSTEM and header/stage/style reference. Existing Hook video screenshot is PRODUCT/FEATURE grounding, specifically its visible reference-example gallery and separate 'References / Your videos' content views; do not copy its narrow editor sidebar or oversized five-column gallery.
Product distinctions: the Reference examples gallery lets people watch example clips and select an example using Recreate. Selecting an example is NOT paid generation and does NOT replace the user's typed instructions. Optional image/video attachments are a separate group used to guide new generation. The existing-clip source branch reuses footage as the opening and bypasses AI generation. Voiceover, captions and optional demo belong in Edit for this Hook format. A saved finished video is required before scheduling. Do not add a voice-reference generation tile from a different workflow.
Dates are anchored to today 10 October 2026. Any scheduling date must be future relative to that anchor. Media, account, estimate and selected-state data in these mockups are illustrative, not product claims. Tiny footer 'Design study · illustrative media and data'. One complete interface per generated image, not a collage.
Screen: Edit, after an opening is chosen and a demo has been added, before final save. Create shows a quiet completed check; Edit is active orange step 2; Schedule inactive step 3. Heading 'Edit your video'. One-sentence guide 'Add a demo and finishing touches, then save your video.'

Inside the same composed charcoal workspace, use two PURPOSEFUL content zones, not a sidebar: LEFT a bounded medium-size actual-video review area; RIGHT grouped optional finishing controls. A portrait 9:16 player about 250–280px wide and 420–470px tall lives inside a wider quiet review surface. It must not consume most of the desktop width or act as an empty placeholder. The player shows a natural illustrative creator talking to camera in a home office, matching the source theme's media. Label 'Sequence preview' with '9:16 · 720p'. Show a normal Play control and '0:00 / 0:17'. A small label 'Illustrative frame' makes it clear this is sample media. If captions appear in this draft preview, use the neutral subtitle 'Keep your team aligned' at the bottom.
BELOW the player, an intuitive two-segment playback-order strip with actual tiny media thumbnails: 'Opening · 5 sec' arrow 'Demo · 12 sec'. Opening has a small secondary 'Change' action. No arbitrary timeline editor with tracks, no reference-example gallery taking over the player's place. This stage is about the person's chosen media.
A small helper below sequence 'Save video to render these edits.' Do not label this already rendered or saved.

RIGHT finishing controls in aligned rows separated by subtle rules:
'Demo footage' with a clearly subordinate 'Optional'; selected compact attachment 'walkthrough.mp4 · 12 sec', app-walkthrough thumbnail, 'Replace' and 'Remove' secondary actions. One small 'Fit demo' action may appear with this selected demo, because framing belongs to that media.
Nested contextual row 'Demo audio · Optional' with 'Add audio'. Helper 'Plays underneath the demo’s original sound.' No selected added audio, no Repeat setting before selecting audio, no confusing generation voice-reference control.
'Auto subtitles' orange switch ON, helper 'English · up to 60 seconds total'. Beneath it, two small dropdowns 'Style' / 'Clean' and 'Position' / 'Bottom'. These controls are visible because subtitles are on. Optional quiet 'Preview style' supporting action, not a huge gallery.
'Background music' neutral switch OFF and helper 'Plays underneath the opening and demo.'
No source Generate / Upload controls and no posting caption on this screen.
At integrated bottom action bar: secondary 'Back to Create' on left; single orange primary 'Save video' on right. Next to it, concise 'Saves your finished video to Library.' Do not show Continue to Schedule as a competing primary action before save; that becomes available after confirmed saving.
Keep all finishing controls, preview and action bar visible with comfortable text and no crowded grids, preserving the same approved dark UI styling.
```

### Schedule

```text
Use case: ui-mockup.
Create one high-fidelity professional desktop product-interface screenshot for UGCPilot. Design images only, not working software. Dimensions 1584 x 992, front-on flat UI, no device or browser frame, no perspective or clipped controls. Match the supplied approved black/dark Create screen's exact visual language: neutral near-black canvas #08090B, header #0E1013, charcoal workspace #15171B, control surfaces #1B1E23 and #101216, thin quiet outlines #303640/#3A414D, main text #F0F2F6, secondary text #AAB3C1, sparse orange #F5774E on active stage and single primary action. Keep realistic 14–16px equivalent body labels, restrained bold task heading, original grotesk font family, clean 8–10px corners, disciplined spacing and alignment. No neon, glow, marketing hero, decorative charts, fake stats, competing colorful features, side navigation rail or cards-within-cards. Use surfaces, grouping and fine dividers before extra borders.
This belongs to the Hook video flow. Audience: first-time user making a video. Preserve the approved header: UGCPilot wordmark, Explore back link, workflow name 'Hook video', help icon and account icon. A compact horizontal three-stage progression 'Create', 'Edit', 'Schedule' stays above the workspace. Do not turn workflow stages into a sidebar. The user has explicitly approved this dark aesthetic.
Input image roles: approved dark Create image is the DESIGN SYSTEM and header/stage/style reference. Existing Hook video screenshot is PRODUCT/FEATURE grounding, specifically its visible reference-example gallery and separate 'References / Your videos' content views; do not copy its narrow editor sidebar or oversized five-column gallery.
Product distinctions: the Reference examples gallery lets people watch example clips and select an example using Recreate. Selecting an example is NOT paid generation and does NOT replace the user's typed instructions. Optional image/video attachments are a separate group used to guide new generation. The existing-clip source branch reuses footage as the opening and bypasses AI generation. Voiceover, captions and optional demo belong in Edit for this Hook format. A saved finished video is required before scheduling. Do not add a voice-reference generation tile from a different workflow.
Dates are anchored to today 10 October 2026. Any scheduling date must be future relative to that anchor. Media, account, estimate and selected-state data in these mockups are illustrative, not product claims. Tiny footer 'Design study · illustrative media and data'. One complete interface per generated image, not a collage.
Screen: Schedule, after the finished video has been saved. Quiet completed checks on Create and Edit; Schedule active orange step 3. Heading 'Schedule your video'. Guide 'Choose where and when to share your saved video.' This is a READY-TO-REVIEW draft, not already scheduled. The saved status refers only to the finished video, not a completed posting action.

Use the same composed workspace with a medium-size finished-video preview on LEFT about 40% and posting fields on RIGHT about 60%. Actual preview is portrait 9:16 about 230–260px wide and 400–460px high with a natural illustrative creator in home office, normal Play control, '0:00 / 0:17' and a small 'Illustrative frame' label. Under its 'Finished video' heading: quiet check 'Saved to Library', and '17 seconds · 9:16 · 720p'. The preview represents the saved combined opening plus demo. Do not substitute a reference example for the saved video. A compact summary beside or below it states 'Instagram · @samplebrand' and '11 Oct 2026 · 10:00 AM', 'Asia/Kolkata · UTC+05:30'. These agree exactly with the fields. Do not invent engagement counts, likes, reach estimates or a fake social-feed wrapper.

RIGHT posting fields, logically ordered and readable:
Label 'Platforms', three quiet selectable buttons with recognizable icons 'Instagram' selected, 'TikTok' and 'YouTube' unselected. A subtle check and orange outline indicate the selected platform; other controls neutral. This is an illustrative user selection, not an automatic default.
Label 'Instagram account', dropdown '@samplebrand', helper 'Sample connected account'. No real customer handle or invented paid plan, no new account connection implied.
Label 'Post caption', medium-height textarea with typed sample: 'Keep your team aligned without another meeting. See how it works.' Helper 'Shown below your social post.'
Paired date/time fields 'Date' value '11 Oct 2026' and 'Time' value '10:00 AM'. Below these, clearly visible 'Time zone: Asia/Kolkata (UTC+05:30)'. Do not hide timezone behind a settings icon.
Near action footer, concise review line 'Instagram · @samplebrand · 11 Oct 2026 at 10:00 AM'. No mismatched destination or date.
Integrated bottom action bar: quiet secondary 'Back to Edit' left, one orange primary 'Schedule post' right. Short subordinate reminder 'Your video is already saved. Scheduling is optional.' Do not add Publish now, extra save/generate actions, or an already-scheduled success toast.
No optional generation references and no reference-example gallery on Schedule; references belong to choosing the starting point in Create. Preserve all draft fields when stages are changed in eventual implementation.
Maintain the professional dark design and comfortable field sizing, avoiding nested card overload, a huge preview, cramped controls or clipped content.
```

