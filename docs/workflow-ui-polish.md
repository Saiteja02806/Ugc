# Explore workflow studio UI polish

Workflow 1/3's current compact left-column layout is documented in `workflow-reference-layout-2026-10-02.md`. The Recreate styling described here remains unchanged; earlier pill/drawer descriptions for Workflow 1 are historical.

Local presentation pass, 2026-09-30. No push or deployment.

## Design and boundaries

- Existing charcoal, warm-white and orange brand tokens are retained. No new font, dependency, theme or generated artwork.
- Both workflows use a compact 76px header, pill controls, quieter surface separation and 28px composers. Recreate has a slightly wider, readable creation chat while the gallery keeps most desktop space.
- Recreate format tabs are a compact capsule. Filters contain category names only, without counts. Selected-reference labels describe the format, not internal numbered titles.
- Gallery columns use the gallery's actual available width: two below 660px, three from 660px, four from 1000px. Narrow desktop windows no longer force three tiny cards beside the chat.
- Slideshow previews and thumbnails contain the complete source image. The main preview has natural-ratio `w-auto / h-auto` sizing, not a wide frame with side bars and not a crop. Ordered slides and original assets remain unchanged.
- Preview dialogs retain their current media through the exit fade, then reset to the first slide for a later opening. Their content scrolls within a bounded dialog on short screens.
- Empty, error and upgrade states use the same quiet rounded styling. No inventory is fabricated for empty states.
- Workflow 1 still places Library after a full first-screen workspace. Its small Library shortcut preserves instructions and moves focus. Library and workflow covers remain empty until approved media is supplied.

## Motion and interaction

- 140–160ms control/selection feedback, 180ms popover/dialog entry, 140ms dialog exit, 220ms demo-panel/drawer entry and 180ms drawer exit.
- Motion animates opacity and transforms rather than layout dimensions. Reduced-motion users get immediate state changes, including portaled workflow popovers and dialogs.
- Shared setting menus receive rounded styling and motion only while a workflow studio is on the page. Standalone generation screens keep their existing presentation.
- Image/Video and reference-format tabs support arrow keys, Home and End with roving tab focus. Existing generator panels remain mounted; tab animation does not reset prompts or generation settings.
- Generation, user instructions, reference selection semantics, audio intent, access gates, catalogue sources, APIs, billing, workers, rendering and scheduling are not rewritten by this presentation pass. The shared standalone generators and UI primitives are not modified.

## Local verification

- TypeScript and targeted ESLint passed; all 27 workflow/catalogue and studio presentation regression checks passed.
- Checked laptop 1366×768 and 1440×900, narrower desktop 1024×768, and mobile 390×844 / 320px-wide layouts. No page-level horizontal overflow.
- Library remained below the initial Workflow 1 viewport at all checked sizes, with the shortcut visible. A 320×568 slideshow dialog retained its full image and scrollable content.
- Confirmed no slideshow side bars: displayed image dimensions preserve the source 4:5 ratio at laptop and mobile sizes, without cropping or changing any image bytes.
- Recreate: Hooks, Wall of Text, Slideshows; category filtering and clearing; selected references; slide thumbnails; Previous/Next bounds; preview open/close; prompt retention across Image/Video; rounded composer and pill controls.
- Workflow 1: Creator selection, local video reference, hook audio/exact-recording intent, demo and background audio, narrow drawer and wide sidebar, close/reopen media readiness, Escape focus restoration and Library shortcut.
- Checked normal entry/exit animations and zero-animation/zero-transition reduced-motion behavior. No browser console errors; existing app-level font-preload warnings remain outside this change.
- Attachment/layout interactions issued no non-GET network requests. Generate stays disabled in local preview; no uploads, credits, paid jobs, renders or schedules were initiated.

These checks verify frontend layout and interactions, not production authentication, provider capabilities, audio mixing, export or publishing. Hosted end-to-end acceptance remains a later release step on the production domain.
