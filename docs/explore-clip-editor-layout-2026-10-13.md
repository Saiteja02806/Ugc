# Explore clip editor layout, 13 October 2026

The user's reference asks for a large live preview on the left and clearly spaced text, trim and sound controls across the remaining workspace. Create, Edit and Schedule stay on the left of the header.

## Local implementation

- Removed the narrow portrait editor width limits. Hook and Demo editing now use the available workspace width.
- Large desktop editors put text content and style beside trim and sound. Trim, sound and text style open initially; the specialized Demo crop controls remain collapsible. Smaller screens stack the controls.
- Increased the Edit overview's sidebar share and preview size. Kept Generate below the Remix text field and Add text manually beside the Hook text heading.
- Used shared outline Button sizing for upload and saved-audio actions, and increased the manual-text and Generate hit areas. Existing app theme tokens supply the colors, borders and focus treatment.
- Kept the existing live preview, draft persistence, trim, overlays, sound, saving and ownership/readiness guards. These presentation changes do not create a publishing file or enable unavailable generation.
- Added Next's Webpack extension alias for NodeNext-style `.js` imports to resolve their existing `.ts` sources in the worker code. JavaScript remains the first resolution choice. This fixes local preview compilation and is separate from production render latency.

## Verification

185 focused workflow/editor tests passed. TypeScript, scoped ESLint and diff whitespace checks passed. Browser interactions verified live text changes, text positioning and draft retention after returning to previews. Desktop widths of 1800 and 1280 pixels and a 390-pixel mobile width were checked without page-level horizontal overflow.

The local sample preview disables real generation, rendering and scheduling. No production deployment or social submission was performed. Full authenticated production acceptance remains pending deployment.

Actual local screenshots are saved under the task's visualization directory, in `schedule-review-20261013`:

- `03-edit-overview.jpg`: wider sidebar and shared button styles.
- `04-hook-editor-wide.jpg`: expanded Hook editor with live text preview.
- `05-demo-editor-wide.jpg`: expanded Demo editor with trim, crop and sound controls.
- `06-demo-editor-mobile.jpg`: smaller-screen layout.
- `07-hook-schedule-wide.jpg`: prepared sample and actions inside the settings card.
- `02-inline-confirmation.jpg`: shared scheduling confirmation inside the workflow, with no new page or fullscreen dialog.

See `explore-render-delay-audit-2026-10-13.md` for measured production timing. The matching three-job chain totalled about 8 minutes 56 seconds; about 95% preceded worker processing. Wider controls and inline review improve use of the workspace, but do not remove that backend startup delay. A fast sequential browser preview and the finished publishing asset have different readiness requirements.

The built-in company audio collection is not completed by this layout change. The saved-audio picker still lists user-owned audio; its visual update should not be treated as implementing that earlier collection request.
