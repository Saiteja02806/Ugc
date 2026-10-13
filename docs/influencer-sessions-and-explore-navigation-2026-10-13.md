# Influencer sessions and Explore navigation

Implemented on 13 October 2026. The changes are local and have not been deployed.

## Behavior

- Explore workflow cards prefetch their complete destinations. Hook video, Wall of text, Slideshows, and Build AI influencer no longer await production query parameters solely for development fixtures, allowing static rendering. Talking Head retains its production preview guard and prefetches the return to Explore.
- Build AI influencer has no New session button. Consecutive batches accumulate in submission order, including after route re-entry and refresh. A settled session starts fresh after ten minutes without interaction. Typing, reference actions, and generation completion renew the activity window. Pending uploads, image jobs, selections, and uncertain generation admissions protect recovery from expiration.
- A fresh session clears the canvas, draft, and selected/uploaded reference while preserving account History and My influencers. Completed job statuses carry between batches, avoiding repeated polling of older images.
- Every completed builder image, including variations and successful candidates from a partial batch, is automatically saved to My influencers through the database completion trigger. Ordinary AI Studio images retain their existing behavior. The migration backfills older completed, unselected builder images and preserves existing names and selection dates.
- My influencers loads all saved images rather than stopping at 100. Provenance is loaded in bounded batches instead of a separate database call per image.
- The header uses rounded History and My influencers buttons. My influencers displays an image gallery. The composer places the identity/reference thumbnail beside the plus control and prompt, removes the separate identity banner and accent glow, and moves image/credit information beside Generate.

## Production audit

A read-only audit of the linked production database found nine builder jobs: eight completed images with valid ready media and one failed job. Seven completed images appeared in My influencers; one remained an unselected image. History already contained the completed candidates. This confirmed the missing automatic-save behavior.

## Verification

- 145 targeted tests passed, covering generation admission, ownership, partial batches, identity validation, more than 100 saved images, ten-minute session rollover, uploads, recovery, navigation, and database atomicity/backfill.
- Targeted ESLint and TypeScript checks passed.
- Production build passed using `next build --webpack`. Build output confirms static `/explore`, `/explore/build-character`, `/explore/hook-video`, `/explore/slideshows`, and `/explore/wall-of-text` routes.
- The real-component browser fixture passed at desktop and mobile sizes: continuous batches, automatic reset, gallery persistence, upload/paste/drop, unchanged retry receipts after refresh, inline identity thumbnail beside plus, no visible focused-composer glow, and no horizontal overflow.
- Local visual checks are stored in `.tmp/character-reference-browser/identity-desktop.png`, `identity-mobile.png`, and `library-desktop.png`.
- The production browser redirected to sign-in. Authenticated production navigation timing and post-release UI acceptance remain to be checked on `https://www.getugcpilot.com`.

## Release requirement

Deploy the web changes with `supabase/migrations/20261013143246_character_auto_save_influencer_images.sql`. The migration has been verified with the actual completion-function SQL in PGlite; it has not been applied to production. It creates the completion trigger and backfills the missing saved images. No worker deployment is required for this change.

After release, verify fast workflow transitions and confirm that the eight completed production images appear in My influencers. Verify a new builder completion appears automatically in both History and My influencers, including when leaving the workspace before completion.

Concurrent changes from other chats were preserved; this work did not commit, push, or deploy them.
