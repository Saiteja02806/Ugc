# Explore workflow UI audit — 8 October 2026

**Historical audit:** this describes the compact design reviewed before the
user's subsequent request to restore the actual older workflow design. Hook and
Wall of text now reuse the older creation styles, with square image/video tiles
above instructions and inline settings. The recommendations below are not a
description of the updated Create UI or approval for another redesign.

## Verdict

The new Hook video, Wall of text and Slideshows screens follow the older talking-head/demo and creator-phone workflows' structure: controls on the left, a large reference/result area on the right, compact Create/Edit/Schedule tabs, and one primary action in a consistent footer. Keep this structure.

The desktop Create screens are substantially clearer than the earlier screenshots with repeated “Use reference” buttons and a separate settings section. The screens are usable, but the video editors and mobile layout need another polish pass before calling the experience fully clean and professional.

| Area | Assessment |
| --- | --- |
| Hook / Wall of text — Create | Clear source choices and compact settings. Reference rules need to be easier to see. |
| Hook / Wall of text — Edit | Live preview works with the supplied footage. The flat list of controls is too long; audio is hard to discover. |
| Slideshows — Create | Clear gallery selection and slide context. Compact settings fit the existing design. |
| Slideshows — Edit | The clearest editor: numbered thumbnails, selected-slide border, large preview and Previous/Next. Recreate is too far down on a short laptop. |
| Schedule | Familiar form, clear timezone and a useful save-first message. The older workflow has a better caption preview. |
| Mobile | No horizontal overflow, but controls and preview are too far apart, especially in Edit. |

## Scope and evidence

Reviewed all three workflows' Create, Edit and Schedule screens in local read-only previews at 1440×1000, 1280×720 and 390×844. Compared both older workflows at desktop size. Imported the supplied `hook.mp4` and `WOT.mp4` into the local preview to inspect the real editor with portrait footage rather than the landscape test cover.

The browser audit blocked every non-GET API request. No generation, cloud upload, saving or social scheduling writes were attempted; no browser runtime errors or horizontal overflow appeared in the reviewed states. Saving and generation are deliberately disabled in these fixtures. Authenticated accounts, saved-output rendering, provider generation and the final schedule confirmation were not verified against production in this audit.

The settings popup closes and returns focus correctly. The earlier overlapping mobile screenshot captured the exit animation; it is not a persistent open-popup defect. Some freshly selected slideshow thumbnails are still loading in the immediate capture, so that capture is not evidence of missing assets.

## Findings by file

### `components/explore/format-workspace.module.css`

- **P2 — line 36: Mobile editing separates the controls from the preview.** At 390×844, the Hook live preview begins around document y=1200, after the full Trim/Text/Audio form and Save button. Users must scroll back and forth to judge changes. Add an obvious mobile **Controls / Preview** switch or a **Preview changes** jump above the editor fields, plus an easy return to editing. Preserve the existing desktop panels.
- **P2 — line 8: Important controls fall below the desktop scroll boundary.** Scrolling itself is expected, but the current form gives little indication of the tools below. At 1280×720 the reference hint begins at y≈549 while the fixed footer begins at y=542. Keep upload restrictions next to the visible Video tile rather than below it. Do not enlarge the entire settings section again.

### `components/explore/format-video-editor.tsx`

- **P2 — line 141: Edit has insufficient hierarchy.** Two separate trim sliders, a tall text box, six text appearance/timing controls and audio form one uninterrupted column. With text present, Audio begins around y=869 even on a 1000px-high desktop, below the controls' usable area. Use three clearly separated **Trim / Text / Audio** groups. Keep the text entry visible; put Position, Color, Width, Size and timing under **Text settings**. For Hook, make the optional overlay compact until used. For Wall of text, keep the message prominent.
- **P3 — line 152: The color control looks like a thin line.** The shared padded field styling squeezes the native color swatch in Edge. Give it a visible swatch and readable color value or preset chips while retaining the native picker and accessible label.
- **P3 — line 142: Duration formatting looks unfinished.** The source header displays `2.837333s`; the trim selection shows `2.837s`. Round display-only labels consistently, such as `2.8s`, while retaining precise internal timing.

