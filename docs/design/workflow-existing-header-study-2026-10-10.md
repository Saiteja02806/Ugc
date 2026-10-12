# Workflow sections in the existing title row — 10 October 2026

Status: selected placement direction, not a product implementation.

## Latest user decision

Use the existing application's Explore / Create a Hook title row, as marked in codex-clipboard-3ec9f915-42f4-4dc1-a5da-009cd066d51e.png. Keep that header structure and place Create / Edit / Schedule in its available horizontal space. Do not add a separate navigation row or duplicate the application's global branding/header.

Keep the selected wide creation form below, including Image reference, Video reference and Voice reference above the brief. Keep the reference-example gallery visible on the right. The supplied current application's narrow controls and empty Workspace are placement context, not a request to restore those proportions or remove the example gallery.

The v3 generated study demonstrates shared-row navigation. It uses the previous mockup's branded header; implementation should adapt this placement to the actual existing Explore / Create a Hook row from the user's latest screenshot.

## Reasons and implementation requirements

- The title provides workflow context; the adjacent stage labels provide navigation in the same existing row.
- Remove the separate stage band completely so it adds no desktop content height.
- Preserve readable labels, accessible targets, focus states and a clear active-stage indicator. Use the header's existing height instead of reducing hit targets to save space.
- Keep enough separation between workflow stage navigation and the References / Your videos content tabs below.
- Retain stage availability, explicit generation actions, drafts and selection behavior described in workflow-navigation-and-voice-study-2026-10-10.md.
- When the real application's sidebar or a narrow viewport reduces available width, adapt the title/navigation within the header and verify at actual viewport sizes. This desktop image does not establish responsive acceptance.
- Voice guidance remains proposed for the current Hook / Wall-of-text path; the compatible model and generation integration must be validated during implementation.

## Visual review and artifacts

The generated image was inspected. Navigation appears once in the existing top band; the separate workspace navigation row is absent. The three generation reference controls, populated brief, output settings, estimate, Generate video action and all six example cards remain visible.

Saved image: output/imagegen/workflow-create-with-references-dark-v3.png

Source image: output/imagegen/workflow-create-with-references-dark-v2.png

Tool: built-in image_gen, one focused image edit. Generated original preserved. No product code or deployment changed.

The subsequent frontend implementation and reference-control revisions are recorded in [Workflow frontend implementation](workflow-ui-implementation-2026-10-10.md). That implementation keeps the generator's existing supported inputs and uses compact, frameless hover previews.

### Full generation prompt

```text
Use case: precise-object-edit / ui-mockup.
Asset: focused revision of the supplied UGC Pilot Create-screen design.
Input image 1 is the EDIT TARGET. Use its exact dark theme, typography, existing content, image assets and form/gallery split.

PRIMARY CHANGE: eliminate the vertical height consumed by workflow navigation. Move Create / Edit / Schedule into the EXISTING GLOBAL TOP BAR, alongside the workflow title "Hook video". Keep UGCPilot, Explore, Hook video at the left and help/account at the right. After Hook video, add a subtle vertical separator and a compact inline three-label navigation: Create, Edit, Schedule. About 300 pixels total width; labels 14–16px equivalent; at least 40px usable target height within the existing 55–60px top bar. Active Create has white semibold text and a slim restrained orange underline; other labels muted. Do NOT add any new header row, numbered circles, connecting line, pill panel or huge centered segment. Navigation must sit on the same baseline as Hook video and Explore inside the existing top bar. Preserve the existing header height.

COMPLETELY DELETE the separate full-width workspace-header row currently containing Create / Edit / Schedule and its bottom horizontal divider. The workspace must start directly with the creation form and example gallery, about 16–20px below the existing global header. Move all workspace content upward by the deleted row height and the reduced top gap. "Create your hook" and gallery tabs should now be close to the top of the workspace. The workflow navigation must appear exactly ONCE, in the global header. The gallery References / Your videos tabs stay in their gallery column, with their existing underline, separate from workflow navigation.

Keep the content scale, card dimensions and spacing of the source rather than shrinking text or controls. To clearly show the real vertical saving, use a slightly shorter desktop frame, approximately 1584 × 912 pixels, retaining the source width and density. The whole creation form, output controls, credit estimate, orange Generate video action and all six reference example cards should fit. Keep only a modest bottom margin and the small design-study caption. Do not fill the saved height with a new decorative row or excessive blank space.

PRESERVE EVERYTHING ELSE: near-black canvas and charcoal workspace; orange accent; comfortable wide left creation form and right example gallery; title Create your hook; Generate new video / Use existing video selection; all THREE compact optional generation-reference cards above the brief: Image reference / Appearance / Choose image, Video reference / Scene & motion / Choose video, Voice reference / Vocal delivery / Choose audio; Optional badge; Reference support depends on the model helper; populated instructions and their label; Length, Shape, Videos, Model & quality; example credit estimate; Generate video; References and Your videos; Filter; six original portrait-video thumbnails with the same people and their existing clip content; Play and Recreate. Do not drop voice guidance or the gallery. Do not change model selections, invent uploaded audio or change content. Preserve the visual polish and clear reading contrast. No red marks, annotations, browser frame, new sidebar, extra progress element or redundant navigation. Output one crisp revised UI screenshot only.
```
