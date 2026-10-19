# Reusable backgrounds for existing Trending slideshows

Implemented locally on 19 October 2026. No deployment or production data change.

## Approved user flow

1. Settings → Media library → New collection. Name it, for example Nature backgrounds.
2. Upload into that collection, or select existing images, expand Organize selected
   images, choose the destination collection and Add to collection.
3. Open the desired slideshow on Trending → Edit → Choose backgrounds from library.
4. Choose one image for This slide, or choose All slides and select multiple images
   in the desired order. Use collection selects the entire collection in its saved
   order. Images repeat from the beginning if there are more slides than images.
5. Preview backgrounds shows the actual proposed slide composition. Previous/Next
   reviews affected slides. Use these backgrounds confirms the editor change.
6. Save the existing creative normally. Its text, text styling, slide identities,
   order and original-image references remain. Existing revision/render handling
   refreshes that same Trending creative; this does not create another slideshow.

Library management never implicitly changes a saved post. The header pill says
Manage library, and the manager explains the edit path. Removed the attempted
separate Explore URL/import flow. Existing Explore picker integrations remain.

## Clarity and safety

- Selection and preview use the full picker width. Removed the side panel and
  up/down ordering buttons. Selection order is visible as numbered checks only on
  selected tiles. Collection use is above the grid, beside the collection name.
- Background confirmation is available after opening the preview. It rechecks
  source ownership/readiness/archive state before the existing atomic callback.
  Failed source checks and Cancel leave the accepted draft unchanged.
- Selection persists through management. Done returns to the picker; management
  states explicitly that library changes save automatically. Organizing images
  stays distinct from changing a slideshow's backgrounds.
- Browsing thumbnails fill the frame without empty side strips. Image bytes and
  actual slideshow crop/composition behavior are unchanged. Native scrollbar
  arrows are suppressed within library dialogs; scrolling remains available.
- Long names wrap on phones. Dialog transitions exclude width/height so resizing
  cannot briefly grow the modal outside the viewport.

## Validation

Application TypeScript, scoped ESLint and 82 focused regression checks pass.
Both browser runners below pass with isolated APIs. The regression runner uses
the repository's next-server-only test loader and module-mocking flag.

- The shared library browser fixture covers collection creation, membership and
  direct collection uploads, single/multiple background selection, collection
  order/repeats, preview/cancel, failed source verification, retained selection,
  archive/restore, retries, music upload/reuse and keyboard interaction.
- Desktop/laptop checks include 1366×680, 1366×768 and 1536×864. Mobile checks
  include 390×844 and 320×640 with a 32-image collection and an 80-character name.
- The actual Trending editor browser fixture verifies preview/cancel without
  saved changes; Use without saving; one normal PATCH to the same creative,
  assignment and edit ID; revision advancement; preserved headline/subtext/CTA,
  text style/position, original images, slide IDs/order; and successful reopen.
- Fixtures isolate authentication and APIs. They do not publish, schedule or
  mutate production. Final acceptance requires a signed-in deployed-site check.

Browser runners: scripts/media-library.browser.cjs and
scripts/trending-carousel-text.browser.cjs. Screenshots are in
.tmp/media-library-browser/ and .tmp/trending-carousel-text/library-background-preview.png.
Focused regression output: .tmp/library-trending-regressions.log.
