# Recreate adjustable layout

Date: 2026-10-03. Local implementation; not deployed.

## Changes

- Replaced the fixed desktop creation-chat width with a visible vertical divider. Dragging adjusts the editor and reference gallery together. Default editor width is 360px, bounded between 320px and 560px, with at least 320px reserved for the gallery at supported desktop widths. Resizing a narrow viewport recalculates the maximum.
- The splitter supports mouse/touch pointer capture, animation-frame batching, cancellation on Escape, pointer cancellation/capture loss, blur and leaving the desktop breakpoint. It cleans up observers, listeners and pending frames on unmount.
- Keyboard alternatives: Left/Right move 16px, Shift moves 40px, Home/End reach the limits, and Enter resets the layout. Double-click also resets the divider. An accessible separator exposes its editor target, current value, limits and instructions.
- Both existing generators remain mounted. Width is local layout state only; it does not change prompts, selected references, generation settings, URL handoff, credit gating or generation callbacks. There is no new storage, API or dependency.
- Mobile keeps the stacked layout and two-column gallery; the divider is hidden. Desktop gallery columns use the available width with a 180px minimum card width, replacing oversized fixed-count cards. Reference images retain their original aspect ratio and `object-contain` treatment.
- The creation input frame has a quieter 16px corner radius and no decorative shadow. On short desktop screens the editor stays bounded and can scroll inside its own section so controls remain reachable.
- The circular-looking arrow is now a larger 20px icon with a lighter 1.6px stroke inside a 40px rounded-square control. Its action remains **Recreate this reference**, not reset playback, clear drafts or run generation.

## Validation

- Full TypeScript check and scoped ESLint passed.
- 23 focused resize/presentation/catalogue checks passed. These cover pure sizing bounds, source interaction contracts, mounted-generator ownership, local-preview gating and catalogue preservation. No video-generation, transcription, render, database or scheduling test ran.
- Actual browser mouse drag changed the editor from 360px to 500px. Extreme drags reached 560px and 320px without changing the selected Hook reference or verbatim video draft.
- Keyboard Left, Home, End, Enter and Shift+Right produced the expected widths. Separate image/video drafts survived resizing and switching modes; the temporary check drafts and selection were removed afterward.
- At 1024×600, the maximum was 492px with a measured 320px gallery. The page had no horizontal overflow. At 390×844 the divider was hidden, the stacked layout remained and the draft was retained, with no horizontal overflow. Temporary viewport overrides were reset.
- At 1280×360 the editor ended at the viewport boundary; its 336px content was scrollable inside a 284px region rather than spilling into the page. Short-screen controls may require scrolling; this is intentional, not a claim that all content fits without scrolling.
- No browser console error logs were observed. No Generate action was invoked. The development preview continued to show generation disabled.
- SHA-256 comparison confirmed 11 protected files were unchanged: the shared composer, standalone image/video generator owners, shared studio stylesheet, Hook/Phone workflow owners, Recreate catalogue/types/manifest and both dependency manifests.
- Actual UI capture: `.tmp/recreate-resizable-2026-10-03.jpg` (editor at 400px; splitter keyboard focus highlighted).

Frontend design guidance informed the restrained arrow/control treatment and smaller cards. The React review kept transient pointer data in refs and isolated visual resize state from the generator owners. UI review checked focus, keyboard alternatives, bounded content and accessible values.

These checks establish local layout behavior only, not authenticated production acceptance. APIs, worker behavior, Carousel generation/rendering/readiness and workflow 1/3 were not modified. Nothing was pushed or deployed.

## Follow-up polish and catalogue removal

The changes below supersede the original default width and full-height divider treatment above.

- The desktop editor now defaults to 20% of the workspace, bounded to 220–320px. The 220px floor protects the controls on smaller laptops; manual dragging still supports 220–560px, subject to the gallery minimum. Enter and double-click return to the responsive default rather than a fixed pixel width. Cancelling a drag restores its previous automatic/manual sizing mode.
- Removed the full-height separator line and focus outline. The invisible 16px drag target remains, with only a small central grip. Keyboard focus is visible around that grip, not the entire divider.
- A scoped editor container query compacts padding, empty-state text and Settings below 300px. Settings remains an accessible, titled icon button with the same popover. The Recreate-only compact composer starts at 64px and grows to 96px; standalone composer sizing and generation callbacks are unchanged.
- Removed `explore-wall-text-01`, identified by the owner's screenshot and media hash `31d42e78ebbe868ee193ff281243948d610140323a593d03dab3258652921c6a`, from the shared direct-video source list. It no longer appears in Recreate, the legacy Explore library/preview, the library's import asset list, or valid Explore reference IDs. Other source entries are unchanged. Client cache keys are versioned so a new application load does not reuse the previous lists.
- Removed gallery-level available-video/slideshow totals, retaining Clear filters only when needed. Individual slideshow slide counts and Previous/Next navigation remain useful and unchanged.
- Format tabs are Slideshows, Wall of Text, Hook videos; a fresh workspace opens Slideshows with Image mode. Slideshow cards alternate categories in deterministic round-robin order, after category filtering. Card IDs, references, internal slide order, selected-reference handoff and video ordering are untouched.

### Follow-up validation

- Full TypeScript, scoped ESLint and 56 focused sizing, catalogue, category-mixing, source-removal, query-cache and presentation checks passed. No generation, transcription, render, database or scheduling job was triggered.
- Actual browser checks confirmed the first Wall of Text poster changed to the former second clip; no removed hash or available totals remain in the rendered gallery. The first 12 slideshow cards cover different categories. Selecting Fitness and Study alternates only those categories; clearing filters restores the full mix.
- Native mouse drag changed the editor from 220px to 320px. Keyboard limits and reset worked. The divider has no pseudo-element line and no painted full-height outline; keyboard focus is confined to the grip. Separate verbatim image/video drafts survived resizing, mode changes and a mobile breakpoint. Temporary check drafts were cleared.
- At 1366×768 the editor measured 234.07px in a 1170.40px workspace (20%). At the default 1280×720 viewport it measured 220px, approximately 20.3%, due to the usability floor. All compact buttons were inside the input frame and Settings opened correctly. At 390×844 the splitter was hidden, drafts survived and there was no horizontal overflow. Temporary viewport overrides were reset.
- Hash comparison confirmed eight protected files were unchanged: standalone image/video generator owners, shared studio stylesheet, Hook/Phone workflow owners, Recreate catalogue, and dependency manifests. The shared composer has only the scoped compact presentation changes listed above; concurrent unrelated copy changes were preserved.
- Browser history contained a transient scheduling-panel parse error from concurrent work. Its current source is corrected, the fresh full TypeScript check passed, and it was not modified for this Recreate task.
- Actual captures: `.tmp/recreate-wall-text-clean-2026-10-03.jpg` and `.tmp/recreate-mixed-slideshows-2026-10-03.jpg`.

Frontend-design guidance informed the compact, quiet controls; UI review retained visible keyboard focus and checked control clipping. Removal is recoverable by restoring the source entry. No cloud media object or user-created video was deleted. These are local changes only; deployment and authenticated production acceptance are pending.
