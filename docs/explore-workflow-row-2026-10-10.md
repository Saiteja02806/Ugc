# Explore workflow row — October 10, 2026

Superseded on October 11 by the user's two-row layout in
[Explore workflow grid](explore-workflow-grid-2026-10-11.md). The notes below
record the earlier horizontal-row implementation.

The fourth workflow previously wrapped onto a second row because Explore used
a three-column grid. The workflow cards now use one horizontally scrollable
row, keeping Slideshows immediately after Wall of text.

Desktop shows three cards at their existing approximate width. Containers
between 560 and 839 CSS pixels show two cards; smaller containers show one card
with part of the next card visible. Two small clickable dots replace the
horizontal scrollbar. They select the first or remaining workflows and follow
manual scrolling/resizing. Scroll snapping and a keyboard-focusable region
remain available; reduced motion disables animated jumps. Workflow destinations
and cover playback are unchanged.

Local verification used the actual Explore page and navigation shell:

- At 1366 × 768, all four cards share the same top position and are about
  395 CSS pixels wide. Horizontal scrolling reveals the complete Slideshow card.
- At 1536 × 864, cards are about 452 CSS pixels wide. Keyboard navigation reaches
  Slideshow and returns to Talking Head + Demo with the row scrolled to its start.
- At 390 × 844, all four cards remain in one row, with a readable 291-pixel card
  and the next card peeking into view. Keyboard navigation reaches Slideshow.
- The page itself has no horizontal overflow at these widths.
- Clicking Slideshow opened its existing Create/Edit slides/Schedule workspace
  in the development preview. Browser logs contained no errors or warnings.
- TypeScript, ESLint, and the changed-file whitespace check passed.

The dot refinement was checked at both laptop widths: exactly two 6-pixel dots
are rendered, the second reveals the complete Slideshow card, and the first
returns to the start. Keyboard activation also works. Both standard and WebKit
scrollbar styles resolve to hidden on this row.

These changes are local and have not been deployed.

![Two small dots below the workflow row](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-workflow-dots-15inch.jpg)
