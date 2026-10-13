# Explore workflow frame correction, 13 October 2026

Status: implemented and verified locally. These additional layout changes have not been deployed by this chat.

The user's screenshots showed Talking Head + Demo losing its enclosing controls card when switching from Edit demo to Schedule. Schedule removed the outer border/background, moved padding into a second form card and replaced the workflow header. Hook video, Wall of text and Slideshows had the same overrides. The phone workflow put its stage tabs in the page header and used different controls widths between stages.

The workflows now retain their workflow header, enclosing rounded controls card and in-card stage tabs across Create, Edit/Demo and Schedule. Scheduling content uses the existing card's padding and scroll area. The phone workflow keeps its existing preview toggle, with stage tabs inside the card and matching desktop proportions. Existing scheduling actions, account selection, confirmation, draft retention and request controllers remain in place.

Hook video and Wall of text previously had a 336px compact desktop override. Removing that override restores the shared `clamp(360px, 25cqw, 440px)` controls-width rule used by Talking Head + Demo. The phone workflow follows that rule even while its empty Create preview is hidden. Mobile retains the existing single-column/pane controls.

## Verification

An isolated browser fixture compiles the actual workflow parent components and CSS modules. Authentication/generation adapters are local and disabled; no media generation or social publishing is submitted. It verifies all five workflows at 1280×720, 1440×900, 1920×1080, 1024×640, 390×844 and 320×740 (30 cases).

Each case verifies stable card and tab x/y/width across stages, matching outer border/radius/background, retained workflow title, retained post caption after switching stages, accessible tab sizes and no horizontal page overflow. All tested desktop card widths match Talking Head + Demo: 360px at 1024/1280/1440 and 440px at 1920. All 30 cases pass with no browser errors or API writes. Private evidence and screenshots are in `.tmp/release-2026-10-13/all-workflow-frames/`.

The existing focused regression suites pass 80 tests, covering source selection, retained audio/framing, scheduling guards and preview inputs, accessible mounted panels and slideshow editing/saving contracts. TypeScript and ESLint are also checked. A final combined release build and acceptance on the real production domain remain required after the shared workspace is frozen.

Files changed for this correction: `components/explore/hook-workflow-preview.tsx`, `phone-workflow-preview.tsx`, `format-workspace.tsx`, `talking-head-schedule-preview.module.css`, `workflow-video-layout.module.css`, `format-workspace.module.css`, `workflow-section-layout.module.css`, and `CAROUSEL_CONTEXT.md`. Other simultaneous changes in those files belong to the ongoing shared work and are preserved.
