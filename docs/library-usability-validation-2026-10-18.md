# Media library usability validation — 18 October 2026

Historical review. The approved workflow and local fixes are recorded in
[the 19 October implementation](media-library-trending-flow-2026-10-19.md).

The basic flow is simple, but the implementation needs clarity and mobile fixes
before a complete usability sign-off. This is an expert review with isolated
component browser checks, not a first-time-user study or production acceptance.

| Criterion | Assessment |
| --- | --- |
| Simplicity | Good: open, select, apply. Scope is visible before selection. |
| Understanding | Needs work: selection indicators disagree after management; Cancel does not explain persisted library changes. |
| Usability | Common desktop flows work. Mobile preview/collection actions are buried by long grids; long names overflow. |

## Findings

1. **P2 — Mobile preview and collection action are hard to find.**
   `components/media/image-library-browser.tsx:180` places Use collection after
   the grid; `components/media/image-library.module.css:67` stacks the preview
   after the entire browser. At 390×844 with 32 images, Use collection starts at
   y=2388 and the preview at y=2465, while Apply stays at y=777. Move Use
   collection beside its name/count and provide an immediately accessible mobile
   preview control/sheet. Acceptance: using a collection never requires traversing
   its grid; previewing a selected image takes at most one clear action.

2. **P2 — Selection disagrees after returning from management.**
   `components/media/image-library-picker.tsx:68` unmounts the browser while
   retaining the parent proposal at line 23. Reproduced: select Photo 1 → Manage
   library → Back to selection. Zero tiles are selected, but the preview retains
   Photo 1 and Apply is enabled. Preserve shared selection state and restore the
   tile indicators. Acceptance: checkmark, selected count, preview and Apply agree
   after management and source changes.

3. **P2 — Cancel has unclear meaning during library management.**
   `components/media/image-library-picker.tsx:83` shows Cancel even though uploads
   and collection edits save immediately. Reproduced: create a collection, save
   its name, Cancel; collection remains saved and slideshow stays unchanged.
   Label management exit Done/Back to selection and state that library changes
   save automatically. Reserve Cancel for discarding the slideshow proposal.
   Acceptance: immediate library saves are clearly distinguished from Apply and
   the subsequent slideshow save.

4. **P2 — Long collection names overflow narrow layouts.**
   `components/media/image-library.module.css:12` lacks protection for unbroken
   collection names. At 320×640 with a permitted 80-character name, the dialog
   body is 262px wide but has 825px scrollable width. Allow its name container to
   shrink and wrap. Acceptance: long names and controls fit at 320px and zoomed
   layouts without horizontal scrolling.

## Additional source-review follow-ups

- `components/trending/carousel-slide-image-section.tsx:113`: Add to library
  opens management rather than saving the current image. Rename it Manage library
  or provide an explicit save-current-image action if intended.
- `components/media/media-library-dialog.tsx:35` and
  `lib/ai-studio/reference-media-upload.ts:66`: upload blocks dismissal but lacks
  explicit cancellation/bounded timeout. Provide safe recovery for stalled uploads.
- `components/media/image-library-picker.tsx:74`: inert preview also hides its
  contents from assistive technology. Provide a readable proposal summary outside
  that subtree.

## Validation evidence and limits

The existing component browser scenarios completed with isolated auth/storage:
image selection and scope, order/repetition, actual composition previews, failed
source checks, preserved text, cancelled proposals, collection membership,
archive/restore, failed-file-only retries, music upload from the editor, owned
track reuse, retained music state, one audio preview at a time and keyboard/dialog
bounds. Native Edge image-search chrome is outside DOM-test coverage.

The original browser runner initially failed because its restore assertion checked
fixture state immediately after clicking Restore. A temporary copy waited for the
restored tile to disappear; all its scenarios then passed. No application code
was changed to obtain that result.

New adversarial checks reproduced all four findings with actual shared components.
Evidence: `.tmp/library-usability-audit/evidence.json` and screenshots
`management-return.png`, `mobile-large-collection.png`, `mobile-long-name.png`.
Runners: `.tmp/library-usability-audit.cjs` and
`.tmp/library-usability-regressions.cjs`.

The production domain and Sign in page loaded, but this browser has no signed-in
session. Authenticated production library acceptance remains outstanding. No
product source edit, deployment or production data change occurred in this review.
First-time-user comprehension, production uploads, 200% zoom and a complete
assistive-technology pass remain unverified.

Criteria: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