### `components/explore/format-generation-references.tsx`

- **P2 — line 89: Reference precedence and limits are easy to miss.** “Style example” and “Reference media” represent different inputs, but the brief helper explaining replacement can be below the visible controls. Keep a visible line such as **Optional image or video — choose one** and **Video: up to 3 seconds**. When media is attached, show the selected source and make it clear that it takes priority over the gallery example. Tooltips alone are insufficient on touch screens.
- **P3 — line 85: Remove controls are small touch targets.** The X is approximately 22×22px from the current icon and padding. Enlarge its hit area without expanding the whole reference tile or interfering with the Replace action.

### `components/explore/format-slideshow-editor.tsx`

- **P2 — line 114: Recreate is below the fold on a short laptop.** With six thumbnails, the Recreate slide 3 button is partly clipped by the footer at 1280×720. Keep an action for the selected slide above the thumbnail grid or next to the preview navigation. Retain the common Save footer.
- **P3 — line 115: Set expectations for “Edit slides.”** Current capabilities are review, replace through generation, restore and save; slide order stays fixed and text inside an image changes through recreation. The existing explanatory copy is useful. Keep it near the active-slide action; avoid promising “arrange” or direct text editing unless those features are implemented.

### `components/explore/format-workspace.tsx`

- **P2 — line 263: Schedule's post preview omits the caption.** In the saved-output branch, the right panel renders media and the asset title, while the scheduling draft stays inside `FormatSchedulePanel`. The older workflow also previews the actual post caption. Restore a shared caption preview and selected-platform context so users can review the post before opening confirmation. This finding comes from source inspection; the authenticated saved-output state was not exercised.
- **P3 — line 263: The save prerequisite should be visible beside the scheduling controls.** The right-side Go to Edit action is helpful on desktop. On mobile it appears after the full scheduling form. Put the same save-first guidance and link above the left form when there is no final output. Let users keep drafting, but explain the prerequisite before they fill the form.

## What to retain from the current UI

- Generate / Upload / Creative Assets as explicit video-source choices.
- Recreate icons over reference cards, separate preview controls, and orange selection feedback; no repeated full-width reference buttons.
- The single settings-summary button in the Create footer.
- A shared primary-action position with step-specific labels: Generate, Save edits / Save slideshow, Review schedule.
- The immediate switch to Your Video during generation, and distinct References / Your Video or Your Slides views.
- The slideshow's numbered thumbnails and full selected-image preview.
- Manual text editing without subtitle controls, as requested.
- Named icon actions, labelled inputs, visible focus styling, alert/status messages and clear empty-state directions. These were spot-checked; this report is not a full accessibility certification.

## Recommended implementation order

1. Fix visible reference limits and selected-source guidance.
2. Group the video editor into Trim, Text and Audio; collapse advanced text settings.
3. Add mobile preview access and move slideshow recreation beside the active slide.
4. Restore caption/platform context in Schedule and show its save-first action beside the form.
5. Polish the color swatch, duration labels and small remove targets.

These are focused refinements to the existing components. A chat layout or another full structural redesign is unnecessary. This audit changed documentation only; workflow source, generation and scheduling behavior were left unchanged.

## Screenshot evidence

All screenshots are in `C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/`.

- [Hook Create — laptop](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/hook-video-create-laptop.png)
- [Hook Edit — laptop](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/hook-video-edit-laptop.png)
- [Hook Edit — full mobile page](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/hook-video-edit-mobile.png)
- [Wall of text Edit — desktop](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/wall-of-text-edit-desktop.png)
- [Slideshows Edit — laptop](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/slideshows-edit-laptop.png)
- [Schedule — laptop](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/hook-video-schedule-laptop.png)
- [Schedule — mobile](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/slideshows-schedule-mobile.png)
- [Older Hook Create](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/older-hook-create.png)
- [Older creator-phone Edit](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/older-phone-edit.png)
- [Older Hook Schedule](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-format-visual-audit/older-hook-schedule.png)

Review criteria: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), plus the project's existing workflow UI and the user's requested flow.
