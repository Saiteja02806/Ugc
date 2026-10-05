# Explore UI verification — 5 October 2026

Baseline: `53e70c8071019757f8b7a6ba1dc9c443565d2e3b`.
Branch: `codex/explore-duration-demo-polish` in the safe reconciliation checkout.
This update is not yet committed, pushed, or deployed. Unrelated changes in the original desktop checkout were preserved.

## Implemented

- Create Hook and Creator Phone share presets 5/10/15/20/30 seconds, filtered by each model's existing API contract, plus a validated Custom dialog. Cancel preserves the confirmed value. Kling's discrete supported values are preserved.
- Both workflows label section 2 **Edited demo**, without changing section identity, original sound, demo-only background audio, or combined subtitles.
- Instagram and YouTube can remain selected together. Each needs an explicit connected account with existing publishing permissions. The existing confirmation editor receives both targets. Exact-request recovery remains intact and partial acknowledgements are rejected.
- Landing **Start Posting** points to Explore. The signed-out hero carries an allowlisted Explore sign-in continuation; paid checkout intent still takes precedence.
- Recreate browsing no longer has a subscription gate. Catalogue authentication and generation access/credit checks remain intact. Settings are compact inline pills with a scrolling chevron. The composer is shorter and first-use guidance explains reference selection and recreation. Existing format order, category mixing, selection, and draggable splitter are preserved.

## Media repair

The imported catalogue was `staged`, so the authenticated API correctly excluded it. Removing the free-user UI gate alone would not restore slideshows.

The existing guarded importer uploaded/verified 342 approved assets under `gs://ugcsaas-media/explore/recreate/v1/`, then marked the catalogue `published`. It checks existing size/type, refuses incompatible overwrites, and verifies every upload. No objects were deleted or bucket permissions changed.

A public HEAD check covered 494 distinct media URLs used by the catalogue: **494 accessible; zero failures**. Cloud assets are ready, but the updated catalogue and UI still require an app deployment.

## Verification

- Application TypeScript (`--noEmit --incremental false`): passed.
- ESLint across changed TS/TSX and new components/helpers (`--max-warnings=0`): passed.
- `git diff --check`: passed.
- Full offline Explore regression suite, serial with the repository test loader/module mocks: **345 passed; zero failed**.
- Four new tests exercise the actual Custom control, including Apply/Enter validation, Cancel, accessible confirmed seconds, and discrete model limits: **4 passed**.
- Final targeted rerun after the duration accessibility refinement: **47 passed**. These overlap the above tests, not additional unique coverage.
- After refining the return chevron to restore the first pill rather than trapping navigation mid-rail, **23 related tests passed** and lint remained clean. Browser geometry confirmed a return to `scrollLeft: 0`.
- An earlier concurrent run had a native video-finishing test-process failure. All eight isolated media-finishing tests and the full serial suite passed. No worker/rendering code was changed to mask it.
- Browser preview: menus, Edited demo and simultaneous platform selection verified for workflows 1 and 3. Recreate's three formats populated; chevron and reference/slide selection verified. Narrow-screen layout had no horizontal page overflow or broken visible images. Recreate and Creator Phone browser error logs were empty.

No database migrations, worker changes, production credential/access changes, paid generation calls, or social posts were made. This new update has not had authenticated production acceptance or real publication testing. Local previews intentionally disable spending.

Review screenshots: `C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-ui-review-20261005/` (`duration.jpg`, `schedule.jpg`, `phone-duration.jpg`, `phone-edited-demo.jpg`, `phone-schedule.jpg`, `recreate.jpg`, `recreate-mobile.jpg`). These are generated review artifacts, not application assets.

## Follow-up: balanced Recreate layout

- The editor now defaults to 32% of available desktop space, bounded to 320–420px. Manual resizing retains its existing 220–560px limits and gallery-space protection.
- The Recreate gallery is capped at three columns, switching to two when its own container is narrower than 660px. Other workflows' grids are unchanged.
- Gallery posters and hover videos fill their cards with `object-cover`, without stretching. This can crop the thumbnail edges. Opened previews retain `object-contain`, original dimensions, and the complete source image/video. No source assets were edited.
- Browser measurements at a 1280px viewport: editor 347px (previously 220px), three columns. At 1920px: editor 420px, still three columns. Mobile 390px: two columns, hidden splitter, no horizontal page overflow. Temporary viewport overrides were reset.
- Dragging, keyboard limits, and Enter reset verified. Selected reference and typed prompt survived resizing. Full preview proportions matched the original. Test selection/prompt were cleared after verification; no generation was submitted.
- 30 related offline tests passed. TypeScript, ESLint and whitespace checks passed. The optimized production build passed with the existing public Firebase client configuration supplied to the build process only. An initial build without that configuration compiled but failed Firebase prerender initialization; no application workaround or private environment-file copy was made.
- Browser error log was empty. Screenshot: `recreate-balanced.jpg` in the review directory above.

These follow-up changes are local and uncommitted; they have not been pushed or deployed. Authenticated production acceptance remains pending deployment.

## Follow-up: compact Recreate composer

- The chat box is inset by 8px on each side of its existing space and capped at 340px. When the desktop editor is narrowed below 300px, it uses the full available inner width instead.
- Compact prompts now grow from 40px to 72px. Standard and non-compact unified generators retain their previous sizing. Selected-reference context still expands normally.
- The footer uses one row for the reference control, scrollable setting pills, chevron, and Generate button. Below a 300px editor width it stacks instead of squeezing the controls.
- Setting pills are 24px high; Generate and attachment buttons are 28px high. Labels, focus treatment, settings handlers, validation, and paid-generation locking are retained. Panel balance and the three-column gallery are unchanged.
- 59 targeted tests passed, including three tests executing the real composer with isolated React/textarea mocks. TypeScript, ESLint, the optimized production build, and read-only Git whitespace checks passed.
- Two pre-existing static assertions were outdated before this change: the old compact height and an assumption that quantity `disabled` immediately followed its label. Assertions now check the requested sizing and the actual quantity control's unchanged disabling condition.
- Browser binding was blocked by the browser safety policy. No alternate browser, indirect browser command, or synthetic screenshot was used. Visual layout acceptance and a new screenshot remain unverified; `recreate-balanced.jpg` shows the preceding layout, not this compact-composer update.

The user requested an image of this latest update. A fresh browser capture still requires access to a user-opened preview tab. No commit, push, deployment, media generation, or social publication occurred.
